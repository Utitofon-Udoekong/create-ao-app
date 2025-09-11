import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { CLI } from '../../../src/core/cli';
import { CommandRegistry } from '../../../src/core/commands/registry';
import { PluginManager } from '../../../src/core/plugins/plugin-manager';

// Mock dependencies
jest.mock('../../../src/core/commands/registry');
jest.mock('../../../src/core/plugins/plugin-manager');
jest.mock('../../../src/core/utils/logging');

// Helper: create a mock BaseCommand
function createMockCommand(name = 'mock', description = 'desc') {
  return {
    name,
    description,
    options: [],
    // @ts-expect-error
    execute: jest.fn().mockResolvedValue(undefined),
    register: jest.fn(),
    addHelpText: jest.fn(),
    getHelpText: jest.fn().mockReturnValue(''),
    logStart: jest.fn(),
    logSuccess: jest.fn(),
    logError: jest.fn(),
    logInfo: jest.fn(),
    validateOptions: jest.fn()
  };
}

describe('CLI', () => {
  let cli: CLI;
  let mockRegistry: jest.Mocked<CommandRegistry>;
  let mockPluginManager: jest.Mocked<PluginManager>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup mock registry
    mockRegistry = {
      registerCommand: jest.fn(),
      getCommand: jest.fn(),
      getAllCommands: jest.fn().mockReturnValue([]),
      getCategories: jest.fn().mockReturnValue([]),
      getCommandsByCategory: jest.fn().mockReturnValue([]),
      getCommandCount: jest.fn().mockReturnValue(0),
      registerCommands: jest.fn()
    } as any;

    // Setup mock plugin manager
    mockPluginManager = {
      // @ts-expect-error
      executeHook: jest.fn().mockResolvedValue(undefined),
      getPluginCount: jest.fn().mockReturnValue(0)
    } as any;

    // Mock the constructors
    const { CommandRegistry } = require('../../../src/core/commands/registry');
    CommandRegistry.mockImplementation(() => mockRegistry);

    const { PluginManager } = require('../../../src/core/plugins/plugin-manager');
    PluginManager.mockImplementation(() => mockPluginManager);

    cli = new CLI();
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      expect(cli).toBeDefined();
      expect(CommandRegistry).toHaveBeenCalled();
      expect(PluginManager).toHaveBeenCalled();
    });

    it('should initialize with custom options', () => {
      const customCli = new CLI({
        name: 'custom-cli',
        version: '1.0.0',
        description: 'Custom CLI',
        enableDebug: true
      });

      expect(customCli).toBeDefined();
    });
  });

  describe('getRegistry', () => {
    it('should return the command registry', () => {
      const registry = cli.getRegistry();
      expect(registry).toBe(mockRegistry);
    });
  });

  describe('getPluginManager', () => {
    it('should return the plugin manager', () => {
      const pluginManager = cli.getPluginManager();
      expect(pluginManager).toBe(mockPluginManager);
    });
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      await cli.initialize();

      expect(mockPluginManager.executeHook).toHaveBeenCalledTimes(2); // CLI_INIT and CLI_READY
    });

    it('should handle initialization errors', async () => {
      mockPluginManager.executeHook.mockRejectedValueOnce(new Error('Init failed'));

      await expect(cli.initialize()).rejects.toThrow('Init failed');
    });
  });

  describe('run', () => {
    it('should show help when no arguments provided', async () => {
      const mockArgs = ['node', 'script'];
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      await cli.initialize();

      try {
        await cli.run(mockArgs);
      } catch (error: any) {
        expect(error.message).toBe('process.exit called');
      }

      mockExit.mockRestore();
    });

    it('should execute command when valid command provided', async () => {
      const mockCommand = createMockCommand('test-command', 'desc') as any;
      mockRegistry.getCommand.mockReturnValue(mockCommand);

      const mockArgs = ['node', 'script', 'test-command'];
      await cli.initialize();
      await cli.run(mockArgs);

      expect(mockRegistry.getCommand).toHaveBeenCalledWith('test-command');
      expect(mockCommand.execute).toHaveBeenCalled();
    });

    it('should handle unknown command', async () => {
      mockRegistry.getCommand.mockReturnValue(undefined);

      const mockArgs = ['node', 'script', 'unknown-command'];
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      await cli.initialize();

      try {
        await cli.run(mockArgs);
      } catch (error: any) {
        expect(error.message).toBe('process.exit called');
      }

      mockExit.mockRestore();
    });
  });

  describe('showHelp', () => {
    it('should display help information', () => {
      const mockCommands = [
        createMockCommand('init', 'Initialize project') as any,
        createMockCommand('build', 'Build project') as any
      ];

      mockRegistry.getAllCommands.mockReturnValue(mockCommands);
      mockRegistry.getCategories.mockReturnValue(['project']);
      mockRegistry.getCommandsByCategory.mockReturnValue(mockCommands);

      // Mock console.log to capture output
      const originalLog = console.log;
      const mockLog = jest.fn();
      console.log = mockLog;

      cli.showHelp();

      expect(mockLog).toHaveBeenCalled();

      console.log = originalLog;
    });
  });
}); 