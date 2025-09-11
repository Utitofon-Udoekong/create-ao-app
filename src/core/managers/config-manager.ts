import fs from 'fs-extra';
import path from 'path';
import yaml from 'js-yaml';
import { logger } from '../utils/logging.js';
import { ErrorHandler } from '../utils/error-handling.js';
import { Validator } from '../utils/validation.js';
import { AOConfig } from '../../types/aos.js';

const CONFIG_FILE_NAME = 'ao.config.yml';

export const DEFAULT_CONFIG: AOConfig = {
  luaFiles: [],
  packageManager: 'npm',
  framework: 'nextjs',
  processName: 'ao-process',
  ports: {
    dev: 3000
  },
  aos: {
    version: '2.x',
    features: {
      coroutines: true,
      bootloader: false,
      weavedrive: false,
    },
  },
  runWithAO: false,
  tags: {
    'Environment': 'development'
  }
};

export class ConfigManager {
  private projectPath: string;
  private configPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.configPath = path.join(projectPath, CONFIG_FILE_NAME);
  }

  async loadConfig(defaultConfig?: Partial<AOConfig>): Promise<AOConfig> {
    logger.debug('Loading configuration...');
    
    try {
      if (!defaultConfig) {
        defaultConfig = DEFAULT_CONFIG;
      }

      // Load the default config if the config file does not exist
      const exists = await fs.pathExists(this.configPath);
      if (!exists) {
        logger.debug('No config file found, using default configuration');
        return defaultConfig as AOConfig;
      }

      // Load the config file
      const configFile = await fs.readFile(this.configPath, 'utf8');
      const config = yaml.load(configFile) as AOConfig;
      
      // Validate the loaded config
      const validatedConfig = Validator.validateConfig(config);
      
      // Merge with defaults
      const mergedConfig = {
        ...defaultConfig,
        ...validatedConfig
      };

      logger.debug('Configuration loaded successfully');
      return mergedConfig;
    } catch (error) {
      logger.error('Error loading config:', error as Error);
      return defaultConfig as AOConfig;
    }
  }

  async saveConfig(config: AOConfig): Promise<void> {
    logger.debug('Saving configuration...');
    
    try {
      // Validate config before saving
      const validatedConfig = Validator.validateConfig(config);
      
      const yamlStr = yaml.dump(validatedConfig);
      await fs.writeFile(this.configPath, yamlStr, 'utf8');
      
      logger.debug('Configuration saved successfully');
    } catch (error) {
      logger.error('Error saving config:', error as Error);
      throw error;
    }
  }

  async updateConfig(updates: Partial<AOConfig>): Promise<AOConfig> {
    logger.debug('Updating configuration...');
    
    try {
      const currentConfig = await this.loadConfig();
      const updatedConfig = {
        ...currentConfig,
        ...updates
      };
      
      await this.saveConfig(updatedConfig);
      
      logger.debug('Configuration updated successfully');
      return updatedConfig;
    } catch (error) {
      logger.error('Error updating config:', error as Error);
      throw error;
    }
  }

  async getConfigValue<T>(key: string): Promise<T | undefined> {
    try {
      const config = await this.loadConfig();
      return this.getNestedValue(config, key);
    } catch (error) {
      logger.error('Error getting config value:', error as Error);
      return undefined;
    }
  }

  async setConfigValue<T>(key: string, value: T): Promise<void> {
    try {
      const config = await this.loadConfig();
      this.setNestedValue(config, key, value);
      await this.saveConfig(config);
    } catch (error) {
      logger.error('Error setting config value:', error as Error);
      throw error;
    }
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => {
      if (!(key in current)) {
        current[key] = {};
      }
      return current[key];
    }, obj);
    target[lastKey] = value;
  }

  async configExists(): Promise<boolean> {
    return await fs.pathExists(this.configPath);
  }

  async createDefaultConfig(): Promise<AOConfig> {
    logger.info('Creating default configuration...');
    
    try {
      const config = DEFAULT_CONFIG;
      await this.saveConfig(config);
      
      logger.success('Default configuration created');
      return config;
    } catch (error) {
      logger.error('Error creating default config:', error as Error);
      throw error;
    }
  }

  async validateConfigFile(): Promise<boolean> {
    try {
      const config = await this.loadConfig();
      Validator.validateConfig(config);
      return true;
    } catch (error) {
      logger.error('Configuration validation failed:', error as Error);
      return false;
    }
  }

  getConfigPath(): string {
    return this.configPath;
  }

  async backupConfig(): Promise<string> {
    try {
      const backupPath = `${this.configPath}.backup.${Date.now()}`;
      await fs.copy(this.configPath, backupPath);
      logger.debug(`Configuration backed up to: ${backupPath}`);
      return backupPath;
    } catch (error) {
      logger.error('Error backing up config:', error as Error);
      throw error;
    }
  }

  async restoreConfig(backupPath: string): Promise<void> {
    try {
      const backupExists = await fs.pathExists(backupPath);
      if (!backupExists) {
        throw new Error(`Backup file not found: ${backupPath}`);
      }
      
      await fs.copy(backupPath, this.configPath);
      logger.debug('Configuration restored from backup');
    } catch (error) {
      logger.error('Error restoring config:', error as Error);
      throw error;
    }
  }
} 