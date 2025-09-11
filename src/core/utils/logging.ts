import chalk from 'chalk';
import ora, { Ora } from 'ora';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export class Logger {
  private level: LogLevel;
  private prefix: string;
  private spinner: Ora | null = null;

  constructor(level: LogLevel = LogLevel.INFO, prefix: string = 'FORGE') {
    this.level = level;
    this.prefix = prefix;
  }

  private formatMessage(level: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] ${chalk.blue(this.prefix)} ${level} ${message}`;
  }

  private formatSimpleMessage(level: string, message: string): string {
    return `${chalk.blue(this.prefix)} ${level} ${message}`;
  }

  debug(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.DEBUG) {
      console.log(this.formatMessage(chalk.gray('DEBUG'), message), ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.INFO) {
      console.log(this.formatSimpleMessage(chalk.blue('INFO'), message), ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.WARN) {
      console.warn(this.formatSimpleMessage(chalk.yellow('WARN'), message), ...args);
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.ERROR) {
      console.error(this.formatSimpleMessage(chalk.red('ERROR'), message), ...args);
    }
  }

  success(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.INFO) {
      console.log(this.formatSimpleMessage(chalk.green('SUCCESS'), message), ...args);
    }
  }

  // AI-specific logging methods
  aiStart(operation: string): void {
    if (this.level <= LogLevel.INFO) {
      console.log(`\n${chalk.cyan('🤖')} ${chalk.bold('AI Assistant')} - ${operation}`);
    }
  }

  aiThinking(): void {
    if (this.level <= LogLevel.INFO) {
      this.spinner = ora({
        text: chalk.cyan('🤔 AI is thinking...'),
        color: 'cyan'
      }).start();
    }
  }

  aiStop(): void {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
  }

  aiSuccess(operation: string): void {
    this.aiStop();
    if (this.level <= LogLevel.INFO) {
      console.log(`${chalk.green('✅')} ${chalk.bold(operation)} completed successfully!`);
    }
  }

  aiError(operation: string, error?: Error): void {
    this.aiStop();
    if (this.level <= LogLevel.ERROR) {
      console.error(`${chalk.red('❌')} ${chalk.bold(operation)} failed`);
      if (error) {
        console.error(chalk.red(`   ${error.message}`));
      }
    }
  }

  // Progress indicators
  startProgress(text: string): void {
    if (this.level <= LogLevel.INFO) {
      this.spinner = ora({
        text: chalk.blue(text),
        color: 'blue'
      }).start();
    }
  }

  updateProgress(text: string): void {
    if (this.spinner) {
      this.spinner.text = chalk.blue(text);
    }
  }

  stopProgress(): void {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
  }

  // Section headers
  section(title: string): void {
    if (this.level <= LogLevel.INFO) {
      console.log(`\n${chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')}`);
      console.log(`${chalk.cyan('📋')} ${chalk.bold(title)}`);
      console.log(`${chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')}\n`);
    }
  }

  subsection(title: string): void {
    if (this.level <= LogLevel.INFO) {
      console.log(`\n${chalk.blue('▸')} ${chalk.bold(title)}`);
    }
  }

  // Results formatting
  result(title: string, content: string | string[]): void {
    if (this.level <= LogLevel.INFO) {
      console.log(`\n${chalk.green('📊')} ${chalk.bold(title)}`);
      if (Array.isArray(content)) {
        content.forEach(item => console.log(`  • ${item}`));
      } else {
        console.log(`  ${content}`);
      }
    }
  }

  codeBlock(code: string, language: string = 'lua'): void {
    if (this.level <= LogLevel.INFO) {
      console.log(`\n${chalk.gray('```' + language)}`);
      console.log(code);
      console.log(`${chalk.gray('```')}\n`);
    }
  }

  // Interactive session helpers
  interactivePrompt(): void {
    if (this.level <= LogLevel.INFO) {
      process.stdout.write(`${chalk.cyan('> ')}`);
    }
  }

  interactiveInfo(message: string): void {
    if (this.level <= LogLevel.INFO) {
      console.log(`${chalk.blue('💡')} ${message}`);
    }
  }

  interactiveSuccess(message: string): void {
    if (this.level <= LogLevel.INFO) {
      console.log(`${chalk.green('✅')} ${message}`);
    }
  }

  interactiveError(message: string): void {
    if (this.level <= LogLevel.ERROR) {
      console.log(`${chalk.red('❌')} ${message}`);
    }
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  setPrefix(prefix: string): void {
    this.prefix = prefix;
  }
}

export const logger = new Logger(); 