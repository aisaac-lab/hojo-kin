/**
 * Common error handling utilities
 */

/**
 * Create a standardized error message
 */
export function createErrorMessage(
  operation: string,
  error: unknown
): string {
  return `Failed to ${operation}: ${
    error instanceof Error ? error.message : 'Unknown error'
  }`;
}

/**
 * Handle service layer errors
 */
export function handleServiceError(
  operation: string,
  error: unknown,
  ErrorClass: new (message: string, code: string) => Error,
  errorCode: string
): never {
  const message = createErrorMessage(operation, error);
  throw new ErrorClass(message, errorCode);
}

/**
 * Handle database errors for Result type
 */
export function handleDatabaseError<T>(
  operation: string,
  error: unknown,
  createError: (code: string, message: string) => T
): T {
  const message = createErrorMessage(operation, error);
  return createError('QUERY_ERROR', message);
}

/**
 * Log error with context
 */
export function logError(
  context: string,
  operation: string,
  error: unknown
): void {
  console.error(`[${context}] ${operation} error:`, error);
  if (error instanceof Error && error.stack) {
    console.error(`[${context}] Stack:`, error.stack);
  }
}

/**
 * Extract error details safely
 */
export function getErrorDetails(error: unknown): {
  message: string;
  code?: string;
  stack?: string;
} {
  if (error instanceof Error) {
    return {
      message: error.message,
      code: (error as any).code,
      stack: error.stack,
    };
  }
  
  if (typeof error === 'string') {
    return { message: error };
  }
  
  return { message: 'Unknown error' };
}

/**
 * Type guard for specific error types
 */
export function isErrorWithCode(error: unknown): error is Error & { code: string } {
  return error instanceof Error && 'code' in error && typeof (error as any).code === 'string';
}