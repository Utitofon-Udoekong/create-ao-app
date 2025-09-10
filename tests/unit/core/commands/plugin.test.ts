import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PluginCommand } from '../../../../src/core/commands/plugin';
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

describe('PluginCommand', () => {
  let command: PluginCommand;
  let program: Command;

  beforeEach(() => {
    command = new PluginCommand();
    program = new Command();
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should create plugin command with correct properties', () => {
      expect(command.name).toBe('plugin');
      expect(command.description).toBe('Manage Forge plugins');
      expect(command.options).toHaveLength(8);
    });

    it('should have correct option flags', () => {
      const optionFlags = command.options.map(opt => opt.flag);
      expect(optionFlags).toContain('-i, --install <plugin>');
      expect(optionFlags).toContain('-u, --uninstall <plugin>');
      expect(optionFlags).toContain('-l, --list');
      expect(optionFlags).toContain('-e, --enable <plugin>');
      expect(optionFlags).toContain('-d, --disable <plugin>');
      expect(optionFlags).toContain('-s, --search <query>');
      expect(optionFlags).toContain('-U, --update <plugin>');
      expect(optionFlags).toContain('--registry <url>');
    });

    it('should not have conflicting option flags', () => {
      const flags = command.options.map(opt => opt.flag);
      const shortFlags = flags
        .map(flag => flag.split(',')[0].trim())
        .filter(flag => flag.startsWith('-') && !flag.startsWith('--'));
      
      const uniqueShortFlags = new Set(shortFlags);
      expect(shortFlags.length).toBe(uniqueShortFlags.size);
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
      expect(commands[0].name()).toBe('plugin');
    });
  });

  describe('execution', () => {
    it('should execute plugin command successfully with no options', async () => {
      await expect(command.execute({})).resolves.not.toThrow();
    });

    it('should log start and success messages', async () => {
      await command.execute({});
      
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('Starting: Managing plugins')
      );
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('Completed: Plugin operation completed successfully')
      );
    });

    it('should handle install option', async () => {
      await command.execute({ install: 'test-plugin' });
      
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('Starting: Installing plugin: test-plugin')
      );
    });

    it('should handle list option', async () => {
      await command.execute({ list: true });
      
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('Starting: Listing installed plugins')
      );
    });
  });

  describe('help text', () => {
    it('should return help text with examples', () => {
      const helpText = command['getHelpText']();
      expect(helpText).toContain('Plugin Management');
      expect(helpText).toContain('Install plugins to extend Forge');
      expect(helpText).toContain('ao-forge plugin --install @ao-forge-ao/typescript');
    });
  });
}); 