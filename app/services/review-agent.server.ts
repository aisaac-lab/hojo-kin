import OpenAI from 'openai';
import type { ReviewResult, ReviewContext } from '~/types/review';

export class ReviewAgentService {
	private openai: OpenAI;
	private subsidiesData: any[] = [];

	constructor() {
		this.openai = new OpenAI({
			apiKey: process.env.OPENAI_API_KEY,
		});
		this.loadSubsidiesData();
	}

	private async loadSubsidiesData() {
		try {
			// メモリ効率のため、必要最小限のデータのみ読み込む
			const fs = await import('fs/promises');
			const path = await import('path');

			// マスターインデックスのみを読み込む（軽量）
			const indexPath = path.join(
				process.cwd(),
				'data/subsidies/index/master-index.json'
			);
			
			try {
				const indexData = await fs.readFile(indexPath, 'utf-8');
				const indexJson = JSON.parse(indexData);
				
				// インデックスから補助金名のリストを作成
				this.subsidiesData = Object.values(indexJson).map((subsidy: any) => ({
					id: subsidy.id,
					name: subsidy.name,
					summary: subsidy.summary
				}));
				
				console.log(
					`[ReviewAgent] Loaded ${this.subsidiesData.length} subsidies from index`
				);
			} catch (indexError) {
				// インデックスが存在しない場合は、最小限のデータを読み込む
				console.warn('[ReviewAgent] Index not found, loading minimal data');
				
				// 検索用メタデータのみ読み込む（より軽量）
				const metadataPath = path.join(
					process.cwd(),
					'data/subsidies/search-optimized/search-metadata.json'
				);
				
				const metadataData = await fs.readFile(metadataPath, 'utf-8');
				const metadata = JSON.parse(metadataData);
				
				// 補助金名のリストを作成
				this.subsidiesData = metadata.subsidies || [];
			}
		} catch (error) {
			console.error('[ReviewAgent] Error loading subsidies data:', error);
			// フォールバック: 固定の補助金リストを使用
			this.subsidiesData = [
				{ id: 'fallback', name: 'データ読み込みエラー', summary: '' }
			];
		}
	}

	async reviewResponse(
		userQuestion: string,
		assistantResponse: string,
		context?: ReviewContext
	): Promise<ReviewResult> {
		// データ検証を含むレビュープロンプトを構築
		const reviewPrompt = this.buildReviewPrompt(
			userQuestion,
			assistantResponse,
			context
		);

		// 提案された補助金を抽出して検証
		const extractedSubsidies =
			this.extractSubsidiesFromResponse(assistantResponse);
		const validationResults = this.validateSubsidies(extractedSubsidies);

		try {
			const completion = await this.openai.chat.completions.create({
				model: process.env.OPENAI_REVIEW_MODEL || 'gpt-4-turbo-preview',
				messages: [
					{ role: 'system', content: this.getReviewerInstructions() },
					{ role: 'user', content: reviewPrompt },
					{
						role: 'assistant',
						content: `データ検証結果:\n${JSON.stringify(
							validationResults,
							null,
							2
						)}`,
					},
				],
				response_format: { type: 'json_object' },
				temperature: 0.1, // 低温度で一貫性のある評価
			});

			const parsedResult = JSON.parse(
				completion.choices[0].message.content || '{}'
			);

			// 特別チェック項目の実装
			const subsidyCountMatch = assistantResponse.match(/申請可能な補助金は(\d+)件です/);
			const proposedCount = subsidyCountMatch ? parseInt(subsidyCountMatch[1]) : extractedSubsidies.length;
			
			// 「全て」「すべて」「一覧」などの要求チェック
			const isAllRequest = /全て|すべて|全部|一覧|列挙/.test(userQuestion);
			const isITRequest = /IT|デジタル|DX|システム|ソフトウェア/.test(userQuestion);
			
			// IT関連の全て要求の場合、10件あれば十分（実際に10件しか存在しないため）
			if (isAllRequest && isITRequest && proposedCount < 8) {
				parsedResult.scores.dataAccuracy = Math.min(parsedResult.scores.dataAccuracy || 0, 60);
				parsedResult.action = 'regenerate';
				parsedResult.issues = parsedResult.issues || [];
				parsedResult.issues.push({
					type: 'data_source',
					description: `IT関連の全て列挙要求に対して提案件数が少なすぎます（${proposedCount}件のみ）`,
					severity: 'critical'
				});
				parsedResult.regenerationHints = parsedResult.regenerationHints || [];
				parsedResult.regenerationHints.push('IT関連補助金は10件存在します。最低でも8件以上を提示してください');
			}
			// IT以外の全て要求の場合
			else if (isAllRequest && !isITRequest && proposedCount < 10) {
				parsedResult.scores.dataAccuracy = Math.min(parsedResult.scores.dataAccuracy || 0, 25);
				parsedResult.action = 'regenerate';
				parsedResult.issues = parsedResult.issues || [];
				parsedResult.issues.push({
					type: 'data_source',
					description: `全て列挙の要求に対して提案件数が少なすぎます（${proposedCount}件のみ）`,
					severity: 'critical'
				});
				parsedResult.regenerationHints = parsedResult.regenerationHints || [];
				parsedResult.regenerationHints.push('最低でも20件以上の補助金を検索・提示してください。複数のカテゴリーを横断的に検索してください');
			}
			
			// IT関連の質問チェック
			if (isITRequest && proposedCount <= 5) {
				parsedResult.scores.dataAccuracy = Math.min(parsedResult.scores.dataAccuracy || 0, 35);
				parsedResult.action = 'regenerate';
				parsedResult.issues = parsedResult.issues || [];
				parsedResult.issues.push({
					type: 'data_source',
					description: `IT関連補助金の提案件数が少なすぎます（${proposedCount}件のみ）`,
					severity: 'critical'
				});
				parsedResult.regenerationHints = parsedResult.regenerationHints || [];
				parsedResult.regenerationHints.push('digitalization以外のカテゴリー（startup、expansion等）からもIT企業が活用できる補助金を探してください');
			}

			// データ検証結果を反映
			if (validationResults.hasInvalidSubsidies) {
				parsedResult.scores.dataAccuracy = Math.min(
					parsedResult.scores.dataAccuracy || 0,
					40
				);
				parsedResult.action = 'regenerate';
				parsedResult.issues = parsedResult.issues || [];
				parsedResult.issues.push({
					type: 'data_source',
					description: `実在しない補助金が含まれています: ${validationResults.invalidSubsidies.join(
						', '
					)}`,
					severity: 'critical',
				});
			}

			if (validationResults.hasIncorrectDetails) {
				parsedResult.scores.dataAccuracy = Math.min(
					parsedResult.scores.dataAccuracy || 0,
					60
				);
				if (parsedResult.action !== 'regenerate') {
					parsedResult.action = 'regenerate';
				}
				parsedResult.issues = parsedResult.issues || [];
				parsedResult.issues.push({
					type: 'data_source',
					description: '補助金の詳細情報（金額、条件等）に誤りがあります',
					severity: 'critical',
					example: validationResults.incorrectDetails.join('; '),
				});
			}

			// デフォルト値を設定
			const scores = {
				relevance: parsedResult.scores?.relevance || 0,
				completeness: parsedResult.scores?.completeness || 0,
				dataAccuracy: parsedResult.scores?.dataAccuracy || 0,
				followUp: parsedResult.scores?.followUp || 0,
				presentationQuality: parsedResult.scores?.presentationQuality || 0,
			};
			
			// 最低スコアを計算
			const scoreEntries = Object.entries(scores);
			const lowestScoreEntry = scoreEntries.reduce((min, [category, score]) => 
				score < min.score ? { category, score } : min,
				{ category: scoreEntries[0][0], score: scoreEntries[0][1] }
			);
			
			const threshold = parseInt(process.env.REVIEW_SCORE_THRESHOLD || '85');
			const passed = Object.values(scores).every(score => score >= threshold);
			
			const result: ReviewResult = {
				passed,
				scores,
				lowestScore: lowestScoreEntry,
				action: parsedResult.action || 'regenerate',
				issues: parsedResult.issues || [],
				clarificationQuestions: parsedResult.clarificationQuestions || [],
				regenerationHints: parsedResult.regenerationHints || [],
				improvedResponse: parsedResult.improvedResponse,
			};

			// 結果を記録
			console.log('[ReviewAgent] Review Result:', {
				action: result.action,
				scores: result.scores,
				dataValidation: validationResults,
			});

			return result;
		} catch (error) {
			console.error('[ReviewAgent] Error during review:', error);
			throw error;
		}
	}

	private extractSubsidiesFromResponse(
		response: string
	): Array<{ name: string; amount?: string; url?: string }> {
		const subsidies: Array<{ name: string; amount?: string; url?: string }> =
			[];

		// 補助金名のパターン（「」で囲まれた部分、【】で囲まれた部分、**で囲まれた部分、番号付きリスト）
		const patterns = [
			/「([^」]+(?:補助金|助成金|支援金|事業|基金)[^」]*)」/g,
			/【([^】]+(?:補助金|助成金|支援金|事業|基金)[^】]*)】/g,
			/\*\*([^*]+(?:補助金|助成金|支援金|事業|基金)[^*]*)\*\*/g,
			/^\d+\.\s*\*\*([^*]+(?:補助金|助成金|支援金|事業|基金)[^*]*)\*\*/gm,
			/^\d+\.\s+(.+(?:補助金|助成金|支援金|事業|基金)[^（\n]*)/gm,
		];

		patterns.forEach((pattern) => {
			const matches = response.matchAll(pattern);
			for (const match of matches) {
				try {
					// 補助金名から余分な*を削除
					const name = match[1].trim().replace(/\*+$/, '').replace(/^\*+/, '');
					
					// 正規表現で使用する際にエスケープ
					const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

					// 金額を抽出
					const amountMatch = response.match(
						new RegExp(`${escapedName}[^\\n]*?([\\d,]+万?円|最大[\\d,]+万?円)`)
					);
					const amount = amountMatch ? amountMatch[1] : undefined;

					// URLを抽出
					const urlMatch = response.match(
						new RegExp(`${escapedName}[^\\n]*?(https?://[^\\s\\)]+)`)
					);
					const url = urlMatch ? urlMatch[1] : undefined;

					subsidies.push({ name, amount, url });
				} catch (err) {
					console.warn(`[ReviewAgent] Failed to extract subsidy info for: ${match[0]}`, err);
					continue;
				}
			}
		});

		// 重複を除去
		const uniqueSubsidies = subsidies.filter(
			(item, index, self) =>
				index === self.findIndex((t) => t.name === item.name)
		);

		console.log(`[ReviewAgent] Extracted ${uniqueSubsidies.length} unique subsidies`);
		if (uniqueSubsidies.length > 0) {
			console.log('[ReviewAgent] Sample extracted subsidy:', uniqueSubsidies[0]);
		}

		return uniqueSubsidies;
	}

	private validateSubsidies(
		extractedSubsidies: Array<{ name: string; amount?: string; url?: string }>
	): {
		hasInvalidSubsidies: boolean;
		invalidSubsidies: string[];
		hasIncorrectDetails: boolean;
		incorrectDetails: string[];
		duplicateCount: number;
	} {
		const invalidSubsidies: string[] = [];
		const incorrectDetails: string[] = [];
		const seenNames = new Set<string>();
		let duplicateCount = 0;

		extractedSubsidies.forEach((subsidy, index) => {
			// 重複チェック
			if (seenNames.has(subsidy.name)) {
				duplicateCount++;
			}
			seenNames.add(subsidy.name);

			// デバッグ: 最初の3件の補助金名を表示
			if (index < 3) {
				console.log(`[ReviewAgent] Checking subsidy ${index + 1}: "${subsidy.name}"`);
			}

			// 実在性チェック（簡略化してメモリ効率を改善）
			const found = this.subsidiesData.find((data) => {
				// 名前の正規化
				const subsidyNameNormalized = subsidy.name.toLowerCase().trim();
				const dataNameNormalized = (data.name || '').toLowerCase().trim();
				
				// 完全一致のみチェック（部分一致は省略してメモリ節約）
				return dataNameNormalized === subsidyNameNormalized;
			});

			if (!found) {
				if (index < 3) {
					console.log(`[ReviewAgent] Subsidy not found: "${subsidy.name}"`);
				}
				invalidSubsidies.push(subsidy.name);
			} else {
				// 詳細情報の正確性チェック
				if (subsidy.amount && found.maxAmount) {
					const extractedAmount = this.parseAmount(subsidy.amount);
					const actualAmount = this.parseAmount(found.maxAmount);

					if (
						extractedAmount &&
						actualAmount &&
						Math.abs(extractedAmount - actualAmount) > actualAmount * 0.1
					) {
						incorrectDetails.push(
							`${subsidy.name}: 金額が不正確（提示: ${subsidy.amount}, 実際: ${found.maxAmount}）`
						);
					}
				}

				if (subsidy.url && found.url && subsidy.url !== found.url) {
					incorrectDetails.push(`${subsidy.name}: URLが不正確`);
				}
			}
		});

		return {
			hasInvalidSubsidies: invalidSubsidies.length > 0,
			invalidSubsidies,
			hasIncorrectDetails: incorrectDetails.length > 0,
			incorrectDetails,
			duplicateCount,
		};
	}

	private parseAmount(amountStr: string): number | null {
		const match = amountStr.match(/([\d,]+)万?円/);
		if (match) {
			const num = parseInt(match[1].replace(/,/g, ''));
			return amountStr.includes('万') ? num * 10000 : num;
		}
		return null;
	}

	protected buildReviewPrompt(
		userQuestion: string,
		assistantResponse: string,
		context?: ReviewContext
	): string {
		let prompt = `【ユーザーの質問】
${userQuestion}

【アシスタントの回答】
${assistantResponse}`;

		if (context) {
			if (context.previousMessages?.length) {
				prompt += `\n\n【会話履歴】\n`;
				context.previousMessages.forEach((msg) => {
					prompt += `${msg.role}: ${msg.content}\n`;
				});
			}

			if (context.filters) {
				prompt += `\n\n【適用されたフィルター】\n${JSON.stringify(
					context.filters,
					null,
					2
				)}`;
			}
		}

		return prompt;
	}

	private getReviewerInstructions(): string {
		const threshold = process.env.REVIEW_SCORE_THRESHOLD || '85';

		return `
あなたは補助金アドバイザーの回答品質を厳格に評価するレビューエージェントです。
ユーザーが最高品質の情報を得られるよう、高い基準で評価してください。

【評価基準と合格ライン】
すべての項目で${threshold}点以上が必要です。${threshold}点未満がある場合は不合格となります。

【特別チェック項目】
- 「他にもありますか？」「全て列挙」などの質問に対して、同じ補助金しか提案していない場合
  → dataAccuracyを30点以下にして、action: "regenerate"
  → regenerationHintsに「より多くの補助金データを検索して、多様な選択肢を提示してください」を追加

- IT関連で「全て」「すべて」「全部」「一覧」「列挙」を含む質問に対して、提案件数が8件未満の場合
  → dataAccuracyを60点以下にして、action: "regenerate"
  → IT関連補助金は10件存在するため、最低8件は提示が必要

- IT以外で「全て」「すべて」「全部」「一覧」「列挙」を含む質問に対して、提案件数が10件未満の場合
  → dataAccuracyを25点以下にして、action: "regenerate"
  → issuesに「全て列挙の要求に対して提案件数が少なすぎます（10件未満）」を追加
  → regenerationHintsに「最低でも20件以上の補助金を検索・提示してください。複数のカテゴリーを横断的に検索してください」を追加
  
- IT関連の質問で提案件数が5件以下の場合
  → dataAccuracyを35点以下にして、action: "regenerate"
  → issuesに「IT関連補助金の提案件数が少なすぎます」を追加
  → regenerationHintsに「digitalization以外のカテゴリー（startup、expansion等）からもIT企業が活用できる補助金を探してください」を追加

- 既に提案済みの補助金を再度提案している場合
  → dataAccuracyを20点以下にして、action: "regenerate"
  → issuesに「既に提案済みの補助金を重複して提案しています」を追加
  → regenerationHintsに「既に提案済みの補助金とは異なる新しい補助金を検索して提案してください」を追加

- 補助金の件数を明示していない場合
  → dataAccuracyを50点以下にする
  → issuesに「補助金の総数が明示されていません」を追加

- マッチ度スコアを表示していない場合
  → dataAccuracyを40点以下にする
  → issuesに「各補助金のマッチ度スコアが表示されていません」を追加

【評価項目】

1. 質問への関連性（relevance）- ${threshold}点未満の場合
   - ユーザーの質問に直接回答しているか
   - 質問の意図を正しく理解しているか
   - 余計な情報を含んでいないか
   - 的外れな回答をしていないか
   → action: "regenerate"

2. 回答の完全性（completeness）- ${threshold}点未満の場合
   - 質問に対して必要な情報がすべて含まれているか
   - 曖昧な質問の場合、適切な深掘り質問をしているか
   - 補助金の詳細情報（金額、条件、期限等）が明確か
   - 申請に必要な情報が網羅されているか
   → action: "ask_clarification"

   深掘り質問の例：
   - 「どちらの地域で事業を行っていますか？」
   - 「どのような用途で補助金をお探しですか？」
   - 「御社の従業員数を教えていただけますか？」
   - 「具体的にどのような設備投資をお考えですか？」
   - 「どの程度の金額規模をご希望ですか？」

3. データの正確性（dataAccuracy）- ${threshold}点未満の場合
   - 提案された補助金が実在するものか
   - URLがexample.comではなく実際のURLか
   - 金額や条件が正確か
   - JSON ファイルから適切に抽出されているか
   - 複数の補助金を求められた場合、多様な選択肢を提示しているか
   - 同じ補助金ばかり繰り返していないか
   - 【重要】同じ補助金を一度の回答で重複して提案していないか
   - 【必須】申請可能な補助金の総数を明示しているか
   - 【必須】各補助金にマッチ度スコア（100点満点）を表示しているか
   - 補助金の詳細情報が具体的か（曖昧な表現を使っていないか）
   → action: "regenerate"

   特に以下が欠けている場合は60点以下：
   - 「〇〇件の補助金が見つかりました」という総数の記載がない
   - 各補助金に「マッチ度: ○○点」の表示がない
   - 同じ補助金を重複して提案している（30点以下）
   - URLが架空のもの（example.com等）
   - 金額が「最大〇〇円」ではなく曖昧な表現

4. フォローアップの適切性（followUp）- ${threshold}点未満の場合
   - ユーザーが次のアクションを取りやすいか
   - 追加情報の提供が適切か
   - 対話的なコミュニケーションができているか
   - 申請手続きの案内が明確か
   - ユーザーの状況に応じた提案ができているか
   → action: "ask_clarification" または "regenerate"

5. 表現の質（presentationQuality）- 新規追加項目
   - 情報が構造化されて見やすいか
   - 専門用語の説明が適切か
   - 読みやすさ・理解しやすさ
   - 一貫性のある表現
   → ${threshold}点未満の場合、action: "regenerate"

【形式的な問題のチェック】
- 【〇:〇〇†source】や【〇:〇〇†subsidies-partXX.json】などの引用が含まれている場合
  → improvedResponseで削除した版を提供
- マークダウン形式が崩れている場合
  → issuesに追加して修正を促す

【アクション決定ロジック】
1. すべて${threshold}点以上 → action: "approve"
2. completenessが${threshold}点未満 → action: "ask_clarification"
3. dataAccuracyが30点以下 → action: "regenerate"（重複や多様性欠如）
4. それ以外で${threshold}点未満 → action: "regenerate"
5. 引用が含まれている → action: "approve" + improvedResponse

【出力フォーマット】
必ず以下のJSON形式で回答してください：
{
  "scores": {
    "relevance": 0-100の数値,
    "completeness": 0-100の数値,
    "dataAccuracy": 0-100の数値,
    "followUp": 0-100の数値,
    "presentationQuality": 0-100の数値
  },
  "action": "approve" | "regenerate" | "ask_clarification",
  "issues": [
    {
      "type": "relevance" | "completeness" | "data_source" | "follow_up" | "citation" | "format" | "presentation",
      "description": "問題の説明",
      "severity": "critical" | "warning" | "info",
      "example": "具体例（オプション）"
    }
  ],
  "clarificationQuestions": ["深掘り質問1", "深掘り質問2", ...],
  "regenerationHints": ["再生成のヒント1", "再生成のヒント2", ...],
  "improvedResponse": "引用を削除した改善版（必要な場合のみ）"
}
`;
	}
}
