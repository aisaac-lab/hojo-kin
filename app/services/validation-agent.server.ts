import { ReviewAgentService } from './review-agent.server';
import { AssistantService } from './assistant.service';
import type { 
  ValidationResult, 
  ValidationLoop, 
  ValidationConfig, 
  ValidationContext,
  ProgressiveHint 
} from '~/types/validation';
import type { ReviewResult, ReviewContext } from '~/types/review';

export class ValidationAgentService extends ReviewAgentService {
  private defaultConfig: ValidationConfig = {
    maxLoops: parseInt(process.env.MAX_VALIDATION_LOOPS || '2'), // Reduced from 3 to 2
    scoreImprovementThreshold: parseInt(process.env.SCORE_IMPROVEMENT_THRESHOLD || '15'), // Increased from 10 to 15
    enableProgressiveHints: process.env.ENABLE_PROGRESSIVE_HINTS !== 'false',
    enableFailureAnalysis: process.env.ENABLE_FAILURE_ANALYSIS !== 'false',
    enableLogging: process.env.ENABLE_VALIDATION_LOGGING !== 'false',
  };

  constructor(config?: Partial<ValidationConfig>) {
    super();
    this.defaultConfig = { ...this.defaultConfig, ...config };
  }

  /**
   * AIレスポンスを検証し、必要に応じてフィードバックループを実行
   */
  async validateWithFeedbackLoop(
    userQuestion: string,
    initialResponse: string,
    threadId: string,
    assistantService: AssistantService,
    context?: ReviewContext,
    additionalInstructions?: string
  ): Promise<ValidationResult> {
    const startTime = Date.now();
    const loops: ValidationLoop[] = [];
    const failurePatterns: string[] = [];
    const successPatterns: string[] = [];
    
    let currentResponse = initialResponse;
    let bestResponse = initialResponse;
    let bestScores = { relevance: 0, completeness: 0, dataAccuracy: 0, followUp: 0 };
    let previousScores = { relevance: 0, completeness: 0, dataAccuracy: 0, followUp: 0 };
    
    // 重複チェックを追加
    const hasDuplicates = this.checkForDuplicateSubsidies(currentResponse);
    if (hasDuplicates) {
      failurePatterns.push('Initial response contains duplicate subsidies');
    }
    
    // フィードバックループの実行
    for (let loopNum = 1; loopNum <= this.defaultConfig.maxLoops; loopNum++) {
      if (this.defaultConfig.enableLogging) {
        console.log(`[VALIDATION] Starting loop ${loopNum}/${this.defaultConfig.maxLoops}`);
      }

      // 現在のレスポンスを検証
      const validationContext: ValidationContext = {
        hasFilters: context?.hasFilters || false,
        previousMessages: context?.previousMessages || [],
        mentionedSubsidies: context?.mentionedSubsidies || [],
        filters: context?.filters || {},
        currentLoop: loopNum,
        previousLoops: loops,
        config: this.defaultConfig,
      };

      const reviewResult = await this.reviewResponse(
        userQuestion,
        currentResponse,
        validationContext
      );
      
      // 重複チェックを各ループで実行
      const currentHasDuplicates = this.checkForDuplicateSubsidies(currentResponse);
      if (currentHasDuplicates && reviewResult.scores.dataAccuracy > 50) {
        // 重複がある場合はdataAccuracyスコアを下げる
        reviewResult.scores.dataAccuracy = Math.min(reviewResult.scores.dataAccuracy, 50);
        reviewResult.lowestScore = { category: 'dataAccuracy', score: reviewResult.scores.dataAccuracy };
        reviewResult.action = 'regenerate';
        reviewResult.regenerationHints = reviewResult.regenerationHints || [];
        reviewResult.regenerationHints.push('同じ補助金を重複して提案しています。各補助金は一度だけ提案してください');
        reviewResult.issues = reviewResult.issues || [];
        reviewResult.issues.push({
          type: 'data_source',
          description: '回答に重複した補助金が含まれています',
          severity: 'critical'
        });
      }

      // スコアの改善を計算
      const currentTotalScore = this.calculateTotalScore(reviewResult.scores);
      const previousTotalScore = this.calculateTotalScore(previousScores);
      const scoreImprovement = currentTotalScore - previousTotalScore;

      // 最良のスコアを更新
      if (currentTotalScore > this.calculateTotalScore(bestScores)) {
        bestScores = reviewResult.scores;
        bestResponse = currentResponse;
      }

      // ループ結果を記録
      const loop: ValidationLoop = {
        loopNumber: loopNum,
        reviewResult,
        improvementHints: reviewResult.regenerationHints || [],
        scoreImprovement,
        timestamp: new Date(),
      };
      loops.push(loop);

      // 成功パターンと失敗パターンを分析
      if (reviewResult.passed) {
        successPatterns.push(`Loop ${loopNum}: All scores >= 70`);
        if (this.defaultConfig.enableLogging) {
          console.log(`[VALIDATION] Loop ${loopNum} PASSED with scores:`, reviewResult.scores);
        }
        break; // 合格したらループを終了
      }

      // Early exit if scores are already very high (average >= 85)
      const avgScore = Object.values(reviewResult.scores).reduce((a, b) => a + b, 0) / 4;
      if (avgScore >= 85 && reviewResult.lowestScore.score >= 65) {
        if (this.defaultConfig.enableLogging) {
          console.log(`[VALIDATION] Early exit: High average score ${avgScore.toFixed(1)}`);
        }
        successPatterns.push(`Loop ${loopNum}: High average score (${avgScore.toFixed(1)})`);
        break;
      }

      // 失敗パターンを記録
      const failureReason = `Loop ${loopNum}: ${reviewResult.lowestScore.category} = ${reviewResult.lowestScore.score}`;
      failurePatterns.push(failureReason);

      // 最終ループまたは改善が見られない場合は終了
      if (loopNum === this.defaultConfig.maxLoops || 
          (loopNum > 1 && scoreImprovement < this.defaultConfig.scoreImprovementThreshold)) {
        if (this.defaultConfig.enableLogging) {
          console.log(`[VALIDATION] Ending loops. Final loop: ${loopNum}, Improvement: ${scoreImprovement}`);
        }
        break;
      }
      
      // Early exit if no significant improvement is possible
      if (loopNum > 1 && scoreImprovement < 5 && avgScore >= 75) {
        if (this.defaultConfig.enableLogging) {
          console.log(`[VALIDATION] Early exit: Diminishing returns (improvement: ${scoreImprovement})`);
        }
        break;
      }

      // 再生成が必要な場合
      if (reviewResult.action === 'regenerate') {
        // プログレッシブヒントの生成
        const progressiveHints = this.generateProgressiveHints(
          loopNum,
          reviewResult,
          loops,
          failurePatterns
        );

        // 改善指示を含めて再生成
        const regenerationInstructions = this.buildRegenerationInstructions(
          reviewResult,
          progressiveHints,
          loops
        );

        if (this.defaultConfig.enableLogging) {
          console.log(`[VALIDATION] Regenerating with progressive hints level ${loopNum}`);
        }

        // アシスタントに再生成を依頼
        const regeneratedResult = await assistantService.runAssistant(
          threadId,
          (additionalInstructions || '') + regenerationInstructions
        );

        // 新しいレスポンスを取得
        currentResponse = this.extractLatestAssistantMessage(regeneratedResult);
        previousScores = reviewResult.scores;
        
        // 中間応答であることをログに記録
        console.log(`[VALIDATION] Generated intermediate response for loop ${loopNum}`);
        if (this.defaultConfig.enableLogging) {
          console.log(`[VALIDATION] Intermediate response length: ${currentResponse.length} chars`);
          console.log(`[VALIDATION] Loop ${loopNum} score:`, reviewResult.scores);
        }
      } else {
        // ask_clarification または approve の場合はループを終了
        break;
      }
    }

    // 最終的な検証結果を構築
    const finalLoop = loops[loops.length - 1];
    const totalImprovement = this.calculateTotalScore(bestScores) - 
                           this.calculateTotalScore(loops[0].reviewResult.scores);

    const validationResult: ValidationResult = {
      ...finalLoop.reviewResult,
      loops,
      finalLoop: loops.length,
      totalImprovement,
      bestResponse,
      bestScores,
      failurePatterns,
      successPatterns,
    };

    const totalDuration = Date.now() - startTime;
    if (this.defaultConfig.enableLogging) {
      console.log(`[VALIDATION] Completed in ${totalDuration}ms with ${loops.length} loops`);
      console.log(`[VALIDATION] Total improvement: ${totalImprovement} points`);
    }

    return validationResult;
  }

  /**
   * プログレッシブヒントを生成
   */
  private generateProgressiveHints(
    loopNumber: number,
    currentResult: ReviewResult,
    previousLoops: ValidationLoop[],
    failurePatterns: string[]
  ): ProgressiveHint {
    const level = Math.min(loopNumber, 3) as 1 | 2 | 3;
    const hints: string[] = [];
    const examples: string[] = [];
    let template: string | undefined;

    // レベル1: 基本的な改善指示
    if (level >= 1) {
      hints.push('ユーザーの質問に直接的に回答してください');
      hints.push('必要な情報をすべて含めてください');
      hints.push('正確なデータを使用してください');
      hints.push('【重要】同じ補助金を重複して提案しないでください。各補助金は一度だけ提案してください');
      
      if (currentResult.lowestScore.category === 'dataAccuracy') {
        hints.push('subsidies-master.jsonから正確にデータを抽出してください');
        hints.push('複数の異なる補助金を提案してください');
        hints.push('補助金名とIDが異なることを確認してください');
      }
    }

    // レベル2: 具体例を含む詳細な指示
    if (level >= 2) {
      examples.push('冒頭: 「申請可能な補助金は○○件です。」');
      examples.push('各補助金に: （マッチ度: 85点/100点）内訳：地域(30/30)...');
      
      // 失敗パターンに基づく具体的な指示
      if (failurePatterns.some(p => p.includes('dataAccuracy'))) {
        hints.push('検索キーワードを拡張してください（例：「スタートアップ」→「創業,起業,新事業」）');
        hints.push('categoriesフィールドも検索対象に含めてください');
      }
      
      if (failurePatterns.some(p => p.includes('completeness'))) {
        hints.push('必ず5件の補助金を提案してください（3-4件では不十分）');
        hints.push('各補助金について詳細な説明を含めてください');
      }
    }

    // レベル3: 完全なテンプレートと詳細な例
    if (level >= 3) {
      template = this.getResponseTemplate();
      
      // 繰り返し失敗しているカテゴリーに特化した指示
      const recurringFailures = this.analyzeRecurringFailures(previousLoops);
      for (const [category, count] of Object.entries(recurringFailures)) {
        if (count >= 2) {
          hints.push(`${category}の改善に特に注意してください（${count}回失敗）`);
        }
      }
      
      // 成功した部分を維持する指示
      const successAreas = this.identifySuccessAreas(currentResult.scores);
      if (successAreas.length > 0) {
        hints.push(`以下の項目は良好です、維持してください: ${successAreas.join(', ')}`);
      }
    }

    return { level, hints, examples, template };
  }

  /**
   * 再生成用の指示を構築
   */
  private buildRegenerationInstructions(
    reviewResult: ReviewResult,
    progressiveHints: ProgressiveHint,
    previousLoops: ValidationLoop[]
  ): string {
    let instructions = `
【再生成理由】
${reviewResult.lowestScore.category}のスコアが${reviewResult.lowestScore.score}点でした。

【改善が必要な項目】
`;

    // 70点未満の項目をリストアップ
    for (const [category, score] of Object.entries(reviewResult.scores)) {
      if (score < 70) {
        instructions += `- ${category}: ${score}点\n`;
      }
    }

    instructions += `
【レベル${progressiveHints.level}の改善指示】
${progressiveHints.hints.map(h => `- ${h}`).join('\n')}
`;

    if (progressiveHints.examples && progressiveHints.examples.length > 0) {
      instructions += `
【具体例】
${progressiveHints.examples.map(e => `- ${e}`).join('\n')}
`;
    }

    if (progressiveHints.template) {
      instructions += `
【推奨テンプレート】
${progressiveHints.template}
`;
    }

    // 過去の失敗から学んだ注意点
    if (previousLoops.length > 0) {
      instructions += `
【過去の試行からの注意点】
`;
      previousLoops.forEach((loop, idx) => {
        if (loop.reviewResult.lowestScore.score < 70) {
          instructions += `- 試行${idx + 1}: ${loop.reviewResult.lowestScore.category}で失敗\n`;
        }
      });
    }

    instructions += `
上記の点を改善して、再度回答を生成してください。
特に${reviewResult.lowestScore.category}の改善に重点を置いてください。
`;

    return instructions;
  }

  /**
   * レスポンステンプレートを取得
   */
  private getResponseTemplate(): string {
    return `
【推奨回答構造】
1. 冒頭（必須）
   「申請可能な補助金は○○件です。」
   「補助金の一部として以下のようなものがあります。」

2. 補助金リスト（必ず5件）
   各補助金の形式：
   
   **1. 補助金名**（マッチ度: ○○点/100点）
   内訳：地域(○/○)、カテゴリー(○/○)、金額(○/○)、企業規模(○/○)、その他(○/10)
   - 対象者：具体的な条件
   - 補助金額：上限○○万円（補助率○/○）
   - 対象経費：具体的な使途
   - 申請期限：○月○日まで
   - なぜ適しているか：ユーザーの状況に合わせた理由
   - [公式サイトで詳細を見る](front_subsidy_detail_page_urlの値)

3. 締めくくり（必須）
   「より最適な補助金をご提案するため、以下について教えていただけますか？」
   - 質問1
   - 質問2
   - 質問3
`;
  }

  /**
   * スコアの合計を計算
   */
  private calculateTotalScore(scores: ReviewResult['scores']): number {
    return Object.values(scores).reduce((sum, score) => sum + score, 0);
  }

  /**
   * 最新のアシスタントメッセージを抽出
   */
  private extractLatestAssistantMessage(result: any): string {
    for (const msg of result.messages.data) {
      if (msg.role === "assistant" && msg.content[0]?.type === "text") {
        return msg.content[0].text.value;
      }
    }
    return "";
  }

  /**
   * 繰り返し失敗しているカテゴリーを分析
   */
  private analyzeRecurringFailures(loops: ValidationLoop[]): Record<string, number> {
    const failures: Record<string, number> = {};
    
    loops.forEach(loop => {
      if (loop.reviewResult.lowestScore.score < 70) {
        const category = loop.reviewResult.lowestScore.category;
        failures[category] = (failures[category] || 0) + 1;
      }
    });
    
    return failures;
  }

  /**
   * 成功している領域を特定
   */
  private identifySuccessAreas(scores: ReviewResult['scores']): string[] {
    const successAreas: string[] = [];
    
    for (const [category, score] of Object.entries(scores)) {
      if (score >= 85) {
        successAreas.push(category);
      }
    }
    
    return successAreas;
  }

  /**
   * 補助金の重複をチェック
   */
  private checkForDuplicateSubsidies(response: string): boolean {
    // 補助金名を抽出（**で囲まれた部分）
    const subsidyNamePattern = /\*\*([^*]+)\*\*/g;
    const subsidyNames: string[] = [];
    let match;
    
    while ((match = subsidyNamePattern.exec(response)) !== null) {
      const subsidyName = match[1].trim();
      // 補助金名らしいものを抽出（番号付きのものは除外）
      if ((subsidyName.includes('補助金') || subsidyName.includes('助成金') || 
           subsidyName.includes('支援') || subsidyName.includes('事業')) &&
          !subsidyName.match(/^\d+\./)) {
        subsidyNames.push(subsidyName);
      }
    }
    
    // 重複チェック
    const uniqueNames = new Set(subsidyNames);
    const hasDuplicates = uniqueNames.size < subsidyNames.length;
    
    if (hasDuplicates && this.defaultConfig.enableLogging) {
      const duplicates = subsidyNames.filter((name, index) => 
        subsidyNames.indexOf(name) !== index
      );
      console.log('[VALIDATION] Duplicate subsidies detected:', duplicates);
    }
    
    return hasDuplicates;
  }

  /**
   * レビュー用のプロンプトを拡張（重複チェックを含む）
   */
  protected buildReviewPrompt(
    userQuestion: string,
    assistantResponse: string,
    context?: ReviewContext | ValidationContext
  ): string {
    const basePrompt = super.buildReviewPrompt(userQuestion, assistantResponse, context);
    
    // 重複チェック結果を追加
    const hasDuplicates = this.checkForDuplicateSubsidies(assistantResponse);
    const duplicateInfo = hasDuplicates 
      ? '\n【警告】回答に重複した補助金が含まれています。'
      : '\n【確認】補助金の重複はありません。';
    
    return basePrompt + duplicateInfo;
  }
}