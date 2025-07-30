// Type definitions for OpenAI Assistant integration
import type { MessagesPage } from 'openai/resources/beta/threads/messages';

// These are kept as separate type aliases for semantic clarity,
// even though they're structurally identical (all strings).
// This makes the code more self-documenting about what each ID represents.

export type AssistantId = string;
export type ThreadId = string;
export type VectorStoreId = string;

export interface AssistantRunResult {
  messages: MessagesPage;
  lastAssistantMessageIdBefore?: string;
}

export interface ThreadMetadata {
  userId?: string;
  [key: string]: any;
}