/**
 * Functional implementation of the Assistant Service
 * Following functional programming and domain-driven design patterns
 */

import OpenAI from 'openai';
import { db } from '../db.server';
import { Result, ok, err } from '../types/result';
import { AssistantError, createAssistantError } from '../types/errors';

// Value objects
type AssistantId = string & { _brand: 'AssistantId' };
type ThreadId = string & { _brand: 'ThreadId' };
type VectorStoreId = string & { _brand: 'VectorStoreId' };

// Domain types
interface Thread {
	id: ThreadId;
	userId?: string;
	metadata?: Record<string, string>;
}

interface Message {
	threadId: ThreadId;
	role: 'user' | 'assistant';
	content: string;
}

interface AssistantConfig {
	apiKey: string;
	assistantId: AssistantId;
}

// Pure functions for OpenAI client creation
function createOpenAIClient(apiKey: string): OpenAI {
	return new OpenAI({ apiKey });
}

// Validation functions
function validateAssistantId(
	id: string | undefined
): Result<AssistantId, AssistantError> {
	if (!id) {
		return err(
			createAssistantError(
				'MISSING_ASSISTANT_ID',
				'OPENAI_ASSISTANT_ID is not set in environment variables'
			)
		);
	}
	return ok(id as AssistantId);
}

function validateCreateAssistantParams(
	name: string,
	instructions: string
): Result<{ name: string; instructions: string }, AssistantError> {
	if (!name || !instructions) {
		return err(
			createAssistantError(
				'INVALID_PARAMS',
				'Name and instructions are required to create an assistant'
			)
		);
	}
	return ok({ name, instructions });
}

// Assistant operations
export function createAssistantService(config: AssistantConfig) {
	const openai = createOpenAIClient(config.apiKey);

	// Create assistant
	async function createAssistant(
		name: string,
		instructions: string,
		vectorStoreId?: VectorStoreId
	): Promise<Result<OpenAI.Beta.Assistant, AssistantError>> {
		const validation = validateCreateAssistantParams(name, instructions);
		if (!validation.ok) return validation;

		try {
			const tools = [{ type: 'file_search' as const }];
			const toolResources = vectorStoreId
				? { file_search: { vector_store_ids: [vectorStoreId] } }
				: undefined;

			const assistant = await openai.beta.assistants.create({
				name,
				instructions,
				model: 'gpt-4-turbo-preview',
				tools,
				tool_resources: toolResources,
			});

			return ok(assistant);
		} catch (error) {
			return err(
				createAssistantError(
					'CREATE_ASSISTANT_FAILED',
					`Failed to create assistant: ${
						error instanceof Error ? error.message : 'Unknown error'
					}`
				)
			);
		}
	}

	// Thread operations
	async function createThread(
		userId?: string,
		metadata?: Record<string, any>
	): Promise<Result<Thread, AssistantError>> {
		try {
			const threadMetadata: Record<string, string> = {};
			if (userId) threadMetadata.userId = userId;
			if (metadata) {
				Object.entries(metadata).forEach(([key, value]) => {
					threadMetadata[key] = String(value);
				});
			}

			const thread = await openai.beta.threads.create(
				Object.keys(threadMetadata).length > 0
					? { metadata: threadMetadata }
					: {}
			);

			// Save to database
			await db.thread.create({
				data: {
					threadId: thread.id,
					userId,
					metadata: metadata ? JSON.stringify(metadata) : null,
				},
			});

			return ok({
				id: thread.id as ThreadId,
				userId,
				metadata: threadMetadata,
			});
		} catch (error) {
			return err(
				createAssistantError(
					'CREATE_ASSISTANT_FAILED',
					`Failed to create thread: ${
						error instanceof Error ? error.message : 'Unknown error'
					}`
				)
			);
		}
	}

	// Message operations
	async function addMessage(
		threadId: ThreadId,
		content: string,
		role: 'user' | 'assistant' = 'user'
	): Promise<Result<Message, AssistantError>> {
		if (!threadId || !content) {
			return err(
				createAssistantError(
					'INVALID_PARAMS',
					'Thread ID and content are required'
				)
			);
		}

		try {
			const message = await openai.beta.threads.messages.create(threadId, {
				role,
				content,
			});

			await db.message.create({
				data: { threadId, role, content },
			});

			return ok({ threadId, role, content });
		} catch (error) {
			return err(
				createAssistantError(
					'ADD_MESSAGE_FAILED',
					`Failed to add message: ${
						error instanceof Error ? error.message : 'Unknown error'
					}`
				)
			);
		}
	}

	// Run assistant
	async function runAssistant(
		threadId: ThreadId,
		additionalInstructions?: string
	): Promise<
		Result<OpenAI.Beta.Threads.Messages.MessagesPage, AssistantError>
	> {
		try {
			const run = await openai.beta.threads.runs.create(threadId, {
				assistant_id: config.assistantId,
				additional_instructions: additionalInstructions,
			});

			const completedRun = await waitForRunCompletion(openai, threadId, run.id);
			if (!completedRun.ok) return completedRun;

			const messages = await openai.beta.threads.messages.list(threadId);

			// Save assistant messages to database
			const assistantMessages = messages.data.filter(
				(msg) => msg.role === 'assistant'
			);
			for (const msg of assistantMessages) {
				if (msg.content[0]?.type === 'text') {
					await db.message.create({
						data: {
							threadId,
							role: 'assistant',
							content: msg.content[0].text.value,
						},
					});
				}
			}

			return ok(messages);
		} catch (error) {
			return err(
				createAssistantError(
					'RUN_FAILED',
					`Failed to run assistant: ${
						error instanceof Error ? error.message : 'Unknown error'
					}`
				)
			);
		}
	}

	// Vector store operations
	async function createVectorStore(
		name: string
	): Promise<Result<OpenAI.VectorStore, AssistantError>> {
		try {
			const vectorStore = await openai.vectorStores.create({ name });
			return ok(vectorStore);
		} catch (error) {
			return err(
				createAssistantError(
					'VECTOR_STORE_ERROR',
					`Failed to create vector store: ${
						error instanceof Error ? error.message : 'Unknown error'
					}`
				)
			);
		}
	}

	async function uploadFileToVectorStore(
		vectorStoreId: VectorStoreId,
		file: File
	): Promise<Result<OpenAI.FileObject, AssistantError>> {
		try {
			const fileStream = file.stream();
			const openaiFile = await openai.files.create({
				file: fileStream as any,
				purpose: 'assistants',
			});

			await openai.vectorStores.files.create(vectorStoreId, {
				file_id: openaiFile.id,
			});

			return ok(openaiFile);
		} catch (error) {
			return err(
				createAssistantError(
					'FILE_UPLOAD_ERROR',
					`Failed to upload file: ${
						error instanceof Error ? error.message : 'Unknown error'
					}`
				)
			);
		}
	}

	return {
		createAssistant,
		createThread,
		addMessage,
		runAssistant,
		createVectorStore,
		uploadFileToVectorStore,
	};
}

// Helper function for waiting for run completion
async function waitForRunCompletion(
	openai: OpenAI,
	threadId: ThreadId,
	runId: string
): Promise<Result<OpenAI.Beta.Threads.Runs.Run, AssistantError>> {
	let run = await openai.beta.threads.runs.retrieve(threadId, runId);

	while (run.status === 'queued' || run.status === 'in_progress') {
		await new Promise((resolve) => setTimeout(resolve, 1000));
		run = await openai.beta.threads.runs.retrieve(threadId, runId);
	}

	if (run.status === 'completed') {
		return ok(run);
	}

	return err(
		createAssistantError('RUN_FAILED', `Run failed with status: ${run.status}`)
	);
}

// Factory function for creating service from environment
export function createAssistantServiceFromEnv(): Result<
	ReturnType<typeof createAssistantService>,
	AssistantError
> {
	const apiKey = process.env.OPENAI_API_KEY;
	if (!apiKey) {
		return err(
			createAssistantError(
				'INVALID_PARAMS',
				'OPENAI_API_KEY is not set in environment variables'
			)
		);
	}

	const assistantIdResult = validateAssistantId(
		process.env.OPENAI_ASSISTANT_ID
	);
	if (!assistantIdResult.ok) return assistantIdResult;

	return ok(
		createAssistantService({
			apiKey,
			assistantId: assistantIdResult.value,
		})
	);
}
