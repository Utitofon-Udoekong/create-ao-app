#!/usr/bin/env node

import { program } from 'commander';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import ora from 'ora';
import chalk from 'chalk';
import inquirer, {DistinctQuestion} from 'inquirer';

const execAsync = promisify(exec);

const TEMPLATES = {
  nextjs: 'https://github.com/Utitofon-Udoekong/next-ao-starter-kit.git',
  nuxtjs: 'https://github.com/Utitofon-Udoekong/nuxt-ao-starter-kit.git'
};

interface CliOptions {
  framework?: string;
  name?: string;
  path?: string;
  packageManager?: string;
}

async function validateDirectory(directoryPath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(directoryPath);
    const isEmpty = (await fs.readdir(directoryPath)).length === 0;
    return stats.isDirectory() && isEmpty;
  } catch (error) {
    return false;
  }
}

async function cloneTemplate(template: string, targetPath: string): Promise<void> {
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

async function initializeGit(targetPath: string): Promise<void> {
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

async function installDependencies(targetPath: string, packageManager: string): Promise<void> {
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

async function promptForMissingOptions(options: CliOptions): Promise<CliOptions> {
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


  const answers = await inquirer.prompt(questions);
  return {
    ...options,
    ...answers
  };
}

async function createProject(options: CliOptions) {
  try {
    // Determine target directory
    let targetPath = options.path || options.name || 'ao-project';
    targetPath = path.resolve(process.cwd(), targetPath);

    // Check if directory exists and is empty
    const exists = await validateDirectory(targetPath);
    if (!exists) {
      await fs.ensureDir(targetPath);
    }

    // Clone the appropriate template
    const templateUrl = TEMPLATES[options.framework as keyof typeof TEMPLATES];
    await cloneTemplate(templateUrl, targetPath);

    // Initialize new git repository
    await initializeGit(targetPath);

    // Install dependencies
    const packageManager = options.packageManager || 'npm';
    await installDependencies(targetPath, packageManager);

    console.log(chalk.green('\n🎉 Project created successfully!'));
    console.log(chalk.blue('\nNext steps:'));
    console.log(chalk.white(`  cd ${path.relative(process.cwd(), targetPath)}`));
    console.log(chalk.white(`  ${packageManager} run dev\n`));

  } catch (error) {
    console.error(chalk.red('Error creating project:'), error);
    process.exit(1);
  }
}

program
  .name('create-ao-app')
  .description('CLI tool to create AO-powered applications')
  .version('1.0.0');

program
  .argument('[name]', 'name of your project')
  .option('-f, --framework <framework>', 'framework to use (nextjs or nuxtjs)')
  .option('-p, --path <path>', 'path to create the project in')
  .option('-pm,--package-manager <packageManager>', 'package manager to use (pnpm, yarn, npm)')
  .action(async (name, options) => {
    const projectOptions = await promptForMissingOptions({
      ...options,
      name
    });
    await createProject(projectOptions);
  });

program.parse();
