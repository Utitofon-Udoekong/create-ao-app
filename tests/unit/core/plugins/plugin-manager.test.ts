import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PluginManager } from '../../../../src/core/plugins/plugin-manager';
import { Plugin, PluginContext, PluginHook } from '../../../../src/types/plugins';

// Mock console methods
const mockConsole = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

global.console = mockConsole as any;

// Mock CLI and CommandRegistry
const mockCLI = {
  getCommandRegistry: jest.fn(),
  getProgram: jest.fn(),
};

const mockCommandRegistry = {
  registerCommand: jest.fn(),
  getCommandCount: jest.fn(),
};

const mockContext: PluginContext = {
  cli: mockCLI as any,
  commandRegistry: mockCommandRegistry as any,
  config: {},
  logger: mockConsole,
  version: '2.0.0',
  platform: 'linux',
  arch: 'x64',
};

// Create test plugin
const createTestPlugin = (name: string, hooks?: any): Plugin => ({
  name,
  version: '1.0.0',
  description: 'Test plugin',
  activate: async () => Promise.resolve(),
  deactivate: async () => Promise.resolve(),
  hooks,
});

describe('PluginManager', () => {
  let pluginManager: PluginManager;

  beforeEach(() => {
    pluginManager = new PluginManager(mockContext);
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should create plugin manager with context', () => {
      expect(pluginManager).toBeInstanceOf(PluginManager);
    });

    it('should initialize hooks map', () => {
      expect(pluginManager.getPluginCount()).toBe(0);
    });
  });

  describe('plugin registration', () => {
    it('should register a valid plugin', () => {
      const plugin = createTestPlugin('test-plugin');
      
      expect(() => pluginManager.registerPlugin(plugin)).not.toThrow();
      expect(pluginManager.getPluginCount()).toBe(1);
      expect(pluginManager.getPlugin('test-plugin')).toBe(plugin);
    });

    it('should throw error for duplicate plugin registration', () => {
      const plugin1 = createTestPlugin('test-plugin');
      const plugin2 = createTestPlugin('test-plugin');
      
      pluginManager.registerPlugin(plugin1);
      
      expect(() => pluginManager.registerPlugin(plugin2)).toThrow(
        "Plugin 'test-plugin' is already registered"
      );
    });

    it('should throw error for invalid plugin name', () => {
      const plugin = createTestPlugin('test-plugin');
      plugin.name = '';
      
      expect(() => pluginManager.registerPlugin(plugin)).toThrow(
        'Plugin must have a valid name'
      );
    });

    it('should throw error for invalid plugin version', () => {
      const plugin = createTestPlugin('test-plugin');
      plugin.version = '';
      
      expect(() => pluginManager.registerPlugin(plugin)).toThrow(
        'Plugin must have a valid version'
      );
    });

    it('should throw error for missing activate function', () => {
      const plugin = createTestPlugin('test-plugin');
      plugin.activate = undefined as any;
      
      expect(() => pluginManager.registerPlugin(plugin)).toThrow(
        'Plugin must have an activate function'
      );
    });
  });

  describe('hook execution', () => {
    it('should execute hook with registered plugins', async () => {
      const hookHandler = jest.fn().mockImplementation(async () => 'hook-result');
      const plugin = createTestPlugin('test-plugin', {
        [PluginHook.CLI_INIT]: hookHandler,
      });
      
      pluginManager.registerPlugin(plugin);
      
      const result = await pluginManager.executeHook(PluginHook.CLI_INIT, 'test-data');
      
      expect(hookHandler).toHaveBeenCalledWith('test-data', mockContext);
      expect(result).toBe('hook-result');
    });

    it('should handle hook execution with no plugins', async () => {
      const result = await pluginManager.executeHook(PluginHook.CLI_INIT, 'test-data');
      
      expect(result).toBe('test-data');
    });

    it('should continue execution if one plugin fails', async () => {
      const failingPlugin = createTestPlugin('failing-plugin', {
        [PluginHook.CLI_INIT]: jest.fn().mockImplementation(async () => {
          throw new Error('Plugin error');
        }),
      });
      
      const workingPlugin = createTestPlugin('working-plugin', {
        [PluginHook.CLI_INIT]: jest.fn().mockImplementation(async () => 'working-result'),
      });
      
      pluginManager.registerPlugin(failingPlugin);
      pluginManager.registerPlugin(workingPlugin);
      
      const result = await pluginManager.executeHook(PluginHook.CLI_INIT, 'test-data');
      
      expect(result).toBe('working-result');
    });
  });

  describe('plugin management', () => {
    it('should get all plugins', () => {
      const plugin1 = createTestPlugin('plugin1');
      const plugin2 = createTestPlugin('plugin2');
      
      pluginManager.registerPlugin(plugin1);
      pluginManager.registerPlugin(plugin2);
      
      const allPlugins = pluginManager.getAllPlugins();
      expect(allPlugins).toHaveLength(2);
      expect(allPlugins).toContain(plugin1);
      expect(allPlugins).toContain(plugin2);
    });

    it('should get plugins by hook', () => {
      const plugin1 = createTestPlugin('plugin1', {
        [PluginHook.CLI_INIT]: jest.fn(),
      });
      const plugin2 = createTestPlugin('plugin2', {
        [PluginHook.BUILD_BEFORE]: jest.fn(),
      });
      
      pluginManager.registerPlugin(plugin1);
      pluginManager.registerPlugin(plugin2);
      
      const cliInitPlugins = pluginManager.getPluginsByHook(PluginHook.CLI_INIT);
      const buildPlugins = pluginManager.getPluginsByHook(PluginHook.BUILD_BEFORE);
      
      expect(cliInitPlugins).toHaveLength(1);
      expect(cliInitPlugins[0]).toBe(plugin1);
      expect(buildPlugins).toHaveLength(1);
      expect(buildPlugins[0]).toBe(plugin2);
    });

    it('should unload plugin successfully', async () => {
      const plugin = createTestPlugin('test-plugin');
      pluginManager.registerPlugin(plugin);
      
      expect(pluginManager.getPluginCount()).toBe(1);
      
      await pluginManager.unloadPlugin('test-plugin');
      
      expect(pluginManager.getPluginCount()).toBe(0);
      expect(pluginManager.getPlugin('test-plugin')).toBeUndefined();
    });

    it('should throw error when unloading non-existent plugin', async () => {
      await expect(pluginManager.unloadPlugin('non-existent')).rejects.toThrow(
        "Plugin 'non-existent' not found"
      );
    });
  });

  describe('plugin loading', () => {
    it('should handle plugin loading from path', async () => {
      await expect(pluginManager.loadPlugin('/path/to/plugin')).resolves.not.toThrow();
    });

    it('should handle plugin loading from directory', async () => {
      await expect(pluginManager.loadPluginsFromDirectory('/path/to/plugins')).resolves.not.toThrow();
    });
  });
}); 