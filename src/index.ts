#!/usr/bin/env node

import { program } from 'commander';
import { loadConfig, saveConfig } from './config.js';
import { AOSProcessManager, Schedule } from './process-manager.js';
import { ProjectManager } from './project-manager.js';
import { AOConfig, CreateProjectOptions, StartDevelopmentServerOptions } from './types.js';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';

// Template repositories for different frameworks
const TEMPLATES = {
  nextjs: 'https://github.com/Utitofon-Udoekong/next-ao-starter-kit.git',
  nuxtjs: 'https://github.com/Utitofon-Udoekong/nuxt-ao-starter-kit.git'
};

const processManager = new AOSProcessManager();
const projectManager = new ProjectManager(process.cwd());

// Core functions
async function createProject(name: string, options: CreateProjectOptions) {
  try {
    // Interactive prompts if options are not provided
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'What is your project named?',
        default: name || 'ao-project',
        when: !name
      },
      {
        type: 'list',
        name: 'framework',
        message: 'Which framework would you like to use?',
        choices: ['nextjs', 'nuxtjs'],
        default: 'nuxtjs',
        when: !options.framework
      },
      {
        type: 'list',
        name: 'packageManager',
        message: 'Which package manager would you like to use?',
        choices: ['npm', 'yarn', 'pnpm'],
        default: 'pnpm',
        when: !options.packageManager
      }
    ]);

    const projectName = name || answers.name;
    const framework = options.framework || answers.framework;
    const packageManager = options.packageManager || answers.packageManager;

    let projectPath = options.path || projectName;
    projectPath = path.resolve(process.cwd(), projectPath);

    console.log('\nProject Configuration:');
    console.log(chalk.blue('  Name:'), chalk.white(projectName));
    console.log(chalk.blue('  Framework:'), chalk.white(framework));
    console.log(chalk.blue('  Package Manager:'), chalk.white(packageManager));
    console.log(chalk.blue('  Path:'), chalk.white(projectPath));

    const { confirm } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: 'Do you want to proceed with this configuration?',
      default: true
    }]);

    if (!confirm) {
      console.log(chalk.yellow('\nProject creation cancelled'));
      return;
    }

    // Check if directory exists and is empty
    const exists = await projectManager.validateDirectory(projectPath);
    if (!exists) {
      await fs.ensureDir(projectPath);
    }

    // Clone template and setup
    const templateUrl = TEMPLATES[framework as keyof typeof TEMPLATES];
    await projectManager.cloneTemplate(templateUrl, projectPath);
    await projectManager.initializeGit(projectPath);
    await projectManager.installDependencies(projectPath, packageManager);

    // Create AO directory
    const processDir = framework === 'nuxtjs' ? 'ao' : 'src/ao';
    const processPath = path.join(projectPath, processDir);
    await fs.ensureDir(processPath);

    // Save default config
    const defaultConfig: AOConfig = {
      luaFiles: [],
      packageManager,
      framework,
      ports: { dev: 3000 }
    };
    await saveConfig(projectPath, defaultConfig);

    console.log(chalk.green(`\n✨ Project ${projectName} created successfully!`));
    console.log(chalk.green(`\n cd ${projectName}`));
    console.log(chalk.blue('\nAvailable commands:'));
    console.log(chalk.white('  cao dev       # Start development server'));
    console.log(chalk.white('  cao dev:ao    # Start development server and AO processes'));
    console.log(chalk.white('  cao ao:start     # Start AO processes'));
    console.log(chalk.white('  cao ao:monitor   # Monitor AO process'));
    console.log(chalk.white('  cao ao:eval <input>   # Evaluate AO process'));
    console.log(chalk.white('  cao ao:schedule    # Start process scheduler'));
    console.log(chalk.white('  cao ao:schedule-stop   # Stop process scheduler'));
  } catch (error) {
    console.error('Error creating project:', error);
    throw error;
  }
}

async function startDevServer() {
  try {
    const projectPath = process.cwd();
    const config = await loadConfig(projectPath);

    // Only prompt for AO process preference on first run
    if (config.runWithAO === undefined) {
      const { startAO } = await inquirer.prompt([{
        type: 'confirm',
        name: 'startAO',
        message: 'Would you like to always start an AO process with the dev server? (This preference will be saved)\n. This can be changed later in the ao config file.',
        default: false
      }]);

      config.runWithAO = startAO;
      await saveConfig(projectPath, config);
    }

    // Start server based on saved preference
    if (config.runWithAO) {
      await startDevWithAO({ monitorProcess: false });
    } else {
      await projectManager.startDevServer(config, false);
    }
  } catch (error) {
    console.error('Error starting development server:', error);
    throw error;
  }
}

async function startAOProcess(options: StartDevelopmentServerOptions) {
  try {
    const projectPath = process.cwd();
    const config = await loadConfig(projectPath);

    if (await processManager.checkAOSInstallation() === false) {
      return;
    }

    // Prompt for process name if not provided
    if (!options.processName && !config.processName) {
      const { processName } = await inquirer.prompt([{
        type: 'input',
        name: 'processName',
        message: 'Enter a name for your AO process (optional):',
        default: 'ao-process'
      }]);

      if (processName) {
        config.processName = processName;
        await saveConfig(projectPath, config);
      }
    } else if (options.processName) {
      config.processName = options.processName;
      await saveConfig(projectPath, config);
    }

    const processDir = config.framework === 'nuxtjs' ? 'ao' : 'src/ao';
    const processPath = path.join(projectPath, processDir);

    console.log(chalk.blue('\nScanning for Lua files...'));
    const luaFiles = await processManager.findLuaFiles(processPath);

    if (luaFiles.length === 0) {
      console.log(chalk.yellow('No Lua files found in the project.'));
      return;
    }

    const { selectedFiles } = await inquirer.prompt([{
      type: 'checkbox',
      name: 'selectedFiles',
      message: 'Select Lua files to load:',
      choices: luaFiles
    }]);

    if (selectedFiles.length === 0) {
      console.log(chalk.yellow('No files selected. Exiting...'));
      return;
    }

    config.luaFiles = selectedFiles;
    await saveConfig(projectPath, config);

    await processManager.startAOProcess(processPath, config);

    if (options.monitorProcess) {
      await processManager.monitorProcess();
    }

    if (options.evaluate) {
      await processManager.evaluateProcess(options.evaluate);
    }

    console.log(chalk.green('\n🎉 AO processes started successfully!'));
    console.log(chalk.blue('\nActive Lua files:'));
    selectedFiles.forEach((file: string) => console.log(chalk.white(`  - ${file}`)));

  } catch (error) {
    console.error('Error starting AO processes:', error);
    throw error;
  }
}

async function startDevWithAO(options: StartDevelopmentServerOptions) {
  try {
    const projectPath = process.cwd();
    const config = await loadConfig(projectPath);

    // Start dev server and wait for it to be ready before starting AO process
    const serverReady = () => new Promise<boolean>(async (resolve, reject) => {
      const devServer = await projectManager.startDevServer(config, true);

      devServer.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();
        if (output.includes('http://localhost:')) {
          resolve(true);
        }
      });

      // Prevent hanging if server fails to start
      setTimeout(() => {
        reject(new Error('Development server startup timed out after 2 minutes'));
      }, 120000);
    });

    // Start and wait for dev server
    console.log(chalk.yellow('\nWaiting for development server to be ready...'));
    const isServerReady = await serverReady();
    if (!isServerReady) {
      console.log(chalk.red('🚫 Development server failed to start!'));
      return;
    }

    // Then handle AO processes
    if (await processManager.checkAOSInstallation() === false) {
      return;
    }

    const processDir = config.framework === 'nuxtjs' ? 'ao' : 'src/ao';
    const processPath = path.join(projectPath, processDir);

    console.log(chalk.blue('\nScanning for Lua files...'));
    const luaFiles = await processManager.findLuaFiles(processPath);

    if (luaFiles.length === 0) {
      console.log(chalk.yellow('No Lua files found in the project.'));
      return;
    }

    console.log('\n'.repeat(2));

    const { selectedFiles } = await inquirer.prompt([{
      type: 'checkbox',
      name: 'selectedFiles',
      message: 'Select Lua files to load:',
      choices: luaFiles,
      pageSize: 10
    }]);

    if (selectedFiles.length === 0) {
      console.log(chalk.yellow('No files selected. Continuing with dev server only...'));
      return;
    }

    config.luaFiles = selectedFiles;
    await saveConfig(projectPath, config);

    console.log(chalk.blue('\nStarting AO processes...'));
    await processManager.startAOProcess(processPath, config);

    if (options.monitorProcess) {
      await processManager.monitorProcess();
    }

    if (options.evaluate) {
      await processManager.evaluateProcess(options.evaluate);
    }

    console.log(chalk.green('\n✨ Development server and AO processes are running!'));
    console.log(chalk.blue('\nActive Lua files:'));
    selectedFiles.forEach((file: string) => console.log(chalk.white(`  - ${file}`)));

  } catch (error) {
    console.error('Error starting development environment:', error);
    throw error;
  }
}

// CLI Commands
program
  .name('create-ao-app')
  .description('CLI tool to create and manage AO-powered applications')
  .version('1.0.3-tc-4');

program
  .command('init [name]')
  .alias('create')
  .description('Initialize a new AO project')
  .option('-f, --framework <framework>', 'framework to use (nextjs or nuxtjs)')
  .option('-p, --path <path>', 'path to create the project in')
  .option('--package-manager <pm>', 'package manager to use (npm, yarn, pnpm)')
  .action(createProject);

program
  .command('dev')
  .description('Start development server')
  .option('--config-path <path>', 'path to configuration file')
  .action(startDevServer);

program
  .command('ao:start')
  .description('Start AO processes')
  .option('--config-path <path>', 'path to configuration file')
  .option('-m, --monitor-process', 'monitor AO processes after starting')
  .option('-e, --evaluate <input>', 'evaluate process after starting')
  .option('-n, --process-name <name>', 'name for the AO process')
  .action(startAOProcess);

program
  .command('ao:monitor')
  .description('Monitor an AO process')
  .option('-p, --pattern [pattern]', 'message pattern to match')
  .option('--json', 'output in JSON format')
  .action(async (options) => {
    await processManager.monitorProcess(options);
  });

program
  .command('ao:eval <input>')
  .description('Evaluate an AO process')
  .option('--await', 'wait for response')
  .option('--timeout <ms>', 'timeout in milliseconds', '5000')
  .action(async (input, options) => {
    await processManager.evaluateProcess(input, options);
  });

program
  .command('ao:schedule')
  .description('Start process scheduler')
  .option('-i, --interval <ms>', 'scheduler interval', '1000')
  .option('-t, --tick <function>', 'tick function name')
  .action(async (options) => {
    const scheduler = new Schedule(
      process.cwd(),
      options,
      new AOSProcessManager()
    );
    await scheduler.start();
  });

program
  .command('ao:schedule-stop')
  .description('Stop process scheduler')
  .action(async () => {
    const scheduler = new Schedule(process.cwd(), {}, new AOSProcessManager());
    await scheduler.stop();
  });

program
  .command('config')
  .description('Manage configuration')
  .option('--get <key>', 'get configuration value')
  .option('--set <key> <value>', 'set configuration value')
  .option('--delete <key>', 'delete configuration value')
  .action(async (options) => {
    const config = await loadConfig(process.cwd());
    if (options.get) {
      console.log(config[options.get as keyof typeof config]);
    } else if (options.set) {
      (config[options.set as keyof typeof config] as any) = options.value;
      await saveConfig(process.cwd(), config);
    } else if (options.delete) {
      delete config[options.delete as keyof typeof config];
      await saveConfig(process.cwd(), config);
    }
  });

program
  .command('dev:ao')
  .description('Start both development server and AO processes')
  .option('--config-path <path>', 'path to configuration file')
  .option('-m, --monitor-process', 'monitor AO processes after starting')
  .option('-e, --evaluate <input>', 'evaluate process after starting')
  .action(startDevWithAO);

program.parse();
