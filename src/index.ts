#!/usr/bin/env node

import { program } from 'commander';
import { AOSProcessManager } from './process-manager';
import { loadConfig, saveConfig } from './config';
import { createProject } from './project';
import { Schedule } from './scheduler';

// Enhanced CLI commands
program
  .name('create-ao-app')
  .description('CLI tool to create and manage AO-powered applications')
  .version('1.0.2');

// Project creation command
program
  .command('new [name]')
  .alias('create')
  .description('Create a new AO project')
  .option('-f, --framework <framework>', 'framework to use (nextjs or nuxtjs)')
  .option('-p, --path <path>', 'path to create the project in')
  .option('--no-aos-process', 'skip automatic AO process creation')
  .option('--package-manager <pm>', 'package manager to use (npm, yarn, pnpm)')
  .option('--config <path>', 'path to configuration file')
  .option('-m, --monitor', 'monitor AO processes after starting')
  .option('-e, --eval <input>', 'evaluate process after starting')
  .action(createProject);

// Process management commands
program
  .command('processes')
  .description('List all AO processes')
  .action(async () => {
    const processes = await AOSProcessManager.listProcesses(process.cwd());
    console.log(processes);
  });

// Enhanced monitor command with pattern matching
program
  .command('monitor <process>')
  .description('Monitor an AO process')
  .option('-p, --pattern <pattern>', 'message pattern to match')
  .option('--json', 'output in JSON format')
  .action(async (process, options) => {
    await AOSProcessManager.monitorProcess(process, process.cwd(), {
      pattern: options.pattern,
      json: options.json
    });
  });

// Enhanced eval command
program
  .command('eval <process> <input>')
  .description('Evaluate an AO process')
  .option('--await', 'wait for response')
  .option('--timeout <ms>', 'timeout in milliseconds', '5000')
  .action(async (process, input, options) => {
    await AOSProcessManager.evaluateProcess(process, input, process.cwd(), {
      await: options.await,
      timeout: parseInt(options.timeout)
    });
  });

// Scheduler commands
program
  .command('schedule <process>')
  .description('Start process scheduler')
  .option('-i, --interval <ms>', 'scheduler interval', '1000')
  .option('-t, --tick <function>', 'tick function name')
  .action(async (process, options) => {
    const scheduler = new Schedule(process, {
      interval: parseInt(options.interval),
      tick: options.tick
    });
    await scheduler.start();
  });

program
  .command('schedule-stop <process>')
  .description('Stop process scheduler')
  .action(async (process) => {
    const scheduler = new Schedule(process);
    await scheduler.stop();
  });

// Pattern watching command
program
  .command('watch <process> <pattern>')
  .description('Watch for specific message patterns')
  .option('--timeout <ms>', 'watch timeout', '0')
  .option('--count <n>', 'number of messages to watch', '0')
  .action(async (process, pattern, options) => {
    await AOSProcessManager.watchPattern(process, pattern, {
      timeout: parseInt(options.timeout),
      count: parseInt(options.count)
    });
  });

// Configuration commands
program
  .command('config')
  .description('Manage configuration')
  .option('--get <key>', 'get configuration value')
  .option('--set <key> <value>', 'set configuration value')
  .option('--delete <key>', 'delete configuration value')
  .action(async (options) => {
    const config = await loadConfig(process.cwd(), {});
    if (options.get) {
      console.log(config[options.get as keyof typeof config]);
    } else if (options.set) {
      config[options.set] = options.value;
      await saveConfig(process.cwd(), config);
    } else if (options.delete) {
      delete config[options.delete as keyof typeof config];
      await saveConfig(process.cwd(), config);
    }
  });

program.parse();
