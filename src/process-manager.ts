// src/process-manager.ts
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { AOConfig, AOProcessOptions, ProcessInfo } from './types.js';
import chalk from 'chalk';
import ora from 'ora';
import { isCommandAvailable } from './utils.js';
import fs from 'fs-extra';
import inquirer from 'inquirer';
import os from 'os';

interface ScheduleOptions {
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
  private processManager: AOSProcessManager;

  constructor(processName: string, options: ScheduleOptions = {}, processManager: AOSProcessManager) {
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

    this.timer = setInterval(async () => {
      try {
        await this.processManager.evaluateProcess(
          this.options.tick,
          { await: true, timeout: this.options.interval.toString() }
        );
        this.retryCount = 0;
      } catch (error) {
        console.error(`Error in scheduler for ${this.processName}:`, error);
        this.retryCount++;

        if (this.retryCount >= this.options.maxRetries) {
          console.error(`Max retries (${this.options.maxRetries}) reached, stopping scheduler`);
          await this.stop();
          
          try {
            await this.processManager.evaluateProcess(this.options.onError);
          } catch (errorHandlerError) {
            console.error('Error handler failed:', errorHandlerError);
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
    }
  }

  isRunning(): boolean {
    return this.timer !== null;
  }
}

export class AOSProcessManager {
  private processFilePath: string;
  private process: ChildProcess | null = null;
  private processName: string | null = null;

  constructor() {
    this.processFilePath = path.join(os.homedir(), '.ao-processes.json');
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
    const spinner = ora('Checking AOS installation...').start();
    try {
      if (!(await isCommandAvailable('aos'))) {
        spinner.fail('AOS is not installed');
        console.log(chalk.yellow('\nPlease install AOS first:'));
        console.log(chalk.white('\n  npm i -g https://get_ao.g8way.io'));
        return false;
      }
      spinner.succeed('AOS is installed');
      return true;
    } catch (error) {
      spinner.fail('Failed to check AOS installation');
      return false;
    }
  }

  async findLuaFiles(targetPath: string): Promise<string[]> {
    const spinner = ora('Scanning for Lua files...').start();
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
      spinner.succeed(`Found ${files.length} Lua file(s)`);
      return files;
    } catch (error) {
      spinner.fail('Failed to scan for Lua files');
      throw error;
    }
  }

  async selectLuaFiles(files: string[]): Promise<string[]> {
    if (files.length === 0) {
      return [];
    }

    const { selectedFiles } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selectedFiles',
        message: 'Select Lua files to load:',
        choices: files,
        default: files,
        when: files.length > 0
      }
    ]);

    return selectedFiles;
  }

  async startAOProcess(projectPath: string, config: AOConfig, options: AOProcessOptions = {}): Promise<ChildProcess> {
    const spinner = ora('Starting AO process...').start();
    try {
      const args: string[] = [];

      // Process name (defaults to "default" if not specified)
      if (options.name || config.processName) {
        const processName = options.name || config.processName || 'default';
        args.push(processName);
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

      console.log(chalk.blue('\nStarting AO process with command:'), 'aos', args.join(' '));

      const process = spawn('aos', args, {
        stdio: 'inherit',
        cwd: projectPath
      });

      process.on('error', (error) => {
        console.error('Error starting AO process:', error);
        throw error;
      });

      this.process = process;
      spinner.succeed(`Started AO process: ${this.processName} with ${config.luaFiles.length} Lua file(s)`);

      await this.saveProcessInfo({
        pid: process.pid || 0,
        name: config.processName || 'ao-process',
        startTime: new Date().toISOString(),
        configPath: projectPath
      });

      return process;

    } catch (error) {
      console.error('Error starting AO process:', error);
      throw error;
    }
  }

  async monitorProcess(processName?: string): Promise<void> {
    try {
      const args = processName ? [processName, '--monitor'] : ['--monitor'];

      console.log(chalk.blue('\nMonitoring AO process...'));
      
      const monitor = spawn('aos', args, {
        stdio: 'inherit'
      });

      monitor.on('error', (error) => {
        console.error('Error monitoring process:', error);
        throw error;
      });

    } catch (error) {
      console.error('Error monitoring AO process:', error);
      throw error;
    }
  }

  async watchProcess(processName: string): Promise<void> {
    try {
      const args = ['--watch=', processName];

      console.log(chalk.blue(`\nWatching AO process: ${processName}`));
      
      const watch = spawn('aos', args, {
        stdio: 'inherit'
      });

      watch.on('error', (error) => {
        console.error('Error watching process:', error);
        throw error;
      });

    } catch (error) {
      console.error('Error watching AO process:', error);
      throw error;
    }
  }

  async listProcesses(): Promise<void> {
    try {
      const args = ['--list'];

      console.log(chalk.blue('\nListing AO processes...'));
      
      const list = spawn('aos', args, {
        stdio: 'inherit'
      });

      list.on('error', (error) => {
        console.error('Error listing processes:', error);
        throw error;
      });

    } catch (error) {
      console.error('Error listing AO processes:', error);
      throw error;
    }
  }

  async setupCron(processName: string, frequency: string): Promise<void> {
    try {
      const args = [processName, '--cron', frequency];

      console.log(chalk.blue(`\nSetting up cron for process ${processName} with frequency ${frequency}`));
      
      const cron = spawn('aos', args, {
        stdio: 'inherit'
      });

      cron.on('error', (error) => {
        console.error('Error setting up cron:', error);
        throw error;
      });

    } catch (error) {
      console.error('Error setting up cron for AO process:', error);
      throw error;
    }
  }

  async evaluateProcess(input: string, options?: { await?: boolean; timeout?: string }): Promise<void> {
    try {
      // AO process evaluation is done through the aos-cli eval command
      const args = ['eval', input];
      if (options?.await) args.push('--await');
      if (options?.timeout) args.push('--timeout', options.timeout);

      const evaluate = spawn('aos', args, {
        stdio: 'inherit'
      });

      evaluate.on('error', (error) => {
        console.error('Error evaluating process:', error);
      });

    } catch (error) {
      console.error('Error evaluating AO process:', error);
      throw error;
    }
  }

  async stopProcess(): Promise<void> {
    const processInfo = await this.getProcessInfo();
    if (processInfo) {
      try {
        process.kill(processInfo.pid);
        await fs.remove(this.processFilePath);
      } catch (error) {
        console.error('Error stopping process:', error);
      }
    }
  }

  isProcessRunning(): boolean {
    return this.process !== null && this.processName !== null;
  }
}