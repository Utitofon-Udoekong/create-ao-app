import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { BaseCommand } from '../../../../src/core/commands/base-command';
import { Command } from 'commander';

// Mock console methods
const mockConsole = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

global.console = mockConsole as any;

// Create a concrete implementation of BaseCommand for testing
class TestCommand extends BaseCommand {
  name = 'test';
  description = 'Test command';
  options = [
    {
      flag: '-n, --name <name>',
      description: 'Test name',
      required: true
    },
    {
      flag: '-o, --optional <value>',
      description: 'Optional value',
      required: false
    }
  ];

  async execute(options: any): Promise<void> {
    this.logStart('Test command executed');
    this.logSuccess('Test command completed');
  }

  // Expose protected methods for testing
  public testLogStart(message: string): void {
    this.logStart(message);
  }

  public testLogSuccess(message: string): void {
    this.logSuccess(message);
  }

  public testLogError(message: string, error?: Error): void {
    this.logError(message, error);
  }

  public testGetHelpText(): string {
    return this.getHelpText();
  }
}

class InvalidCommand extends BaseCommand {
  name = ''; // Invalid: empty name
  description = 'Invalid command';
  options = [];

  async execute(options: any): Promise<void> {
    // Implementation
  }
}

describe('BaseCommand', () => {
  let command: TestCommand;
  let program: Command;

  beforeEach(() => {
    command = new TestCommand();
    program = new Command();
    jest.clearAllMocks();
  });

  describe('validation', () => {
    it('should validate correct command', () => {
      expect(() => new TestCommand()).not.toThrow();
    });

    it('should throw error for invalid command name during registration', () => {
      const invalidCommand = new InvalidCommand();
      expect(() => invalidCommand.register(program)).toThrow('Command must have a valid name');
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
      expect(commands[0].name()).toBe('test');
    });
  });

  describe('logging methods', () => {
    it('should log start message', () => {
      command.testLogStart('Test message');
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('Starting: Test message')
      );
    });

    it('should log success message', () => {
      command.testLogSuccess('Test message');
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('Completed: Test message')
      );
    });

    it('should log error message', () => {
      const error = new Error('Test error');
      command.testLogError('Test message', error);
      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed: Test message')
      );
    });
  });

  describe('help text', () => {
    it('should return empty help text by default', () => {
      expect(command.testGetHelpText()).toBe('');
    });
  });
}); 