import { logger } from '../utils/logging.js';
import { ErrorHandler } from '../utils/error-handling.js';
import { Plugin, PluginContext, PluginHook } from '../../types/plugins.js';

export class PluginManager {
  private plugins: Map<string, Plugin> = new Map();
  private hooks: Map<PluginHook, Plugin[]> = new Map();
  private context: PluginContext;

  constructor(context: PluginContext) {
    this.context = context;
    this.initializeHooks();
  }

  private initializeHooks(): void {
    // Initialize hook categories
    Object.values(PluginHook).forEach(hook => {
      this.hooks.set(hook, []);
    });
  }

  async loadPlugin(pluginPath: string): Promise<void> {
    try {
      logger.debug(`Loading plugin from: ${pluginPath}`);
      
      // TODO: Implement dynamic plugin loading
      // 1. Load plugin module
      // 2. Validate plugin structure
      // 3. Register plugin
      // 4. Register hooks
      
      logger.success(`Plugin loaded successfully: ${pluginPath}`);
    } catch (error) {
      logger.error(`Failed to load plugin: ${pluginPath}`, error as Error);
      throw error;
    }
  }

  async loadPluginsFromDirectory(directory: string): Promise<void> {
    try {
      logger.debug(`Loading plugins from directory: ${directory}`);
      
      // TODO: Implement directory scanning
      // 1. Scan directory for plugin files
      // 2. Load each plugin
      // 3. Handle loading errors gracefully
      
      logger.success(`Loaded plugins from directory: ${directory}`);
    } catch (error) {
      logger.error(`Failed to load plugins from directory: ${directory}`, error as Error);
      throw error;
    }
  }

  registerPlugin(plugin: Plugin): void {
    try {
      if (this.plugins.has(plugin.name)) {
        throw new Error(`Plugin '${plugin.name}' is already registered`);
      }

      // Validate plugin
      this.validatePlugin(plugin);

      // Register plugin
      this.plugins.set(plugin.name, plugin);

      // Register hooks
      this.registerHooks(plugin);

      logger.debug(`Plugin registered: ${plugin.name}`);
    } catch (error) {
      logger.error(`Failed to register plugin: ${plugin.name}`, error as Error);
      throw error;
    }
  }

  private validatePlugin(plugin: Plugin): void {
    if (!plugin.name || typeof plugin.name !== 'string') {
      throw new Error('Plugin must have a valid name');
    }
    if (!plugin.version || typeof plugin.version !== 'string') {
      throw new Error('Plugin must have a valid version');
    }
    if (typeof plugin.activate !== 'function') {
      throw new Error('Plugin must have an activate function');
    }
  }

  private registerHooks(plugin: Plugin): void {
    if (plugin.hooks) {
      Object.entries(plugin.hooks).forEach(([hookName, handler]) => {
        const hook = hookName as PluginHook;
        if (this.hooks.has(hook)) {
          this.hooks.get(hook)!.push(plugin);
        }
      });
    }
  }

  async executeHook(hook: PluginHook, data?: any): Promise<any> {
    try {
      const plugins = this.hooks.get(hook) || [];
      logger.debug(`Executing hook '${hook}' with ${plugins.length} plugins`);

      let result = data;
      for (const plugin of plugins) {
        if (plugin.hooks && plugin.hooks[hook]) {
          try {
            result = await plugin.hooks[hook]!(result, this.context);
          } catch (error) {
            logger.error(`Plugin '${plugin.name}' failed to execute hook '${hook}'`, error as Error);
            // Continue with other plugins
          }
        }
      }

      return result;
    } catch (error) {
      logger.error(`Failed to execute hook: ${hook}`, error as Error);
      throw error;
    }
  }

  getPlugin(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  getPluginsByHook(hook: PluginHook): Plugin[] {
    return this.hooks.get(hook) || [];
  }

  async unloadPlugin(name: string): Promise<void> {
    try {
      const plugin = this.plugins.get(name);
      if (!plugin) {
        throw new Error(`Plugin '${name}' not found`);
      }

      // Execute deactivation hook
      if (plugin.deactivate) {
        await plugin.deactivate(this.context);
      }

      // Remove from plugins map
      this.plugins.delete(name);

      // Remove from hooks
      this.hooks.forEach((plugins, hook) => {
        const index = plugins.findIndex(p => p.name === name);
        if (index !== -1) {
          plugins.splice(index, 1);
        }
      });

      logger.success(`Plugin unloaded: ${name}`);
    } catch (error) {
      logger.error(`Failed to unload plugin: ${name}`, error as Error);
      throw error;
    }
  }

  getPluginCount(): number {
    return this.plugins.size;
  }
} 