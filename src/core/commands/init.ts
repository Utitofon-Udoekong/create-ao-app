import { BaseCommand } from './base-command.js';
import { CommandOption } from '../../types/cli.js';
import { logger } from '../utils/logging.js';
import { ProjectManager } from '../managers/project-manager.js';
import { CreateProjectOptions } from '../../types/aos.js';
import path from 'path';
import fs from 'fs-extra';
import inquirer from 'inquirer';

export class InitCommand extends BaseCommand {
  name = 'init';
  description = 'Create a new AO project';
  options: CommandOption[] = [
    {
      flag: '-f, --framework <framework>',
      description: 'Framework to use (nextjs, nuxtjs, svelte)',
      defaultValue: 'nextjs'
    },
    {
      flag: '-p, --package-manager <manager>',
      description: 'Package manager (npm, yarn, pnpm)',
      defaultValue: 'pnpm'
    },
    {
      flag: '--path <path>',
      description: 'Path to create project'
    },
    {
      flag: '--port <port>',
      description: 'Development server port',
      defaultValue: '3000'
    },
    {
      flag: '--process-name <name>',
      description: 'AO process name',
      defaultValue: 'ao-process'
    },
    {
      flag: '--run-with-ao',
      description: 'Run with AO process',
      required: false
    },
    {
      flag: '--git',
      description: 'Initialize git repository',
      required: false
    }
  ];

  async execute(options: any): Promise<void> {
    // Always run interactive mode, but pre-fill values if provided
    const projectOptions = await this.runInteractiveMode(options);
    
    this.logStart(`Creating new AO project: ${projectOptions.name}`);
    
    await this.validateOptions(projectOptions);
    
    try {
      // Determine project path
      const projectPath = this.determineProjectPath(projectOptions);
      
      // Create project manager
      const projectManager = new ProjectManager(projectPath);
      
      // Create the project
      await projectManager.createProject(projectOptions);
      
      this.logSuccess(`Project ${projectOptions.name} created successfully`);
      
      // Show next steps
      this.showNextSteps(projectPath, projectOptions);
      
    } catch (error) {
      this.logError('Failed to create project', error as Error);
      throw error;
    }
  }

    private async runInteractiveMode(options?: any): Promise<CreateProjectOptions> {
    logger.info('🚀 Welcome to Forge! Let\'s create your AO project.');
    logger.info('');

    // Build prompts dynamically based on what options are provided
    const prompts: any[] = [];
    
    if (!options?.name) {
      prompts.push({
        type: 'input',
        name: 'name',
        message: 'What is your project name?',
        validate: (input: string) => {
          if (!input.trim()) {
            return 'Project name is required';
          }
          if (!/^[a-zA-Z0-9_-]+$/.test(input)) {
            return 'Project name must be alphanumeric and may contain hyphens and underscores';
          }
          return true;
        }
      });
    }

    if (!options?.framework) {
      prompts.push({
        type: 'list',
        name: 'framework',
        message: 'Which framework would you like to use?',
        choices: [
          { name: 'Next.js (React)', value: 'nextjs' },
          { name: 'Nuxt.js (Vue)', value: 'nuxtjs' },
          { name: 'SvelteKit (Svelte)', value: 'svelte' }
        ],
        default: 'nextjs'
      });
    }

    if (!options?.packageManager) {
      prompts.push({
        type: 'list',
        name: 'packageManager',
        message: 'Which package manager would you like to use?',
        choices: [
          { name: 'npm', value: 'npm' },
          { name: 'yarn', value: 'yarn' },
          { name: 'pnpm (recommended)', value: 'pnpm' }
        ],
        default: 'pnpm'
      });
    }

    if (!options?.port) {
      prompts.push({
        type: 'input',
        name: 'port',
        message: 'What port should the development server use?',
        default: '3000',
        validate: (input: string) => {
          const port = parseInt(input);
          if (isNaN(port) || port < 1 || port > 65535) {
            return 'Port must be a valid number between 1 and 65535';
          }
          return true;
        }
      });
    }

    if (!options?.processName) {
      prompts.push({
        type: 'input',
        name: 'processName',
        message: 'What should your AO process be called?',
        default: 'ao-process',
        validate: (input: string) => {
          if (!/^[a-zA-Z0-9_-]+$/.test(input)) {
            return 'Process name must be alphanumeric and may contain hyphens and underscores';
          }
          return true;
        }
      });
    }

    if (options?.git === undefined) {
      prompts.push({
        type: 'confirm',
        name: 'initializeGit',
        message: 'Initialize a git repository?',
        default: true
      });
    }

    if (options?.runWithAo === undefined) {
      prompts.push({
        type: 'confirm',
        name: 'runWithAO',
        message: 'Run with AO process monitoring?',
        default: false
      });
    }

    const answers = await inquirer.prompt(prompts);

    // Create project options from provided options and interactive answers
    const projectOptions: CreateProjectOptions = {
      name: options?.name || answers.name,
      framework: options?.framework || answers.framework,
      packageManager: options?.packageManager || answers.packageManager,
      port: parseInt(options?.port || answers.port),
      processName: options?.processName || answers.processName,
      runWithAO: options?.runWithAo !== undefined ? options.runWithAo : answers.runWithAO,
      initializeGit: options?.git !== undefined ? options.git : answers.initializeGit
    };

    return projectOptions;
  }

  private determineProjectPath(options: any): string {
    if (options.path) {
      return path.resolve(options.path);
    }
    return path.resolve(process.cwd(), options.name);
  }

  private showNextSteps(projectPath: string, options: CreateProjectOptions): void {
    logger.info('\n🎉 Project created successfully!');
    logger.info('\nNext steps:');
    logger.info(`  cd ${path.relative(process.cwd(), projectPath)}`);
    logger.info('  forge dev          # Start development server');
    logger.info('  forge build        # Build the project');
    logger.info('  forge deploy       # Deploy to Arweave');
    logger.info('\nFor more information, visit: https://docs.forge-ao.com');
  }

  protected async validateOptions(options: any): Promise<void> {
    if (!options.name) {
      throw new Error('Project name is required');
    }

    const validFrameworks = ['nextjs', 'nuxtjs', 'svelte'];
    if (!validFrameworks.includes(options.framework)) {
      throw new Error(`Invalid framework. Must be one of: ${validFrameworks.join(', ')}`);
    }

    const validPackageManagers = ['npm', 'yarn', 'pnpm'];
    if (!validPackageManagers.includes(options.packageManager)) {
      throw new Error(`Invalid package manager. Must be one of: ${validPackageManagers.join(', ')}`);
    }

    // Validate port
    const port = parseInt(options.port);
    if (isNaN(port) || port < 1 || port > 65535) {
      throw new Error('Port must be a valid number between 1 and 65535');
    }

    // Validate process name
    if (options.processName && !this.isValidProcessName(options.processName)) {
      throw new Error('Process name must be alphanumeric and may contain hyphens and underscores');
    }
  }

  private isValidProcessName(name: string): boolean {
    return /^[a-zA-Z0-9_-]+$/.test(name);
  }

  protected getHelpText(): string {
    return `
Create a new AO project with the specified framework and configuration.

Examples:
  forge init my-app
  forge init my-app --framework nuxtjs
  forge init my-app --package-manager yarn --path ./custom-path
  forge init my-app --port 8080 --process-name my-process
  forge init my-app --run-with-ao --git

Frameworks:
  nextjs    - Next (React)
  nuxtjs    - Nuxt (Vue)
  svelte    - SvelteKit

Package Managers:
  npm       - Node Package Manager
  yarn      - Yarn Package Manager
  pnpm      - pnpm Package Manager
    `;
  }
} 