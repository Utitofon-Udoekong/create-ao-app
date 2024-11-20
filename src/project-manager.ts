import inquirer, { DistinctQuestion } from 'inquirer';
import fs from 'fs-extra';
import path from 'path';
import ora from 'ora';
import { CliOptions } from './types';
import { execAsync } from './utils';

export class ProjectManager {
    async cloneTemplate(template: string, targetPath: string): Promise<void> {
        const spinner = ora('Cloning template...').start();
        try {
            await execAsync(`git clone ${template} ${targetPath}`);
            await fs.remove(path.join(targetPath, '.git')); // Remove .git directory
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

        if (!options.framework) {
            questions.push({
                type: 'list',
                name: 'framework',
                message: 'Which framework would you like to use?',
                choices: [
                    { name: 'Next.js', value: 'nextjs' },
                    { name: 'Nuxt.js', value: 'nuxtjs' }
                ]
            });
        }

        if (!options.name && !options.path) {
            questions.push({
                type: 'input',
                name: 'name',
                message: 'What is the name of your project?',
                default: 'ao-project'
            });
        }

        if (!options.packageManager) {
            questions.push({
                type: 'list',
                name: 'packageManager',
                message: 'Which package manager would you like to use?',
                choices: ['pnpm', 'yarn', 'npm']
            });
        }

        if (!options.aosProcess) {
            questions.push(
                {
                    type: 'confirm',
                    name: 'aosProcess',
                    message: 'Would you like to automatically start an AO process?',
                    default: true
                },
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
}