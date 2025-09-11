import { BaseCommand } from './base-command.js';
import { CommandOption } from '../../types/cli.js';
import { ProjectManager } from '../managers/project-manager.js';
import { ConfigManager } from '../managers/config-manager.js';
import path from 'path';
import fs from 'fs-extra';

export class DevCommand extends BaseCommand {
  name = 'dev';
  description = 'Start development server with hot reloading';
  options: CommandOption[] = [
    {
      flag: '-p, --port <port>',
      description: 'Port for development server',
      required: false,
      defaultValue: '3000'
    },
    {
      flag: '--host <host>',
      description: 'Host for development server',
      required: false,
      defaultValue: 'localhost'
    },
    {
      flag: '--no-watch',
      description: 'Disable file watching and hot reloading',
      required: false
    },
    {
      flag: '--debug',
      description: 'Enable debug mode with verbose logging',
      required: false
    },
    {
      flag: '--quiet',
      description: 'Quiet mode - minimize framework output',
      required: false
    }
  ];

  async execute(options: any): Promise<void> {
    this.logStart('Starting development server');
    
    try {
      // Determine project path
      const projectPath = this.determineProjectPath();
      
      // Check if project exists
      if (!(await this.projectExists(projectPath))) {
        throw new Error('No AO project found. Run "ao-forge init" to create a new project.');
      }
      
      // Load configuration
      const configManager = new ConfigManager(projectPath);
      const config = await configManager.loadConfig();
      
      // Set debug level if requested
      if (options.debug) {
        // TODO: Set debug logging level
      }
      
      // Create project manager
      const projectManager = new ProjectManager(projectPath);
      
      // Start development server
      const devProcess = await projectManager.startDevServer(config, options.quiet);
      
      this.logSuccess('Development server started successfully');
      
      // Show AOS CLI guide
      this.showAOSCLIGuide(config);
      
      // Keep the process running for development
      process.on('SIGINT', async () => {
        this.logStart('Shutting down development server');
        
        // Kill dev process
        devProcess.kill();
        
        process.exit(0);
      });
      
    } catch (error) {
      this.logError('Failed to start development server', error as Error);
      throw error;
    }
  }

  private determineProjectPath(): string {
    return process.cwd();
  }

  private async projectExists(projectPath: string): Promise<boolean> {
    try {
      const packageJsonPath = path.join(projectPath, 'package.json');
      const configPath = path.join(projectPath, 'ao.config.yml');
      
      return await fs.pathExists(packageJsonPath) || await fs.pathExists(configPath);
    } catch {
      return false;
    }
  }

  private showAOSCLIGuide(config: any): void {
    this.logInfo('\n📋 AOS CLI Guide:');
    this.logInfo('To run AO processes, use the AOS CLI in a separate terminal:');
    this.logInfo('');
    this.logInfo('  # Install AOS CLI');
    this.logInfo('  npm i -g https://get_ao.g8way.io');
    this.logInfo('');
    this.logInfo('  # Start an AO process');
    this.logInfo('  aos [process-name]');
    this.logInfo('');
    this.logInfo('  # Load Lua files');
    this.logInfo('  aos [process-name] --load ./ao/contract.lua');
    this.logInfo('');
    this.logInfo('  # Monitor process');
    this.logInfo('  aos [process-name] --monitor');
    this.logInfo('');
    this.logInfo('  # For more AOS commands, visit: https://docs.arweave.org/developers/ao');
    this.logInfo('');
  }

  protected getHelpText(): string {
    return `
Start the development server with hot reloading.

The development server will:
- Start the framework development server (Next, Nuxt, etc.)
- Enable hot reloading for frontend development
- Open the application in your browser

To run AO processes, use the AOS CLI in a separate terminal:

Examples:
  ao-forge dev                                    # Start dev server
  ao-forge dev -p 8080                           # Start on specific port
  ao-forge dev --debug                           # Enable debug mode
  ao-forge dev --no-watch                        # Disable hot reloading
  ao-forge dev --quiet                           # Minimize framework output

AOS CLI Guide:
  # Install AOS CLI
  npm i -g https://get_ao.g8way.io

  # Start an AO process
  aos [process-name]

  # Load Lua files
  aos [process-name] --load ./ao/contract.lua

  # Monitor process
  aos [process-name] --monitor

  # For more AOS commands, visit: https://docs.arweave.org/developers/ao
    `;
  }
}