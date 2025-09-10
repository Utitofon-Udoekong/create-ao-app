import { Command } from 'commander';
import { InitCommand } from './commands/init.js';
import { VersionCommand } from './commands/version.js';
import { BuildCommand } from './commands/build.js';
import { DeployCommand } from './commands/deploy.js';
import { DevCommand } from './commands/dev.js';
import { AICommand } from './commands/ai.js';
import { PluginCommand } from './commands/plugin.js';
import { ProcessCommand } from './commands/process.js';
import { ConfigCommand } from './commands/config.js';
import { logger } from './utils/logging.js';
import { ErrorHandler } from './utils/error-handling.js';
import { PluginManager } from './plugins/plugin-manager.js';
import { PluginContext, PluginHook } from '../types/plugins.js';
import chalk from 'chalk';

export interface CLIOptions {
  name?: string;
  version?: string;
  description?: string;
  enableDebug?: boolean;
}

export class CLI {
  private program: Command;
  private pluginManager: PluginManager;
  private options: CLIOptions;

  constructor(options: CLIOptions = {}) {
    this.options = {
      name: 'ao-forge',
      version: '2.0.0',
      description: 'Forge: CLI tool to create AO-powered applications',
      enableDebug: false,
      ...options
    };

    this.program = new Command();
    this.program
      .name(this.options.name!)
      .version(this.options.version!)
      .description(this.options.description!);
    
    // Initialize plugin manager
    const context: PluginContext = {
      cli: this,
      commandRegistry: null, // We'll update this later
      config: {},
      logger,
      version: this.options.version!,
      platform: process.platform,
      arch: process.arch
    };
    this.pluginManager = new PluginManager(context);

    this.setupErrorHandling();
    this.registerCommands();
  }

  private setupErrorHandling(): void {
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });
  }

  private registerCommands(): void {
    // Core commands
    new InitCommand().register(this.program);
    new VersionCommand().register(this.program);
    new BuildCommand().register(this.program);
    new DevCommand().register(this.program);
    
    // AI commands
    new AICommand().register(this.program);
    
    // Process and config management
    new ProcessCommand().register(this.program);
    new ConfigCommand().register(this.program);
    
    // TODO: Re-enable these commands when implemented
    // new DeployCommand().register(this.program);
    // new PluginCommand().register(this.program);
  }

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Forge CLI...');
      
      // Execute CLI init hook
      await this.pluginManager.executeHook(PluginHook.CLI_INIT);
      
      // Load plugins
      await this.loadPlugins();
      
      // Execute CLI ready hook
      await this.pluginManager.executeHook(PluginHook.CLI_READY);
      
      logger.success('Forge CLI initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Forge CLI:', error);
      throw error;
    }
  }

  private async loadPlugins(): Promise<void> {
    try {
      logger.debug('Loading plugins...');
      
      // TODO: Load plugins from configuration
      // 1. Read plugin configuration
      // 2. Load enabled plugins
      // 3. Register plugin commands
      // 4. Execute plugin activation hooks
      
      logger.debug(`Loaded ${this.pluginManager.getPluginCount()} plugins`);
    } catch (error) {
      logger.error('Failed to load plugins:', error);
      // Don't throw - plugins are optional
    }
  }

  async run(args: string[]): Promise<void> {
    try {
      await this.initialize();
      
      // Parse and execute with commander
      await this.program.parseAsync(args);
      
    } catch (error) {
      ErrorHandler.handle(error as Error);
      process.exit(1);
    } finally {
      // Execute CLI shutdown hook
      await this.pluginManager.executeHook(PluginHook.CLI_SHUTDOWN);
    }
  }



  getProgram(): Command {
    return this.program;
  }

  getPluginManager(): PluginManager {
    return this.pluginManager;
  }

  showHelp(): void {
    this.program.help();
  }
} 