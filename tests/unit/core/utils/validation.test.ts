import { describe, it, expect } from '@jest/globals';
import { Validator } from '../../../../src/core/utils/validation';
import { ValidationError } from '../../../../src/core/utils/error-handling';
import { createMockConfig } from '../../../setup';

describe('Validator', () => {
  describe('validateConfig', () => {
    it('should validate a correct config', () => {
      const config = createMockConfig();
      const result = Validator.validateConfig(config);
      expect(result).toEqual(config);
    });

    it('should throw ValidationError for invalid config', () => {
      const invalidConfig = {
        packageManager: 'invalid-package-manager',
        framework: 'invalid-framework'
      };

      expect(() => {
        Validator.validateConfig(invalidConfig);
      }).toThrow(ValidationError);
    });
  });

  describe('validateProcessName', () => {
    it('should validate correct process names', () => {
      expect(Validator.validateProcessName('my-process')).toBe(true);
      expect(Validator.validateProcessName('process_123')).toBe(true);
      expect(Validator.validateProcessName('MyProcess')).toBe(true);
    });

    it('should reject invalid process names', () => {
      expect(Validator.validateProcessName('')).toBe(false);
      expect(Validator.validateProcessName('my process')).toBe(false);
      expect(Validator.validateProcessName('my@process')).toBe(false);
      expect(Validator.validateProcessName('a'.repeat(51))).toBe(false);
    });
  });

  describe('validateLuaFile', () => {
    it('should validate correct Lua file paths', () => {
      expect(Validator.validateLuaFile('contract.lua')).toBe(true);
      expect(Validator.validateLuaFile('src/contract.lua')).toBe(true);
      expect(Validator.validateLuaFile('./contract.lua')).toBe(true);
    });

    it('should reject invalid Lua file paths', () => {
      expect(Validator.validateLuaFile('')).toBe(false);
      expect(Validator.validateLuaFile('contract.txt')).toBe(false);
      expect(Validator.validateLuaFile('contract')).toBe(false);
    });
  });

  describe('validateCronExpression', () => {
    it('should validate correct cron expressions', () => {
      expect(Validator.validateCronExpression('1-minute')).toBe(true);
      expect(Validator.validateCronExpression('30-seconds')).toBe(true);
      expect(Validator.validateCronExpression('2-hours')).toBe(true);
    });

    it('should reject invalid cron expressions', () => {
      expect(Validator.validateCronExpression('')).toBe(false);
      expect(Validator.validateCronExpression('1-minute-invalid')).toBe(false);
      expect(Validator.validateCronExpression('invalid')).toBe(false);
    });
  });
}); 