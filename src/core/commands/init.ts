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
      description: 'Framework to use (nextjs, nuxtjs, svelte)'
    },
    {
      flag: '-p, --package-manager <manager>',
      description: 'Package manager (npm, yarn, pnpm)'
    },
    {
      flag: '--path <path>',
      description: 'Path to create project'
    },
    {
      flag: '--port <port>',
      description: 'Development server port'
    },
    {
      flag: '--process-name <name>',
      description: 'AO process name'
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
    },

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
    
    // Check if name was provided (either as positional argument or flag)
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

    // Check if framework was explicitly provided via flag
    if (!this.isOptionExplicitlyProvided(options, 'framework')) {
      prompts.push({
        type: 'list',
        name: 'framework',
        message: 'Which framework would you like to use?',
        choices: [
          { name: 'Next.js (React)', value: 'nextjs' },
          { name: 'Nuxt.js (Vue)', value: 'nuxtjs' },
          { name: 'SvelteKit (Svelte)', value: 'svelte' },
          { name: 'React (Vite)', value: 'react' },
          { name: 'Vue (Vite)', value: 'vue' }
        ],
        default: 'nextjs'
      });
    }

    // Check if package manager was explicitly provided via flag
    if (!this.isOptionExplicitlyProvided(options, 'packageManager')) {
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

    // Check if port was explicitly provided via flag
    if (!this.isOptionExplicitlyProvided(options, 'port')) {
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

    // Check if process name was explicitly provided via flag
    if (!this.isOptionExplicitlyProvided(options, 'processName')) {
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

    // Check if git flag was explicitly provided
    if (!this.isOptionExplicitlyProvided(options, 'git')) {
      prompts.push({
        type: 'confirm',
        name: 'initializeGit',
        message: 'Initialize a git repository?',
        default: true
      });
    }

    // Check if run-with-ao flag was explicitly provided
    if (!this.isOptionExplicitlyProvided(options, 'runWithAo')) {
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
      framework: options?.framework || answers.framework || 'nextjs',
      packageManager: options?.packageManager || answers.packageManager || 'pnpm',
      port: parseInt(options?.port || answers.port || '3000'),
      processName: options?.processName || answers.processName || 'ao-process',
      runWithAO: this.isOptionExplicitlyProvided(options, 'runWithAo') ? options.runWithAo : (answers.runWithAO !== undefined ? answers.runWithAO : false),
      initializeGit: this.isOptionExplicitlyProvided(options, 'git') ? options.git : (answers.initializeGit !== undefined ? answers.initializeGit : true),

    };

    return projectOptions;
  }

  /**
   * Check if an option was explicitly provided via command-line flag
   * This is needed because Commander.js doesn't distinguish between default values and explicit flags
   */
  private isOptionExplicitlyProvided(options: any, optionName: string): boolean {
    if (!options) return false;
    
    // Check if the option exists in the options object
    // For boolean flags, we need to check if they were explicitly set
    if (optionName === 'git' || optionName === 'runWithAo') {
      return optionName in options;
    }
    
    // For other options, check if they have a value and it's not undefined
    return options[optionName] !== undefined && options[optionName] !== null;
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
    logger.info('  ao-forge dev          # Start development server');
    logger.info('  ao-forge build        # Build the project');
    logger.info('  ao-forge deploy       # Deploy to Arweave');
    logger.info('\nFor more information, visit: https://docs.ao-forge-ao.com');
  }

  protected async validateOptions(options: any): Promise<void> {
    if (!options.name) {
      throw new Error('Project name is required');
    }

    const validFrameworks = ['nextjs', 'nuxtjs', 'svelte', 'react', 'vue'];
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

The command runs in interactive mode by default, asking for any options not provided via flags.
You can provide any combination of flags to skip those specific prompts.

Examples:
  ao-forge init                    # Interactive mode - asks for all options
  ao-forge init my-app            # Interactive mode - asks for all options except name
  ao-forge init --framework nuxtjs # Interactive mode - asks for all options except framework
  ao-forge init my-app --framework nuxtjs --package-manager yarn
  ao-forge init my-app --port 8080 --process-name my-process
  ao-forge init my-app --run-with-ao --git


Frameworks:
  nextjs    - Next.js (React)
  nuxtjs    - Nuxt.js (Vue)
  svelte    - SvelteKit (Svelte)
  react     - React (Vite)
  vue       - Vue (Vite)

Package Managers:
  npm       - Node Package Manager
  yarn      - Yarn Package Manager
  pnpm      - pnpm Package Manager (recommended)
    `;
  }
} 