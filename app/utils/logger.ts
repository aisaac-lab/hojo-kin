/**
 * Logger utility for consistent logging across the application
 */

export interface Logger {
  log: (message: string, ...args: any[]) => void;
  error: (message: string, error?: unknown) => void;
  warn: (message: string, ...args: any[]) => void;
  info: (message: string, ...args: any[]) => void;
  debug: (message: string, ...args: any[]) => void;
}

/**
 * Create a logger with a specific prefix
 */
export function createLogger(prefix: string): Logger {
  const formatMessage = (level: string, message: string) => {
    return `[${prefix}] ${message}`;
  };

  return {
    log: (message: string, ...args: any[]) => {
      console.log(formatMessage('LOG', message), ...args);
    },
    
    error: (message: string, error?: unknown) => {
      console.error(formatMessage('ERROR', message));
      if (error) {
        if (error instanceof Error) {
          console.error(`[${prefix}] Error details:`, error.message);
          if (error.stack) {
            console.error(`[${prefix}] Stack trace:`, error.stack);
          }
        } else {
          console.error(`[${prefix}] Error details:`, error);
        }
      }
    },
    
    warn: (message: string, ...args: any[]) => {
      console.warn(formatMessage('WARN', message), ...args);
    },
    
    info: (message: string, ...args: any[]) => {
      console.log(formatMessage('INFO', message), ...args);
    },
    
    debug: (message: string, ...args: any[]) => {
      if (process.env.NODE_ENV === 'development') {
        console.log(formatMessage('DEBUG', message), ...args);
      }
    },
  };
}

/**
 * Default loggers for common contexts
 */
export const serverLogger = createLogger('SERVER');
export const databaseLogger = createLogger('DATABASE');
export const apiLogger = createLogger('API');
export const scriptLogger = createLogger('SCRIPT');

/**
 * Log operation timing
 */
export async function logTiming<T>(
  logger: Logger,
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  
  try {
    logger.debug(`${operation} started`);
    const result = await fn();
    const duration = Date.now() - start;
    logger.debug(`${operation} completed in ${duration}ms`);
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    logger.error(`${operation} failed after ${duration}ms`, error);
    throw error;
  }
}