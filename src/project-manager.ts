import inquirer, { DistinctQuestion } from 'inquirer';
import fs from 'fs-extra';
import path from 'path';
import ora from 'ora';
import { AOConfig, CliOptions, CreateProjectOptions } from './types.js';
import { detectPackageManager, execAsync } from './utils.js';
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { DEFAULT_CONFIG } from './config.js';
import chalk from 'chalk';
import open from 'open';

export class ProjectManager {
    private projectPath: string;

    constructor(projectPath: string) {
        this.projectPath = projectPath;
    }

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

    async startDevServer(config: AOConfig, quietFramework: boolean): Promise<ChildProcessWithoutNullStreams> {
        const spinner = ora('Starting development server...').start();
        
        try {
            const port = config.ports?.dev || 3000;
            const pm = config.packageManager || await detectPackageManager();
            const devCommand = {
                'npm': 'npm run dev',
                'yarn': 'yarn run dev',
                'pnpm': 'pnpm run dev'
            }[pm];

            if (!devCommand) {
                throw new Error(`Unsupported package manager: ${pm}`);
            }
            
            const installCommand = {
                'npm': 'npm install',
                'yarn': 'yarn install',
                'pnpm': 'pnpm install'
            }[pm];
            
            if (await this.checkDependenciesInstalled(pm)) {
                spinner.text = 'Dependencies already installed.\n ';
            } else {
                spinner.text = 'Installing dependencies...';
                await execAsync(installCommand, { cwd: this.projectPath });
            }
            
            spinner.text = 'Starting development server...\n ';
            const devProcess = spawn(devCommand, [], {
                cwd: this.projectPath,
                shell: true,
                stdio: ['inherit', 'pipe', 'pipe']
            });

            let serverStarted = false;

            // Handle stdout and detect server ready state
            devProcess.stdout?.on('data', (data: Buffer) => {
                const output = data.toString();
                
                if (!serverStarted && output.includes('http://localhost:')) {
                    serverStarted = true;
                    spinner.stop();
                    console.log(chalk.green('\n🎉 Development server started successfully!'));
                    
                    // Extract the port from the output
                    const match = output.match(/Local:\s+http:\/\/localhost:(\d+)/);
                    const serverPort = match ? match[1] : port;
                    const url = `http://localhost:${serverPort}`;
                    console.log(chalk.cyan(`\n🚀 Your application is running at: ${url}\n`));
                    
                    open(url).catch(() => {
                        console.log(chalk.yellow('\nCould not open browser automatically.'));
                    });
                }

                // Only show framework output if not running with AO process
                if (!quietFramework) {
                    process.stdout.write(data);
                }
            });

            // Handle stderr
            devProcess.stderr?.on('data', (data: Buffer) => {
                const error = data.toString();
                if (error.includes('error')) {
                    spinner.stop();
                }
                // Only show error output if not in quiet mode
                if (!quietFramework) {
                    process.stderr.write(data);
                }
            });

            // Handle process exit
            devProcess.on('close', (code: number) => {
                if (spinner.isSpinning) {
                    spinner.stop();
                }
                if (code !== 0) {
                    console.error(chalk.red('\nDevelopment server stopped unexpectedly'));
                    process.exit(code);
                }
            });

            // Handle process errors
            devProcess.on('error', (error) => {
                if (spinner.isSpinning) {
                    spinner.stop();
                }
                console.error(chalk.red('\nFailed to start development server'));
                console.error(error);
                process.exit(1);
            });

            return devProcess as unknown as ChildProcessWithoutNullStreams;

        } catch (error) {
            spinner.fail(chalk.red('Failed to start development server'));
            console.error(error);
            process.exit(1);
        }
    }

    async createDefaultAOConfig(options: CreateProjectOptions): Promise<AOConfig> {
        return {
            ...DEFAULT_CONFIG,
            luaFiles: [], 
            packageManager: options.packageManager || 'npm',
            processName: options.processName || 'ao-process',
            runWithAO: false,
            tags: {
                'Environment': 'development',
                'Project': options.name || 'ao-app'
            }
        };
    }

    async checkDependenciesInstalled(packageManager: string): Promise<boolean> {
        const nodeModulesPath = path.join(this.projectPath, 'node_modules');
        return fs.pathExists(nodeModulesPath);
    }
}