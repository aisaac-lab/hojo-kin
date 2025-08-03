import OpenAI from 'openai';
import { db } from '../db.server';

export class AssistantServiceError extends Error {
	constructor(message: string, public code: string) {
		super(message);
		this.name = 'AssistantServiceError';
	}
}

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
});

export class AssistantService {
	private assistantId: string;

	constructor() {
		const assistantId = process.env.OPENAI_ASSISTANT_ID;
		if (!assistantId) {
			throw new AssistantServiceError(
				'OPENAI_ASSISTANT_ID is not set in environment variables',
				'MISSING_ASSISTANT_ID'
			);
		}
		this.assistantId = assistantId;
	}

	async createAssistant(
		name: string,
		instructions: string,
		vectorStoreId?: string
	) {
		if (!name || !instructions) {
			throw new AssistantServiceError(
				'Name and instructions are required to create an assistant',
				'INVALID_PARAMS'
			);
		}

		try {
			const tools = [{ type: 'file_search' as const }];

			const toolResources = vectorStoreId
				? {
						file_search: {
							vector_store_ids: [vectorStoreId],
						},
				  }
				: undefined;

			const assistant = await openai.beta.assistants.create({
				name,
				instructions,
				model: 'gpt-4-turbo-preview',
				tools,
				tool_resources: toolResources,
			});

			this.assistantId = assistant.id;
			return assistant;
		} catch (error) {
			throw new AssistantServiceError(
				`Failed to create assistant: ${
					error instanceof Error ? error.message : 'Unknown error'
				}`,
				'CREATE_ASSISTANT_FAILED'
			);
		}
	}

	async createThread(userId?: string, metadata?: Record<string, any>) {
		const threadMetadata: Record<string, string> = {};
		if (userId) {
			threadMetadata.userId = userId;
		}
		if (metadata) {
			Object.entries(metadata).forEach(([key, value]) => {
				threadMetadata[key] = String(value);
			});
		}

		const thread = await openai.beta.threads.create(
			Object.keys(threadMetadata).length > 0 ? { metadata: threadMetadata } : {}
		);

		await db.thread.create({
			data: {
				threadId: thread.id,
				userId,
				metadata: metadata ? JSON.stringify(metadata) : null,
			},
		});

		return thread;
	}

	async addMessage(
		threadId: string,
		content: string,
		role: 'user' | 'assistant' = 'user'
	) {
		if (!threadId || !content) {
			throw new AssistantServiceError(
				'Thread ID and content are required',
				'INVALID_PARAMS'
			);
		}

		try {
			const message = await openai.beta.threads.messages.create(threadId, {
				role,
				content,
			});

			await db.message.create({
				data: {
					threadId,
					role,
					content,
				},
			});

			return message;
		} catch (error) {
			throw new AssistantServiceError(
				`Failed to add message: ${
					error instanceof Error ? error.message : 'Unknown error'
				}`,
				'ADD_MESSAGE_FAILED'
			);
		}
	}

	async runAssistant(threadId: string, additionalInstructions?: string) {
		// Get the ID of the last assistant message before running
		const messagesBefore = await openai.beta.threads.messages.list(threadId);
		const lastAssistantMessageId = messagesBefore.data.find(
			(msg) => msg.role === 'assistant'
		)?.id;

		const run = await openai.beta.threads.runs.create(threadId, {
			assistant_id: this.assistantId,
			additional_instructions: additionalInstructions,
		});

		const result = await this.waitForRunCompletion(threadId, run.id);

		// Return the messages along with the last message ID from before
		return {
			messages: result,
			lastAssistantMessageIdBefore: lastAssistantMessageId,
		};
	}

	private async waitForRunCompletion(threadId: string, runId: string) {
		let run = await openai.beta.threads.runs.retrieve(threadId, runId);

		while (run.status === 'queued' || run.status === 'in_progress') {
			await new Promise((resolve) => setTimeout(resolve, 1000));
			run = await openai.beta.threads.runs.retrieve(threadId, runId);
		}

		if (run.status === 'completed') {
			const messages = await openai.beta.threads.messages.list(threadId);
			const assistantMessages = messages.data.filter(
				(msg) => msg.role === 'assistant'
			);

			if (assistantMessages.length > 0) {
				const latestMessage = assistantMessages[0];
				const content = latestMessage.content[0];

				if (content.type === 'text') {
					await db.message.create({
						data: {
							threadId,
							role: 'assistant',
							content: content.text.value,
						},
					});
				}
			}

			return messages;
		}

		// Include more error details
		const errorDetails = run.status === 'failed' && run.last_error 
			? ` - ${run.last_error.code}: ${run.last_error.message}`
			: '';
		throw new Error(`Run failed with status: ${run.status}${errorDetails}`);
	}

	async getMessages(threadId: string) {
		return await openai.beta.threads.messages.list(threadId);
	}
	
	async getThread(threadId: string) {
		return await db.thread.findUnique({
			where: { threadId },
			include: { messages: true },
		});
	}

	async listThreads(userId?: string) {
		return await db.thread.findMany({
			where: userId ? { userId } : undefined,
			orderBy: { updatedAt: 'desc' },
		});
	}

	async createVectorStore(name: string) {
		return await openai.vectorStores.create({
			name,
		});
	}

	async uploadFileToVectorStore(vectorStoreId: string, file: File) {
		const fileStream = file.stream();

		const openaiFile = await openai.files.create({
			file: fileStream as any, // Type mismatch between Web File API and Node.js streams
			purpose: 'assistants',
		});

		await openai.vectorStores.files.create(vectorStoreId, {
			file_id: openaiFile.id,
		});

		return openaiFile;
	}

	async updateAssistantVectorStore(vectorStoreId: string) {
		return await openai.beta.assistants.update(this.assistantId, {
			tool_resources: {
				file_search: {
					vector_store_ids: [vectorStoreId],
				},
			},
		});
	}
}
