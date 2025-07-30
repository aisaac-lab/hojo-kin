import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { AssistantService } from '../../app/services/assistant.server.js';
import { FileStoreService } from '../../app/services/filestore.server.js';
import { prisma } from '../../app/db.server.js';
import dotenv from 'dotenv';

dotenv.config();

const server = new Server({
  name: 'subsidy-search',
  version: '1.0.0',
}, {
  capabilities: {
    tools: {},
    resources: {},
  },
});

const assistantService = new AssistantService();
const fileStoreService = new FileStoreService();

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'search_subsidies',
        description: 'AIアシスタントを使用して補助金を検索します',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: '検索クエリ（例：IT導入、スタートアップ支援など）',
            },
            threadId: {
              type: 'string',
              description: '既存のスレッドID（オプション）',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'list_subsidies',
        description: 'データベース内のすべての補助金をリストします',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: '取得する補助金の最大数',
              default: 10,
            },
          },
        },
      },
      {
        name: 'get_subsidy_details',
        description: '特定の補助金の詳細情報を取得します',
        inputSchema: {
          type: 'object',
          properties: {
            jgrantsId: {
              type: 'string',
              description: '補助金のjGrants ID',
            },
          },
          required: ['jgrantsId'],
        },
      },
      {
        name: 'sync_subsidies',
        description: '補助金データをOpenAIベクターストアと同期します',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'search_subsidies': {
        const query = args?.query as string;
        const threadId = args?.threadId as string | undefined;

        let currentThreadId = threadId;
        if (!currentThreadId) {
          const thread = await assistantService.createThread();
          currentThreadId = thread.id;
        }

        await assistantService.addMessage(currentThreadId, query);
        const result = await assistantService.runAssistant(currentThreadId);

        const latestMessage = result.messages.data
          .filter((msg: any) => msg.role === 'assistant')
          .map((msg: any) => {
            const content = msg.content[0];
            return content.type === 'text' ? content.text.value : '';
          })[0];

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                threadId: currentThreadId,
                response: latestMessage,
              }, null, 2),
            },
          ],
        };
      }

      case 'list_subsidies': {
        const limit = (args?.limit as number) || 10;
        const allSubsidies = await prisma.subsidy.findMany();
        const subsidies = allSubsidies.slice(0, limit);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(subsidies, null, 2),
            },
          ],
        };
      }

      case 'get_subsidy_details': {
        const jgrantsId = args?.jgrantsId as string;
        
        const subsidy = await prisma.subsidy.findUnique({
          where: { jgrantsId },
        });

        if (!subsidy) {
          throw new Error(`補助金が見つかりません: ${jgrantsId}`);
        }

        const markdownContent = await fileStoreService.readSubsidyMarkdown(jgrantsId);

        return {
          content: [
            {
              type: 'text',
              text: markdownContent || JSON.stringify(subsidy, null, 2),
            },
          ],
        };
      }

      case 'sync_subsidies': {
        const subsidies = await prisma.subsidy.findMany();
        const vectorStoreId = process.env.OPENAI_VECTOR_STORE_ID;

        if (!vectorStoreId) {
          throw new Error('OPENAI_VECTOR_STORE_ID が設定されていません');
        }

        let syncedCount = 0;
        for (const subsidy of subsidies) {
          await fileStoreService.saveSubsidyAsMarkdown(subsidy);
          const file = await fileStoreService.createFileForOpenAI(subsidy.id.toString());
          
          if (file) {
            await assistantService.uploadFileToVectorStore(vectorStoreId, file);
            syncedCount++;
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: `${syncedCount}件の補助金データを同期しました`,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '不明なエラーが発生しました';
    return {
      content: [
        {
          type: 'text',
          text: `エラー: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const subsidies = await prisma.subsidy.findMany();

  return {
    resources: subsidies.map((subsidy) => ({
      uri: `subsidy:///${subsidy.jgrantsId}`,
      name: subsidy.title,
      description: `補助金情報: ${subsidy.title}`,
      mimeType: 'text/markdown',
    })),
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;
  const jgrantsId = uri.replace('subsidy:///', '');

  const subsidy = await prisma.subsidy.findUnique({
    where: { jgrantsId },
  });

  if (!subsidy) {
    throw new Error(`補助金が見つかりません: ${jgrantsId}`);
  }

  const markdownContent = await fileStoreService.readSubsidyMarkdown(jgrantsId);

  return {
    contents: [
      {
        uri,
        mimeType: 'text/markdown',
        text: markdownContent || '',
      },
    ],
  };
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('補助金検索MCPサーバーが起動しました');
}

main().catch((error) => {
  console.error('サーバーエラー:', error);
  process.exit(1);
});