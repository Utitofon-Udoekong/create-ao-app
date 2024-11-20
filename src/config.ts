// src/config.ts
import fs from 'fs-extra';
import path from 'path';
import yaml from 'js-yaml';
import { Config } from './types';

const CONFIG_FILE_NAME = 'ao.config.yml';

export async function loadConfig(
  targetPath: string,
  defaultConfig: Partial<Config>
): Promise<Config> {
  const configPath = path.join(targetPath, CONFIG_FILE_NAME);
  
  try {

    // Load the default config if the config file does not exist
    const exists = await fs.pathExists(configPath);
    if (!exists) {
      return defaultConfig as Config;
    }

    // Load the config file
    const configFile = await fs.readFile(configPath, 'utf8');
    const config = yaml.load(configFile) as Config;
    
    return {
      ...defaultConfig,
      ...config
    };
  } catch (error) {
    console.error('Error loading config:', error);
    return defaultConfig as Config;
  }
}

export async function saveConfig(
  targetPath: string,
  config: Config
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