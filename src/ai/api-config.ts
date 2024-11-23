import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import inquirer from 'inquirer';
import chalk from 'chalk';

interface APIConfig {
  openai?: string;
  anthropic?: string;
}

export class APIKeyManager {
  private configPath: string;
  private config: APIConfig;

  constructor() {
    this.configPath = path.join(os.homedir(), '.ao-config');
    this.config = {};
  }

  async loadConfig(): Promise<APIConfig> {
    try {
      await fs.ensureDir(this.configPath);
      const configFile = path.join(this.configPath, 'api-keys.json');
      
      if (await fs.pathExists(configFile)) {
        this.config = await fs.readJSON(configFile);
      }
      
      return this.config;
    } catch (error) {
      console.error('Error loading API configuration:', error);
      return {};
    }
  }

  async saveConfig(config: APIConfig): Promise<void> {
    try {
      await fs.ensureDir(this.configPath);
      const configFile = path.join(this.configPath, 'api-keys.json');
      await fs.writeJSON(configFile, config, { spaces: 2 });
    } catch (error) {
      console.error('Error saving API configuration:', error);
      throw error;
    }
  }

  async getOpenAIKey(): Promise<string | undefined> {
    // Check environment variable first
    const envKey = process.env.OPENAI_API_KEY;
    if (envKey) return envKey;

    // Then check saved config
    await this.loadConfig();
    return this.config.openai;
  }

  async promptForAPIKey(): Promise<void> {
    const { provider } = await inquirer.prompt([{
      type: 'list',
      name: 'provider',
      message: 'Select AI provider:',
      choices: ['OpenAI', 'Anthropic']
    }]);

    const { apiKey } = await inquirer.prompt([{
      type: 'password',
      name: 'apiKey',
      message: `Enter your ${provider} API key:`,
      validate: (input: string) => input.length > 0 || 'API key is required'
    }]);

    const { save } = await inquirer.prompt([{
      type: 'confirm',
      name: 'save',
      message: 'Would you like to save this API key for future use?',
      default: true
    }]);

    if (save) {
      await this.loadConfig();
      this.config[provider.toLowerCase() as keyof APIConfig] = apiKey;
      await this.saveConfig(this.config);
      console.log(chalk.green('\nAPI key saved successfully!'));
    }
  }
} 