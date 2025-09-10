import { BaseCommand } from './base-command.js';
import { CommandOption } from '../../types/cli.js';
import chalk from 'chalk';

export class VersionCommand extends BaseCommand {
  name = 'version';
  description = 'Show version information';
  options: CommandOption[] = [];

  async execute(options: any): Promise<void> {
    this.logStart('Displaying version information');
    
    console.log(chalk.blue('🔥 AO Forge'));
    console.log(chalk.white('Version: 2.0.0'));
    console.log(chalk.gray('AO Application Builder'));
    console.log(chalk.gray('Built with TypeScript and Node'));
    console.log(chalk.gray('Forge your next AO application with ease'));
    
    this.logSuccess('Version information displayed');
  }
} 