// src/process-manager.ts
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { Config } from './types';

export class AOSProcessManager {
  private static processes: Map<string, ChildProcess> = new Map();

  static async startProcess(
    targetPath: string,
    processName: string,
    luaFile: string,
    config: Config
  ): Promise<void> {
    if (!processName) {
      throw new Error(`No process name configured for ${luaFile}`);
    }

    const process = spawn(
      'aos',
      ['load', '--name', processName, path.join(targetPath, luaFile)],
      {
        stdio: 'inherit',
        shell: true
      }
    );

    this.processes.set(processName, process);

    return new Promise((resolve, reject) => {
      process.on('error', (error) => {
        reject(error);
      });

      process.on('exit', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Process exited with code ${code}`));
        }
      });
    });
  }

  static async monitorProcess(
    processName: string,
    targetPath: string,
    options: { pattern?: string; json?: boolean } = {}
  ): Promise<void> {
    const args = ['monitor', processName];
    if (options.pattern) {
      args.push('--pattern', options.pattern);
    }
    if (options.json) {
      args.push('--json');
    }

    const process = spawn('aos', args, {
      stdio: 'inherit',
      shell: true,
      cwd: targetPath
    });

    return new Promise((resolve, reject) => {
      process.on('error', reject);
      process.on('exit', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Monitor exited with code ${code}`));
      });
    });
  }

  static async evaluateProcess(
    processName: string,
    input: string,
    targetPath: string,
    options: { await?: boolean; timeout?: number } = {}
  ): Promise<void> {
    const args = ['eval', processName, input];
    if (options.await) {
      args.push('--await');
      if (options.timeout) {
        args.push('--timeout', options.timeout.toString());
      }
    }

    const process = spawn('aos', args, {
      stdio: 'inherit',
      shell: true,
      cwd: targetPath
    });

    return new Promise((resolve, reject) => {
      process.on('error', reject);
      process.on('exit', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Eval exited with code ${code}`));
      });
    });
  }

  static async listProcesses(targetPath: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const process = spawn('aos', ['list'], {
        stdio: ['inherit', 'pipe', 'inherit'],
        shell: true,
        cwd: targetPath
      });

      let output = '';
      process.stdout?.on('data', (data) => {
        output += data.toString();
      });

      process.on('error', reject);
      process.on('exit', (code) => {
        if (code === 0) {
          resolve(output.trim().split('\n'));
        } else {
          reject(new Error(`List command failed with code ${code}`));
        }
      });
    });
  }

  static async watchPattern(
    processName: string,
    pattern: string,
    options: { timeout?: number; count?: number } = {}
  ): Promise<void> {
    const args = ['watch', processName, pattern];
    if (options.timeout) {
      args.push('--timeout', options.timeout.toString());
    }
    if (options.count) {
      args.push('--count', options.count.toString());
    }

    const process = spawn('aos', args, {
      stdio: 'inherit',
      shell: true
    });

    return new Promise((resolve, reject) => {
      process.on('error', reject);
      process.on('exit', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Watch command failed with code ${code}`));
      });
    });
  }

  static async matchPattern(patterns: string[], message: string): Promise<boolean> {
    return patterns.some(pattern => {
      const regex = pattern
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.')
        .replace(/\[!\]/g, '[^]');
      return new RegExp(`^${regex}$`).test(message);
    });
  }
}