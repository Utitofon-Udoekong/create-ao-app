import { BaseCommand } from './base-command.js';
import { CommandOption } from '../../types/cli.js';
import { ProcessManager } from '../managers/process-manager.js';
import { ConfigManager } from '../managers/config-manager.js';
import path from 'path';
import fs from 'fs-extra';

export class ProcessCommand extends BaseCommand {
  name = 'process';
  description = 'Manage AO processes';
  options: CommandOption[] = [
    {
      flag: 'start',
      description: 'Start an AO process',
      required: false
    },
    {
      flag: 'stop',
      description: 'Stop a running AO process',
      required: false
    },
    {
      flag: 'list',
      description: 'List all processes',
      required: false
    },
    {
      flag: '-n, --name <name>',
      description: 'Process name',
      required: false
    },
    {
      flag: '--wallet <path>',
      description: 'Path to wallet file',
      required: false
    },
    {
      flag: '--data <data>',
      description: 'Process data',
      required: false
    },
    {
      flag: '--module <module>',
      description: 'Process module',
      required: false
    }
  ];

  async execute(options: any): Promise<void> {
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
      
      // Create process manager
      const processManager = new ProcessManager();
      
      // Execute subcommand
      if (options.start) {
        await this.startProcess(processManager, config, options);
      } else if (options.stop) {
        await this.stopProcess(processManager, options);
      } else if (options.list) {
        await this.listProcesses(processManager);
      } else {
        this.showHelp();
      }
      
    } catch (error) {
      this.logError('Process command failed', error as Error);
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

  private async startProcess(processManager: ProcessManager, config: any, options: any): Promise<void> {
    this.logStart('Starting AO process...');
    
    try {
      // Check AOS installation
      const aosInstalled = await processManager.checkAOSInstallation();
      if (!aosInstalled) {
        this.logError('AOS is not installed');
        this.logInfo('To install AOS, run: npm i -g https://get_ao.g8way.io');
        this.logInfo('Or visit: https://cookbook_ao.arweave.net/guides/aos/');
        this.logInfo('');
        this.logInfo('Once AOS is installed, you can run:');
        this.logInfo(`  aos ${options.name || config.processName || 'my-process'}`);
        return;
      }
      
      // Find Lua files
      const luaFiles = await processManager.findLuaFiles(process.cwd());
      if (luaFiles.length > 0) {
        config.luaFiles = luaFiles;
        this.logInfo(`Found ${luaFiles.length} Lua files: ${luaFiles.join(', ')}`);
      }
      
      // Process options
      const processOptions = {
        name: options.name || config.processName || 'my-process',
        wallet: options.wallet,
        data: options.data,
        module: options.module
      };
      
      await processManager.startAOProcess(process.cwd(), config, processOptions);
      
      this.logSuccess('AO process started successfully');
      
    } catch (error) {
      this.logError('Failed to start AO process', error as Error);
      this.logInfo('');
      this.logInfo('You can also start AO processes manually:');
      this.logInfo(`  aos ${options.name || config.processName || 'my-process'}`);
      if (config.luaFiles && config.luaFiles.length > 0) {
        this.logInfo(`  aos ${options.name || config.processName || 'my-process'} --load ${config.luaFiles[0]}`);
      }
      throw error;
    }
  }

  private async stopProcess(processManager: ProcessManager, options: any): Promise<void> {
    this.logStart('Stopping AO process...');
    
    try {
      await processManager.stopProcess();
      this.logSuccess('AO process stopped successfully');
      
    } catch (error) {
      this.logError('Failed to stop AO process', error as Error);
      throw error;
    }
  }

  private async listProcesses(processManager: ProcessManager): Promise<void> {
    this.logStart('Listing processes...');
    
    try {
      await processManager.listProcesses();
      
    } catch (error) {
      this.logError('Failed to list processes', error as Error);
      throw error;
    }
  }


  private showHelp(): void {
    this.logInfo('AO Process Management Commands:');
    this.logInfo('');
    this.logInfo('  ao-forge process start [options]     # Start an AO process');
    this.logInfo('  ao-forge process stop                # Stop a running process');
    this.logInfo('  ao-forge process list                # List all processes');
    this.logInfo('');
    this.logInfo('Options:');
    this.logInfo('  -n, --name <name>       Process name');
    this.logInfo('  --wallet <path>         Path to wallet file');
    this.logInfo('  --data <data>           Process data');
    this.logInfo('  --module <module>       Process module');
    this.logInfo('');
    this.logInfo('Examples:');
    this.logInfo('  ao-forge process start -n my-process');
    this.logInfo('  ao-forge process start --wallet ./keyon');
    this.logInfo('  ao-forge process list');
    this.logInfo('');
    this.logInfo('Note: For advanced AO process management, use the AOS CLI directly:');
    this.logInfo('  npm i -g https://get_ao.g8way.io');
    this.logInfo('  aos [process-name] --load ./ao/contract.lua');
  }

  protected getHelpText(): string {
    return `
Manage AO processes including starting, stopping, and listing.

Subcommands:
  start     Start an AO process
  stop      Stop a running AO process
  list      List all processes

Examples:
  ao-forge process start -n my-process
  ao-forge process start --wallet ./keyon --data "initial data"
  ao-forge process list

Note: For advanced AO process management, use the AOS CLI directly:
  npm i -g https://get_ao.g8way.io
  aos [process-name] --load ./ao/contract.lua
    `;
  }
} 