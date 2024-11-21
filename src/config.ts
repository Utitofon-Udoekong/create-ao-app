import fs from 'fs-extra';
import path from 'path';
import yaml from 'js-yaml';
import { AOConfig } from './types.js';

const CONFIG_FILE_NAME = 'ao.config.yml';
export const DEFAULT_CONFIG: AOConfig = {
  luaFiles: [],
  packageManager: 'pnpm',
  autoStart: true,
  ports: {
    dev: 3000
  },
  processName: 'ao-process',
  cronInterval: undefined,
  tags: {
    'Environment': 'development'
  }
};

export async function loadConfig(
  targetPath: string,
  defaultConfig?: Partial<AOConfig>
): Promise<AOConfig> {
  const configPath = path.join(targetPath, CONFIG_FILE_NAME);
  
  try {
    if(!defaultConfig) {
      defaultConfig = DEFAULT_CONFIG;
    }
    // Load the default config if the config file does not exist
    const exists = await fs.pathExists(configPath);
    if (!exists) {
      return defaultConfig as AOConfig;
    }

    // Load the config file
    const configFile = await fs.readFile(configPath, 'utf8');
    const config = yaml.load(configFile) as AOConfig;
    
    return {
      ...defaultConfig,
      ...config
    };
  } catch (error) {
    console.error('Error loading config:', error);
    return defaultConfig as AOConfig;
  }
}

export async function saveConfig(
  targetPath: string,
  config: AOConfig
): Promise<void> {
  const configPath = path.join(targetPath, CONFIG_FILE_NAME);
  
  try {
    const yamlStr = yaml.dump(config);
    await fs.writeFile(configPath, yamlStr, 'utf8');
  } catch (error) {
    console.error('Error saving config:', error);
    throw error;
  }
}