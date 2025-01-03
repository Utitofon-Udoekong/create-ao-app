#!/usr/bin/env node

import { program } from 'commander';
import { loadConfig, saveConfig } from './config.js';
import { AOSProcessManager, Schedule } from './process-manager.js';
import { ProjectManager } from './project-manager.js';
import { AOConfig, AOProcessOptions, CreateProjectOptions, StartDevelopmentServerOptions } from './types.js';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { LuaCodeGenerator } from './ai/code-generator.js';
import { APIKeyManager } from './ai/api-config.js';

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
    console.log(chalk.white('  cao ao:generate    # Generate Lua code using AI'));
    console.log(chalk.white('  cao config:api     # Configure AI provider API keys'));
    console.log(chalk.white('  cao config     # Manage configuration'));
    console.log(chalk.white('  cao help       # Show help'));
    console.log(chalk.white('  cao version    # Show version'));
    
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

async function startAOProcess(options: AOProcessOptions) {
  try {
    const projectPath = process.cwd();
    const config = await loadConfig(projectPath);

    if (await processManager.checkAOSInstallation() === false) {
      return;
    }

    // Prompt for process name if not provided
    if (!options.name && !config.processName) {
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
    } else if (options.name) {
      config.processName = options.name;
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

    await processManager.startAOProcess(processPath, config, options);

    if (options.monitor) {
      await processManager.monitorProcess();
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
  .version('1.0.5');

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
  .option('-n, --name <name>', 'name for the AO process')
  .option('-w, --wallet <path>', 'path to wallet file')
  .option('-d, --data <path>', 'data file path')
  .option('--tag-name <name>', 'process tag name')
  .option('--tag-value <value>', 'process tag value')
  .option('--module <txid>', 'module ID to use')
  .option('--cron <frequency>', 'setup cron job (e.g., "1-minute")')
  .option('--monitor', 'monitor the process')
  .option('--sqlite', 'use sqlite3 AOS Module')
  .option('--gateway-url <url>', 'set Arweave gateway URL')
  .option('--cu-url <url>', 'set Computer Unit URL')
  .option('--mu-url <url>', 'set Messenger Unit URL')
  .action(startAOProcess);

program
  .command('ao:monitor')
  .description('Monitor AO processes')
  .argument('[name]', 'process name to monitor')
  .action(async (name) => {
    try {
      await processManager.monitorProcess(name);
    } catch (error) {
      console.error(chalk.red('Error monitoring process:'), error);
      process.exit(1);
    }
  });

program
  .command('ao:watch')
  .description('Watch an AO process')
  .argument('<name>', 'process name to watch')
  .action(async (name) => {
    try {
      await processManager.watchProcess(name);
    } catch (error) {
      console.error(chalk.red('Error watching process:'), error);
      process.exit(1);
    }
  });

program
  .command('ao:list')
  .description('List AO processes for your wallet')
  .action(async () => {
    try {
      await processManager.listProcesses();
    } catch (error) {
      console.error(chalk.red('Error listing processes:'), error);
      process.exit(1);
    }
  });

program
  .command('ao:cron')
  .description('Setup a cron job for an AO process')
  .argument('<name>', 'process name')
  .argument('<frequency>', 'cron frequency (e.g., "1-minute", "30-second")')
  .action(async (name, frequency) => {
    try {
      await processManager.setupCron(name, frequency);
    } catch (error) {
      console.error(chalk.red('Error setting up cron:'), error);
      process.exit(1);
    }
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

program
  .command('ao:generate')
  .description('Generate Lua code using AI')
  .requiredOption('-p, --prompt <text>', 'Description of the Lua code you want to generate')
  .option('-t, --type <type>', 'Type of code', 'contract')
  .option('-o, --output <path>', 'Output file path')
  .option('--provider <provider>', 'AI provider to use (openai or anthropic)', 'openai')
  .option('--model <model>', 'Specific AI model to use')
  .action(async (options) => {
    try {
      const generator = new LuaCodeGenerator();
      
      // Generate the code
      const code = await generator.generateCode({
        prompt: options.prompt,
        type: options.type,
        provider: options.provider as 'openai' | 'anthropic',
        model: options.model
      });

      // Display the generated code
      console.log(chalk.blue('\nGenerated Code:'));
      console.log(code);

      // Save if output path is provided
      if (options.output) {
        const outputPath = path.resolve(process.cwd(), options.output);
        await generator.saveCode(code, outputPath);
      }

    } catch (error) {
      console.error(chalk.red('Error generating code:'), error);
      process.exit(1);
    }
  });

program
  .command('config:api')
  .description('Configure AI provider API keys')
  .action(async () => {
    try {
      const apiKeyManager = new APIKeyManager();
      await apiKeyManager.promptForAPIKey();
    } catch (error) {
      console.error(chalk.red('Error configuring API key:'), error);
      process.exit(1);
    }
  });

program
  .command('ao:stop')
  .description('Stop running AO processes')
  .action(async () => {
    try {
      await processManager.stopProcess();
      console.log(chalk.green('AO process stopped successfully'));
    } catch (error) {
      console.error(chalk.red('Error stopping process:'), error);
    }
  });

program.parse();
