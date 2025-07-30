/**
 * Result type for functional error handling
 * Following the pattern from instructions/typescript.md
 */
export type Result<T, E> = 
  | { ok: true; value: T }
  | { ok: false; error: E };

export function ok<T, E>(value: T): Result<T, E> {
  return { ok: true, value };
}

export function err<T, E>(error: E): Result<T, E> {
  return { ok: false, error };
}

// Helper function to map successful results
export function mapResult<T, E, U>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> {
  if (result.ok) {
    return ok(fn(result.value));
  }
  return result;
}

// Helper function for async result handling
export async function mapResultAsync<T, E, U>(
  result: Result<T, E>,
  fn: (value: T) => Promise<U>
): Promise<Result<U, E>> {
  if (result.ok) {
    return ok(await fn(result.value));
  }
  return result;
}