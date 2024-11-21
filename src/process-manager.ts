// src/process-manager.ts
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { AOConfig } from './types.js';
import chalk from 'chalk';
import ora from 'ora';
import { isCommandAvailable } from './utils.js';
import fs from 'fs-extra';
import inquirer from 'inquirer';

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
          { await: true, timeout: this.options.interval }
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
  private process: ChildProcess | null = null;
  private processName: string | null = null;

  async checkAOSInstallation(): Promise<boolean> {
    const spinner = ora('Checking AOS installation...').start();
    try {
      if (!(await isCommandAvailable('aos'))) {
        spinner.fail('AOS is not installed');
        console.log(chalk.yellow('\nPlease install AOS first:'));
        console.log(chalk.white('\n  npm install -g @permaweb/aos-cli'));
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

  async startAOProcess(targetPath: string, config: AOConfig): Promise<ChildProcess> {
    const spinner = ora('Starting AO process...').start();
    try {
      if (!config.luaFiles?.length) {
        throw new Error('No Lua files configured to load');
      }

      this.processName = config.processName || 'ao-process';
      const args = [this.processName];

      // Add all Lua files to be loaded
      for (const luaFile of config.luaFiles) {
        args.push('--load', luaFile);
      }

      if (config.cronInterval) {
        args.push('--cron', config.cronInterval);
      }

      if (config.tags) {
        Object.entries(config.tags).forEach(([name, value]) => {
          args.push('--tag-name', name, '--tag-value', value);
        });
      }

      const aosProcess = spawn('aos', args, {
        cwd: targetPath,
        stdio: 'inherit'
      });

      this.process = aosProcess;
      spinner.succeed(`Started AO process: ${this.processName} with ${config.luaFiles.length} Lua file(s)`);

      return aosProcess;
    } catch (error) {
      spinner.fail('Failed to start AO process');
      throw error;
    }
  }

  async evaluateProcess(
    input: string,
    options: { await?: boolean; timeout?: number } = {}
  ): Promise<void> {
    if (!this.process || !this.processName) {
      throw new Error('No AO process is running');
    }

    const args = ['eval', this.processName, input];
    if (options.await) {
      args.push('--await');
      if (options.timeout) {
        args.push('--timeout', options.timeout.toString());
      }
    }

    const process = spawn('aos', args, {
      stdio: 'inherit',
      shell: true
    });

    return new Promise((resolve, reject) => {
      process.on('error', reject);
      process.on('exit', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Eval exited with code ${code}`));
      });
    });
  }

  async monitorProcess(options: { pattern?: string; json?: boolean } = {}): Promise<void> {
    if (!this.processName) {
      throw new Error('No AO process is running');
    }

    const args = ['monitor', this.processName];
    if (options.pattern) {
      args.push('--pattern', options.pattern);
    }
    if (options.json) {
      args.push('--json');
    }

    const process = spawn('aos', args, {
      stdio: 'inherit',
      shell: true
    });

    return new Promise((resolve, reject) => {
      process.on('error', reject);
      process.on('exit', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Monitor exited with code ${code}`));
      });
    });
  }

  stopProcess(): void {
    if (this.process) {
      this.process.kill();
      console.log(chalk.green(`Stopped AO process: ${this.processName}`));
      this.process = null;
      this.processName = null;
    }
  }

  isProcessRunning(): boolean {
    return this.process !== null && this.processName !== null;
  }
}