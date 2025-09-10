import { z } from 'zod';
import { ValidationError } from './error-handling.js';
import { AOConfigSchema, AOConfig } from '../../types/config.js';

export class Validator {
  static validateConfig(config: any): AOConfig {
    try {
      return AOConfigSchema.parse(config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(
          'Invalid configuration',
          error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
        );
      }
      throw error;
    }
  }

  static validateProcessName(name: string): boolean {
    if (!name || typeof name !== 'string') {
      return false;
    }
    
    // Process names should be alphanumeric with hyphens and underscores
    const nameRegex = /^[a-zA-Z0-9_-]+$/;
    return nameRegex.test(name) && name.length <= 50;
  }

  static validateLuaFile(filePath: string): boolean {
    if (!filePath || typeof filePath !== 'string') {
      return false;
    }
    
    return filePath.endsWith('.lua') && filePath.length > 0;
  }

  static validateWalletPath(path: string): boolean {
    if (!path || typeof path !== 'string') {
      return false;
    }
    
    // Basic validation - should be a file path
    return path.length > 0 && !path.includes('..');
  }

  static validateCronExpression(expression: string): boolean {
    if (!expression || typeof expression !== 'string') {
      return false;
    }
    
    // Simple validation for common cron patterns
    const validPatterns = [
      /^\d+-(second|minute|hour|day|week|month)$/,
      /^\d+-(seconds|minutes|hours|days|weeks|months)$/
    ];
    
    return validPatterns.some(pattern => pattern.test(expression));
  }

  static validateModuleId(id: string): boolean {
    if (!id || typeof id !== 'string') {
      return false;
    }
    
    // Basic validation for Arweave transaction IDs
    const txIdRegex = /^[a-zA-Z0-9_-]{43}$/;
    return txIdRegex.test(id);
  }

  static validateTags(tags: Record<string, string>): boolean {
    if (!tags || typeof tags !== 'object') {
      return false;
    }
    
    for (const [key, value] of Object.entries(tags)) {
      if (typeof key !== 'string' || typeof value !== 'string') {
        return false;
      }
      
      if (key.length === 0 || value.length === 0) {
        return false;
      }
    }
    
    return true;
  }
} 