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
import { db } from '../../app/db.server.js';
import { SmartHojokinScraper } from '../../scripts/scrape-smart-hojokin.js';
import dotenv from 'dotenv';

dotenv.config();

const server = new Server(
	{
		name: 'subsidy-search',
		version: '1.0.0',
	},
	{
		capabilities: {
			tools: {},
			resources: {},
		},
	}
);

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
			{
				name: 'scrape_smart_hojokin',
				description: 'スマート補助金サイトから補助金情報をスクレイピングします',
				inputSchema: {
					type: 'object',
					properties: {
						url: {
							type: 'string',
							description:
								'スクレイピング開始URL（デフォルト: 東京都の補助金一覧）',
						},
						saveToDb: {
							type: 'boolean',
							description: 'スクレイピングしたデータをデータベースに保存するか',
							default: false,
						},
						withDetails: {
							type: 'boolean',
							description: '各補助金の詳細ページもスクレイピングするか',
							default: false,
						},
					},
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
							text: JSON.stringify(
								{
									threadId: currentThreadId,
									response: latestMessage,
								},
								null,
								2
							),
						},
					],
				};
			}

			case 'list_subsidies': {
				const limit = (args?.limit as number) || 10;
				const allSubsidies = await db.subsidy.findMany();
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

				const subsidy = await db.subsidy.findUnique({
					where: { jgrantsId },
				});

				if (!subsidy) {
					throw new Error(`補助金が見つかりません: ${jgrantsId}`);
				}

				const markdownContent = await fileStoreService.readSubsidyMarkdown(
					jgrantsId
				);

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
				const subsidies = await db.subsidy.findMany();
				const vectorStoreId = process.env.OPENAI_VECTOR_STORE_ID;

				if (!vectorStoreId) {
					throw new Error('OPENAI_VECTOR_STORE_ID が設定されていません');
				}

				let syncedCount = 0;
				for (const subsidy of subsidies) {
					await fileStoreService.saveSubsidyAsMarkdown(subsidy);
					const file = await fileStoreService.createFileForOpenAI(
						subsidy.id.toString()
					);

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

			case 'scrape_smart_hojokin': {
				const url =
					(args?.url as string) ||
					'https://www.smart-hojokin.jp/subsidy/prefectures/13/areas/1110?exclude=true&page=1';
				const saveToDb = (args?.saveToDb as boolean) || false;
				const withDetails = (args?.withDetails as boolean) || false;

				const scraper = new SmartHojokinScraper();

				try {
					await scraper.initialize();

					const subsidies = withDetails
						? await scraper.scrapeWithDetails(url)
						: await scraper.scrapeAllPages(url);

					// Save to file
					const filePath = await scraper.saveToFile(subsidies);

					// Optionally save to database
					let savedToDb = 0;
					if (saveToDb) {
						for (const subsidy of subsidies) {
							try {
								await db.subsidy.create({
									data: {
										jgrantsId: `SCRAPED-${Date.now()}-${Math.random()
											.toString(36)
											.substr(2, 9)}`,
										title: subsidy.title,
										description: subsidy.description || '',
										targetAudience: subsidy.targetArea,
										amount: subsidy.maxAmount,
										deadline: subsidy.deadline,
										requirements: subsidy.categories.join(', '),
										applicationUrl: subsidy.detailUrl,
										ministry: '不明',
									},
								});
								savedToDb++;
							} catch (error) {
								console.error('Error saving to database:', error);
							}
						}
					}

					const summary = {
						totalScraped: subsidies.length,
						savedToFile: filePath,
						savedToDatabase: saveToDb,
						databaseCount: savedToDb,
						sampleData: subsidies.slice(0, 3),
					};

					return {
						content: [
							{
								type: 'text',
								text: JSON.stringify(summary, null, 2),
							},
						],
					};
				} finally {
					await scraper.close();
				}
			}

			default:
				throw new Error(`Unknown tool: ${name}`);
		}
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : '不明なエラーが発生しました';
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
	const subsidies = await db.subsidy.findMany();

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

	const subsidy = await db.subsidy.findUnique({
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
