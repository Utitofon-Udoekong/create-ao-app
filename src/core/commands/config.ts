import { BaseCommand } from './base-command.js';
import { CommandOption } from '../../types/cli.js';
import { ConfigManager } from '../managers/config-manager.js';
import path from 'path';
import fs from 'fs-extra';

export class ConfigCommand extends BaseCommand {
  name = 'config';
  description = 'Manage project configuration';
  options: CommandOption[] = [
    {
      flag: 'get <key>',
      description: 'Get a configuration value',
      required: false
    },
    {
      flag: 'set <key> <value>',
      description: 'Set a configuration value',
      required: false
    },
    {
      flag: 'list',
      description: 'List all configuration values',
      required: false
    },
    {
      flag: 'init',
      description: 'Initialize default configuration',
      required: false
    },
    {
      flag: 'validate',
      description: 'Validate configuration file',
      required: false
    },
    {
      flag: 'backup',
      description: 'Create a backup of configuration',
      required: false
    },
    {
      flag: 'restore <path>',
      description: 'Restore configuration from backup',
      required: false
    },
    {
      flag: '--format <format>',
      description: 'Output format (json, yaml)',
      required: false,
      defaultValue: 'yaml'
    }
  ];

  async execute(options: any): Promise<void> {
    try {
      // Determine project path
      const projectPath = this.determineProjectPath();
      
      // Check if project exists
      if (!(await this.projectExists(projectPath))) {
        throw new Error('No AO project found. Run "ao-forge init" to create a new project.');
      }
      
      // Create config manager
      const configManager = new ConfigManager(projectPath);
      
      // Execute subcommand
      if (options.get) {
        await this.getConfigValue(configManager, options);
      } else if (options.set) {
        await this.setConfigValue(configManager, options);
      } else if (options.list) {
        await this.listConfig(configManager, options);
      } else if (options.init) {
        await this.initConfig(configManager);
      } else if (options.validate) {
        await this.validateConfig(configManager);
      } else if (options.backup) {
        await this.backupConfig(configManager);
      } else if (options.restore) {
        await this.restoreConfig(configManager, options);
      } else {
        this.showHelp();
      }
      
    } catch (error) {
      this.logError('Config command failed', error as Error);
      throw error;
    }
  }

  private determineProjectPath(): string {
    return process.cwd();
  }

  private async projectExists(projectPath: string): Promise<boolean> {
    try {
      const packageJsonPath = path.join(projectPath, 'packageon');
      const configPath = path.join(projectPath, 'ao.config.yml');
      
      return await fs.pathExists(packageJsonPath) || await fs.pathExists(configPath);
    } catch {
      return false;
    }
  }

  private async getConfigValue(configManager: ConfigManager, options: any): Promise<void> {
    this.logStart(`Getting config value: ${options.get}`);
    
    try {
      const value = await configManager.getConfigValue(options.get);
      
      if (value === undefined) {
        this.logInfo(`Configuration key '${options.get}' not found`);
      } else {
        this.logInfo(`${options.get}: ${JSON.stringify(value)}`);
      }
      
    } catch (error) {
      this.logError('Failed to get config value', error as Error);
      throw error;
    }
  }

  private async setConfigValue(configManager: ConfigManager, options: any): Promise<void> {
    this.logStart(`Setting config value: ${options.set} = ${options.value}`);
    
    try {
      // Parse value based on type
      let parsedValue: any = options.value;
      
      // Try to parse as JSON first
      try {
        parsedValue = JSON.parse(options.value);
      } catch {
        // If not JSON, use as string
        parsedValue = options.value;
      }
      
      await configManager.setConfigValue(options.set, parsedValue);
      this.logSuccess(`Configuration updated: ${options.set} = ${JSON.stringify(parsedValue)}`);
      
    } catch (error) {
      this.logError('Failed to set config value', error as Error);
      throw error;
    }
  }

  private async listConfig(configManager: ConfigManager, options: any): Promise<void> {
    this.logStart('Listing configuration...');
    
    try {
      const config = await configManager.loadConfig();
      
      if (options.format === 'json') {
        this.logInfo(JSON.stringify(config, null, 2));
      } else {
        // YAML format
        const yaml = require('js-yaml');
        this.logInfo(yaml.dump(config));
      }
      
    } catch (error) {
      this.logError('Failed to list configuration', error as Error);
      throw error;
    }
  }

  private async initConfig(configManager: ConfigManager): Promise<void> {
    this.logStart('Initializing configuration...');
    
    try {
      const config = await configManager.createDefaultConfig();
      this.logSuccess('Default configuration created successfully');
      this.logInfo(`Configuration file: ${configManager.getConfigPath()}`);
      
    } catch (error) {
      this.logError('Failed to initialize configuration', error as Error);
      throw error;
    }
  }

  private async validateConfig(configManager: ConfigManager): Promise<void> {
    this.logStart('Validating configuration...');
    
    try {
      const isValid = await configManager.validateConfigFile();
      
      if (isValid) {
        this.logSuccess('Configuration is valid');
      } else {
        this.logError('Configuration validation failed');
        throw new Error('Invalid configuration');
      }
      
    } catch (error) {
      this.logError('Failed to validate configuration', error as Error);
      throw error;
    }
  }

  private async backupConfig(configManager: ConfigManager): Promise<void> {
    this.logStart('Creating configuration backup...');
    
    try {
      const backupPath = await configManager.backupConfig();
      this.logSuccess(`Configuration backed up to: ${backupPath}`);
      
    } catch (error) {
      this.logError('Failed to backup configuration', error as Error);
      throw error;
    }
  }

  private async restoreConfig(configManager: ConfigManager, options: any): Promise<void> {
    this.logStart('Restoring configuration from backup...');
    
    try {
      const backupPath = path.resolve(options.restore);
      
      if (!(await fs.pathExists(backupPath))) {
        throw new Error(`Backup file not found: ${backupPath}`);
      }
      
      await configManager.restoreConfig(backupPath);
      this.logSuccess('Configuration restored successfully');
      
    } catch (error) {
      this.logError('Failed to restore configuration', error as Error);
      throw error;
    }
  }

  private showHelp(): void {
    this.logInfo('Configuration Management Commands:');
    this.logInfo('');
    this.logInfo('  ao-forge config get <key>              # Get a configuration value');
    this.logInfo('  ao-forge config set <key> <value>      # Set a configuration value');
    this.logInfo('  ao-forge config list                   # List all configuration values');
    this.logInfo('  ao-forge config init                   # Initialize default configuration');
    this.logInfo('  ao-forge config validate               # Validate configuration file');
    this.logInfo('  ao-forge config backup                 # Create a backup of configuration');
    this.logInfo('  ao-forge config restore <path>         # Restore configuration from backup');
    this.logInfo('');
    this.logInfo('Options:');
    this.logInfo('  --format <format>       Output format (json, yaml)');
    this.logInfo('');
    this.logInfo('Examples:');
    this.logInfo('  ao-forge config get processName');
    this.logInfo('  ao-forge config set processName "my-process"');
    this.logInfo('  ao-forge config set ports.dev 8080');
    this.logInfo('  ao-forge config list --format json');
    this.logInfo('  ao-forge config backup');
    this.logInfo('  ao-forge config restore ./ao.config.yml.backup.1234567890');
  }

  protected getHelpText(): string {
    return `
Manage project configuration including getting, setting, and validating config values.

Subcommands:
  get <key>      Get a configuration value
  set <key> <value> Set a configuration value
  list           List all configuration values
  init           Initialize default configuration
  validate       Validate configuration file
  backup         Create a backup of configuration
  restore <path> Restore configuration from backup

Examples:
  ao-forge config get processName
  ao-forge config set processName "my-process"
  ao-forge config set ports.dev 8080
  ao-forge config list --format json
  ao-forge config init
  ao-forge config validate
  ao-forge config backup
  ao-forge config restore ./backup.yml
    `;
  }
} 