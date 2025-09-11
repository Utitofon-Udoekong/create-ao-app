import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { CLI } from '../../../src/core/cli';
import { PluginManager } from '../../../src/core/plugins/plugin-manager';

// Mock dependencies
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
  let mockPluginManager: jest.Mocked<PluginManager>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup mock plugin manager
    mockPluginManager = {
      // @ts-expect-error
      executeHook: jest.fn().mockResolvedValue(undefined),
      getPluginCount: jest.fn().mockReturnValue(0)
    } as any;

    // Mock the constructors
    const { PluginManager } = require('../../../src/core/plugins/plugin-manager');
    PluginManager.mockImplementation(() => mockPluginManager);

    cli = new CLI();
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      expect(cli).toBeDefined();
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

  describe('getProgram', () => {
    it('should return the commander program', () => {
      const program = cli.getProgram();
      expect(program).toBeDefined();
      expect(program.name()).toBe('ao-forge');
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
    it('should initialize and parse arguments', async () => {
      const mockArgs = ['node', 'script', '--help'];
      
      // Mock process.exit to prevent actual exit
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      try {
        await cli.run(mockArgs);
      } catch (error: any) {
        // Expected to throw due to process.exit mock
        expect(error.message).toBe('process.exit called');
      }

      expect(mockPluginManager.executeHook).toHaveBeenCalled();
      mockExit.mockRestore();
    });
  });

  describe('showHelp', () => {
    it('should display help information', () => {
      // Mock process.exit to prevent actual exit
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      try {
        cli.showHelp();
      } catch (error: any) {
        // Expected to throw due to process.exit mock
        expect(error.message).toBe('process.exit called');
      }

      // The help method should have been called (it exits the process)
      mockExit.mockRestore();
    });
  });
}); 