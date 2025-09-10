import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AICommand } from '../../../../src/core/commands/ai';
import { Command } from 'commander';

// Mock dependencies
jest.mock('../../../../src/core/managers/ai-manager');
jest.mock('../../../../src/core/managers/config-manager');
jest.mock('fs-extra');

// Mock console methods
const mockConsole = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

global.console = mockConsole as any;

describe('AICommand', () => {
  let command: AICommand;
  let program: Command;

  beforeEach(() => {
    command = new AICommand();
    program = new Command();
    jest.clearAllMocks();

    // Mock the constructors with simple implementations
    const { AIManager } = require('../../../../src/core/managers/ai-manager');
    AIManager.mockImplementation(() => ({
      // @ts-expect-error
      initialize: jest.fn().mockResolvedValue(undefined),
      // @ts-expect-error
      generateCode: jest.fn().mockResolvedValue({ code: 'test', metadata: {}, validation: { valid: true, errors: [], warnings: [], suggestions: [] } }),
      // @ts-expect-error
      refactorCode: jest.fn().mockResolvedValue({ code: 'test', metadata: {}, validation: { valid: true, errors: [], warnings: [], suggestions: [] } }),
      // @ts-expect-error
      generateTests: jest.fn().mockResolvedValue({ code: 'test', metadata: {}, validation: { valid: true, errors: [], warnings: [], suggestions: [] } }),
      // @ts-expect-error
      analyzeCode: jest.fn().mockResolvedValue({ suggestions: [], improvements: [], issues: [], complexity: 'low' }),
      // @ts-expect-error
      generateFromTemplate: jest.fn().mockResolvedValue({ code: 'test', metadata: {}, validation: { valid: true, errors: [], warnings: [], suggestions: [] } })
    }));

    const { ConfigManager } = require('../../../../src/core/managers/config-manager');
    ConfigManager.mockImplementation(() => ({
      // @ts-expect-error
      loadConfig: jest.fn().mockResolvedValue({})
    }));
  });

  describe('initialization', () => {
    it('should create AI command with correct properties', () => {
      expect(command.name).toBe('ai');
      expect(command.description).toBe('AI-powered code generation and assistance');
      expect(command.options.length).toBeGreaterThanOrEqual(8);
    });

    it('should have correct option flags', () => {
      const optionFlags = command.options.map(opt => opt.flag);
      expect(optionFlags).toContain('-p, --prompt <text>');
      expect(optionFlags).toContain('-f, --file <path>');
      expect(optionFlags).toContain('-i, --interactive');
      expect(optionFlags).toContain('--refactor');
      expect(optionFlags).toContain('--test');
      expect(optionFlags).toContain('--analyze');
      expect(optionFlags).toContain('--template <name>');
      expect(optionFlags).toContain('--optimize <type>');
      expect(optionFlags).toContain('--document <format>');
      expect(optionFlags).toContain('--audit');
      expect(optionFlags).toContain('--batch <operation>');
      expect(optionFlags).toContain('--migrate <framework>');
      expect(optionFlags).toContain('--integration-tests <type>');
      expect(optionFlags).toContain('-o, --output <path>');
      expect(optionFlags).toContain('--provider <name>');
      expect(optionFlags).toContain('--model <name>');
      expect(optionFlags).toContain('--temperature <number>');
    });
  });

  describe('registration', () => {
    it('should register command with program', () => {
      expect(() => command.register(program)).not.toThrow();
    });

    it('should add command to program', () => {
      command.register(program);
      const commands = program.commands;
      expect(commands).toHaveLength(1);
      expect(commands[0].name()).toBe('ai');
    });
  });

  describe('execution', () => {
    it('should generate code from prompt successfully', async () => {
      const options = {
        prompt: 'Create a counter contract',
        provider: 'openai',
        output: 'counter.lua'
      };

      await command.execute(options);

      const { AIManager } = require('../../../../src/core/managers/ai-manager');
      const mockAIManager = AIManager.mock.results[0].value;
      expect(mockAIManager.initialize).toHaveBeenCalled();
      expect(mockAIManager.generateCode).toHaveBeenCalled();
    });

    it('should handle missing action gracefully', async () => {
      const options = {};

      await command.execute(options);

      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('No action specified')
      );
    });
  });

  describe('help text', () => {
    it('should return help text with examples', () => {
      const helpText = command['getHelpText']();
      expect(helpText).toContain('AI-powered code generation');
      expect(helpText).toContain('Examples:');
      expect(helpText).toContain('ao-forge ai --prompt');
      expect(helpText).toContain('Supported providers: openai, anthropic');
    });
  });
}); 