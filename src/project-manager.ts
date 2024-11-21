import inquirer, { DistinctQuestion } from 'inquirer';
import fs from 'fs-extra';
import path from 'path';
import ora from 'ora';
import { AOConfig, CliOptions, CreateProjectOptions } from './types.js';
import { detectPackageManager, execAsync } from './utils.js';
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { DEFAULT_CONFIG } from './config.js';

export class ProjectManager {
    async cloneTemplate(template: string, targetPath: string): Promise<void> {
        const spinner = ora('Cloning template...').start();
        try {
            await execAsync(`git clone ${template} ${targetPath}`);
            await fs.remove(path.join(targetPath, '.git')); 
            spinner.succeed('Template cloned successfully');
        } catch (error) {
            spinner.fail('Failed to clone template');
            throw error;
        }
    }

    async initializeGit(targetPath: string): Promise<void> {
        const spinner = ora('Initializing git repository...').start();
        try {
            await execAsync('git init', { cwd: targetPath });
            await execAsync('git add .', { cwd: targetPath });
            await execAsync('git commit -m "Initial commit from AO CLI"', { cwd: targetPath });
            spinner.succeed('Git repository initialized');
        } catch (error) {
            spinner.fail('Failed to initialize git repository');
            throw error;
        }
    }

    async installDependencies(targetPath: string, packageManager: string): Promise<void> {
        const spinner = ora(`Installing dependencies with ${packageManager}...`).start();
        try {
            const command = `${packageManager} install`;

            await execAsync(command, { cwd: targetPath });
            spinner.succeed('Dependencies installed');
        } catch (error) {
            spinner.fail('Failed to install dependencies');
            throw error;
        }
    }

    async validateDirectory(directoryPath: string): Promise<boolean> {
        try {
            const stats = await fs.stat(directoryPath);
            const isEmpty = (await fs.readdir(directoryPath)).length === 0;
            return stats.isDirectory() && isEmpty;
        } catch (error) {
            return false;
        }
    }


    async promptForMissingOptions(options: CliOptions): Promise<CliOptions> {
        const questions: DistinctQuestion[] = [];

        questions.push(
            {
                type: 'confirm',
                name: 'aosProcess',
                message: 'Would you like to set a name for your AO process?',
                default: false
            },
        );

        if (!options.aosProcess) {
            questions.push(
                {
                    type: 'input',
                    name: 'processName',
                    message: 'Custom AO process name (optional):',
                    when: (answers) => answers.aosProcess
                }
            );
        }

        const answers = await inquirer.prompt(questions);
        return {
            ...options,
            ...answers
        };
    }

    async startDevServer(targetPath: string, config: AOConfig): Promise<ChildProcessWithoutNullStreams> {
        const spinner = ora('Starting development server...').start();
        try {
          const pm = config.packageManager || await detectPackageManager();
          const startCommand = {
            'npm': 'npm run dev',
            'yarn': 'yarn dev',
            'pnpm': 'pnpm dev'
          }[pm];
      
          if (!startCommand) {
            throw new Error(`Unsupported package manager: ${pm}`);
          }
      
          const devProcess = spawn(startCommand, {
            cwd: targetPath,
            shell: true,
            stdio: 'pipe',
            env: {
              ...process.env,
              ...config.env,
              PORT: config.ports?.dev?.toString() || '3000'
            }
          });
      
          spinner.succeed(`Development server starting with ${pm}`);
          return devProcess;
        } catch (error) {
          spinner.fail('Failed to start development server');
          throw error;
        }
      }

    async createDefaultAOConfig(options: CreateProjectOptions): Promise<AOConfig> {
        return {
            ...DEFAULT_CONFIG,
            luaFiles: [], 
            packageManager: options.packageManager || 'npm',
            processName: options.processName || 'ao-process',
            autoStart: true,
            tags: {
                'Environment': 'development',
                'Project': options.name || 'ao-app'
            }
        };
    }
}