import { json, type ActionFunctionArgs } from "@remix-run/node";
import { AssistantService } from "../services/assistant.server";
import type { ChatResponse } from "~/types/chat";

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

    // フィルター条件をコンテキストに追加
    let filterContext = '';
    if (filters && Object.keys(filters).length > 0) {
      filterContext = '\n\n【検索フィルター条件】\n';
      
      // 地域フィルター
      if (filters.area) {
        if (filters.area.cities && filters.area.cities.length > 0) {
          filterContext += `- 対象地域: ${filters.area.cities.join('、')}\n`;
        }
        if (filters.area.includeNationwide) {
          filterContext += `- 全国対象の補助金も含む\n`;
        }
      }
      
      // 金額フィルター
      if (filters.amount) {
        const { min, max } = filters.amount;
        if (min && max) {
          filterContext += `- 補助金額: ${min.toLocaleString()}円〜${max.toLocaleString()}円\n`;
        } else if (min) {
          filterContext += `- 補助金額: ${min.toLocaleString()}円以上\n`;
        } else if (max) {
          filterContext += `- 補助金額: ${max.toLocaleString()}円以下\n`;
        }
        
        if (filters.amount.subsidyRate) {
          const { min: rateMin, max: rateMax } = filters.amount.subsidyRate;
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
      if (filters.purpose) {
        if (filters.purpose.mainCategories && filters.purpose.mainCategories.length > 0) {
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
          const categories = filters.purpose.mainCategories.map((c: keyof typeof categoryLabels) => categoryLabels[c] || c).join('、');
          filterContext += `- カテゴリー: ${categories}\n`;
        }
        
        if (filters.purpose.keywords && filters.purpose.keywords.length > 0) {
          filterContext += `- キーワード: ${filters.purpose.keywords.join('、')}\n`;
        }
      }
      
      // 企業属性フィルター
      if (filters.company) {
        if (filters.company.companySize) {
          const sizeLabels = {
            'micro': '個人事業主・マイクロ法人',
            'small': '小規模事業者',
            'medium': '中小企業',
            'large': '大企業',
            'any': '規模不問'
          };
          filterContext += `- 企業規模: ${sizeLabels[filters.company.companySize as keyof typeof sizeLabels]}\n`;
        }
        
        if (filters.company.specialConditions && filters.company.specialConditions.length > 0) {
          const conditionLabels = {
            'woman_owned': '女性経営',
            'young_entrepreneur': '若手起業家',
            'succession': '事業承継',
            'nonprofit': 'NPO・非営利団体'
          };
          const conditions = filters.company.specialConditions.map((c: keyof typeof conditionLabels) => conditionLabels[c] || c).join('、');
          filterContext += `- 特別条件: ${conditions}\n`;
        }
      }
      
      // 申請期限フィルター
      if (filters.deadline) {
        if (filters.deadline.status === 'accepting') {
          filterContext += `- 現在受付中の補助金のみ\n`;
        } else if (filters.deadline.status === 'upcoming') {
          filterContext += `- 受付開始予定の補助金のみ\n`;
        }
      }
      
      filterContext += '\n上記の条件に合致する補助金を優先的に提案してください。';
    }

    const additionalInstructions = `
      【最重要】file_search ツールを使用して subsidies-master.json ファイルから補助金データを検索してください。
      
      【検索手順】
      1. file_search ツールを使用する
      2. subsidies フィールド内の配列を検索する
      3. title, description, categories フィールドでキーワードマッチングを行う
      4. front_subsidy_detail_page_url フィールドの値を必ず取得する
      
      ユーザーの質問: "${message}"
      
      回答の原則：
      1. まず、ユーザーが具体的に何を知りたいのか理解する
      2. その質問に対して、直接的で明確な回答を最初に提示する
      3. 補助金の提案をする場合は、なぜその補助金が質問に関連するのか説明する
      
      【必須】補助金を提案する際は、必ず各補助金のfront_subsidy_detail_page_urlをMarkdownのリンク形式で表示してください。
      形式：[公式サイトで詳細を見る](実際のURL)
      例：[公式サイトで詳細を見る](https://www.tokyo-kosha.or.jp/support/josei/)
      これにより、ユーザーがクリックして別ページで開けるようになります。
      
      【重要】file_searchを使用する際は、subsidies-master.json ファイルのデータを優先してください。
      front_subsidy_detail_page_url フィールドには実際のURLが含まれています（example.comではありません）。
      
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
         - スタートアップ → "創業", "起業", "新事業", "ベンチャー"
         - IT → "IT", "DX", "デジタル", "システム", "IoT"
         - 設備投資 → "設備", "機械", "装置", "導入"
      3. データが見つからない場合は、別のキーワードで再検索してください
      4. subsidies-master.json には338件の補助金データが含まれています
      
      【網羅性と対話的絞り込みに関する重要な指示】
      
      1. ユーザーが「全て」「すべて」「全部」「一覧」を求めている場合：
         - まず該当する補助金の総数を明示する（例：「○○件の補助金が見つかりました」）
         - 件数が10件を超える場合は、以下の対話的アプローチを取る：
           a) 「多数の補助金が見つかりました。より最適な提案のため、以下について教えてください」と伝える
           b) 具体的な質問を3-4個提示：
              - 業種や事業分野
              - 従業員数や企業規模
              - 希望する補助金額の範囲
              - 補助金の使用目的（設備投資、研究開発、人材育成など）
           c) 現時点で特に関連性の高い5-7件を先に提示
           d) 「他の補助金も確認したい場合はお知らせください」と付け加える
         - 件数が10件以下の場合は、全てを列挙する
      
      2. 絞り込み後の提案：
         - ユーザーから追加情報を得た場合、その条件に最も適した補助金を優先的に提示
         - なぜその補助金が適しているか理由を明確に説明
      
      3. 段階的な情報提供：
         - 初回は概要を提示し、ユーザーが興味を示した補助金について詳細情報を提供
         - 常にユーザーが次のアクションを取りやすいよう、選択肢を提示
      
      補助金を提案する際の注意事項：
      - ユーザーの業種、事業規模、目的に合致するものを選ぶ
      - 各補助金について以下を明記：
        ・補助金名
        ・対象者（業種、規模、地域など）
        ・補助金額（上限額、補助率）
        ・対象経費
        ・申請期限
        ・なぜこの補助金が適しているか
        ・公式サイト（必須：front_subsidy_detail_page_urlをMarkdownリンク形式で表示 [公式サイトで詳細を見る](URL)）
      
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
    `;

    // デバッグ: 追加指示をログ出力
    console.log('[DEBUG] Additional instructions (truncated):', additionalInstructions.substring(0, 200) + '...');
    
    const result = await assistantService.runAssistant(
      currentThreadId,
      additionalInstructions
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
    

    const response: ChatResponse = {
      threadId: currentThreadId,
      messages: latestMessageContent ? [latestMessageContent] : [],
      success: true,
    };
    
    return json(response);
  } catch (error) {
    console.error("Chat error:", error);
    return json({ error: "Failed to process chat message" }, { status: 500 });
  }
}
