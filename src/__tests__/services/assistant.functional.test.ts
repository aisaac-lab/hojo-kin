/**
 * Tests for functional assistant service
 * Following TDD principles from instructions/tdd.md
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAssistantService } from '../../../app/services/assistant.service';
import { ok, err } from '../../../app/types/result';
import { createAssistantError } from '../../../app/types/errors';

// Mock OpenAI
vi.mock('openai', () => ({
	default: vi.fn().mockImplementation(() => ({
		beta: {
			assistants: {
				create: vi.fn(),
				update: vi.fn(),
			},
			threads: {
				create: vi.fn(),
				messages: {
					create: vi.fn(),
					list: vi.fn(),
				},
				runs: {
					create: vi.fn(),
					retrieve: vi.fn(),
				},
			},
		},
		vectorStores: {
			create: vi.fn(),
			files: {
				create: vi.fn(),
			},
		},
		files: {
			create: vi.fn(),
		},
	})),
}));

// Mock db
vi.mock('../../../app/db.server', () => ({
	db: {
		thread: {
			create: vi.fn(),
		},
		message: {
			create: vi.fn(),
		},
	},
}));

describe('createAssistantService', () => {
	const mockConfig = {
		apiKey: 'test-api-key',
		assistantId: 'test-assistant-id' as any,
	};

	let service: ReturnType<typeof createAssistantService>;
	let mockOpenAI: any;

	beforeEach(() => {
		vi.clearAllMocks();
		service = createAssistantService(mockConfig);

		// Get mocked OpenAI instance
		const OpenAI = require('openai').default;
		mockOpenAI = new OpenAI();
	});

	describe('createThread', () => {
		it('should successfully create a thread without metadata', async () => {
			// Arrange
			const expectedThreadId = 'thread_123';
			mockOpenAI.beta.threads.create.mockResolvedValue({
				id: expectedThreadId,
			});

			const { db } = require('../../../app/db.server');
			db.thread.create.mockResolvedValue({});

			// Act
			const result = await service.createThread();

			// Assert
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.id).toBe(expectedThreadId);
				expect(result.value.userId).toBeUndefined();
				expect(result.value.metadata).toEqual({});
			}

			expect(mockOpenAI.beta.threads.create).toHaveBeenCalledWith({});
			expect(db.thread.create).toHaveBeenCalledWith({
				data: {
					threadId: expectedThreadId,
					userId: undefined,
					metadata: null,
				},
			});
		});

		it('should successfully create a thread with userId and metadata', async () => {
			// Arrange
			const expectedThreadId = 'thread_456';
			const userId = 'user_123';
			const metadata = { category: 'subsidy', region: 'tokyo' };

			mockOpenAI.beta.threads.create.mockResolvedValue({
				id: expectedThreadId,
			});

			const { db } = require('../../../app/db.server');
			db.thread.create.mockResolvedValue({});

			// Act
			const result = await service.createThread(userId, metadata);

			// Assert
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.id).toBe(expectedThreadId);
				expect(result.value.userId).toBe(userId);
				expect(result.value.metadata).toEqual({
					userId,
					category: 'subsidy',
					region: 'tokyo',
				});
			}

			expect(mockOpenAI.beta.threads.create).toHaveBeenCalledWith({
				metadata: {
					userId,
					category: 'subsidy',
					region: 'tokyo',
				},
			});
		});

		it('should handle OpenAI API errors', async () => {
			// Arrange
			const errorMessage = 'API rate limit exceeded';
			mockOpenAI.beta.threads.create.mockRejectedValue(new Error(errorMessage));

			// Act
			const result = await service.createThread();

			// Assert
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.type).toBe('CREATE_ASSISTANT_FAILED');
				expect(result.error.message).toContain(errorMessage);
			}
		});
	});

	describe('addMessage', () => {
		it('should successfully add a user message', async () => {
			// Arrange
			const threadId = 'thread_123' as any;
			const content = 'IT補助金について教えてください';
			const messageId = 'msg_123';

			mockOpenAI.beta.threads.messages.create.mockResolvedValue({
				id: messageId,
			});

			const { db } = require('../../../app/db.server');
			db.message.create.mockResolvedValue({});

			// Act
			const result = await service.addMessage(threadId, content);

			// Assert
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.threadId).toBe(threadId);
				expect(result.value.content).toBe(content);
				expect(result.value.role).toBe('user');
			}

			expect(mockOpenAI.beta.threads.messages.create).toHaveBeenCalledWith(
				threadId,
				{ role: 'user', content }
			);
		});

		it('should validate required parameters', async () => {
			// Act
			const result = await service.addMessage('' as any, 'content');

			// Assert
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.type).toBe('INVALID_PARAMS');
				expect(result.error.message).toBe('Thread ID and content are required');
			}
		});
	});

	describe('createVectorStore', () => {
		it('should successfully create a vector store', async () => {
			// Arrange
			const storeName = 'Subsidy Database';
			const storeId = 'vs_123';

			mockOpenAI.vectorStores.create.mockResolvedValue({
				id: storeId,
				name: storeName,
			});

			// Act
			const result = await service.createVectorStore(storeName);

			// Assert
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.id).toBe(storeId);
				expect(result.value.name).toBe(storeName);
			}

			expect(mockOpenAI.vectorStores.create).toHaveBeenCalledWith({
				name: storeName,
			});
		});

		it('should handle vector store creation errors', async () => {
			// Arrange
			const errorMessage = 'Insufficient permissions';
			mockOpenAI.vectorStores.create.mockRejectedValue(new Error(errorMessage));

			// Act
			const result = await service.createVectorStore('test');

			// Assert
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.type).toBe('VECTOR_STORE_ERROR');
				expect(result.error.message).toContain(errorMessage);
			}
		});
	});

	describe('runAssistant', () => {
		it('should successfully run assistant and save response', async () => {
			// Arrange
			const threadId = 'thread_123' as any;
			const runId = 'run_123';
			const assistantMessage = 'IT導入補助金は中小企業向けの補助金です。';

			mockOpenAI.beta.threads.runs.create.mockResolvedValue({
				id: runId,
				status: 'queued',
			});

			mockOpenAI.beta.threads.runs.retrieve
				.mockResolvedValueOnce({ id: runId, status: 'in_progress' })
				.mockResolvedValueOnce({ id: runId, status: 'completed' });

			mockOpenAI.beta.threads.messages.list.mockResolvedValue({
				data: [
					{
						role: 'assistant',
						content: [
							{
								type: 'text',
								text: { value: assistantMessage },
							},
						],
					},
				],
			});

			const { db } = require('../../../app/db.server');
			db.message.create.mockResolvedValue({});

			// Act
			const result = await service.runAssistant(threadId);

			// Assert
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.data).toHaveLength(1);
				expect((result.value.data[0].content[0] as any).text.value).toBe(
					assistantMessage
				);
			}

			expect(db.message.create).toHaveBeenCalledWith({
				data: {
					threadId,
					role: 'assistant',
					content: assistantMessage,
				},
			});
		});

		it('should handle run failure', async () => {
			// Arrange
			const threadId = 'thread_123' as any;
			const runId = 'run_123';

			mockOpenAI.beta.threads.runs.create.mockResolvedValue({
				id: runId,
				status: 'queued',
			});

			mockOpenAI.beta.threads.runs.retrieve.mockResolvedValue({
				id: runId,
				status: 'failed',
			});

			// Act
			const result = await service.runAssistant(threadId);

			// Assert
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.type).toBe('RUN_FAILED');
				expect(result.error.message).toContain('failed');
			}
		});
	});
});
