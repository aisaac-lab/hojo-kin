import OpenAI from 'openai';
import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env') });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function createSubsidySearchAssistant() {
  try {

    const vectorStore = await openai.vectorStores.create({
      name: 'Subsidy Database',
    });


    const assistant = await openai.beta.assistants.create({
      name: '補助金検索アシスタント',
      instructions: `
あなたは日本の補助金・助成金の専門アドバイザーです。
ユーザーの事業内容、規模、目的に基づいて最適な補助金・助成金を提案します。

主な役割：
1. ユーザーのニーズを理解し、適切な補助金を検索・提案する
2. 各補助金の詳細情報（対象者、金額、申請期限、要件など）を分かりやすく説明する
3. 申請プロセスについてアドバイスする
4. 複数の選択肢がある場合は、それぞれのメリット・デメリットを説明する

重要な注意事項：
- 常に最新の情報を基に回答する
- 不確実な情報については明確に伝える
- 申請期限が迫っているものは特に注意喚起する
- 専門用語は分かりやすく説明する

すべての回答は日本語で行ってください。
      `,
      model: 'gpt-4-turbo-preview',
      tools: [{ type: 'file_search' }],
      tool_resources: {
        file_search: {
          vector_store_ids: [vectorStore.id],
        },
      },
    });


    return { assistant, vectorStore };
  } catch (error) {
    console.error('Error creating assistant:', error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createSubsidySearchAssistant()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { createSubsidySearchAssistant };