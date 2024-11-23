import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { APIKeyManager } from './api-config.js';
import { CodeGenerationOptions } from '../types.js';

const AI_MODELS = {
  openai: [
    'gpt-4o-mini',
    'gpt-4',
    'gpt-3.5-turbo'
  ],
  anthropic: [
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240229',
    'claude-2.1'
  ]
};

export class LuaCodeGenerator {
  private openai: OpenAI | null = null;
  private anthropic: Anthropic | null = null;
  private apiKeyManager: APIKeyManager;

  constructor() {
    this.apiKeyManager = new APIKeyManager();
  }

  private async selectModel(provider: 'openai' | 'anthropic'): Promise<string> {
    const { model } = await inquirer.prompt([{
      type: 'list',
      name: 'model',
      message: `Select ${provider} model:`,
      choices: AI_MODELS[provider],
      default: AI_MODELS[provider][0] // Default to the first model
    }]);
    return model;
  }

  private async initializeAI(provider: 'openai' | 'anthropic'): Promise<void> {
    const config = await this.apiKeyManager.loadConfig();
    
    if (provider === 'openai') {
      const apiKey = config.openai || process.env.OPENAI_API_KEY;
      
      if (!apiKey) {
        console.log(chalk.yellow('\nNo OpenAI API key found. Please provide one.'));
        await this.apiKeyManager.promptForAPIKey();
        const newConfig = await this.apiKeyManager.loadConfig();
        if (!newConfig.openai) {
          throw new Error('No OpenAI API key available');
        }
        this.openai = new OpenAI({ apiKey: newConfig.openai });
      } else {
        this.openai = new OpenAI({ apiKey });
      }
    } else {
      const apiKey = config.anthropic || process.env.ANTHROPIC_API_KEY;
      
      if (!apiKey) {
        console.log(chalk.yellow('\nNo Anthropic API key found. Please provide one.'));
        await this.apiKeyManager.promptForAPIKey();
        const newConfig = await this.apiKeyManager.loadConfig();
        if (!newConfig.anthropic) {
          throw new Error('No Anthropic API key available');
        }
        this.anthropic = new Anthropic({ apiKey: newConfig.anthropic });
      } else {
        this.anthropic = new Anthropic({ apiKey });
      }
    }
  }

  private getSystemPrompt(type: string): string {
    return `You are an expert Lua programmer specializing in AO smart contracts. 
    Generate clean, well-documented ${type} code based on the user's requirements. 
    Include comments explaining the code's functionality.`;
  }

  async generateCode(options: CodeGenerationOptions): Promise<string> {
    const provider = options.provider || 'openai';
    
    if (provider === 'openai' && !this.openai) {
      await this.initializeAI('openai');
    } else if (provider === 'anthropic' && !this.anthropic) {
      await this.initializeAI('anthropic');
    }

    // Get model selection if not provided
    const model = options.model || await this.selectModel(provider);

    const spinner = ora(`Generating Lua code using ${provider} (${model})...`).start();

    try {
      let generatedCode: string;

      if (provider === 'openai') {
        const response = await this.openai!.chat.completions.create({
          model: model,
          messages: [
            { 
              role: "system", 
              content: this.getSystemPrompt(options.type) 
            },
            { 
              role: "user", 
              content: options.prompt 
            }
          ],
          temperature: 0.7,
        });

        generatedCode = response.choices[0]?.message?.content || '';
      } else {
        const response = await this.anthropic!.messages.create({
          model: model,
          max_tokens: 4000,
          messages: [{
            role: "user",
            content: `${this.getSystemPrompt(options.type)}\n\n${options.prompt}`
          }]
        });

        generatedCode = response.content[0].type === 'text' ? response.content[0].text : '';
      }

      if (!generatedCode) {
        throw new Error('No code was generated');
      }

      spinner.succeed(`Code generated successfully using ${provider} (${model})`);
      return generatedCode;

    } catch (error) {
      spinner.fail(`Failed to generate code using ${provider} (${model})`);
      throw error;
    }
  }

  async saveCode(code: string, outputPath: string): Promise<void> {
    try {
      await fs.ensureDir(path.dirname(outputPath));
      await fs.writeFile(outputPath, code);
      console.log(chalk.green(`\nCode saved to ${outputPath}`));
    } catch (error) {
      console.error(chalk.red('Error saving code:'), error);
      throw error;
    }
  }
} 