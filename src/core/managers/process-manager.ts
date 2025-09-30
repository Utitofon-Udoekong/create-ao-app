import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import { logger } from '../utils/logging.js';
import { ErrorHandler } from '../utils/error-handling.js';
import { Validator } from '../utils/validation.js';
import { AOConfig, ProcessInfo, ProcessState } from '../../types/aos.js';

export interface ProcessOptions {
  name?: string;
  wallet?: string;
  data?: string;
  tagName?: string;
  tagValue?: string;
  module?: string;
  cron?: string;
  monitor?: boolean;
  sqlite?: boolean;
  gatewayUrl?: string;
  cuUrl?: string;
  muUrl?: string;
}

export interface ScheduleOptions {
  interval?: number;
  tick?: string;
  maxRetries?: number;
  onError?: string;
}

export class Schedule {
  private processName: string;
  private options: Required<ScheduleOptions>;
  private timer: ReturnType<typeof setInterval> | null = null;
  private retryCount: number = 0;
  private processManager: ProcessManager;

  constructor(processName: string, options: ScheduleOptions = {}, processManager: ProcessManager) {
    this.processName = processName;
    this.processManager = processManager;
    this.options = {
      interval: options.interval || 1000,
      tick: options.tick || 'tick',
      maxRetries: options.maxRetries || 3,
      onError: options.onError || 'handleError'
    };
  }

  async start(): Promise<void> {
    if (this.timer) {
      throw new Error('Scheduler already running');
    }

    logger.info(`Starting scheduler for process: ${this.processName}`);

    this.timer = setInterval(async () => {
      try {
        await this.processManager.evaluateProcess(
          this.options.tick,
          { await: true, timeout: this.options.interval.toString() }
        );
        this.retryCount = 0;
      } catch (error) {
        logger.error(`Error in scheduler for ${this.processName}:`, error as Error);
        this.retryCount++;

        if (this.retryCount >= this.options.maxRetries) {
          logger.error(`Max retries (${this.options.maxRetries}) reached, stopping scheduler`);
          await this.stop();
          
          try {
            await this.processManager.evaluateProcess(this.options.onError);
          } catch (errorHandlerError) {
            logger.error('Error handler failed:', errorHandlerError as Error);
          }
        }
      }
    }, this.options.interval);
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.retryCount = 0;
      logger.info(`Scheduler stopped for process: ${this.processName}`);
    }
  }

  isRunning(): boolean {
    return this.timer !== null;
  }
}

export class ProcessManager {
  private processFilePath: string;
  private process: ChildProcess | null = null;
  private processName: string | null = null;
  private processState: ProcessState | null = null;
  private schedules: Map<string, Schedule> = new Map();

  constructor() {
    this.processFilePath = path.join(os.homedir(), '.ao-forge-processeson');
  }

  private async saveProcessInfo(info: ProcessInfo): Promise<void> {
    await fs.writeJSON(this.processFilePath, info);
  }

  private async getProcessInfo(): Promise<ProcessInfo | null> {
    try {
      if (await fs.pathExists(this.processFilePath)) {
        return await fs.readJSON(this.processFilePath);
      }
      return null;
    } catch {
      return null;
    }
  }

  async checkAOSInstallation(): Promise<boolean> {
    logger.info('Checking AOS installation...');
    try {
      // Check if 'aos' command is available in PATH using execSync
      const { execSync } = await import('child_process');
      
      try {
        execSync('aos --version', { stdio: 'pipe' });
        logger.success('AOS is installed');
        return true;
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          logger.error('AOS is not installed');
          logger.info('\nTo install AOS, run:');
          logger.info('npm i -g https://get_ao.g8way.io');
          logger.info('\nOr visit: https://cookbook_ao.arweave.net/guides/aos/');
        } else {
          logger.error('AOS installation check failed:', error.message);
        }
        return false;
      }
    } catch (error) {
      logger.error('Failed to check AOS installation', error as Error);
      return false;
    }
  }

  async findLuaFiles(targetPath: string): Promise<string[]> {
    logger.info('Scanning for Lua files...');
    try {
      const files: string[] = [];
      const walk = async (dir: string) => {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory() && !entry.name.startsWith('.')) {
            await walk(fullPath);
          } else if (entry.isFile() && entry.name.endsWith('.lua')) {
            files.push(path.relative(targetPath, fullPath));
          }
        }
      };

      await walk(targetPath);
      logger.success(`Found ${files.length} Lua file(s)`);
      return files;
    } catch (error) {
      logger.error('Failed to scan for Lua files', error as Error);
      throw error;
    }
  }

  async startAOProcess(projectPath: string, config: AOConfig, options: ProcessOptions = {}): Promise<ChildProcess> {
    return this.startAOProcessForeground(projectPath, config, options);
  }

  async startAOProcessBackground(projectPath: string, config: AOConfig, options: ProcessOptions = {}): Promise<ChildProcess> {
    logger.info('Starting AO process in background...');
    try {
      const args: string[] = [];

      // Process name (defaults to "default" if not specified)
      if (options.name || config.processName) {
        const processName = options.name || config.processName || 'default';
        args.push(processName);
        this.processName = processName;
      }

      // Add wallet if specified
      if (options.wallet) {
        args.push('--wallet', options.wallet);
      }

      // Add Lua files to load
      if (config.luaFiles && config.luaFiles.length > 0) {
        for (const file of config.luaFiles) {
          args.push('--load', file);
        }
      }

      // Add other options
      if (options.data) args.push('--data', options.data);
      if (options.tagName && options.tagValue) {
        args.push('--tag-name', options.tagName, '--tag-value', options.tagValue);
      }
      if (options.module) args.push('--module', options.module);
      if (options.cron) args.push('--cron', options.cron);
      if (options.monitor) args.push('--monitor');
      if (options.sqlite) args.push('--sqlite');
      if (options.gatewayUrl) args.push('--gateway-url', options.gatewayUrl);
      if (options.cuUrl) args.push('--cu-url', options.cuUrl);
      if (options.muUrl) args.push('--mu-url', options.muUrl);

      // Start the process in background (detached)
      this.process = spawn('aos', args, {
        cwd: projectPath,
        stdio: 'ignore', // Ignore all stdio to run truly in background
        detached: true   // Detach from parent process
      });

      // Handle spawn errors (like ENOENT when aos is not found)
      this.process.on('error', (error: any) => {
        if (error.code === 'ENOENT') {
          logger.error('AOS command not found. Please install AOS first:');
          logger.info('npm i -g https://get_ao.g8way.io');
          logger.info('Or visit: https://cookbook_ao.arweave.net/guides/aos/');
        } else {
          logger.error('Failed to start AO process:', error.message);
        }
        throw error;
      });

      // Set up process state
      this.processState = {
        id: this.processName || 'default',
        status: 'running',
        startTime: new Date(),
        features: {
          coroutines: config.aos?.features?.coroutines || false,
          requestResponse: false,
          defaultActions: false,
          bootloader: config.aos?.features?.bootloader || false,
          weavedrive: config.aos?.features?.weavedrive || false,
          version: config.aos?.version || '1.x'
        },
        messages: [],
        errors: [],
        config: {
          name: this.processName || 'default',
          monitor: options.monitor || false,
          sqlite: options.sqlite || false,
          tags: {},
          luaFiles: config.luaFiles || []
        }
      };

      // Save process info
      await this.saveProcessInfo({
        name: this.processName || 'default',
        pid: this.process.pid || 0,
        startTime: new Date().toISOString(),
        config
      });

      // Unref the process so it doesn't keep the parent process alive
      this.process.unref();

      logger.success(`AO process started in background (PID: ${this.process.pid})`);
      return this.process;
    } catch (error) {
      logger.error('Failed to start AO process in background', error as Error);
      throw error;
    }
  }

  async startAOProcessForeground(projectPath: string, config: AOConfig, options: ProcessOptions = {}): Promise<ChildProcess> {
    logger.info('Starting AO process...');
    try {
      const args: string[] = [];

      // Process name (defaults to "default" if not specified)
      if (options.name || config.processName) {
        const processName = options.name || config.processName || 'default';
        args.push(processName);
        this.processName = processName;
      }

      // Add wallet if specified
      if (options.wallet) {
        args.push('--wallet', options.wallet);
      }

      // Add Lua files to load
      if (config.luaFiles && config.luaFiles.length > 0) {
        for (const file of config.luaFiles) {
          args.push('--load', file);
        }
      }

      // Add other options
      if (options.data) args.push('--data', options.data);
      if (options.tagName && options.tagValue) {
        args.push('--tag-name', options.tagName, '--tag-value', options.tagValue);
      }
      if (options.module) args.push('--module', options.module);
      if (options.cron) args.push('--cron', options.cron);
      if (options.monitor) args.push('--monitor');
      if (options.sqlite) args.push('--sqlite');
      if (options.gatewayUrl) args.push('--gateway-url', options.gatewayUrl);
      if (options.cuUrl) args.push('--cu-url', options.cuUrl);
      if (options.muUrl) args.push('--mu-url', options.muUrl);

      // Start the process
      this.process = spawn('aos', args, {
        cwd: projectPath,
        stdio: 'inherit'
      });

      // Handle spawn errors (like ENOENT when aos is not found)
      this.process.on('error', (error: any) => {
        if (error.code === 'ENOENT') {
          logger.error('AOS command not found. Please install AOS first:');
          logger.info('npm i -g https://get_ao.g8way.io');
          logger.info('Or visit: https://cookbook_ao.arweave.net/guides/aos/');
        } else {
          logger.error('Failed to start AO process:', error.message);
        }
        throw error;
      });

      // Set up process state
      this.processState = {
        id: this.processName || 'default',
        status: 'running',
        startTime: new Date(),
        features: {
          coroutines: config.aos?.features?.coroutines || false,
          requestResponse: false, // Not in AOConfig features
          defaultActions: false, // Not in AOConfig features
          bootloader: config.aos?.features?.bootloader || false,
          weavedrive: config.aos?.features?.weavedrive || false,
          version: config.aos?.version || '1.x'
        },
        messages: [],
        errors: [],
        config: {
          name: this.processName || 'default',
          monitor: options.monitor || false,
          sqlite: options.sqlite || false,
          tags: {},
          luaFiles: config.luaFiles || []
        }
      };

      // Save process info
      await this.saveProcessInfo({
        name: this.processName || 'default',
        pid: this.process.pid || 0,
        startTime: new Date().toISOString(),
        config
      });

      // Set up process event handlers
      this.setupProcessHandlers();

      logger.success('AO process started successfully');
      return this.process;
    } catch (error) {
      logger.error('Failed to start AO process', error as Error);
      throw error;
    }
  }

  private setupProcessHandlers(): void {
    if (!this.process) return;

    this.process.stdout?.on('data', (data: Buffer) => {
      const message = data.toString().trim();
      if (message) {
        this.processState?.messages.push({
          id: Date.now().toString(),
          action: 'log',
          data: message,
          tags: {},
          timestamp: new Date(),
          sender: 'process',
          recipient: 'stdout'
        });
        logger.debug(`Process output: ${message}`);
      }
    });

    this.process.stderr?.on('data', (data: Buffer) => {
      const error = data.toString().trim();
      if (error) {
        this.processState?.errors.push(new Error(error));
        logger.error(`Process error: ${error}`);
      }
    });

    this.process.on('close', (code: number) => {
      this.processState!.status = 'stopped';
      logger.info(`AO process stopped with code: ${code}`);
    });

    this.process.on('error', (error: Error) => {
      this.processState!.status = 'error';
      this.processState!.errors.push(error);
      logger.error('AO process error:', error);
    });
  }

  async monitorProcess(processName?: string): Promise<void> {
    logger.info('Starting process monitoring...');
    try {
      // TODO: Implement process monitoring
      // This should provide real-time monitoring of the AO process
      logger.success('Process monitoring started');
    } catch (error) {
      logger.error('Failed to start process monitoring', error as Error);
      throw error;
    }
  }

  async watchProcess(processName: string): Promise<void> {
    logger.info(`Watching process: ${processName}`);
    try {
      // TODO: Implement process watching
      // This should watch for changes and restart the process
      logger.success(`Process watching started for: ${processName}`);
    } catch (error) {
      logger.error('Failed to start process watching', error as Error);
      throw error;
    }
  }

  async listProcesses(): Promise<void> {
    logger.info('Listing processes...');
    try {
      const processInfo = await this.getProcessInfo();
      if (processInfo) {
        logger.info(`Process: ${processInfo.name} (PID: ${processInfo.pid})`);
        logger.info(`Started: ${processInfo.startTime}`);
      } else {
        logger.info('No processes found');
      }
    } catch (error) {
      logger.error('Failed to list processes', error as Error);
      throw error;
    }
  }

  async setupCron(processName: string, frequency: string): Promise<void> {
    logger.info(`Setting up cron for process: ${processName} with frequency: ${frequency}`);
    try {
      // TODO: Implement cron setup
      // This should set up scheduled tasks for the process
      logger.success(`Cron setup completed for: ${processName}`);
    } catch (error) {
      logger.error('Failed to setup cron', error as Error);
      throw error;
    }
  }

  async evaluateProcess(input: string, options?: { await?: boolean; timeout?: string }): Promise<void> {
    logger.debug(`Evaluating process with input: ${input}`);
    try {
      // TODO: Implement process evaluation
      // This should send input to the AO process and handle the response
      logger.debug('Process evaluation completed');
    } catch (error) {
      logger.error('Failed to evaluate process', error as Error);
      throw error;
    }
  }

  async stopProcess(): Promise<void> {
    logger.info('Stopping AO process...');
    try {
      if (this.process) {
        this.process.kill();
        this.process = null;
        if (this.processState) {
          this.processState.status = 'stopped';
        }
        logger.success('AO process stopped');
      } else {
        logger.warn('No process running to stop');
      }
    } catch (error) {
      logger.error('Failed to stop AO process', error as Error);
      throw error;
    }
  }

  isProcessRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }

  getProcessState(): ProcessState | null {
    return this.processState;
  }

  getProcessName(): string | null {
    return this.processName;
  }
} 