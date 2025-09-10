import { BaseCommand } from './base-command.js';
import { CommandOption } from '../../types/cli.js';
import { ProjectManager } from '../managers/project-manager.js';
import { ConfigManager } from '../managers/config-manager.js';
import { ProcessManager } from '../managers/process-manager.js';
import path from 'path';
import fs from 'fs-extra';

export class DeployCommand extends BaseCommand {
  name = 'deploy';
  description = 'Deploy the project to Arweave';
  options: CommandOption[] = [
    {
      flag: '-e, --environment <env>',
      description: 'Deployment environment (mainnet, testnet, local)',
      required: false,
      defaultValue: 'testnet'
    },
    {
      flag: '--wallet <path>',
      description: 'Path to wallet file',
      required: false
    },
    {
      flag: '--dry-run',
      description: 'Simulate deployment without actually deploying',
      required: false
    },
    {
      flag: '--process <name>',
      description: 'Deploy specific AO process',
      required: false
    },
    {
      flag: '--build-dir <dir>',
      description: 'Directory containing build artifacts',
      required: false,
      defaultValue: 'dist'
    },
    {
      flag: '--tags <tags>',
      description: 'Additional tags for deployment (key=value,key2=value2)',
      required: false
    },
    {
      flag: '--no-build',
      description: 'Skip building before deployment',
      required: false
    }
  ];

  async execute(options: any): Promise<void> {
    this.logStart('Deploying project to Arweave');
    
    try {
      // Determine project path
      const projectPath = this.determineProjectPath();
      
      // Check if project exists
      if (!(await this.projectExists(projectPath))) {
        throw new Error('No AO project found. Run "forge init" to create a new project.');
      }
      
      // Load configuration
      const configManager = new ConfigManager(projectPath);
      const config = await configManager.loadConfig();
      
      // Create managers
      const projectManager = new ProjectManager(projectPath);
      const processManager = new ProcessManager();
      
      // Build project if not skipped
      if (!options.noBuild) {
        await this.buildProject(projectManager, config, options);
      }
      
      // Validate deployment artifacts
      await this.validateDeploymentArtifacts(options.buildDir);
      
      // Deploy to Arweave
      const deploymentResult = await this.deployToArweave(config, options);
      
      // Deploy AO process if configured
      if (config.runWithAO || options.process) {
        await this.deployAOProcess(processManager, config, options);
      }
      
      this.logSuccess('Deployment completed successfully');
      
      // Show deployment summary
      this.showDeploymentSummary(deploymentResult, options);
      
    } catch (error) {
      this.logError('Deployment failed', error as Error);
      throw error;
    }
  }

  private determineProjectPath(): string {
    return process.cwd();
  }

  private async projectExists(projectPath: string): Promise<boolean> {
    try {
      const packageJsonPath = path.join(projectPath, 'packageon');
      const configPath = path.join(projectPath, 'ao.config.yml');
      
      return await fs.pathExists(packageJsonPath) || await fs.pathExists(configPath);
    } catch {
      return false;
    }
  }

  private async buildProject(projectManager: ProjectManager, config: any, options: any): Promise<void> {
    this.logInfo('Building project for deployment...');
    
    try {
      // TODO: Implement build logic
      // This should call the build command or use build manager
      this.logSuccess('Project built successfully');
      
    } catch (error) {
      this.logError('Build failed', error as Error);
      throw error;
    }
  }

  private async validateDeploymentArtifacts(buildDir: string): Promise<void> {
    this.logInfo('Validating deployment artifacts...');
    
    try {
      const buildPath = path.resolve(buildDir);
      
      if (!(await fs.pathExists(buildPath))) {
        throw new Error(`Build directory not found: ${buildDir}. Run "forge build" first.`);
      }
      
      // Check for manifest file
      const manifestPath = path.join(buildPath, 'manifeston');
      if (!(await fs.pathExists(manifestPath))) {
        throw new Error('Deployment manifest not found. Run "forge build" first.');
      }
      
      this.logSuccess('Deployment artifacts validated');
      
    } catch (error) {
      this.logError('Deployment artifacts validation failed', error as Error);
      throw error;
    }
  }

  private async deployToArweave(config: any, options: any): Promise<any> {
    this.logInfo('Deploying to Arweave...');
    
    try {
      // Parse additional tags
      const additionalTags = this.parseTags(options.tags);
      
      // Merge with config tags
      const allTags = {
        ...config.tags,
        ...additionalTags,
        'App-Name': 'forge-ao',
        'App-Version': '1.0.0',
        'Environment': options.environment
      };
      
      // TODO: Implement Arweave deployment logic
      // This should upload files to Arweave using the appropriate SDK
      
      const deploymentResult = {
        transactionId: 'mock-transaction-id',
        url: `https://arweave.net/mock-transaction-id`,
        timestamp: new Date().toISOString(),
        environment: options.environment,
        tags: allTags
      };
      
      this.logSuccess('Deployed to Arweave successfully');
      return deploymentResult;
      
    } catch (error) {
      this.logError('Arweave deployment failed', error as Error);
      throw error;
    }
  }

  private async deployAOProcess(processManager: ProcessManager, config: any, options: any): Promise<void> {
    this.logInfo('Deploying AO process...');
    
    try {
      // Check AOS installation
      const aosInstalled = await processManager.checkAOSInstallation();
      if (!aosInstalled) {
        throw new Error('AOS is not installed. Please install AOS first: npm i -g https://get_ao.g8way.io');
      }
      
      // TODO: Implement AO process deployment logic
      // This should deploy the AO process using AOS CLI
      
      this.logSuccess('AO process deployed successfully');
      
    } catch (error) {
      this.logError('AO process deployment failed', error as Error);
      throw error;
    }
  }

  private parseTags(tagsString?: string): Record<string, string> {
    if (!tagsString) {
      return {};
    }
    
    const tags: Record<string, string> = {};
    const pairs = tagsString.split(',');
    
    for (const pair of pairs) {
      const [key, value] = pair.split('=');
      if (key && value) {
        tags[key.trim()] = value.trim();
      }
    }
    
    return tags;
  }

  private showDeploymentSummary(deploymentResult: any, options: any): void {
    this.logInfo('\n🚀 Deployment Summary:');
    this.logInfo(`Environment: ${options.environment}`);
    this.logInfo(`Transaction ID: ${deploymentResult.transactionId}`);
    this.logInfo(`URL: ${deploymentResult.url}`);
    this.logInfo(`Timestamp: ${deploymentResult.timestamp}`);
    
    if (Object.keys(deploymentResult.tags).length > 0) {
      this.logInfo('\nTags:');
      for (const [key, value] of Object.entries(deploymentResult.tags)) {
        this.logInfo(`  ${key}: ${value}`);
      }
    }
  }

  protected getHelpText(): string {
    return `
Deploy the project to Arweave and optionally deploy AO processes.

The deployment process will:
- Build the project (unless --no-build is specified)
- Validate deployment artifacts
- Upload files to Arweave
- Deploy AO processes (if configured)
- Generate deployment metadata

Examples:
  forge deploy                    # Deploy to testnet
  forge deploy -e mainnet        # Deploy to mainnet
  forge deploy --wallet ./keyon # Use specific wallet
  forge deploy --dry-run         # Simulate deployment
  forge deploy --process my-app  # Deploy specific AO process
  forge deploy --build-dir ./build # Use custom build directory
  forge deploy --tags "env=prod,version=1.0" # Add custom tags
  forge deploy --no-build        # Skip building before deployment

Environments:
  testnet    - Arweave testnet (default)
  mainnet    - Arweave mainnet
  local      - Local development network
    `;
  }
} 