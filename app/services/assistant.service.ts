/**
 * Unified Assistant Service
 * Combines the best of both class-based and functional implementations
 */

import OpenAI from 'openai';
import { threadRepository, messageRepository } from '../utils/database-simple';
import { handleServiceError } from '../utils/error-handling';
import { processThreadMetadata } from '../utils/metadata';
import { createLogger } from '../utils/logger';

const logger = createLogger('AssistantService');

export class AssistantServiceError extends Error {
	constructor(message: string, public code: string) {
		super(message);
		this.name = 'AssistantServiceError';
	}
}

// Value objects for type safety
export type AssistantId = string & { _brand: 'AssistantId' };
export type ThreadId = string & { _brand: 'ThreadId' };
export type VectorStoreId = string & { _brand: 'VectorStoreId' };

// Domain types
export interface Thread {
	id: ThreadId;
	userId?: string;
	metadata?: Record<string, string>;
}

export interface Message {
	threadId: ThreadId;
	role: 'user' | 'assistant';
	content: string;
}

// Validation functions
function validateAssistantId(id: string | undefined): AssistantId {
	if (!id) {
		throw new AssistantServiceError(
			'OPENAI_ASSISTANT_ID is not set in environment variables',
			'MISSING_ASSISTANT_ID'
		);
	}
	return id as AssistantId;
}

function validateApiKey(apiKey: string | undefined): string {
	if (!apiKey) {
		throw new AssistantServiceError(
			'OPENAI_API_KEY is not set in environment variables',
			'MISSING_API_KEY'
		);
	}
	return apiKey;
}

export class AssistantService {
	private openai: OpenAI;
	private assistantId: AssistantId;

	constructor(apiKey?: string, assistantId?: string) {
		const validatedApiKey = validateApiKey(
			apiKey || process.env.OPENAI_API_KEY
		);
		this.assistantId = validateAssistantId(
			assistantId || process.env.OPENAI_ASSISTANT_ID
		);

		this.openai = new OpenAI({
			apiKey: validatedApiKey,
		});

		logger.info('AssistantService initialized');
	}

	async createAssistant(
		name: string,
		instructions: string,
		vectorStoreId?: VectorStoreId
	) {
		if (!name || !instructions) {
			throw new AssistantServiceError(
				'Name and instructions are required to create an assistant',
				'INVALID_PARAMS'
			);
		}

		try {
			logger.debug(`Creating assistant: ${name}`);

			const tools = [{ type: 'file_search' as const }];
			const toolResources = vectorStoreId
				? {
						file_search: {
							vector_store_ids: [vectorStoreId],
						},
				  }
				: undefined;

			const assistant = await this.openai.beta.assistants.create({
				name,
				instructions,
				model: 'gpt-4.1-mini',
				tools,
				tool_resources: toolResources,
			});

			this.assistantId = assistant.id as AssistantId;
			logger.info(`Assistant created successfully: ${assistant.id}`);

			return assistant;
		} catch (error) {
			handleServiceError(
				'create assistant',
				error,
				AssistantServiceError,
				'CREATE_ASSISTANT_FAILED'
			);
		}
	}

	async createThread(
		userId?: string,
		metadata?: Record<string, any>
	): Promise<Thread> {
		try {
			logger.debug('Creating thread', { userId });

			const threadMetadata = processThreadMetadata(userId, metadata);
			const thread = await this.openai.beta.threads.create(
				Object.keys(threadMetadata).length > 0
					? { metadata: threadMetadata }
					: {}
			);

			const result = await threadRepository.create({
				threadId: thread.id,
				userId,
				metadata: metadata ? JSON.stringify(metadata) : undefined,
			});

			if ('ok' in result && !result.ok) {
				throw new Error(result.error.message);
			}

			logger.info(`Thread created: ${thread.id}`);

			return {
				id: thread.id as ThreadId,
				userId,
				metadata: threadMetadata,
			};
		} catch (error) {
			handleServiceError(
				'create thread',
				error,
				AssistantServiceError,
				'CREATE_THREAD_FAILED'
			);
		}
	}

	async addMessage(
		threadId: string,
		content: string,
		role: 'user' | 'assistant' = 'user'
	): Promise<Message> {
		if (!threadId || !content) {
			throw new AssistantServiceError(
				'Thread ID and content are required',
				'INVALID_PARAMS'
			);
		}

		try {
			logger.debug(`Adding ${role} message to thread ${threadId}`);

			const message = await this.openai.beta.threads.messages.create(threadId, {
				role,
				content,
			});

			const msgResult = await messageRepository.create({
				threadId,
				role,
				content,
			});

			if ('ok' in msgResult && !msgResult.ok) {
				throw new Error(msgResult.error.message);
			}

			logger.info(`Message added to thread ${threadId}`);

			return {
				threadId: threadId as ThreadId,
				role,
				content,
			};
		} catch (error) {
			handleServiceError(
				'add message',
				error,
				AssistantServiceError,
				'ADD_MESSAGE_FAILED'
			);
		}
	}

	async runAssistant(threadId: string, additionalInstructions?: string) {
		try {
			logger.debug(`Running assistant on thread ${threadId}`);

			// Get the ID of the last assistant message before running
			const messagesBefore = await this.openai.beta.threads.messages.list(
				threadId
			);
			const lastAssistantMessageId = messagesBefore.data.find(
				(msg) => msg.role === 'assistant'
			)?.id;

			const run = await this.openai.beta.threads.runs.create(threadId, {
				assistant_id: this.assistantId,
				additional_instructions: additionalInstructions,
			});

			logger.debug(`Run created: ${run.id}`);

			const messages = await this.waitForRunCompletion(threadId, run.id);

			return {
				messages,
				lastAssistantMessageIdBefore: lastAssistantMessageId,
			};
		} catch (error) {
			handleServiceError(
				'run assistant',
				error,
				AssistantServiceError,
				'RUN_FAILED'
			);
		}
	}

	private async waitForRunCompletion(threadId: string, runId: string) {
		let run = await this.openai.beta.threads.runs.retrieve(threadId, runId);
		let delay = 100; // Start with 100ms
		const maxDelay = 1000; // Max 1 second
		const delayMultiplier = 1.5; // Exponential backoff multiplier

		while (run.status === 'queued' || run.status === 'in_progress') {
			logger.debug(`Run ${runId} status: ${run.status}, polling delay: ${delay}ms`);
			await new Promise((resolve) => setTimeout(resolve, delay));
			
			// Exponential backoff: increase delay for next iteration
			delay = Math.min(delay * delayMultiplier, maxDelay);
			
			run = await this.openai.beta.threads.runs.retrieve(threadId, runId);
		}

		if (run.status === 'completed') {
			logger.info(`Run ${runId} completed successfully`);

			const messages = await this.openai.beta.threads.messages.list(threadId);
			const assistantMessages = messages.data.filter(
				(msg) => msg.role === 'assistant'
			);

			// Save new assistant messages to database
			if (assistantMessages.length > 0) {
				const latestMessage = assistantMessages[0];
				const content = latestMessage.content[0];

				if (content.type === 'text') {
					const msgResult = await messageRepository.create({
						threadId,
						role: 'assistant',
						content: content.text.value,
					});

					if ('ok' in msgResult && !msgResult.ok) {
						throw new Error(msgResult.error.message);
					}
				}
			}

			return messages;
		}

		// Include more error details
		const errorDetails =
			run.status === 'failed' && run.last_error
				? ` - ${run.last_error.code}: ${run.last_error.message}`
				: '';

		logger.error(
			`Run ${runId} failed with status: ${run.status}${errorDetails}`
		);
		throw new AssistantServiceError(
			`Run failed with status: ${run.status}${errorDetails}`,
			'RUN_FAILED'
		);
	}

	async getMessages(threadId: string) {
		logger.debug(`Getting messages for thread ${threadId}`);
		return await this.openai.beta.threads.messages.list(threadId);
	}

	// Expose openai instance for streaming (temporary solution)
	get openaiClient() {
		return this.openai;
	}

	async getThread(threadId: string) {
		logger.debug(`Getting thread ${threadId}`);
		const result = await threadRepository.findUnique(threadId);
		if ('ok' in result && !result.ok) {
			throw new Error(result.error.message);
		}
		return result.value;
	}

	async listThreads(userId?: string) {
		logger.debug('Listing threads', { userId });
		const result = await threadRepository.findMany(userId);
		if ('ok' in result && !result.ok) {
			throw new Error(result.error.message);
		}
		return result.value;
	}

	async createVectorStore(name: string) {
		try {
			logger.debug(`Creating vector store: ${name}`);
			const vectorStore = await this.openai.vectorStores.create({ name });
			logger.info(`Vector store created: ${vectorStore.id}`);
			return vectorStore;
		} catch (error) {
			handleServiceError(
				'create vector store',
				error,
				AssistantServiceError,
				'VECTOR_STORE_ERROR'
			);
		}
	}

	async uploadFileToVectorStore(vectorStoreId: string, file: File) {
		try {
			logger.debug(`Uploading file to vector store ${vectorStoreId}`);

			const fileStream = file.stream();
			const openaiFile = await this.openai.files.create({
				file: fileStream as any, // Type mismatch between Web File API and Node.js streams
				purpose: 'assistants',
			});

			await this.openai.vectorStores.files.create(vectorStoreId, {
				file_id: openaiFile.id,
			});

			logger.info(`File uploaded to vector store: ${openaiFile.id}`);
			return openaiFile;
		} catch (error) {
			handleServiceError(
				'upload file to vector store',
				error,
				AssistantServiceError,
				'FILE_UPLOAD_ERROR'
			);
		}
	}

	async updateAssistantVectorStore(vectorStoreId: string) {
		try {
			logger.debug(
				`Updating assistant ${this.assistantId} with vector store ${vectorStoreId}`
			);

			const assistant = await this.openai.beta.assistants.update(
				this.assistantId,
				{
					tool_resources: {
						file_search: {
							vector_store_ids: [vectorStoreId],
						},
					},
				}
			);

			logger.info(`Assistant vector store updated`);
			return assistant;
		} catch (error) {
			handleServiceError(
				'update assistant vector store',
				error,
				AssistantServiceError,
				'UPDATE_VECTOR_STORE_ERROR'
			);
		}
	}
}

// Factory function for creating service from environment
export function createAssistantServiceFromEnv(): AssistantService {
	return new AssistantService();
}

// Export a singleton instance for convenience
export const assistantService = createAssistantServiceFromEnv();
