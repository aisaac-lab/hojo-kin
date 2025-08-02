import { json, type ActionFunctionArgs } from "@remix-run/node";
import { AssistantService } from "../services/assistant.server";
import { ReviewAgentService } from "../services/review-agent.server";
import type { ChatResponse } from "~/types/chat";
import type { ReviewContext } from "~/types/review";
import { db } from "../db.server";
import { reviewLogs } from "../db/schema";
import { generateAutoFilter } from "../utils/auto-filter";

export async function action({ request }: ActionFunctionArgs) {
  
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const { threadId, message, userId, filters } = await request.json();

    if (!message) {
      return json({ error: "Message is required" }, { status: 400 });
    }

    const assistantService = new AssistantService();

    let currentThreadId = threadId;

    if (!currentThreadId) {
      const thread = await assistantService.createThread(userId);
      currentThreadId = thread.id;
    }

    await assistantService.addMessage(currentThreadId, message, "user");
    
    // デバッグ: ユーザーメッセージをログ出力
    console.log('[DEBUG] User message:', message);
    console.log('[DEBUG] Thread ID:', currentThreadId);
    console.log('[DEBUG] Filters:', filters);
    
    // フィルターが指定されていない場合、メッセージから自動生成
    let effectiveFilters = filters;
    if (!filters || Object.keys(filters).length === 0) {
      const autoFilter = generateAutoFilter(message);
      if (autoFilter) {
        effectiveFilters = autoFilter;
        console.log('[DEBUG] Auto-generated filters:', effectiveFilters);
      }
    }

    // フィルター条件をコンテキストに追加
    let filterContext = '';
    if (effectiveFilters && Object.keys(effectiveFilters).length > 0) {
      filterContext = '\n\n【検索フィルター条件】\n';
      
      // 地域フィルター
      if (effectiveFilters.area) {
        if (effectiveFilters.area.cities && effectiveFilters.area.cities.length > 0) {
          filterContext += `- 対象地域: ${effectiveFilters.area.cities.join('、')}\n`;
        }
        if (effectiveFilters.area.includeNationwide) {
          filterContext += `- 全国対象の補助金も含む\n`;
        }
      }
      
      // 金額フィルター
      if (effectiveFilters.amount) {
        const { min, max } = effectiveFilters.amount;
        if (min && max) {
          filterContext += `- 補助金額: ${min.toLocaleString()}円〜${max.toLocaleString()}円\n`;
        } else if (min) {
          filterContext += `- 補助金額: ${min.toLocaleString()}円以上\n`;
        } else if (max) {
          filterContext += `- 補助金額: ${max.toLocaleString()}円以下\n`;
        }
        
        if (effectiveFilters.amount.subsidyRate) {
          const { min: rateMin, max: rateMax } = effectiveFilters.amount.subsidyRate;
          if (rateMin && rateMax) {
            filterContext += `- 補助率: ${rateMin}%〜${rateMax}%\n`;
          } else if (rateMin) {
            filterContext += `- 補助率: ${rateMin}%以上\n`;
          } else if (rateMax) {
            filterContext += `- 補助率: ${rateMax}%以下\n`;
          }
        }
      }
      
      // 目的・カテゴリーフィルター
      if (effectiveFilters.purpose) {
        if (effectiveFilters.purpose.mainCategories && effectiveFilters.purpose.mainCategories.length > 0) {
          const categoryLabels = {
            'equipment': '設備投資',
            'employment': '人材・雇用',
            'research': '研究開発',
            'expansion': '販路拡大・PR',
            'startup': '創業・新事業',
            'digitalization': 'DX・IT導入',
            'environment': '環境・エネルギー',
            'welfare': '福祉・健康',
            'other': 'その他'
          };
          const categories = effectiveFilters.purpose.mainCategories.map((c: keyof typeof categoryLabels) => categoryLabels[c] || c).join('、');
          filterContext += `- カテゴリー: ${categories}\n`;
        }
        
        if (effectiveFilters.purpose.keywords && effectiveFilters.purpose.keywords.length > 0) {
          filterContext += `- キーワード: ${effectiveFilters.purpose.keywords.join('、')}\n`;
        }
      }
      
      // 企業属性フィルター
      if (effectiveFilters.company) {
        if (effectiveFilters.company.companySize) {
          const sizeLabels = {
            'micro': '個人事業主・マイクロ法人',
            'small': '小規模事業者',
            'medium': '中小企業',
            'large': '大企業',
            'any': '規模不問'
          };
          filterContext += `- 企業規模: ${sizeLabels[effectiveFilters.company.companySize as keyof typeof sizeLabels]}\n`;
        }
        
        if (effectiveFilters.company.specialConditions && effectiveFilters.company.specialConditions.length > 0) {
          const conditionLabels = {
            'woman_owned': '女性経営',
            'young_entrepreneur': '若手起業家',
            'succession': '事業承継',
            'nonprofit': 'NPO・非営利団体'
          };
          const conditions = effectiveFilters.company.specialConditions.map((c: keyof typeof conditionLabels) => conditionLabels[c] || c).join('、');
          filterContext += `- 特別条件: ${conditions}\n`;
        }
      }
      
      // 申請期限フィルター
      if (effectiveFilters.deadline) {
        if (effectiveFilters.deadline.status === 'accepting') {
          filterContext += `- 現在受付中の補助金のみ\n`;
        } else if (effectiveFilters.deadline.status === 'upcoming') {
          filterContext += `- 受付開始予定の補助金のみ\n`;
        }
      }
      
      filterContext += '\n上記の条件に合致する補助金を優先的に提案してください。';
      
      // キーワードがある場合は検索に使用するよう明示的に指示
      if (effectiveFilters.purpose && effectiveFilters.purpose.keywords && effectiveFilters.purpose.keywords.length > 0) {
        filterContext += '\n特に以下のキーワードで file_search を実行してください: ' + effectiveFilters.purpose.keywords.join(', ');
      }
    }
    
    // フィルター設定状況の詳細を追加
    let filterStatusDetails = '';
    if (effectiveFilters && Object.keys(effectiveFilters).length > 0) {
      filterStatusDetails = '\n\n【設定済みのフィルター情報】';
      if (effectiveFilters.area) {
        filterStatusDetails += '\n✓ 地域: 設定済み';
      }
      if (effectiveFilters.amount) {
        filterStatusDetails += '\n✓ 金額: 設定済み';
      }
      if (effectiveFilters.purpose) {
        filterStatusDetails += '\n✓ カテゴリー/目的: 設定済み';
      }
      if (effectiveFilters.company) {
        filterStatusDetails += '\n✓ 企業規模/条件: 設定済み';
      }
      if (effectiveFilters.deadline) {
        filterStatusDetails += '\n✓ 申請期限: 設定済み';
      }
      filterStatusDetails += '\n\n既に設定されている項目については再度質問する必要はありません。';
    }

    const additionalInstructions = `
      【最重要】file_search ツールを使用して補助金データを検索してください。
      
      【データ構造】
      補助金データは subsidies-master.json ファイルに格納されています。
      338件の補助金情報が含まれており、各補助金には以下のフィールドがあります：
      - id: 補助金ID
      - title: 補助金名
      - description: 説明
      - categories: カテゴリー配列（日本語）
      - maxAmount: 最大補助金額
      - subsidyRate: 補助率
      - targetArea: 対象地域
      - applicationPeriod: 申請期間
      - targetBusiness: 対象事業者
      - front_subsidy_detail_page_url: 公式サイトURL
      
      【検索手順】
      1. subsidies-master.json から条件に合う補助金を検索
      2. categoriesフィールドやdescriptionを使ってキーワードマッチング
      3. front_subsidy_detail_page_url フィールドの値を必ず取得する
      
      ユーザーの質問: "${message}"
      
      回答の原則：
      1. まず、ユーザーが具体的に何を知りたいのか理解する
      2. その質問に対して、直接的で明確な回答を最初に提示する
      3. 補助金の提案をする場合は、なぜその補助金が質問に関連するのか説明する
      
      【曖昧な質問への対応 - 最優先事項】
      
      【最優先確認事項】まず既に提供されているフィルター条件を確認してください：
      ${filterContext ? '- 既にフィルター条件が設定されています' : '- フィルター条件は設定されていません'}
      
      【対応方法】
      1. 以下の条件を満たす場合は、質問せずに直接補助金を検索・提案する：
         - 地域が設定されている
         - カテゴリーまたは目的が設定されている  
         - 「全て」「すべて」「一覧」「教えて」という文言が含まれる
         - 企業規模が設定されている
         - 金額条件が設定されている
         
         この場合の対応：
         - その条件に基づいて補助金を検索し、複数（3-5件程度）提案する
         - 既に設定されている条件については絶対に再度質問しない
         - 未設定の条件についてのみ、提案後に追加質問する
      
      2. 検索条件が本当に不足している場合のみ：
         - 「補助金について教えて」「補助金が欲しい」など条件が何もない場合
         - 「補助金をお探しですね。より適切な補助金をご提案するため、いくつか質問させてください」と伝える
         - 以下から3-4個の質問を選んで聞く：
           - どちらの地域で事業を行っていますか？（例：東京都、大阪府など）
           - どのような業種・事業分野ですか？（例：製造業、IT、サービス業など）
           - 従業員数はどれくらいですか？（例：1-5名、6-20名、21名以上など）
           - 補助金の使用目的は何ですか？（例：設備投資、研究開発、人材育成、販路拡大など）
           - 希望する補助金額はどれくらいですか？（例：100万円以下、100-500万円、500万円以上など）
         - 選択肢を提示して、ユーザーが答えやすくする
      
      【必須】補助金を提案する際は、必ず各補助金のfront_subsidy_detail_page_urlをMarkdownのリンク形式で表示してください。
      形式：[公式サイトで詳細を見る](実際のURL)
      例：[公式サイトで詳細を見る](https://www.tokyo-kosha.or.jp/support/josei/)
      これにより、ユーザーがクリックして別ページで開けるようになります。
      
      【重要】file_searchを使用する際の注意点：
      - subsidies-master.json から直接検索してください
      - front_subsidy_detail_page_url フィールドには実際のURLが含まれています（example.comではありません）
      - categoriesフィールドは日本語でカテゴリーが記載されています（例: "研究開発", "設備投資", "IT導入" など）
      
      【ソース引用の完全非表示 - 最重要】
      - file_searchの結果に含まれる引用元情報を絶対に表示しないでください：
        - 【○:○○†source】形式
        - 【○:○○†subsidies-partXX.json】形式
        - その他あらゆる【】で囲まれた引用表記
      - ユーザーには補助金の情報のみを清潔に表示し、内部的な参照情報は一切含めないでください
      - 回答生成時に引用マークが自動的に追加されても、それを必ず削除してください
      
      【必須アクション】
      1. 必ず file_search ツールを使用してください
      2. 検索キーワード例：
         - スタートアップ → "創業", "起業", "新事業", "ベンチャー", "スタートアップ"
         - IT → "IT", "DX", "デジタル", "システム", "IoT", "AI", "IT導入"
         - 設備投資 → "設備", "機械", "装置", "導入", "設備投資"
         - 研究開発 → "研究", "開発", "R&D", "技術", "イノベーション", "研究開発"
         - 人材 → "人材", "雇用", "採用", "育成", "研修"
         - 環境 → "環境", "エネルギー", "省エネ", "脱炭素", "SDGs"
      3. データが見つからない場合は、別のキーワードで再検索してください
      4. 全体で338件の補助金データが subsidies-master.json に含まれています
      5. categoriesフィールドの値も検索対象として活用してください
      
      【絶対必須】補助金を提案する際の形式：
      1. 必ず以下のフォーマットで開始する：
         「申請可能な補助金は○○件です。」
         「補助金の一部として以下のようなものがあります。」
      2. 必ず5件の補助金を提案する（3件や4件ではなく、必ず5件）
      3. 各補助金に必ずマッチ度と内訳を表示：
         例：（マッチ度: 85点/100点）
         内訳：地域条件(30点/30点)、カテゴリー(25点/25点)、金額(15点/20点)、企業規模(15点/15点)
      4. 同じ補助金を重複して提案しない
      
      【網羅性と対話的絞り込みに関する重要な指示】
      
      1. 補助金の提案方法：
         - 必ず「申請可能な補助金は○○件です。」で開始
         - 必ず「補助金の一部として以下のようなものがあります。」と続ける
         - その中から最もマッチ度の高い5件を厳選して提案する（必ず5件）
         - 各補助金にマッチ度スコア（100点満点）を表示する
         - それぞれの補助金について、なぜ適しているか簡潔に説明する
         
      【マッチ度スコアの算出基準と表示方法】
      重要：ユーザーが指定した条件のみでスコアを計算する
      
      配点（条件が指定されている場合のみ）：
      - 地域の一致: 指定時のみ30点
      - カテゴリー/目的の一致: キーワードや質問内容から判断して25点
      - 金額条件: 指定時のみ20点（未指定の場合は「未指定」と表示）
      - 企業規模: 指定時のみ15点（未指定の場合は「未指定」と表示）
      - その他の条件: 10点（以下の要素で評価）
        ・申請期限の余裕（現在受付中: 5点、期限迫る: 2点、締切済み: 0点）
        ・申請の容易さ（オンライン申請可: 3点、書類簡易: 2点）
        ・採択率の高さ（高採択率: 2点）
      
      表示形式（必須）：
      **補助金名**（マッチ度: 40点/65点）※65点は指定条件の合計
      内訳：地域(30/30)、カテゴリー(10/25)、金額(未指定)、企業規模(未指定)、その他(5/10)
      
      その他の詳細を表示する場合：
      その他(7/10): 申請期限◎(5点)、オンライン申請○(2点)
      
      【重要】未指定の条件については必ず追加質問をする
         
      2. 検索結果が20件を超える場合の対応：
         - 「○○件の補助金が見つかりました。より最適な提案をするため、条件を絞り込みたいと思います」と伝える
         - 未設定の条件から2-3個の質問を選んで提示：
           a) 業種・事業分野（未設定の場合）
           b) 企業規模（未設定の場合）
           c) 補助金の使用目的（未設定の場合）
           d) 希望する補助金額（未設定の場合）
         - 現時点で特に関連性の高い3-5件を先に提示
         - 「条件を教えていただければ、より適切な補助金をご提案できます」と付け加える
      
      3. ユーザーが「全て」「すべて」「全部」「一覧」を求めている場合：
         - まず該当する補助金の総数を明示する（例：「○○件の補助金が見つかりました」）
         - 件数が10件を超える場合は、絞り込みを提案
         - 件数が10件以下の場合は、全てを列挙する
      
      4. 絞り込み後の提案：
         - ユーザーから追加情報を得た場合、その条件に最も適した補助金を優先的に提示
         - なぜその補助金が適しているか理由を明確に説明
      
      5. 段階的な情報提供：
         - 初回は概要を提示し、ユーザーが興味を示した補助金について詳細情報を提供
         - 常にユーザーが次のアクションを取りやすいよう、選択肢を提示
      
      補助金を提案する際の注意事項：
      - ユーザーの業種、事業規模、目的に合致するものを選ぶ
      - 各補助金について以下を明記：
        ・補助金名
        ・マッチ度: ○○点/○○点（指定条件の合計点）
        ・対象者（業種、規模、地域など）
        ・補助金額（上限額、補助率）
        ・対象経費
        ・申請期限
        ・なぜこの補助金が適しているか（マッチ度の根拠も含める）
        ・公式サイト（必須：front_subsidy_detail_page_urlをMarkdownリンク形式で表示 [公式サイトで詳細を見る](URL)）
        
      【必須】提案後に以下の形式で追加質問をする：
      「より最適な補助金をご提案するため、以下について教えていただけますか？」
      - 企業規模（従業員数）はどれくらいですか？（1-5名、6-20名、21名以上など）
      - 希望する補助金額はどれくらいですか？（100万円以下、100-500万円、500万円以上など）
      - その他の特別な条件はありますか？（女性経営、NPO、事業承継など）
      
      【提案例（地域のみ指定の場合）】
      申請可能な補助金は28件です。
      補助金の一部として以下のようなものがあります。
      
      1. **研究開発助成事業**（マッチ度: 60点/65点）
         内訳：地域(30/30)、カテゴリー(25/25)、金額(未指定)、企業規模(未指定)、その他(5/10)
         その他詳細：申請期限◎(5点)、オンライン申請×(0点)
         - 対象者：東京都内の中小企業
         - 補助金額：最大1,000万円（補助率2/3）
         - なぜ適しているか：千代田区を含む東京都内で研究開発を行う企業向けの補助金です
         - [公式サイトで詳細を見る](https://example.com)
      
      2. **IT導入補助金**（マッチ度: 55点/65点）
         ...
      3. **ものづくり補助金**（マッチ度: 50点/65点）
         ...
      4. **小規模事業者持続化補助金**（マッチ度: 45点/65点）
         ...
      5. **事業再構築補助金**（マッチ度: 40点/65点）
         ...
         ...
         
      より最適な補助金をご提案するため、以下について教えていただけますか？
      - 企業規模（従業員数）はどれくらいですか？
      - 希望する補助金額の規模は？
      - 研究開発の具体的な分野は？（AI、バイオ、環境技術など）
      
      URLに関する注意事項：
      - 公式サイトのURLを求められた場合、データに含まれているURLを正確に提示する
      - URLが不明な場合は「URLは現在のデータに含まれていません」と明記する
      - 推測や一般的なURLを提供しない
      
      対話的なコミュニケーション：
      - 情報が多い場合は、ユーザーとの対話を通じて最適な情報を提供
      - 常に親切で分かりやすい説明を心がける
      - ユーザーが追加の質問をしやすい雰囲気を作る
      
      常に日本語で、丁寧かつ分かりやすく回答してください。
      ${filterContext}
      ${filterStatusDetails}
    `;

    // デバッグ: 追加指示をログ出力
    console.log('[DEBUG] Additional instructions (truncated):', additionalInstructions.substring(0, 200) + '...');
    
    // 既出の補助金を抽出する関数
    const extractMentionedSubsidies = (messages: any[]) => {
      const mentionedSubsidies: string[] = [];
      
      // アシスタントのメッセージから補助金名を抽出
      for (const msg of messages) {
        if (msg.role === "assistant" && msg.content[0]?.type === "text") {
          const content = msg.content[0].text.value;
          
          // 補助金名のパターンを検索（**で囲まれた部分）
          const subsidyNamePattern = /\*\*([^*]+)\*\*/g;
          let match;
          while ((match = subsidyNamePattern.exec(content)) !== null) {
            const subsidyName = match[1].trim();
            // 補助金名らしいものを抽出（「補助金」「助成金」「支援」を含むもの）
            if (subsidyName.includes('補助金') || subsidyName.includes('助成金') || 
                subsidyName.includes('支援') || subsidyName.includes('事業')) {
              if (!mentionedSubsidies.includes(subsidyName)) {
                mentionedSubsidies.push(subsidyName);
              }
            }
          }
        }
      }
      
      return mentionedSubsidies;
    };
    
    // 既存のメッセージを取得して既出の補助金を抽出
    let mentionedSubsidies: string[] = [];
    if (currentThreadId) {
      try {
        const existingMessages = await assistantService.getMessages(currentThreadId);
        mentionedSubsidies = extractMentionedSubsidies(existingMessages.data);
        console.log('[DEBUG] Previously mentioned subsidies:', mentionedSubsidies);
      } catch (error) {
        console.error('[DEBUG] Error getting existing messages:', error);
      }
    }
    
    // 既出補助金を追加指示に含める
    let enhancedInstructions = additionalInstructions;
    if (mentionedSubsidies.length > 0) {
      enhancedInstructions += `\n\n【重要】以下の補助金は既にこの会話で提案済みです。これらとは異なる補助金を提案してください：\n${mentionedSubsidies.map(s => `- ${s}`).join('\n')}`;
    }
    
    const result = await assistantService.runAssistant(
      currentThreadId,
      enhancedInstructions
    );

    // Get only the new assistant message(s) created in this run
    // OpenAI returns messages in reverse chronological order (newest first)
    let newAssistantMessage = null;
    
    // Find the first assistant message that's newer than the last one we saw
    for (const msg of result.messages.data) {
      if (msg.role === "assistant") {
        if (!result.lastAssistantMessageIdBefore || msg.id !== result.lastAssistantMessageIdBefore) {
          newAssistantMessage = msg;
          break;
        } else {
          // We've reached the last message from before, stop here
          break;
        }
      }
    }
    
    // Get the content of the new message
    const latestMessageContent = newAssistantMessage && newAssistantMessage.content[0].type === "text"
      ? newAssistantMessage.content[0].text.value 
      : "";
    
    // デバッグ: アシスタントの応答をログ出力
    console.log('[DEBUG] Assistant response (truncated):', latestMessageContent.substring(0, 200) + '...');
    console.log('[DEBUG] Total messages in thread:', result.messages.data.length);
    
    // レビューエージェントによる品質チェック
    let finalResponse = latestMessageContent;
    
    if (latestMessageContent) {
      const reviewAgentService = new ReviewAgentService();
      const reviewContext: ReviewContext = {
        hasFilters: !!effectiveFilters && Object.keys(effectiveFilters).length > 0,
        mentionedSubsidies: mentionedSubsidies,
        // TODO: 過去のメッセージ履歴を追加
      };
      
      const reviewResult = await reviewAgentService.reviewResponse(
        message,
        latestMessageContent,
        reviewContext
      );
      
      console.log('[REVIEW RESULT]', {
        action: reviewResult.action,
        scores: reviewResult.scores,
        lowestScore: reviewResult.lowestScore,
        passed: reviewResult.passed
      });
      
      switch (reviewResult.action) {
        case 'approve':
          // 軽微な修正がある場合のみ適用（引用削除など）
          if (reviewResult.improvedResponse) {
            finalResponse = reviewResult.improvedResponse;
            console.log('[REVIEW] Applied improved response (citation removal)');
          }
          break;
          
        case 'regenerate':
          // 評価が低い項目に基づいて再生成
          const regenerationInstructions = `
            【再生成理由】
            ${reviewResult.lowestScore.category}のスコアが${reviewResult.lowestScore.score}点でした。
            
            【改善指示】
            ${reviewResult.regenerationHints?.join('\n') || ''}
            
            元の指示に従いつつ、上記の点を改善して回答してください。
          `;
          
          console.log('[REVIEW] Regenerating response due to low score');
          
          const regeneratedResult = await assistantService.runAssistant(
            currentThreadId,
            additionalInstructions + regenerationInstructions
          );
          
          // 再生成された回答を取得
          for (const msg of regeneratedResult.messages.data) {
            if (msg.role === "assistant" && 
                (!regeneratedResult.lastAssistantMessageIdBefore || 
                 msg.id !== regeneratedResult.lastAssistantMessageIdBefore)) {
              if (msg.content[0].type === "text") {
                finalResponse = msg.content[0].text.value;
                break;
              }
            }
          }
          break;
          
        case 'ask_clarification':
          // 深掘り質問を含む回答を生成
          const clarificationSection = reviewResult.clarificationQuestions && reviewResult.clarificationQuestions.length > 0
            ? `

より最適な補助金をご提案するため、以下について教えていただけますか？

${reviewResult.clarificationQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

これらの情報をいただければ、より具体的で有益な補助金情報をご提供できます。`
            : '';
            
          finalResponse = latestMessageContent + clarificationSection;
          console.log('[REVIEW] Added clarification questions');
          break;
      }
      
      // レビューで問題が見つかった場合の記録
      if (reviewResult.issues && reviewResult.issues.length > 0) {
        console.log('[REVIEW ISSUES]', reviewResult.issues);
      }
      
      // レビュー結果をデータベースに保存
      try {
        await db.insert(reviewLogs).values({
          threadId: currentThreadId,
          userQuestion: message,
          originalResponse: latestMessageContent,
          finalResponse: finalResponse,
          action: reviewResult.action,
          scores: JSON.stringify(reviewResult.scores),
          lowestScoreCategory: reviewResult.lowestScore.category,
          lowestScoreValue: reviewResult.lowestScore.score,
          issues: JSON.stringify(reviewResult.issues)
        });
      } catch (dbError) {
        console.error('[REVIEW LOG ERROR] Failed to save review log:', dbError);
        // ログ保存に失敗してもチャット処理は続行
      }
    }

    const response: ChatResponse = {
      threadId: currentThreadId,
      messages: finalResponse ? [finalResponse] : [],
      success: true,
    };
    
    return json(response);
  } catch (error) {
    console.error("Chat error:", error);
    return json({ error: "Failed to process chat message" }, { status: 500 });
  }
}
