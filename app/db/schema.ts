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

// Review logs table
export const reviewLogs = sqliteTable('review_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  threadId: text('thread_id').notNull(),
  userQuestion: text('user_question').notNull(),
  originalResponse: text('original_response').notNull(),
  finalResponse: text('final_response').notNull(),
  action: text('action', { enum: ['approve', 'regenerate', 'ask_clarification'] }).notNull(),
  scores: text('scores').notNull(), // JSON string
  lowestScoreCategory: text('lowest_score_category').notNull(),
  lowestScoreValue: integer('lowest_score_value').notNull(),
  issues: text('issues').notNull(), // JSON string
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Validation loops table for tracking feedback loop history
export const validationLoops = sqliteTable('validation_loops', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  threadId: text('thread_id').notNull(),
  userQuestion: text('user_question').notNull(),
  loopNumber: integer('loop_number').notNull(),
  reviewScores: text('review_scores').notNull(), // JSON string of scores
  lowestScoreCategory: text('lowest_score_category').notNull(),
  lowestScoreValue: integer('lowest_score_value').notNull(),
  improvementHints: text('improvement_hints'), // JSON array of hints
  scoreImprovement: integer('score_improvement').notNull(),
  response: text('response').notNull(),
  action: text('action').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Validation results table for final outcomes
export const validationResults = sqliteTable('validation_results', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  threadId: text('thread_id').notNull(),
  userQuestion: text('user_question').notNull(),
  initialResponse: text('initial_response').notNull(),
  finalResponse: text('final_response').notNull(),
  bestResponse: text('best_response').notNull(),
  totalLoops: integer('total_loops').notNull(),
  totalImprovement: integer('total_improvement').notNull(),
  bestScores: text('best_scores').notNull(), // JSON string
  failurePatterns: text('failure_patterns'), // JSON array
  successPatterns: text('success_patterns'), // JSON array
  duration: integer('duration').notNull(), // milliseconds
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Type exports for TypeScript
export type Thread = typeof threads.$inferSelect;
export type NewThread = typeof threads.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type Subsidy = typeof subsidies.$inferSelect;
export type NewSubsidy = typeof subsidies.$inferInsert;
export type ReviewLog = typeof reviewLogs.$inferSelect;
export type NewReviewLog = typeof reviewLogs.$inferInsert;
export type ValidationLoop = typeof validationLoops.$inferSelect;
export type NewValidationLoop = typeof validationLoops.$inferInsert;
export type ValidationResult = typeof validationResults.$inferSelect;
export type NewValidationResult = typeof validationResults.$inferInsert;