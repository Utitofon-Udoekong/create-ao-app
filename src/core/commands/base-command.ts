import { Command } from 'commander';
import { CommandOption, CommandContext } from '../../types/cli.js';
import { logger } from '../utils/logging.js';
import { ErrorHandler } from '../utils/error-handling.js';

export abstract class BaseCommand {
  abstract name: string;
  abstract description: string;
  abstract options: CommandOption[];

  register(program: Command): void {
    // Validate before registering
    this.validateCommand();
    
    const cmd = program.command(this.name).description(this.description);
    
    // Add positional arguments for init command (optional for interactive mode)
    if (this.name === 'init') {
      cmd.argument('[name]', 'Project name (optional for interactive mode)');
    }
    
    // Register options
    for (const option of this.options) {
      if (option.required) {
        cmd.requiredOption(option.flag, option.description, option.defaultValue);
      } else {
        cmd.option(option.flag, option.description, option.defaultValue);
      }
    }
    
    // Register action with error handling
    cmd.action(async (name: string, options: any) => {
      try {
        logger.debug(`Executing command: ${this.name}`, { name, ...options });
        // For init command, add name to options
        if (this.name === 'init') {
          options.name = name;
        }
        await this.execute(options);
        logger.debug(`Command completed: ${this.name}`);
      } catch (error) {
        ErrorHandler.handle(error as Error);
        process.exit(1);
      }
    });

    // Add help text
    this.addHelpText(cmd);
  }

  private validateCommand(): void {
    if (!this.name || typeof this.name !== 'string') {
      throw new Error('Command must have a valid name');
    }
    if (!this.description || typeof this.description !== 'string') {
      throw new Error('Command must have a valid description');
    }
    if (!Array.isArray(this.options)) {
      throw new Error('Command must have a valid options array');
    }
  }

  protected addHelpText(cmd: Command): void {
    cmd.addHelpText('after', this.getHelpText());
  }

  protected getHelpText(): string {
    return '';
  }

  abstract execute(options: any): Promise<void>;

  protected async validateOptions(options: any): Promise<void> {
    // Override in subclasses for specific validation
  }

  protected logStart(message: string): void {
    logger.info(`Starting: ${message}`);
  }

  protected logSuccess(message: string): void {
    logger.success(`Completed: ${message}`);
  }

  protected logError(message: string, error?: Error): void {
    logger.error(`Failed: ${message}`);
    if (error) {
      logger.debug('Error details:', error);
    }
  }

  protected logInfo(message: string): void {
    logger.info(message);
  }
} 