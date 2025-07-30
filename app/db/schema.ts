/**
 * Drizzle ORM Schema Definition
 * Following functional programming patterns
 */

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Threads table
export const threads = sqliteTable('threads', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  threadId: text('thread_id').notNull().unique(),
  userId: text('user_id'),
  metadata: text('metadata'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Messages table
export const messages = sqliteTable('messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  threadId: text('thread_id').notNull().references(() => threads.threadId),
  role: text('role', { enum: ['user', 'assistant'] }).notNull(),
  content: text('content').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Subsidies table
export const subsidies = sqliteTable('subsidies', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  jgrantsId: text('jgrants_id').notNull().unique(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  targetAudience: text('target_audience'),
  amount: text('amount'),
  deadline: text('deadline'),
  requirements: text('requirements'),
  applicationUrl: text('application_url'),
  ministry: text('ministry'),
  vectorStoreId: text('vector_store_id'),
  fileId: text('file_id'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Type exports for TypeScript
export type Thread = typeof threads.$inferSelect;
export type NewThread = typeof threads.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type Subsidy = typeof subsidies.$inferSelect;
export type NewSubsidy = typeof subsidies.$inferInsert;