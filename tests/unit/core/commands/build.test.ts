import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { BuildCommand } from '../../../../src/core/commands/build';
import { Command } from 'commander';

// Mock dependencies
jest.mock('../../../../src/core/managers/project-manager');
jest.mock('../../../../src/core/managers/config-manager');
jest.mock('../../../../src/core/managers/process-manager');
jest.mock('fs-extra');
jest.mock('child_process');
jest.mock('util', () => ({
  // @ts-expect-error - Jest mock typing issue
  promisify: jest.fn(() => jest.fn().mockResolvedValue({ stdout: '', stderr: '' }))
}));

// Mock console methods
const mockConsole = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

global.console = mockConsole as any;

describe('BuildCommand', () => {
  let command: BuildCommand;
  let program: Command;

  beforeEach(() => {
    command = new BuildCommand();
    program = new Command();
    jest.clearAllMocks();

    // Mock fs-extra methods
    const fs = require('fs-extra') as any;
    // @ts-expect-error - Jest mock typing issue
    fs.pathExists = jest.fn().mockResolvedValue(true);
    // @ts-expect-error - Jest mock typing issue
    fs.ensureDir = jest.fn().mockResolvedValue(undefined);
    // @ts-expect-error - Jest mock typing issue
    fs.remove = jest.fn().mockResolvedValue(undefined);
    // @ts-expect-error - Jest mock typing issue
    fs.copy = jest.fn().mockResolvedValue(undefined);
    // @ts-expect-error - Jest mock typing issue
    fs.writeJSON = jest.fn().mockResolvedValue(undefined);
    // @ts-expect-error - Jest mock typing issue
    fs.readdir = jest.fn().mockResolvedValue([]);


    // Mock managers
    const { ProjectManager } = require('../../../../src/core/managers/project-manager') as any;
    const { ConfigManager } = require('../../../../src/core/managers/config-manager') as any;
    const { ProcessManager } = require('../../../../src/core/managers/process-manager') as any;
    
    ProjectManager.mockImplementation(() => ({}));
    ConfigManager.mockImplementation(() => ({
      // @ts-expect-error - Jest mock typing issue
      loadConfig: jest.fn().mockResolvedValue({
        framework: 'nextjs',
        packageManager: 'npm'
      })
    }));
    ProcessManager.mockImplementation(() => ({}));
  });

  describe('initialization', () => {
    it('should create build command with correct properties', () => {
      expect(command.name).toBe('build');
      expect(command.description).toBe('Build the project for production');
      expect(command.options.length).toBe(2);
    });

    it('should have correct option flags', () => {
      const optionFlags = command.options.map(opt => opt.flag);
      expect(optionFlags).toContain('-o, --output <dir>');
      expect(optionFlags).toContain('--clean');
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
      expect(commands[0].name()).toBe('build');
    });
  });

  describe('execution', () => {
    it('should execute build command successfully', async () => {
      await expect(command.execute({ output: 'dist' })).resolves.not.toThrow();
    });

    it('should log start and success messages', async () => {
      await command.execute({ output: 'dist' });
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('Starting: Building project for production')
      );
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('Completed: Project built successfully')
      );
    });
  });

  describe('help text', () => {
    it('should return help text with examples', () => {
      const helpText = command['getHelpText']();
      expect(helpText).toContain('Examples:');
      expect(helpText).toContain('ao-forge build');
      expect(helpText).toContain('ao-forge build -o ./build');
      expect(helpText).toContain('ao-forge build --clean');
    });
  });
}); 