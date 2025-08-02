import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AssistantService } from '../../../app/services/assistant.server';
import { db } from '../../../app/db.server';

vi.mock('openai', () => ({
	default: vi.fn().mockImplementation(() => ({
		beta: {
			assistants: {
				create: vi.fn().mockResolvedValue({
					id: 'asst_123',
					name: 'Test Assistant',
				}),
				update: vi.fn().mockResolvedValue({
					id: 'asst_123',
				}),
			},
			threads: {
				create: vi.fn().mockResolvedValue({
					id: 'thread_123',
					metadata: {},
				}),
				messages: {
					create: vi.fn().mockResolvedValue({
						id: 'msg_123',
						role: 'user',
						content: [{ type: 'text', text: { value: 'Test message' } }],
					}),
					list: vi.fn().mockResolvedValue({
						data: [
							{
								id: 'msg_456',
								role: 'assistant',
								content: [{ type: 'text', text: { value: 'Test response' } }],
							},
						],
					}),
				},
				runs: {
					create: vi.fn().mockResolvedValue({
						id: 'run_123',
						status: 'in_progress',
					}),
					retrieve: vi
						.fn()
						.mockResolvedValueOnce({ id: 'run_123', status: 'in_progress' })
						.mockResolvedValueOnce({ id: 'run_123', status: 'completed' }),
				},
			},
			vectorStores: {
				create: vi.fn().mockResolvedValue({
					id: 'vs_123',
					name: 'Test Vector Store',
				}),
				files: {
					create: vi.fn().mockResolvedValue({
						id: 'file_123',
					}),
				},
			},
		},
		files: {
			create: vi.fn().mockResolvedValue({
				id: 'file_123',
			}),
		},
	})),
}));

describe('AssistantService', () => {
	let assistantService: AssistantService;

	beforeEach(() => {
		process.env.OPENAI_ASSISTANT_ID = 'asst_test';
		assistantService = new AssistantService();
	});

	describe('createAssistant', () => {
		it('should create an assistant with file search tool', async () => {
			const assistant = await assistantService.createAssistant(
				'Test Assistant',
				'Test instructions'
			);

			expect(assistant).toHaveProperty('id', 'asst_123');
			expect(assistant).toHaveProperty('name', 'Test Assistant');
		});

		it('should create an assistant with vector store', async () => {
			const assistant = await assistantService.createAssistant(
				'Test Assistant',
				'Test instructions',
				'vs_123'
			);

			expect(assistant).toHaveProperty('id', 'asst_123');
		});
	});

	describe('createThread', () => {
		it('should create a thread and save to database', async () => {
			const thread = await assistantService.createThread('user_123', {
				test: 'metadata',
			});

			expect(thread).toHaveProperty('id', 'thread_123');

			const dbThread = await db.thread.findUnique({
				where: { threadId: 'thread_123' },
			});

			expect(dbThread).not.toBeNull();
			expect(dbThread?.userId).toBe('user_123');
			expect(dbThread?.metadata).toBe(JSON.stringify({ test: 'metadata' }));
		});
	});

	describe('addMessage', () => {
		it('should add a message to thread and save to database', async () => {
			await db.thread.create({
				data: {
					threadId: 'thread_123',
					userId: 'user_123',
				},
			});

			const message = await assistantService.addMessage(
				'thread_123',
				'Test message'
			);

			expect(message).toHaveProperty('id', 'msg_123');

			const dbMessage = await db.message.findFirst({
				where: { threadId: 'thread_123' },
			});

			expect(dbMessage).not.toBeNull();
			expect(dbMessage?.content).toBe('Test message');
			expect(dbMessage?.role).toBe('user');
		});
	});

	describe('runAssistant', () => {
		it('should run assistant and save response', async () => {
			await db.thread.create({
				data: {
					threadId: 'thread_123',
					userId: 'user_123',
				},
			});

			const result = await assistantService.runAssistant('thread_123');

			expect(result.messages.data).toHaveLength(1);
			expect((result.messages.data[0].content[0] as any).text.value).toBe(
				'Test response'
			);

			const dbMessage = await db.message.findFirst({
				where: {
					threadId: 'thread_123',
					role: 'assistant',
				},
			});

			expect(dbMessage).not.toBeNull();
			expect(dbMessage?.content).toBe('Test response');
		});
	});

	describe('createVectorStore', () => {
		it('should create a vector store', async () => {
			const vectorStore = await assistantService.createVectorStore(
				'Test Vector Store'
			);

			expect(vectorStore).toHaveProperty('id', 'vs_123');
			expect(vectorStore).toHaveProperty('name', 'Test Vector Store');
		});
	});
});
