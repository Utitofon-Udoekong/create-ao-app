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
    this.logInfo('\n📋 AO Process Management:');
    this.logInfo('Use ao-forge commands to manage AO processes:');
    this.logInfo('');
    this.logInfo('  # Start an AO process');
    this.logInfo(`  ao-forge process start -n ${config.processName || 'my-process'}`);
    this.logInfo('');
    this.logInfo('  # List running processes');
    this.logInfo('  ao-forge process list');
    this.logInfo('');
    this.logInfo('  # Stop a process');
    this.logInfo('  ao-forge process stop');
    this.logInfo('');
    this.logInfo('  # For more process commands, run: ao-forge process --help');
    this.logInfo('');
  }

  protected getHelpText(): string {
    return `
Start the development server with hot reloading.

The development server will:
- Start the framework development server (Next, Nuxt, etc.)
- Enable hot reloading for frontend development
- Open the application in your browser

To run AO processes, use ao-forge process commands:

Examples:
  ao-forge dev                                    # Start dev server
  ao-forge dev -p 8080                           # Start on specific port
  ao-forge dev --debug                           # Enable debug mode
  ao-forge dev --no-watch                        # Disable hot reloading
  ao-forge dev --quiet                           # Minimize framework output

AO Process Management:
  # Start an AO process
  ao-forge process start -n my-process

  # List running processes
  ao-forge process list

  # Stop a process
  ao-forge process stop

  # For more process commands, run: ao-forge process --help
    `;
  }
}