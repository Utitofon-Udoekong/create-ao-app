import fs from 'fs-extra';
import path from 'path';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { logger } from '../utils/logging.js';
import { ErrorHandler } from '../utils/error-handling.js';
import { Validator } from '../utils/validation.js';
import { AOConfig, CreateProjectOptions } from '../../types/aos.js';
import { ConfigManager } from './config-manager.js';
import open from 'open';

// Framework template repositories
const FRAMEWORK_TEMPLATES = {
  nextjs: 'https://github.com/Utitofon-Udoekong/nextjs-ao-starter-v2',
  nuxtjs: 'https://github.com/Utitofon-Udoekong/nuxtjs-ao-starter-v2',
  svelte: 'https://github.com/Utitofon-Udoekong/svelte-ao-starter-v2',
  react: 'https://github.com/Utitofon-Udoekong/react-ao-starter-v2',
  vue: 'https://github.com/Utitofon-Udoekong/vue-ao-starter-v2'
};

export class ProjectManager {
  private projectPath: string;
  private configManager: ConfigManager;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.configManager = new ConfigManager(projectPath);
  }

  async cloneFrameworkTemplate(framework: string, targetPath: string): Promise<void> {
    logger.info(`Cloning ${framework} template...`);
    
    try {
      const templateUrl = FRAMEWORK_TEMPLATES[framework as keyof typeof FRAMEWORK_TEMPLATES];
      
      if (!templateUrl) {
        throw new Error(`Unsupported framework: ${framework}`);
      }

      // Clone the template repository
      await this.executeCommand('git', ['clone', templateUrl, targetPath]);
      
      // Remove .git directory to start fresh
      await fs.remove(path.join(targetPath, '.git'));

      logger.success(`${framework} template cloned successfully`);
    } catch (error) {
      logger.error('Failed to clone template', error as Error);
      throw error;
    }
  }

  async initializeGit(targetPath: string): Promise<void> {
    logger.info('Initializing git repository...');
    
    try {
      // Initialize git repository
      await this.executeCommand('git', ['init'], { cwd: targetPath });
      
      // Add all files
      await this.executeCommand('git', ['add', '.'], { cwd: targetPath });
      
      // Make initial commit
      await this.executeCommand('git', ['commit', '-m', 'Initial commit - Project created with ao-forge'], { cwd: targetPath });
      
      logger.success('Git repository initialized');
    } catch (error) {
      logger.error('Failed to initialize git repository', error as Error);
      throw error;
    }
  }

  async installDependencies(targetPath: string, packageManager: string): Promise<void> {
    logger.info(`Installing dependencies with ${packageManager}...`);
    
    try {
      const installCommands = {
        'npm': ['install'],
        'yarn': ['install'],
        'pnpm': ['install']
      };

      const command = installCommands[packageManager as keyof typeof installCommands];
      if (!command) {
        throw new Error(`Unsupported package manager: ${packageManager}`);
      }

      await this.executeCommand(packageManager, command, { cwd: targetPath });
      logger.success('Dependencies installed successfully');
    } catch (error) {
      logger.error('Failed to install dependencies', error as Error);
      throw error;
    }
  }

  async findLuaFiles(targetPath: string): Promise<string[]> {
    try {
      const files: string[] = [];
      const walk = async (dir: string) => {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            await walk(fullPath);
          } else if (entry.isFile() && entry.name.endsWith('.lua')) {
            files.push(path.relative(targetPath, fullPath));
          }
        }
      };

      await walk(targetPath);
      return files;
    } catch (error) {
      logger.error('Failed to scan for Lua files', error as Error);
      return [];
    }
  }

  private async executeCommand(command: string, args: string[], options: any = {}): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: 'inherit',
        shell: false,
        ...options
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Command failed with exit code ${code}`));
        }
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  async validateDirectory(directoryPath: string): Promise<boolean> {
    try {
      const exists = await fs.pathExists(directoryPath);
      if (!exists) {
        return false;
      }

      const stats = await fs.stat(directoryPath);
      return stats.isDirectory();
    } catch (error) {
      return false;
    }
  }

  private async ensureProjectDirectory(): Promise<void> {
    try {
      const exists = await this.validateDirectory(this.projectPath);
      
      if (exists) {
        const files = await fs.readdir(this.projectPath);
        if (files.length > 0) {
          throw new Error(`Directory ${this.projectPath} is not empty. Please choose a different location or remove existing files.`);
        }
      } else {
        await fs.ensureDir(this.projectPath);
      }
    } catch (error) {
      logger.error('Failed to ensure project directory', error as Error);
      throw error;
    }
  }

  async createProject(options: CreateProjectOptions): Promise<void> {
    logger.info('Creating new AO project...');
    
    try {
      // Ensure project directory exists and is empty
      await this.ensureProjectDirectory();

      // Clone framework template from GitHub
      await this.cloneFrameworkTemplate(options.framework, this.projectPath);

      // Create AO-specific configuration
      const config = await this.createDefaultConfig(options);
      
      // Scan for Lua files and add them to config
      const luaFiles = await this.findLuaFiles(this.projectPath);
      if (luaFiles.length > 0) {
        config.luaFiles = luaFiles;
        logger.info(`Found ${luaFiles.length} Lua file(s): ${luaFiles.join(', ')}`);
      }
      
      await this.configManager.saveConfig(config);

      // Initialize git if requested
      if (options.initializeGit) {
        await this.initializeGit(this.projectPath);
      }

      // Install dependencies
      await this.installDependencies(this.projectPath, options.packageManager);

      logger.success('Project created successfully');
      this.showProjectInfo(options);
      
    } catch (error) {
      logger.error('Failed to create project', error as Error);
      throw error;
    }
  }

  async startDevServer(config: AOConfig, quietFramework: boolean = false): Promise<ChildProcessWithoutNullStreams> {
    logger.info('Starting development server...');
    
    try {
      const packageManager = config.packageManager || 'pnpm';
      const devCommand = this.getDevCommand(packageManager);
      
      const child = spawn(packageManager, devCommand, {
        cwd: this.projectPath,
        stdio: quietFramework ? 'pipe' : 'inherit',
        shell: true
      }) as ChildProcessWithoutNullStreams;

      return child;
    } catch (error) {
      logger.error('Failed to start development server', error as Error);
      throw error;
    }
  }

  private async createDefaultConfig(options: CreateProjectOptions): Promise<AOConfig> {
    return {
      luaFiles: [],
      packageManager: options.packageManager || 'pnpm',
      framework: options.framework,
      processName: options.processName || options.name,
      ports: {
        dev: options.port || 3000
      },
      aos: {
        version: '2.x',
        features: {
          coroutines: true,
          bootloader: true,
          weavedrive: true
        }
      },
      runWithAO: options.runWithAO || false,
      tags: {}
    };
  }

  private getDevCommand(packageManager: string): string[] {
    const commands = {
      'npm': ['run', 'dev'],
      'yarn': ['dev'],
      'pnpm': ['dev'],
      'bun': ['dev'],
      'deno': ['task', 'dev']
    };
    
    return commands[packageManager as keyof typeof commands] || ['run', 'dev'];
  }

  private showProjectInfo(options: CreateProjectOptions): void {
    logger.info('\n🎉 Project created successfully!');
    logger.info(`📁 Project location: ${this.projectPath}`);
    logger.info(`⚡ Framework: ${options.framework}`);
    logger.info(`📦 Package manager: ${options.packageManager || 'pnpm'}`);
    
    if (options.initializeGit) {
      logger.info('📝 Git repository initialized');
    }
    
    logger.info('\n🚀 Next steps:');
    logger.info('1. cd ' + path.basename(this.projectPath));
    logger.info(`2. ${options.packageManager || 'pnpm'} dev`);
    logger.info('\n📚 Documentation: https://aoforge.vercel.app/');
  }
}
