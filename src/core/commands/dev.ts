import { BaseCommand } from './base-command.js';
import { CommandOption } from '../../types/cli.js';
import { ProjectManager } from '../managers/project-manager.js';
import { ProcessManager } from '../managers/process-manager.js';
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
      flag: '--process <name>',
      description: 'Run specific process in development mode',
      required: false
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
        throw new Error('No AO project found. Run "forge init" to create a new project.');
      }
      
      // Load configuration
      const configManager = new ConfigManager(projectPath);
      const config = await configManager.loadConfig();
      
      // Set debug level if requested
      if (options.debug) {
        // TODO: Set debug logging level
      }
      
      // Create managers
      const projectManager = new ProjectManager(projectPath);
      const processManager = new ProcessManager();
      
      // Start development server
      const devProcess = await projectManager.startDevServer(config, options.quiet);
      
      // Start AO process if configured
      if (config.runWithAO || options.process) {
        await this.startAOProcess(processManager, config, options);
      }
      
      this.logSuccess('Development server started successfully');
      
      // Keep the process running for development
      process.on('SIGINT', async () => {
        this.logStart('Shutting down development server');
        
        // Stop AO process if running
        if (processManager.isProcessRunning()) {
          await processManager.stopProcess();
        }
        
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
      const packageJsonPath = path.join(projectPath, 'packageon');
      const configPath = path.join(projectPath, 'ao.config.yml');
      
      return await fs.pathExists(packageJsonPath) || await fs.pathExists(configPath);
    } catch {
      return false;
    }
  }

  private async startAOProcess(processManager: ProcessManager, config: any, options: any): Promise<void> {
    try {
      // Check AOS installation
      const aosInstalled = await processManager.checkAOSInstallation();
      if (!aosInstalled) {
        throw new Error('AOS is not installed. Please install AOS first: npm i -g https://get_ao.g8way.io');
      }
      
      // Find Lua files
      const luaFiles = await processManager.findLuaFiles(process.cwd());
      if (luaFiles.length > 0) {
        // Update config with found Lua files
        config.luaFiles = luaFiles;
      }
      
      // Start AO process
      const processOptions = {
        name: options.process || config.processName,
        monitor: !options.noWatch
      };
      
      await processManager.startAOProcess(process.cwd(), config, processOptions);
      
      // Start monitoring if requested
      if (!options.noWatch) {
        await processManager.monitorProcess(processOptions.name);
      }
      
    } catch (error) {
      this.logError('Failed to start AO process', error as Error);
      // Don't throw - AO process is optional for development
    }
  }

  protected getHelpText(): string {
    return `
Start the development server with hot reloading and optional AO process integration.

The development server will:
- Start the framework development server (Next, Nuxt, etc.)
- Optionally start an AO process if configured
- Enable hot reloading for both frontend and AO process
- Open the application in your browser

Examples:
  forge dev                    # Start dev server on default port
  forge dev -p 8080           # Start on specific port
  forge dev --process my-app  # Run specific AO process
  forge dev --debug           # Enable debug mode
  forge dev --no-watch        # Disable hot reloading
  forge dev --quiet           # Minimize framework output
    `;
  }
} 