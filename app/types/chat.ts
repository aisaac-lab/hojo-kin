// Shared type definitions for chat functionality

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
}

export interface ChatResponse {
  threadId?: string;
  messages?: string[];
  error?: string;
  success?: boolean;
  responseId?: string;
}

import type { EnhancedSubsidyFilter } from './enhanced-filter';

export interface ChatRequest {
  message: string;
  threadId: string;
  userId: string;
  filters?: EnhancedSubsidyFilter;
}