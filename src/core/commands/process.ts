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
      flag: 'monitor',
      description: 'Monitor a process',
      required: false
    },
    {
      flag: 'watch',
      description: 'Watch a process for changes',
      required: false
    },
    {
      flag: 'evaluate',
      description: 'Evaluate a process with input',
      required: false
    },
    {
      flag: 'cron',
      description: 'Set up cron for a process',
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
    },
    {
      flag: '--frequency <frequency>',
      description: 'Cron frequency (for cron command)',
      required: false
    },
    {
      flag: '--input <input>',
      description: 'Input for evaluation (for evaluate command)',
      required: false
    }
  ];

  async execute(options: any): Promise<void> {
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
      
      // Create process manager
      const processManager = new ProcessManager();
      
      // Execute subcommand
      if (options.start) {
        await this.startProcess(processManager, config, options);
      } else if (options.stop) {
        await this.stopProcess(processManager, options);
      } else if (options.list) {
        await this.listProcesses(processManager);
      } else if (options.monitor) {
        await this.monitorProcess(processManager, options);
      } else if (options.watch) {
        await this.watchProcess(processManager, options);
      } else if (options.evaluate) {
        await this.evaluateProcess(processManager, options);
      } else if (options.cron) {
        await this.setupCron(processManager, options);
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
        throw new Error('AOS is not installed. Please install AOS first: npm i -g https://get_ao.g8way.io');
      }
      
      // Find Lua files
      const luaFiles = await processManager.findLuaFiles(process.cwd());
      if (luaFiles.length > 0) {
        config.luaFiles = luaFiles;
      }
      
      // Process options
      const processOptions = {
        name: options.name || config.processName,
        wallet: options.wallet,
        data: options.data,
        module: options.module
      };
      
      await processManager.startAOProcess(process.cwd(), config, processOptions);
      
      this.logSuccess('AO process started successfully');
      
    } catch (error) {
      this.logError('Failed to start AO process', error as Error);
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

  private async monitorProcess(processManager: ProcessManager, options: any): Promise<void> {
    this.logStart('Starting process monitoring...');
    
    try {
      await processManager.monitorProcess(options.name);
      
    } catch (error) {
      this.logError('Failed to start process monitoring', error as Error);
      throw error;
    }
  }

  private async watchProcess(processManager: ProcessManager, options: any): Promise<void> {
    this.logStart('Starting process watching...');
    
    try {
      const processName = options.name || 'default';
      await processManager.watchProcess(processName);
      
    } catch (error) {
      this.logError('Failed to start process watching', error as Error);
      throw error;
    }
  }

  private async evaluateProcess(processManager: ProcessManager, options: any): Promise<void> {
    this.logStart('Evaluating process...');
    
    try {
      if (!options.input) {
        throw new Error('Input is required for process evaluation');
      }
      
      await processManager.evaluateProcess(options.input);
      this.logSuccess('Process evaluation completed');
      
    } catch (error) {
      this.logError('Failed to evaluate process', error as Error);
      throw error;
    }
  }

  private async setupCron(processManager: ProcessManager, options: any): Promise<void> {
    this.logStart('Setting up cron...');
    
    try {
      if (!options.frequency) {
        throw new Error('Frequency is required for cron setup');
      }
      
      const processName = options.name || 'default';
      await processManager.setupCron(processName, options.frequency);
      
      this.logSuccess('Cron setup completed');
      
    } catch (error) {
      this.logError('Failed to setup cron', error as Error);
      throw error;
    }
  }

  private showHelp(): void {
    this.logInfo('AO Process Management Commands:');
    this.logInfo('');
    this.logInfo('  forge process start [options]     # Start an AO process');
    this.logInfo('  forge process stop                # Stop a running process');
    this.logInfo('  forge process list                # List all processes');
    this.logInfo('  forge process monitor [options]   # Monitor a process');
    this.logInfo('  forge process watch [options]     # Watch a process for changes');
    this.logInfo('  forge process evaluate [options]  # Evaluate a process with input');
    this.logInfo('  forge process cron [options]      # Set up cron for a process');
    this.logInfo('');
    this.logInfo('Options:');
    this.logInfo('  -n, --name <name>       Process name');
    this.logInfo('  --wallet <path>         Path to wallet file');
    this.logInfo('  --data <data>           Process data');
    this.logInfo('  --module <module>       Process module');
    this.logInfo('  --frequency <freq>      Cron frequency (for cron command)');
    this.logInfo('  --input <input>         Input for evaluation (for evaluate command)');
    this.logInfo('');
    this.logInfo('Examples:');
    this.logInfo('  forge process start -n my-process');
    this.logInfo('  forge process start --wallet ./keyon');
    this.logInfo('  forge process monitor -n my-process');
    this.logInfo('  forge process evaluate --input "hello world"');
    this.logInfo('  forge process cron -n my-process --frequency "*/5 * * * *"');
  }

  protected getHelpText(): string {
    return `
Manage AO processes including starting, stopping, monitoring, and evaluation.

Subcommands:
  start     Start an AO process
  stop      Stop a running AO process
  list      List all processes
  monitor   Monitor a process in real-time
  watch     Watch a process for changes and restart
  evaluate  Evaluate a process with input
  cron      Set up scheduled tasks for a process

Examples:
  forge process start -n my-process
  forge process start --wallet ./keyon --data "initial data"
  forge process monitor -n my-process
  forge process evaluate --input "hello world"
  forge process cron -n my-process --frequency "*/5 * * * *"
    `;
  }
} 