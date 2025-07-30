/**
 * Domain error types following functional programming patterns
 */

// Assistant service errors
export type AssistantError =
  | { type: 'MISSING_ASSISTANT_ID'; message: string }
  | { type: 'INVALID_PARAMS'; message: string }
  | { type: 'CREATE_ASSISTANT_FAILED'; message: string }
  | { type: 'ADD_MESSAGE_FAILED'; message: string }
  | { type: 'RUN_FAILED'; message: string }
  | { type: 'VECTOR_STORE_ERROR'; message: string }
  | { type: 'FILE_UPLOAD_ERROR'; message: string };

// Database errors
export type DatabaseError =
  | { type: 'CONNECTION_ERROR'; message: string }
  | { type: 'QUERY_ERROR'; message: string }
  | { type: 'NOT_FOUND'; message: string }
  | { type: 'INVALID_INPUT'; message: string };

// API errors
export type ApiError =
  | { type: 'NETWORK_ERROR'; message: string }
  | { type: 'VALIDATION_ERROR'; message: string }
  | { type: 'UNAUTHORIZED'; message: string }
  | { type: 'SERVER_ERROR'; message: string };

// Helper function to create error messages
export function createAssistantError(
  type: AssistantError['type'],
  message: string
): AssistantError {
  return { type, message } as AssistantError;
}

export function createDatabaseError(
  type: DatabaseError['type'],
  message: string
): DatabaseError {
  return { type, message } as DatabaseError;
}

export function createApiError(
  type: ApiError['type'],
  message: string
): ApiError {
  return { type, message } as ApiError;
}