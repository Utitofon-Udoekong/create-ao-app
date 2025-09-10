import { logger } from './logging.js';

export class ForgeError extends Error {
  public code: string;
  public details?: any;

  constructor(message: string, code: string, details?: any) {
    super(message);
    this.name = 'ForgeError';
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends ForgeError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class ProcessError extends ForgeError {
  constructor(message: string, details?: any) {
    super(message, 'PROCESS_ERROR', details);
    this.name = 'ProcessError';
  }
}

export class AIError extends ForgeError {
  constructor(message: string, details?: any) {
    super(message, 'AI_ERROR', details);
    this.name = 'AIError';
  }
}

export class ErrorHandler {
  static handle(error: Error): void {
    if (error instanceof ForgeError) {
      logger.error(`${error.name}: ${error.message}`);
      if (error.details) {
        logger.debug('Error details:', error.details);
      }
    } else {
      logger.error(`Unexpected error: ${error.message}`);
      logger.debug('Stack trace:', error.stack);
    }
  }

  static async withRetry<T>(
    fn: () => Promise<T>,
    retries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        logger.warn(`Attempt ${i + 1} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
        }
      }
    }

    throw lastError!;
  }

  static async withTimeout<T>(
    fn: () => Promise<T>,
    timeout: number = 30000
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new ForgeError(`Operation timed out after ${timeout}ms`, 'TIMEOUT_ERROR'));
        }, timeout);
      })
    ]);
  }
} 