import { Command } from 'commander';
import { BaseCommand } from './base-command.js';
import { logger } from '../utils/logging.js';

export class CommandRegistry {
  private commands: Map<string, BaseCommand> = new Map();
  private categories: Map<string, string[]> = new Map();

  registerCommand(command: BaseCommand, category: string = 'default'): void {
    if (this.commands.has(command.name)) {
      logger.warn(`Command '${command.name}' is already registered. Overwriting...`);
    }

    this.commands.set(command.name, command);
    
    if (!this.categories.has(category)) {
      this.categories.set(category, []);
    }
    this.categories.get(category)!.push(command.name);
    
    logger.debug(`Registered command: ${command.name} in category: ${category}`);
  }

  registerCommands(program: Command): void {
    logger.debug(`Registering ${this.commands.size} commands...`);
    
    for (const command of this.commands.values()) {
      command.register(program);
    }
    
    logger.debug('All commands registered successfully');
  }

  getCommand(name: string): BaseCommand | undefined {
    return this.commands.get(name);
  }

  getAllCommands(): BaseCommand[] {
    return Array.from(this.commands.values());
  }

  getCommandsByCategory(category: string): BaseCommand[] {
    const commandNames = this.categories.get(category) || [];
    return commandNames.map(name => this.commands.get(name)!);
  }

  getCategories(): string[] {
    return Array.from(this.categories.keys());
  }

  removeCommand(name: string): boolean {
    const removed = this.commands.delete(name);
    if (removed) {
      // Remove from all categories
      for (const [category, commands] of this.categories.entries()) {
        const index = commands.indexOf(name);
        if (index > -1) {
          commands.splice(index, 1);
          if (commands.length === 0) {
            this.categories.delete(category);
          }
        }
      }
      logger.debug(`Removed command: ${name}`);
    }
    return removed;
  }

  clear(): void {
    this.commands.clear();
    this.categories.clear();
    logger.debug('Command registry cleared');
  }

  getCommandCount(): number {
    return this.commands.size;
  }
} 