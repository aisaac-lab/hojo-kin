/**
 * Drizzle ORM Database Module
 * Following functional programming patterns from instructions
 */

import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { resolve } from 'path';
import * as schema from './schema';
import { eq, and } from 'drizzle-orm';
import { Result, ok, err } from '../types/result';
import { DatabaseError, createDatabaseError } from '../types/errors';

// Database singleton
let client: ReturnType<typeof createClient> | null = null;
let drizzleDb: ReturnType<typeof drizzle> | null = null;

// Initialize database connection
async function getDb() {
	if (!drizzleDb) {
		try {
			// Get database path from env or use default
			const envUrl = process.env.DATABASE_URL;
			let dbPath: string;

			if (envUrl) {
				// Remove 'file:' prefix and resolve relative paths
				const cleanPath = envUrl.replace('file:', '');
				dbPath =
					cleanPath.startsWith('./') || cleanPath.startsWith('../')
						? resolve(process.cwd(), cleanPath)
						: cleanPath;
			} else {
				// Default to db/dev.db
				dbPath = resolve(process.cwd(), 'db', 'dev.db');
			}

			console.log('[DB] Initializing database with path:', dbPath);
			console.log('[DB] Database URL from env:', envUrl);
			console.log('[DB] Current working directory:', process.cwd());
			
			// Check if we're using Turso (remote database)
			const tursoUrl = process.env.TURSO_DATABASE_URL;
			const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;
			
			if (tursoUrl && tursoAuthToken) {
				// Using Turso with embedded replica
				console.log('[DB] Using Turso database with embedded replica');
				console.log('[DB] Turso URL:', tursoUrl.replace(/\/\/.*@/, '//***@')); // Hide credentials
				
				try {
					client = createClient({
						url: tursoUrl,
						authToken: tursoAuthToken,
						// Add timeout settings
						intMode: 'number',
					});
					
					// Test connection
					console.log('[DB] Testing Turso connection...');
					await client.execute('SELECT 1');
					console.log('[DB] Turso connection successful');
				} catch (tursoError) {
					console.error('[DB] Failed to connect to Turso:', tursoError);
					throw new Error(`Turso connection failed: ${tursoError instanceof Error ? tursoError.message : 'Unknown error'}`);
				}
			} else {
				// Using local SQLite file
				console.log('[DB] Using local SQLite file');
				client = createClient({
					url: `file:${dbPath}`,
				});
			}
			drizzleDb = drizzle(client, { schema });
			
			console.log('[DB] Database initialized successfully');
		} catch (error) {
			console.error('[DB] Failed to initialize database:', error);
			throw new Error(`Database initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}
	return drizzleDb;
}

// Close database connection
export function closeDb(): void {
	if (client) {
		client.close();
		client = null;
		drizzleDb = null;
	}
}

// Thread repository functions
export const threadRepository = {
	async create(data: {
		threadId: string;
		userId?: string;
		metadata?: string;
	}): Promise<Result<schema.Thread, DatabaseError>> {
		try {
			const db = await getDb();
			const [thread] = await db
				.insert(schema.threads)
				.values({
					threadId: data.threadId,
					userId: data.userId,
					metadata: data.metadata,
				})
				.returning();

			return ok(thread);
		} catch (error) {
			return err(
				createDatabaseError(
					'QUERY_ERROR',
					`Failed to create thread: ${
						error instanceof Error ? error.message : 'Unknown error'
					}`
				)
			);
		}
	},

	async findUnique(
		threadId: string
	): Promise<
		Result<schema.Thread & { messages: schema.Message[] }, DatabaseError>
	> {
		try {
			const db = await getDb();
			const [thread] = await db
				.select()
				.from(schema.threads)
				.where(eq(schema.threads.threadId, threadId))
				.limit(1);

			if (!thread) {
				return err(createDatabaseError('NOT_FOUND', 'Thread not found'));
			}

			const threadMessages = await db
				.select()
				.from(schema.messages)
				.where(eq(schema.messages.threadId, threadId));

			return ok({
				...thread,
				messages: threadMessages,
			});
		} catch (error) {
			return err(
				createDatabaseError(
					'QUERY_ERROR',
					`Failed to find thread: ${
						error instanceof Error ? error.message : 'Unknown error'
					}`
				)
			);
		}
	},

	async findMany(
		userId?: string
	): Promise<Result<schema.Thread[], DatabaseError>> {
		try {
			const db = await getDb();
			const threads = userId
				? await db
						.select()
						.from(schema.threads)
						.where(eq(schema.threads.userId, userId))
				: await db.select().from(schema.threads);

			return ok(threads);
		} catch (error) {
			return err(
				createDatabaseError(
					'QUERY_ERROR',
					`Failed to find threads: ${
						error instanceof Error ? error.message : 'Unknown error'
					}`
				)
			);
		}
	},
};

// Message repository functions
export const messageRepository = {
	async create(data: {
		threadId: string;
		role: 'user' | 'assistant';
		content: string;
	}): Promise<Result<schema.Message, DatabaseError>> {
		try {
			const db = await getDb();
			const [message] = await db
				.insert(schema.messages)
				.values({
					threadId: data.threadId,
					role: data.role,
					content: data.content,
				})
				.returning();

			// Update thread's updated_at
			await db
				.update(schema.threads)
				.set({ updatedAt: new Date().toISOString() })
				.where(eq(schema.threads.threadId, data.threadId));

			return ok(message);
		} catch (error) {
			return err(
				createDatabaseError(
					'QUERY_ERROR',
					`Failed to create message: ${
						error instanceof Error ? error.message : 'Unknown error'
					}`
				)
			);
		}
	},
};

// Subsidy repository functions
export const subsidyRepository = {
	async upsert(
		data: schema.NewSubsidy
	): Promise<Result<schema.Subsidy, DatabaseError>> {
		try {
			const db = await getDb();

			// Check if exists
			const [existing] = await db
				.select()
				.from(schema.subsidies)
				.where(eq(schema.subsidies.jgrantsId, data.jgrantsId))
				.limit(1);

			if (existing) {
				// Update
				const [updated] = await db
					.update(schema.subsidies)
					.set({
						...data,
						updatedAt: new Date().toISOString(),
					})
					.where(eq(schema.subsidies.jgrantsId, data.jgrantsId))
					.returning();

				return ok(updated);
			} else {
				// Insert
				const [inserted] = await db
					.insert(schema.subsidies)
					.values(data)
					.returning();

				return ok(inserted);
			}
		} catch (error) {
			return err(
				createDatabaseError(
					'QUERY_ERROR',
					`Failed to upsert subsidy: ${
						error instanceof Error ? error.message : 'Unknown error'
					}`
				)
			);
		}
	},

	async update(
		id: number,
		data: Partial<Pick<schema.Subsidy, 'vectorStoreId' | 'fileId'>>
	): Promise<Result<void, DatabaseError>> {
		try {
			const db = await getDb();

			await db
				.update(schema.subsidies)
				.set({
					...data,
					updatedAt: new Date().toISOString(),
				})
				.where(eq(schema.subsidies.id, id));

			return ok(undefined);
		} catch (error) {
			return err(
				createDatabaseError(
					'QUERY_ERROR',
					`Failed to update subsidy: ${
						error instanceof Error ? error.message : 'Unknown error'
					}`
				)
			);
		}
	},

	async findMany(): Promise<Result<schema.Subsidy[], DatabaseError>> {
		try {
			const db = await getDb();
			const subsidies = await db.select().from(schema.subsidies);
			return ok(subsidies);
		} catch (error) {
			return err(
				createDatabaseError(
					'QUERY_ERROR',
					`Failed to find subsidies: ${
						error instanceof Error ? error.message : 'Unknown error'
					}`
				)
			);
		}
	},

	async findUnique(where: {
		id?: number;
		jgrantsId?: string;
	}): Promise<Result<schema.Subsidy | null, DatabaseError>> {
		try {
			const db = await getDb();
			let query;

			if (where.id !== undefined) {
				query = db
					.select()
					.from(schema.subsidies)
					.where(eq(schema.subsidies.id, where.id));
			} else if (where.jgrantsId) {
				query = db
					.select()
					.from(schema.subsidies)
					.where(eq(schema.subsidies.jgrantsId, where.jgrantsId));
			} else {
				return err(
					createDatabaseError(
						'INVALID_INPUT',
						'Must provide either id or jgrantsId'
					)
				);
			}

			const [subsidy] = await query.limit(1);
			return ok(subsidy || null);
		} catch (error) {
			return err(
				createDatabaseError(
					'QUERY_ERROR',
					`Failed to find subsidy: ${
						error instanceof Error ? error.message : 'Unknown error'
					}`
				)
			);
		}
	},
};

// Export db wrapper for direct access with Prisma-compatible interface
export const db = {
	thread: {
		create: async (args: { data: any }) => {
			const result = await threadRepository.create(args.data);
			if (!result.ok) throw new Error(result.error.message);
			return result.value;
		},
		findUnique: async (args: {
			where: { threadId: string };
			include?: { messages: boolean };
		}) => {
			const result = await threadRepository.findUnique(args.where.threadId);
			if (!result.ok) {
				if (result.error.type === 'NOT_FOUND') return null;
				throw new Error(result.error.message);
			}
			return result.value;
		},
		findMany: async (args?: {
			where?: { userId?: string };
			orderBy?: { updatedAt: 'desc' };
		}) => {
			const result = await threadRepository.findMany(args?.where?.userId);
			if (!result.ok) throw new Error(result.error.message);
			return result.value;
		},
	},
	message: {
		create: async (args: { data: any }) => {
			const result = await messageRepository.create(args.data);
			if (!result.ok) throw new Error(result.error.message);
			return result.value;
		},
		findFirst: async (args?: {
			where?: { threadId?: string; role?: 'user' | 'assistant' };
			orderBy?: { createdAt: 'desc' };
		}) => {
			const db = await getDb();

			if (args?.where?.threadId && args?.where?.role) {
				const messages = await db
					.select()
					.from(schema.messages)
					.where(
						and(
							eq(schema.messages.threadId, args.where.threadId),
							eq(schema.messages.role, args.where.role)
						)
					)
					.limit(1);
				return messages[0] || null;
			} else if (args?.where?.threadId) {
				const messages = await db
					.select()
					.from(schema.messages)
					.where(eq(schema.messages.threadId, args.where.threadId))
					.limit(1);
				return messages[0] || null;
			} else if (args?.where?.role) {
				const messages = await db
					.select()
					.from(schema.messages)
					.where(eq(schema.messages.role, args.where.role))
					.limit(1);
				return messages[0] || null;
			} else {
				const messages = await db.select().from(schema.messages).limit(1);
				return messages[0] || null;
			}
		},
	},
	subsidy: {
		create: async (args: { data: any }) => {
			const result = await subsidyRepository.upsert(args.data);
			if (!result.ok) throw new Error(result.error.message);
			return result.value;
		},
		upsert: async (args: {
			where: { jgrantsId: string };
			create: any;
			update: any;
		}) => {
			const result = await subsidyRepository.upsert(args.create);
			if (!result.ok) throw new Error(result.error.message);
			return result.value;
		},
		update: async (args: { where: { id: number }; data: any }) => {
			const result = await subsidyRepository.update(args.where.id, args.data);
			if (!result.ok) throw new Error(result.error.message);
		},
		findMany: async () => {
			const result = await subsidyRepository.findMany();
			if (!result.ok) throw new Error(result.error.message);
			return result.value;
		},
		findUnique: async (args: {
			where: { id?: number; jgrantsId?: string };
		}) => {
			const result = await subsidyRepository.findUnique(args.where);
			if (!result.ok) throw new Error(result.error.message);
			return result.value;
		},
	},
	// Direct access to drizzle methods
	insert: async (table: any) => (await getDb()).insert(table),
	select: async () => (await getDb()).select(),
	update: async (table: any) => (await getDb()).update(table),
	delete: async (table: any) => (await getDb()).delete(table),
	$disconnect: async () => {
		closeDb();
	},
};
