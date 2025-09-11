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
  nextjs: 'https://github.com/vercel/next.js/tree/canary/examples/hello-world',
  nuxtjs: 'https://github.com/nuxt/starter/tree/templates/v3',
  svelte: 'https://github.com/sveltejs/template'
};

// Supported package managers
const SUPPORTED_PACKAGE_MANAGERS = ['npm', 'yarn', 'pnpm', 'bun', 'deno'] as const;
type PackageManager = typeof SUPPORTED_PACKAGE_MANAGERS[number];

// Template configuration interface
interface TemplateConfig {
  createCommand: string;
  createArgs: string[];
}

// Next.js template configuration
const getNextJsArgs = (packageManager: PackageManager): string[] => {
  const baseArgs = [
    'create-next-app@latest',
    '.',
    '--disable-git',
    '--typescript',
    '--tailwind',
    '--eslint',
    '--app',
    '--src-dir',
    '--import-alias',
    '@/*',
    '--skip-install',
    '--yes'
  ];

  const packageManagerFlag = `--use-${packageManager}`;
  const args = [...baseArgs, packageManagerFlag];
  
  return args;
};

// Fallback template creation for when cloning fails
const FALLBACK_TEMPLATES = (packageManager: PackageManager): Record<string, TemplateConfig> => {
  return {
  nextjs: {
    createCommand: 'npx',
      createArgs: getNextJsArgs(packageManager)
  },
  nuxtjs: {
    createCommand: 'npx',
      createArgs: ['nuxi@latest', 'init', '.', '-f', '--yes', '--package-manager', packageManager, '--gitInit', 'no']
  },
  svelte: {
    createCommand: 'npx',
      createArgs: ['sv', 'create', '.', '--template', 'minimal', '--no-add-ons', '--install', packageManager, '--types', 'ts']
  }
  };
};

export class ProjectManager {
  private projectPath: string;
  private configManager: ConfigManager;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.configManager = new ConfigManager(projectPath);
  }

  async cloneTemplate(template: string, targetPath: string, packageManager: string = 'pnpm'): Promise<void> {
    logger.info(`Creating ${template} project...`);
    
    try {
      // Validate package manager
      if (!SUPPORTED_PACKAGE_MANAGERS.includes(packageManager as PackageManager)) {
        throw new Error(`Unsupported package manager: ${packageManager}`);
      }

      const templates = FALLBACK_TEMPLATES(packageManager as PackageManager);
      const fallbackTemplate = templates[template as keyof typeof templates];
      
      if (!fallbackTemplate) {
        throw new Error(`Unsupported template: ${template}`);
      }

      await this.executeCommand(fallbackTemplate.createCommand, fallbackTemplate.createArgs, {
        cwd: targetPath
      });

      logger.success(`${template} project created successfully`);
    } catch (error) {
      logger.error('Failed to create template', error as Error);
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
      await this.executeCommand('git', ['commit', '-m', 'Initial commit - Project created with Forge'], { cwd: targetPath });
      
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
      const stats = await fs.stat(directoryPath);
      const isEmpty = (await fs.readdir(directoryPath)).length === 0;
      return stats.isDirectory() && isEmpty;
    } catch (error) {
      return false;
    }
  }

  private async ensureProjectDirectory(): Promise<void> {
    try {
      // Check if directory exists
      const exists = await fs.pathExists(this.projectPath);
      
      if (exists) {
        // Directory exists, check if it's empty
        const isEmpty = (await fs.readdir(this.projectPath)).length === 0;
        if (!isEmpty) {
          throw new Error(`Directory ${this.projectPath} is not empty. Please choose a different location or clear the directory.`);
        }
      } else {
        // Directory doesn't exist, create it
        await fs.ensureDir(this.projectPath);
        logger.info(`Created project directory: ${this.projectPath}`);
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

      // Clone framework template
      await this.cloneTemplate(options.framework, this.projectPath, options.packageManager);

      // Update package.json with project name
      await this.updatePackageJson(options.name);

      // Create AO-specific configuration
      const config = await this.createDefaultConfig(options);
      await this.configManager.saveConfig(config);

      // Add AO-specific files and structure
      await this.addAOStructure();
      
      // Create framework-specific TaskMaster files
      await this.createFrameworkFiles(options.framework);
      
      // Create TaskMaster README
      await this.createTaskMasterREADME();

      // Update config with created Lua files
      await this.updateConfigWithLuaFiles(config);

      // Initialize git if requested
      if (options.initializeGit) {
        await this.initializeGit(this.projectPath);
      }

      // Install dependencies
      await this.installDependencies(this.projectPath, options.packageManager);

      // Install Tailwind CSS for frameworks that need it
      if (options.framework !== 'nextjs') {
        await this.ensureTailwindCSS(options.packageManager, options.framework);
      }

      logger.success('Project created successfully');
      this.showProjectInfo(options);
      
    } catch (error) {
      logger.error('Failed to create project', error as Error);
      throw error;
    }
  }

  private async updatePackageJson(projectName: string): Promise<void> {
    try {
      const packageJsonPath = path.join(this.projectPath, 'package.json');
      
      if (await fs.pathExists(packageJsonPath)) {
        const packageJson = await fs.readJSON(packageJsonPath);
        
        // Update project name
        packageJson.name = projectName;
        
        // Add Forge-specific scripts if they don't exist
        if (!packageJson.scripts) {
          packageJson.scripts = {};
        }
        
        // Preserve existing scripts and add Forge-specific ones
        packageJson.scripts = {
          ...packageJson.scripts,
          'ao-forge:dev': 'ao-forge dev',
          'ao-forge:build': 'ao-forge build',
          'ao-forge:deploy': 'ao-forge deploy',
          'ao-forge:test': 'ao-forge test'
        };

        // Add AO-related keywords
        if (!packageJson.keywords) {
          packageJson.keywords = [];
        }
        packageJson.keywords.push('ao', 'arweave', 'ao-forge');

        // Add AO-related dependencies
        if (!packageJson.dependencies) {
          packageJson.dependencies = {};
        }
        packageJson.dependencies['@permaweb/aoconnect'] = '^0.0.85';

        await fs.writeJSON(packageJsonPath, packageJson, { spaces: 2 });
      }
    } catch (error) {
      logger.error('Failed to update package.json', error as Error);
      throw error;
    }
  }

  private async addAOStructure(): Promise<void> {
    try {
      // Create AO-specific directories
      const aoDirs = [
        'src/ao',
        'src/contracts',
        'src/utils',
        'tests',
        'docs'
      ];

      for (const dir of aoDirs) {
        await fs.ensureDir(path.join(this.projectPath, dir));
      }

      // Create AO-specific files
      await this.createAOFiles();

    } catch (error) {
      logger.error('Failed to add AO structure', error as Error);
      throw error;
    }
  }

  private async createAOFiles(): Promise<void> {
    try {
      // Create TaskMaster AO process file
      const taskProcessContent = `-- TaskMaster AO Process
-- A decentralized task management system with gamification

local json = require("json")

-- Initialize state
local Tasks = {}
local Points = {}
local Users = {}

-- Helper function to get user points
local function getUserPoints(userId)
  return Points[userId] or 0
end

-- Helper function to award points
local function awardPoints(userId, amount)
  Points[userId] = getUserPoints(userId) + amount
  return Points[userId]
end

-- Create Task Handler
Handlers.add("CreateTask", function(msg)
  local taskId = msg.Id
  local taskData = json.decode(msg.Data)
  
  local task = {
    id = taskId,
    title = taskData.title or "Untitled Task",
    description = taskData.description or "",
    completed = false,
    created = os.time(),
    owner = msg.From,
    priority = taskData.priority or "medium"
  }
  
  Tasks[taskId] = task
  
  -- Award points for creating task
  local newPoints = awardPoints(msg.From, 10)
  
  ao.send({
    Target = msg.From,
    Tags = { 
      Action = "TaskCreated", 
      TaskId = taskId,
      Points = tostring(newPoints)
    },
    Data = json.encode({
      success = true,
      message = "Task created successfully! +10 points",
      task = task,
      points = newPoints
    })
  })
end)

-- Complete Task Handler
Handlers.add("CompleteTask", function(msg)
  local taskId = msg.Tags.TaskId
  local task = Tasks[taskId]
  
  if not task then
    ao.send({
      Target = msg.From,
      Tags = { Action = "Error" },
      Data = json.encode({
        success = false,
        message = "Task not found"
      })
    })
    return
  end
  
  if task.owner ~= msg.From then
    ao.send({
      Target = msg.From,
      Tags = { Action = "Error" },
      Data = json.encode({
        success = false,
        message = "You can only complete your own tasks"
      })
    })
    return
  end
  
  if task.completed then
    ao.send({
      Target = msg.From,
      Tags = { Action = "Error" },
      Data = json.encode({
        success = false,
        message = "Task already completed"
      })
    })
    return
  end
  
  -- Mark task as completed
  task.completed = true
  task.completedAt = os.time()
  
  -- Award completion points
  local newPoints = awardPoints(msg.From, 25)
  
  ao.send({
    Target = msg.From,
    Tags = { 
      Action = "TaskCompleted", 
      TaskId = taskId,
      Points = tostring(newPoints)
    },
    Data = json.encode({
      success = true,
      message = "Task completed! +25 points",
      task = task,
      points = newPoints
    })
  })
end)

-- Get User Tasks Handler
Handlers.add("GetTasks", function(msg)
  local userTasks = {}
  for id, task in pairs(Tasks) do
    if task.owner == msg.From then
      table.insert(userTasks, task)
    end
  end
  
  -- Sort by creation time (newest first)
  table.sort(userTasks, function(a, b) return a.created > b.created end)
  
  ao.send({
    Target = msg.From,
    Tags = { Action = "TasksList" },
    Data = json.encode({
      success = true,
      tasks = userTasks,
      count = #userTasks
    })
  })
end)

-- Get User Points Handler
Handlers.add("GetPoints", function(msg)
  local userPoints = getUserPoints(msg.From)
  
  ao.send({
    Target = msg.From,
    Tags = { Action = "PointsBalance" },
    Data = json.encode({
      success = true,
      points = userPoints,
      userId = msg.From
    })
  })
end)

-- Get Leaderboard Handler
Handlers.add("GetLeaderboard", function(msg)
  local leaderboard = {}
  
  for userId, points in pairs(Points) do
    table.insert(leaderboard, {
      userId = userId,
      points = points
    })
  end
  
  -- Sort by points (highest first)
  table.sort(leaderboard, function(a, b) return a.points > b.points end)
  
  -- Limit to top 10
  local top10 = {}
  for i = 1, math.min(10, #leaderboard) do
    table.insert(top10, leaderboard[i])
  end
  
  ao.send({
    Target = msg.From,
    Tags = { Action = "Leaderboard" },
    Data = json.encode({
      success = true,
      leaderboard = top10
    })
  })
end)

-- Delete Task Handler
Handlers.add("DeleteTask", function(msg)
  local taskId = msg.Tags.TaskId
  local task = Tasks[taskId]
  
  if not task then
    ao.send({
      Target = msg.From,
      Tags = { Action = "Error" },
      Data = json.encode({
        success = false,
        message = "Task not found"
      })
    })
    return
  end
  
  if task.owner ~= msg.From then
    ao.send({
      Target = msg.From,
      Tags = { Action = "Error" },
      Data = json.encode({
        success = false,
        message = "You can only delete your own tasks"
      })
    })
    return
  end
  
  -- Remove task
  Tasks[taskId] = nil
  
  ao.send({
    Target = msg.From,
    Tags = { Action = "TaskDeleted", TaskId = taskId },
    Data = json.encode({
      success = true,
      message = "Task deleted successfully"
    })
  })
end)

-- Initialize process
print("TaskMaster AO Process initialized!")
print("Available actions: CreateTask, CompleteTask, GetTasks, GetPoints, GetLeaderboard, DeleteTask")
`;

      await fs.writeFile(path.join(this.projectPath, 'src/ao/task-process.lua'), taskProcessContent);

      // Create AO utilities file
      const aoUtilsContent = `-- AO Utilities for TaskMaster
-- Shared utility functions for AO processes

local json = require("json")

-- Utility function to validate message structure
local function validateMessage(msg, requiredFields)
  for _, field in ipairs(requiredFields) do
    if not msg[field] then
      return false, "Missing required field: " .. field
    end
  end
  return true
end

-- Utility function to create error response
local function createErrorResponse(message, code)
  return {
    success = false,
    error = message,
    code = code or "GENERAL_ERROR"
  }
end

-- Utility function to create success response
local function createSuccessResponse(data, message)
  return {
    success = true,
    data = data,
    message = message or "Operation completed successfully"
  }
end

-- Export utilities
return {
  validateMessage = validateMessage,
  createErrorResponse = createErrorResponse,
  createSuccessResponse = createSuccessResponse
}
`;

      await fs.writeFile(path.join(this.projectPath, 'src/ao/utils.lua'), aoUtilsContent);

      // Create AO README
      const aoReadmeContent = `# TaskMaster AO Process

This directory contains the AO (Arweave Operating System) processes for TaskMaster.

## Files

- \`task-process.lua\` - Main TaskMaster AO process with task management and gamification
- \`utils.lua\` - Shared utility functions for AO processes
- \`contracts/\` - Additional contract files
- \`tests/\` - Test files for AO processes

## TaskMaster Features

### Task Management
- **Create Tasks** - Add new tasks with title, description, and priority
- **Complete Tasks** - Mark tasks as completed and earn points
- **Delete Tasks** - Remove tasks you no longer need
- **List Tasks** - View all your tasks with status

### Gamification
- **Points System** - Earn points for creating (+10) and completing (+25) tasks
- **Leaderboard** - See top users by points
- **User Stats** - Track your progress and achievements

### AO Actions

| Action | Description | Required Tags | Data Format |
|--------|-------------|---------------|-------------|
| CreateTask | Create a new task | None | \`{"title": "Task Title", "description": "Description", "priority": "high/medium/low"}\` |
| CompleteTask | Mark task as completed | TaskId | Any string |
| GetTasks | Get user's tasks | None | Any string |
| GetPoints | Get user's points | None | Any string |
| GetLeaderboard | Get top 10 users | None | Any string |
| DeleteTask | Delete a task | TaskId | Any string |

## Development

1. Edit your AO process files in \`src/ao/\`
2. Use \`ao-forge dev\` to start development with AO integration
3. Use \`ao-forge build\` to build your processes
4. Use \`ao-forge deploy\` to deploy to Arweave

## Testing the Process

\`\`\`bash
# Start aos CLI
aos taskmaster

# Load the process
.load src/ao/task-process.lua

# Spawn the process
.spawn

# Test creating a task
Send({Target = ao.id, Action = "CreateTask", Data = '{"title": "Test Task", "description": "A test task", "priority": "high"}'})

# Test getting tasks
Send({Target = ao.id, Action = "GetTasks", Data = "get"})

# Test getting points
Send({Target = ao.id, Action = "GetPoints", Data = "get"})
\`\`\`

## Resources

- [AO Documentation](https://cookbook_ao.arweave.net/welcome/ao-core-introduction.html)
- [AOS Reference](https://cookbook_ao.arweave.net/guides/aos/)
- [aoconnect Guide](https://cookbook_ao.arweave.net/guides/aoconnect/aoconnect.html)
`;

      await fs.writeFile(path.join(this.projectPath, 'src/ao/README.md'), aoReadmeContent);

    } catch (error) {
      logger.error('Failed to create AO files', error as Error);
      throw error;
    }
  }

  private async createFrameworkFiles(framework: string): Promise<void> {
    try {
      switch (framework) {
        case 'nextjs':
          await this.createNextJSFiles();
          break;
        case 'nuxtjs':
          await this.createNuxtJSFiles();
          break;
        case 'svelte':
          await this.createSvelteFiles();
          break;
        default:
          logger.warn(`No specific files created for framework: ${framework}`);
      }
    } catch (error) {
      logger.error('Failed to create framework files', error as Error);
      throw error;
    }
  }

  private async createNextJSFiles(): Promise<void> {
    // Ensure directories exist (Next.js App Router structure)
    await fs.ensureDir(path.join(this.projectPath, 'app'));
    await fs.ensureDir(path.join(this.projectPath, 'components'));
    await fs.ensureDir(path.join(this.projectPath, 'lib'));
    await fs.ensureDir(path.join(this.projectPath, 'public'));
    
    // Create lib/aoconnect.ts
    const aoConnectContent = `import { message, createDataItemSigner, connect } from '@permaweb/aoconnect';

export interface Task {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  created: number;
  owner: string;
  priority: 'high' | 'medium' | 'low';
  completedAt?: number;
}

export interface AOResponse {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
}

export class AOClient {
  private signer: any;
  private processId: string;

  constructor(wallet: any, processId: string) {
    this.signer = createDataItemSigner(wallet);
    this.processId = processId;
  }

  async createTask(taskData: { title: string; description?: string; priority?: string }): Promise<AOResponse> {
    try {
      const result = await message({
        process: this.processId,
        tags: [{ name: 'Action', value: 'CreateTask' }],
        data: JSON.stringify(taskData),
        signer: this.signer
      });
      
      return JSON.parse(result.data);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async completeTask(taskId: string): Promise<AOResponse> {
    try {
      const result = await message({
        process: this.processId,
        tags: [
          { name: 'Action', value: 'CompleteTask' },
          { name: 'TaskId', value: taskId }
        ],
        data: 'complete',
        signer: this.signer
      });
      
      return JSON.parse(result.data);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getTasks(): Promise<AOResponse> {
    try {
      const result = await message({
        process: this.processId,
        tags: [{ name: 'Action', value: 'GetTasks' }],
        data: 'get',
        signer: this.signer
      });
      
      return JSON.parse(result.data);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getPoints(): Promise<AOResponse> {
    try {
      const result = await message({
        process: this.processId,
        tags: [{ name: 'Action', value: 'GetPoints' }],
        data: 'get',
        signer: this.signer
      });
      
      return JSON.parse(result.data);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getLeaderboard(): Promise<AOResponse> {
    try {
      const result = await message({
        process: this.processId,
        tags: [{ name: 'Action', value: 'GetLeaderboard' }],
        data: 'get',
        signer: this.signer
      });
      
      return JSON.parse(result.data);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async deleteTask(taskId: string): Promise<AOResponse> {
    try {
      const result = await message({
        process: this.processId,
        tags: [
          { name: 'Action', value: 'DeleteTask' },
          { name: 'TaskId', value: taskId }
        ],
        data: 'delete',
        signer: this.signer
      });
      
      return JSON.parse(result.data);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}`;

    await fs.writeFile(path.join(this.projectPath, 'lib/aoconnect.ts'), aoConnectContent);

    // Create components/WalletConnect.tsx
    const walletConnectContent = `'use client';
import { useState, useEffect } from 'react';

declare global {
  interface Window {
    arweaveWallet?: any;
  }
}

export default function WalletConnect({ onConnect }: { onConnect: (wallet: any) => void }) {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const connectWallet = async () => {
    if (typeof window !== 'undefined' && window.arweaveWallet) {
      setConnecting(true);
      try {
        await window.arweaveWallet.connect(['ACCESS_ADDRESS', 'SIGN_TRANSACTION']);
        setConnected(true);
        onConnect(window.arweaveWallet);
      } catch (error) {
        console.error('Failed to connect wallet:', error);
      } finally {
        setConnecting(false);
      }
    } else {
      alert('Please install ArConnect or another Arweave wallet extension');
    }
  };

  return (
    <div className="wallet-connect">
      {!connected ? (
        <button 
          onClick={connectWallet}
          disabled={connecting}
          className="group relative inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-white bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl blur opacity-75 group-hover:opacity-100 transition-opacity duration-200"></div>
          <span className="relative flex items-center gap-3">
            {connecting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Connecting...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
                Connect Arweave Wallet
              </>
            )}
          </span>
        </button>
      ) : (
        <div className="flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-green-700 font-semibold text-lg">Wallet Connected!</span>
          <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
    </div>
  );
}`;

    await fs.writeFile(path.join(this.projectPath, 'components/WalletConnect.tsx'), walletConnectContent);

    // Create components/TaskList.tsx
    const taskListContent = `'use client';
import { useState, useEffect } from 'react';
import { AOClient, Task } from '../lib/aoconnect';

interface TaskListProps {
  aoClient: AOClient | null;
}

export default function TaskList({ aoClient }: TaskListProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);

  const loadTasks = async () => {
    if (!aoClient) return;
    
    setLoading(true);
    try {
      const result = await aoClient.getTasks();
      if (result.success && result.data?.tasks) {
        setTasks(result.data.tasks);
      }
    } catch (error) {
      console.error('Failed to load tasks:', error);
    }
    setLoading(false);
  };

  const completeTask = async (taskId: string) => {
    if (!aoClient) return;
    
    try {
      const result = await aoClient.completeTask(taskId);
      if (result.success) {
        await loadTasks(); // Refresh list
      }
    } catch (error) {
      console.error('Failed to complete task:', error);
    }
  };

  const deleteTask = async (taskId: string) => {
    if (!aoClient) return;
    
    try {
      const result = await aoClient.deleteTask(taskId);
      if (result.success) {
        await loadTasks(); // Refresh list
      }
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

  useEffect(() => {
    if (aoClient) {
      loadTasks();
    }
  }, [aoClient]);

  const getPriorityConfig = (priority: string) => {
    switch (priority) {
      case 'high': 
        return { 
          color: 'text-red-600', 
          bg: 'bg-red-50', 
          border: 'border-red-200',
          icon: '🔴',
          gradient: 'from-red-500 to-pink-500'
        };
      case 'medium': 
        return { 
          color: 'text-yellow-600', 
          bg: 'bg-yellow-50', 
          border: 'border-yellow-200',
          icon: '🟡',
          gradient: 'from-yellow-500 to-orange-500'
        };
      case 'low': 
        return { 
          color: 'text-green-600', 
          bg: 'bg-green-50', 
          border: 'border-green-200',
          icon: '🟢',
          gradient: 'from-green-500 to-emerald-500'
        };
      default: 
        return { 
          color: 'text-gray-600', 
          bg: 'bg-gray-50', 
          border: 'border-gray-200',
          icon: '⚪',
          gradient: 'from-gray-500 to-slate-500'
        };
    }
  };

  return (
    <div className="task-list">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
          Your Tasks
        </h2>
        <button
          onClick={loadTasks}
          disabled={loading}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <svg className={\`w-5 h-5 \${loading ? 'animate-spin' : ''}\`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>
      
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
          <p className="text-gray-500 text-lg">Loading your tasks...</p>
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center">
            <svg className="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No tasks yet</h3>
          <p className="text-gray-500 mb-6">Create your first task to get started!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {tasks.map((task, index) => {
            const priorityConfig = getPriorityConfig(task.priority);
            return (
            <div 
              key={task.id} 
                className={\`group relative p-6 rounded-2xl shadow-sm border transition-all duration-300 hover:shadow-lg hover:scale-[1.02] \${task.completed ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200' : 'bg-white border-gray-200 hover:border-gray-300'}\`}
                style={{ animationDelay: \`\${index * 100}ms\` }}
              >
                <div className="flex items-start gap-4">
                  {/* Priority Indicator */}
                  <div className={\`flex-shrink-0 w-3 h-3 rounded-full mt-2 bg-gradient-to-r \${priorityConfig.gradient}\`}></div>
                  
                  {/* Task Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-3">
                      <span className={\`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium \${priorityConfig.bg} \${priorityConfig.color} \${priorityConfig.border} border\`}>
                        <span>{priorityConfig.icon}</span>
                      {task.priority.toUpperCase()}
                    </span>
                    {task.completed && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          Completed
                        </span>
                    )}
                  </div>
                    
                    <h3 className={\`text-lg font-semibold mb-2 \${task.completed ? 'line-through text-gray-500' : 'text-gray-900'}\`}>
                    {task.title}
                  </h3>
                    
                  {task.description && (
                      <p className={\`text-sm mb-3 \${task.completed ? 'text-gray-400' : 'text-gray-600'}\`}>
                      {task.description}
                    </p>
                  )}
                    
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {new Date(task.created * 1000).toLocaleDateString()}
                      </span>
                      {task.completedAt && (
                        <span className="flex items-center gap-1 text-green-600">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Completed {new Date(task.completedAt * 1000).toLocaleDateString()}
                        </span>
                      )}
                </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  {!task.completed && (
                    <button
                      onClick={() => completeTask(task.id)}
                        className="p-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:shadow-lg transform hover:scale-105 transition-all duration-200"
                        title="Complete task"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </button>
                  )}
                  <button
                    onClick={() => deleteTask(task.id)}
                      className="p-2 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-lg hover:shadow-lg transform hover:scale-105 transition-all duration-200"
                      title="Delete task"
                  >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                  </button>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}`;

    await fs.writeFile(path.join(this.projectPath, 'components/TaskList.tsx'), taskListContent);

    // Create components/CreateTask.tsx
    const createTaskContent = `'use client';
import { useState } from 'react';
import { AOClient } from '../lib/aoconnect';

interface CreateTaskProps {
  aoClient: AOClient | null;
  onTaskCreated: () => void;
}

export default function CreateTask({ aoClient, onTaskCreated }: CreateTaskProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aoClient || !title.trim()) return;

    setLoading(true);
    try {
      const result = await aoClient.createTask({
        title: title.trim(),
        description: description.trim(),
        priority
      });
      
      if (result.success) {
        setTitle('');
        setDescription('');
        setPriority('medium');
        onTaskCreated();
      } else {
        alert('Failed to create task: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Failed to create task:', error);
      alert('Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  const getPriorityConfig = (priority: string) => {
    switch (priority) {
      case 'high': 
        return { 
          color: 'text-red-600', 
          bg: 'bg-red-50', 
          border: 'border-red-200',
          icon: '🔴',
          gradient: 'from-red-500 to-pink-500'
        };
      case 'medium': 
        return { 
          color: 'text-yellow-600', 
          bg: 'bg-yellow-50', 
          border: 'border-yellow-200',
          icon: '🟡',
          gradient: 'from-yellow-500 to-orange-500'
        };
      case 'low': 
        return { 
          color: 'text-green-600', 
          bg: 'bg-green-50', 
          border: 'border-green-200',
          icon: '🟢',
          gradient: 'from-green-500 to-emerald-500'
        };
      default: 
        return { 
          color: 'text-gray-600', 
          bg: 'bg-gray-50', 
          border: 'border-gray-200',
          icon: '⚪',
          gradient: 'from-gray-500 to-slate-500'
        };
    }
  };

  return (
    <div className="create-task bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
          Create New Task
        </h2>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <label htmlFor="title" className="block text-sm font-semibold text-gray-700">
            Task Title *
          </label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
            placeholder="What needs to be done?"
            required
          />
        </div>
        
        <div className="space-y-2">
          <label htmlFor="description" className="block text-sm font-semibold text-gray-700">
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white resize-none"
            placeholder="Add more details about this task..."
            rows={4}
          />
        </div>
        
        <div className="space-y-2">
          <label htmlFor="priority" className="block text-sm font-semibold text-gray-700">
            Priority Level
          </label>
          <div className="grid grid-cols-3 gap-3">
            {(['low', 'medium', 'high'] as const).map((p) => {
              const config = getPriorityConfig(p);
              const isSelected = priority === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={\`p-3 rounded-xl border-2 transition-all duration-200 \${isSelected ? \`\${config.bg} \${config.border} border-2\` : 'border-gray-200 bg-white hover:bg-gray-50'}\`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-lg">{config.icon}</span>
                    <span className={\`text-sm font-medium \${isSelected ? config.color : 'text-gray-600'}\`}>
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        
        <button
          type="submit"
          disabled={loading || !title.trim()}
          className="group relative w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl blur opacity-75 group-hover:opacity-100 transition-opacity duration-200"></div>
          <span className="relative flex items-center justify-center gap-3">
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Creating Task...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Create Task
              </>
            )}
          </span>
        </button>
      </form>
    </div>
  );
}`;

    await fs.writeFile(path.join(this.projectPath, 'components/CreateTask.tsx'), createTaskContent);

    // Create components/PointsDisplay.tsx
    const pointsDisplayContent = `'use client';
import { useState, useEffect } from 'react';
import { AOClient } from '../lib/aoconnect';

interface PointsDisplayProps {
  aoClient: AOClient | null;
}

export default function PointsDisplay({ aoClient }: PointsDisplayProps) {
  const [points, setPoints] = useState(0);
  const [loading, setLoading] = useState(false);

  const loadPoints = async () => {
    if (!aoClient) return;
    
    setLoading(true);
    try {
      const result = await aoClient.getPoints();
      if (result.success && result.data?.points !== undefined) {
        setPoints(result.data.points);
      }
    } catch (error) {
      console.error('Failed to load points:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (aoClient) {
      loadPoints();
    }
  }, [aoClient]);

  return (
    <div className="points-display relative overflow-hidden bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-700 text-white p-8 rounded-2xl shadow-xl">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
      <div className="absolute -top-4 -right-4 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
      <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>
      
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold">Your Points</h3>
        </div>
        
      {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="text-center">
            <div className="text-5xl font-bold mb-2 bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent">
              {points.toLocaleString()}
            </div>
            <p className="text-white/80 text-sm mb-4">
              Total points earned
            </p>
          </div>
        )}
        
        <div className="mt-6 space-y-2 text-sm text-white/90">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              Create task
            </span>
            <span className="font-semibold">+10 pts</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
              Complete task
            </span>
            <span className="font-semibold">+25 pts</span>
          </div>
        </div>
      </div>
    </div>
  );
}`;

    await fs.writeFile(path.join(this.projectPath, 'components/PointsDisplay.tsx'), pointsDisplayContent);

    // Create app/page.tsx (Next.js App Router)
    const mainPageContent = `'use client';
import { useState, useEffect } from 'react';
import { AOClient } from '../lib/aoconnect';
import WalletConnect from '../components/WalletConnect';
import TaskList from '../components/TaskList';
import CreateTask from '../components/CreateTask';
import PointsDisplay from '../components/PointsDisplay';

export default function Home() {
  const [wallet, setWallet] = useState<any>(null);
  const [aoClient, setAOClient] = useState<AOClient | null>(null);
  const [processId, setProcessId] = useState<string>('');

  useEffect(() => {
    if (wallet && processId) {
      setAOClient(new AOClient(wallet, processId));
    }
  }, [wallet, processId]);

  const handleWalletConnect = (connectedWallet: any) => {
    setWallet(connectedWallet);
  };

  const handleTaskCreated = () => {
    // This will trigger a refresh of the task list
    // The TaskList component will handle the refresh
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Background decoration */}
      <div className="fixed inset-0 bg-gradient-to-br from-blue-400/5 via-purple-400/5 to-pink-400/5"></div>
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-blue-300/10 rounded-full blur-3xl"></div>
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-purple-300/10 rounded-full blur-3xl"></div>
      
      <div className="relative z-10">
      <div className="container mx-auto px-4 py-8">
          <header className="text-center mb-12">
            <div className="inline-flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-3xl">🎯</span>
              </div>
              <div>
                <h1 className="text-5xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-purple-800 bg-clip-text text-transparent">
                  TaskMaster
          </h1>
                <p className="text-xl text-gray-600 mt-2">
            Decentralized task management powered by AO and Arweave
          </p>
              </div>
            </div>
        </header>

          <div className="max-w-6xl mx-auto">
          {/* Wallet Connection */}
            <div className="bg-white/80 backdrop-blur-sm p-8 rounded-3xl shadow-xl border border-white/20 mb-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Connect Your Wallet</h2>
              </div>
            <WalletConnect onConnect={handleWalletConnect} />
          </div>

          {/* Process ID Input */}
          {wallet && (
              <div className="bg-white/80 backdrop-blur-sm p-8 rounded-3xl shadow-xl border border-white/20 mb-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">AO Process Configuration</h2>
                </div>
              <div className="space-y-4">
                <div>
                    <label htmlFor="processId" className="block text-sm font-semibold text-gray-700 mb-2">
                    Process ID
                  </label>
                  <input
                    type="text"
                    id="processId"
                    value={processId}
                    onChange={(e) => setProcessId(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                    placeholder="Enter your AO process ID"
                  />
                    <p className="text-sm text-gray-500 mt-2">
                    Deploy the TaskMaster process and enter the process ID here
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Main Content */}
          {aoClient && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column - Create Task & Points */}
                <div className="lg:col-span-1 space-y-8">
                <PointsDisplay aoClient={aoClient} />
                <CreateTask aoClient={aoClient} onTaskCreated={handleTaskCreated} />
              </div>
              
              {/* Right Column - Task List */}
              <div className="lg:col-span-2">
                  <div className="bg-white/80 backdrop-blur-sm p-8 rounded-3xl shadow-xl border border-white/20">
                <TaskList aoClient={aoClient} />
                  </div>
              </div>
            </div>
          )}

          {/* Instructions */}
          {!aoClient && wallet && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-3xl p-8 shadow-lg">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-blue-900">
                Getting Started
              </h3>
                </div>
                <ol className="list-decimal list-inside space-y-3 text-blue-800 text-lg">
                <li>Deploy the TaskMaster AO process using the aos CLI</li>
                <li>Enter the process ID in the field above</li>
                <li>Start creating and managing your tasks!</li>
              </ol>
                <div className="mt-6 p-6 bg-blue-100 rounded-2xl border border-blue-200">
                  <p className="text-blue-800">
                    <strong>Quick Deploy:</strong> Run <code className="bg-blue-200 px-2 py-1 rounded-lg font-mono text-sm">aos taskmaster</code> then <code className="bg-blue-200 px-2 py-1 rounded-lg font-mono text-sm">.load src/ao/task-process.lua</code> and <code className="bg-blue-200 px-2 py-1 rounded-lg font-mono text-sm">.spawn</code>
                </p>
              </div>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}`;

    await fs.writeFile(path.join(this.projectPath, 'app/page.tsx'), mainPageContent);

    // Create app/layout.tsx (Next.js App Router root layout)
    const layoutContent = `import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TaskMaster - AO Task Management',
  description: 'Decentralized task management powered by AO and Arweave',
  keywords: ['AO', 'Arweave', 'Task Management', 'Decentralized', 'Web3'],
  authors: [{ name: 'TaskMaster Team' }],
  viewport: 'width=device-width, initial-scale=1',
  themeColor: '#3B82F6',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 font-inter antialiased">
        {children}
      </body>
    </html>
  );
}`;

    await fs.writeFile(path.join(this.projectPath, 'app/layout.tsx'), layoutContent);

    // Create app/globals.css (Next.js App Router global styles)
    const globalsCss = `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --foreground-rgb: 15, 23, 42;
  --background-start-rgb: 248, 250, 252;
  --background-end-rgb: 241, 245, 249;
  --primary-rgb: 59, 130, 246;
  --secondary-rgb: 147, 51, 234;
}

@media (prefers-color-scheme: dark) {
  :root {
    --foreground-rgb: 248, 250, 252;
    --background-start-rgb: 15, 23, 42;
    --background-end-rgb: 30, 41, 59;
  }
}

* {
  box-sizing: border-box;
  padding: 0;
  margin: 0;
}

html {
  scroll-behavior: smooth;
}

body {
  color: rgb(var(--foreground-rgb));
  background: linear-gradient(
      135deg,
      rgb(var(--background-start-rgb)) 0%,
      rgb(var(--background-end-rgb)) 100%
    );
  font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.font-inter {
  font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: rgb(241, 245, 249);
}

::-webkit-scrollbar-thumb {
  background: rgb(148, 163, 184);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgb(100, 116, 139);
}

/* Custom animations */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeInScale {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.animate-fade-in-up {
  animation: fadeInUp 0.6s ease-out;
}

.animate-fade-in-scale {
  animation: fadeInScale 0.4s ease-out;
}

/* Glass morphism effect */
.glass {
  background: rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.18);
}

/* Gradient text */
.gradient-text {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Custom focus styles */
.focus-ring {
  @apply focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2;
}

/* Button hover effects */
.btn-hover {
  @apply transition-all duration-200 hover:scale-105 hover:shadow-lg;
}

/* Card hover effects */
.card-hover {
  @apply transition-all duration-300 hover:shadow-xl hover:scale-[1.02];
}`;

    await fs.writeFile(path.join(this.projectPath, 'app/globals.css'), globalsCss);
  }

  private async createNuxtJSFiles(): Promise<void> {
    // Ensure directories exist following Nuxt 4 structure
    await fs.ensureDir(path.join(this.projectPath, 'app/lib'));
    await fs.ensureDir(path.join(this.projectPath, 'app/components'));
    await fs.ensureDir(path.join(this.projectPath, 'app/pages'));
    await fs.ensureDir(path.join(this.projectPath, 'app/composables'));
    await fs.ensureDir(path.join(this.projectPath, 'app/utils'));
    
    // Create app/lib/aoconnect.ts (Nuxt 4 structure)
    const aoConnectContent = `import { message, createDataItemSigner, connect } from '@permaweb/aoconnect';

export interface Task {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  created: number;
  owner: string;
  priority: 'high' | 'medium' | 'low';
  completedAt?: number;
}

export interface AOResponse {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
}

export class AOClient {
  private signer: any;
  private processId: string;

  constructor(wallet: any, processId: string) {
    this.signer = createDataItemSigner(wallet);
    this.processId = processId;
  }

  async createTask(taskData: { title: string; description?: string; priority?: string }): Promise<AOResponse> {
    try {
      const result = await message({
        process: this.processId,
        tags: [{ name: 'Action', value: 'CreateTask' }],
        data: JSON.stringify(taskData),
        signer: this.signer
      });
      
      return JSON.parse(result.data);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async completeTask(taskId: string): Promise<AOResponse> {
    try {
      const result = await message({
        process: this.processId,
        tags: [
          { name: 'Action', value: 'CompleteTask' },
          { name: 'TaskId', value: taskId }
        ],
        data: 'complete',
        signer: this.signer
      });
      
      return JSON.parse(result.data);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getTasks(): Promise<AOResponse> {
    try {
      const result = await message({
        process: this.processId,
        tags: [{ name: 'Action', value: 'GetTasks' }],
        data: 'get',
        signer: this.signer
      });
      
      return JSON.parse(result.data);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getPoints(): Promise<AOResponse> {
    try {
      const result = await message({
        process: this.processId,
        tags: [{ name: 'Action', value: 'GetPoints' }],
        data: 'get',
        signer: this.signer
      });
      
      return JSON.parse(result.data);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getLeaderboard(): Promise<AOResponse> {
    try {
      const result = await message({
        process: this.processId,
        tags: [{ name: 'Action', value: 'GetLeaderboard' }],
        data: 'get',
        signer: this.signer
      });
      
      return JSON.parse(result.data);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async deleteTask(taskId: string): Promise<AOResponse> {
    try {
      const result = await message({
        process: this.processId,
        tags: [
          { name: 'Action', value: 'DeleteTask' },
          { name: 'TaskId', value: taskId }
        ],
        data: 'delete',
        signer: this.signer
      });
      
      return JSON.parse(result.data);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}`;

    await fs.writeFile(path.join(this.projectPath, 'app/lib/aoconnect.ts'), aoConnectContent);

    // Create app/components/WalletConnect.vue
    const walletConnectVue = `<template>
  <div class="wallet-connect">
    <button 
      v-if="!connected"
      @click="connectWallet"
      :disabled="connecting"
      class="group relative inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-white bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
    >
      <div class="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl blur opacity-75 group-hover:opacity-100 transition-opacity duration-200"></div>
      <span class="relative flex items-center gap-3">
        <div v-if="connecting" class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
        <svg v-else class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" />
        </svg>
      {{ connecting ? 'Connecting...' : 'Connect Arweave Wallet' }}
      </span>
    </button>
    <div v-else class="flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl">
      <div class="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
      <span class="text-green-700 font-semibold text-lg">Wallet Connected!</span>
      <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
const connected = ref(false);
const connecting = ref(false);
const wallet = ref(null);

const emit = defineEmits(['connect']);

const connectWallet = async () => {
  if (process.client && window.arweaveWallet) {
    connecting.value = true;
    try {
      await window.arweaveWallet.connect(['ACCESS_ADDRESS', 'SIGN_TRANSACTION']);
      wallet.value = window.arweaveWallet;
      connected.value = true;
      emit('connect', window.arweaveWallet);
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    } finally {
      connecting.value = false;
    }
  } else {
    alert('Please install ArConnect or another Arweave wallet extension');
  }
};
</script>`;

    await fs.writeFile(path.join(this.projectPath, 'app/components/WalletConnect.vue'), walletConnectVue);

    // Create app/pages/index.vue (Nuxt 4 structure)
    const mainPageVue = `<template>
  <div class="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
    <!-- Background decoration -->
    <div class="fixed inset-0 bg-gradient-to-br from-blue-400/5 via-purple-400/5 to-pink-400/5"></div>
    <div class="fixed top-0 left-1/4 w-96 h-96 bg-blue-300/10 rounded-full blur-3xl"></div>
    <div class="fixed bottom-0 right-1/4 w-96 h-96 bg-purple-300/10 rounded-full blur-3xl"></div>
    
    <div class="relative z-10">
    <div class="container mx-auto px-4 py-8">
        <header class="text-center mb-12">
          <div class="inline-flex items-center gap-4 mb-6">
            <div class="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
              <span class="text-3xl">🎯</span>
            </div>
            <div>
              <h1 class="text-5xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-purple-800 bg-clip-text text-transparent">
                TaskMaster
        </h1>
              <p class="text-xl text-gray-600 mt-2">
          Decentralized task management powered by AO and Arweave
        </p>
            </div>
          </div>
      </header>

        <div class="max-w-6xl mx-auto">
        <!-- Wallet Connection -->
          <div class="bg-white/80 backdrop-blur-sm p-8 rounded-3xl shadow-xl border border-white/20 mb-8">
            <div class="flex items-center gap-3 mb-6">
              <div class="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h2 class="text-2xl font-bold text-gray-900">Connect Your Wallet</h2>
            </div>
          <WalletConnect @connect="handleWalletConnect" />
        </div>

        <!-- Process ID Input -->
          <div v-if="wallet" class="bg-white/80 backdrop-blur-sm p-8 rounded-3xl shadow-xl border border-white/20 mb-8">
            <div class="flex items-center gap-3 mb-6">
              <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h2 class="text-2xl font-bold text-gray-900">AO Process Configuration</h2>
            </div>
          <div class="space-y-4">
            <div>
                <label for="processId" class="block text-sm font-semibold text-gray-700 mb-2">
                Process ID
              </label>
              <input
                type="text"
                id="processId"
                v-model="processId"
                  class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                placeholder="Enter your AO process ID"
              />
                <p class="text-sm text-gray-500 mt-2">
                Deploy the TaskMaster process and enter the process ID here
              </p>
            </div>
          </div>
        </div>

        <!-- Main Content -->
          <div v-if="aoClient" class="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <!-- Left Column - Create Task & Points -->
            <div class="lg:col-span-1 space-y-8">
            <PointsDisplay :ao-client="aoClient" />
            <CreateTask :ao-client="aoClient" @task-created="handleTaskCreated" />
          </div>
          
          <!-- Right Column - Task List -->
          <div class="lg:col-span-2">
              <div class="bg-white/80 backdrop-blur-sm p-8 rounded-3xl shadow-xl border border-white/20">
            <TaskList :ao-client="aoClient" />
              </div>
          </div>
        </div>

        <!-- Instructions -->
          <div v-if="!aoClient && wallet" class="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-3xl p-8 shadow-lg">
            <div class="flex items-center gap-3 mb-6">
              <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 class="text-2xl font-bold text-blue-900">
            Getting Started
          </h3>
            </div>
            <ol class="list-decimal list-inside space-y-3 text-blue-800 text-lg">
            <li>Deploy the TaskMaster AO process using the aos CLI</li>
            <li>Enter the process ID in the field above</li>
            <li>Start creating and managing your tasks!</li>
          </ol>
            <div class="mt-6 p-6 bg-blue-100 rounded-2xl border border-blue-200">
              <p class="text-blue-800">
                <strong>Quick Deploy:</strong> Run <code class="bg-blue-200 px-2 py-1 rounded-lg font-mono text-sm">aos taskmaster</code> then <code class="bg-blue-200 px-2 py-1 rounded-lg font-mono text-sm">.load src/ao/task-process.lua</code> and <code class="bg-blue-200 px-2 py-1 rounded-lg font-mono text-sm">.spawn</code>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { AOClient } from '~/lib/aoconnect';

const wallet = ref(null);
const aoClient = ref<AOClient | null>(null);
const processId = ref('');

const handleWalletConnect = (connectedWallet: any) => {
  wallet.value = connectedWallet;
};

const handleTaskCreated = () => {
  // This will trigger a refresh of the task list
};

watch([wallet, processId], () => {
  if (wallet.value && processId.value) {
    aoClient.value = new AOClient(wallet.value, processId.value);
  }
});
</script>`;

    await fs.writeFile(path.join(this.projectPath, 'app/pages/index.vue'), mainPageVue);

    // Create app/app.vue (Nuxt 4 main app component)
    const appVue = `<template>
  <div>
    <NuxtPage />
  </div>
</template>

<script setup lang="ts">
// Main app component - Nuxt 4 structure
</script>

<style>
/* Global styles */
</style>`;

    await fs.writeFile(path.join(this.projectPath, 'app/app.vue'), appVue);

    // Create app/app.config.ts (Nuxt 4 app configuration)
    const appConfig = `export default defineAppConfig({
  title: 'TaskMaster - AO Task Management',
  description: 'Decentralized task management powered by AO and Arweave',
  theme: {
    dark: false,
    colors: {
      primary: '#3B82F6'
    }
  }
})`;

    await fs.writeFile(path.join(this.projectPath, 'app/app.config.ts'), appConfig);

    // Create Nuxt components
    await this.createNuxtComponents();
  }

  private async createNuxtComponents(): Promise<void> {
    // Create app/components/PointsDisplay.vue
    const pointsDisplayVue = `<template>
  <div class="points-display relative overflow-hidden bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-700 text-white p-8 rounded-2xl shadow-xl">
    <!-- Background decoration -->
    <div class="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
    <div class="absolute -top-4 -right-4 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
    <div class="absolute -bottom-4 -left-4 w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>
    
    <div class="relative z-10">
      <div class="flex items-center gap-3 mb-4">
        <div class="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
          <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
        </div>
        <h3 class="text-xl font-bold">Your Points</h3>
      </div>
      
    <div class="text-center">
        <div class="text-5xl font-bold mb-2 bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent">
          {{ points.toLocaleString() }}
    </div>
        <p class="text-white/80 text-sm mb-4">
          Total points earned
        </p>
      </div>
      
      <div class="mt-6 space-y-2 text-sm text-white/90">
        <div class="flex items-center justify-between">
          <span class="flex items-center gap-2">
            <div class="w-2 h-2 bg-green-400 rounded-full"></div>
            Create task
          </span>
          <span class="font-semibold">+10 pts</span>
        </div>
        <div class="flex items-center justify-between">
          <span class="flex items-center gap-2">
            <div class="w-2 h-2 bg-yellow-400 rounded-full"></div>
            Complete task
          </span>
          <span class="font-semibold">+25 pts</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { AOClient } from '~/lib/aoconnect';

interface Props {
  aoClient: AOClient;
}

const props = defineProps<Props>();
const points = ref(0);

const fetchPoints = async () => {
  if (props.aoClient) {
    try {
      const result = await props.aoClient.getPoints();
      if (result.success && result.data) {
        points.value = result.data.points || 0;
      }
    } catch (error) {
      console.error('Failed to fetch points:', error);
    }
  }
};

// Fetch points on mount and when aoClient changes
watch(() => props.aoClient, fetchPoints, { immediate: true });

// Refresh points every 30 seconds
onMounted(() => {
  const interval = setInterval(fetchPoints, 30000);
  onUnmounted(() => clearInterval(interval));
});
</script>`;

    await fs.writeFile(path.join(this.projectPath, 'app/components/PointsDisplay.vue'), pointsDisplayVue);

    // Create app/components/CreateTask.vue
    const createTaskVue = `<template>
  <div class="create-task bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
    <div class="flex items-center gap-3 mb-6">
      <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
        <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      </div>
      <h2 class="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
        Create New Task
      </h2>
    </div>
    
    <form @submit.prevent="handleSubmit" class="space-y-6">
      <div class="space-y-2">
        <label for="title" class="block text-sm font-semibold text-gray-700">
          Task Title *
        </label>
        <input
          id="title"
          v-model="form.title"
          type="text"
          required
          class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
          placeholder="What needs to be done?"
        />
      </div>
      
      <div class="space-y-2">
        <label for="description" class="block text-sm font-semibold text-gray-700">
          Description
        </label>
        <textarea
          id="description"
          v-model="form.description"
          rows="4"
          class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white resize-none"
          placeholder="Add more details about this task..."
        ></textarea>
      </div>
      
      <div class="space-y-2">
        <label for="priority" class="block text-sm font-semibold text-gray-700">
          Priority Level
        </label>
        <div class="grid grid-cols-3 gap-3">
          <button
            v-for="p in ['low', 'medium', 'high']"
            :key="p"
            type="button"
            @click="form.priority = p"
            :class="[
              'p-3 rounded-xl border-2 transition-all duration-200',
              form.priority === p 
                ? getPriorityConfig(p).bg + ' ' + getPriorityConfig(p).border + ' border-2'
                : 'border-gray-200 bg-white hover:bg-gray-50'
            ]"
          >
            <div class="flex flex-col items-center gap-2">
              <span class="text-lg">{{ getPriorityConfig(p).icon }}</span>
              <span :class="[
                'text-sm font-medium',
                form.priority === p ? getPriorityConfig(p).color : 'text-gray-600'
              ]">
                {{ p.charAt(0).toUpperCase() + p.slice(1) }}
              </span>
            </div>
          </button>
        </div>
      </div>
      
      <button
        type="submit"
        :disabled="isSubmitting || !form.title.trim()"
        class="group relative w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
      >
        <div class="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl blur opacity-75 group-hover:opacity-100 transition-opacity duration-200"></div>
        <span class="relative flex items-center justify-center gap-3">
          <div v-if="isSubmitting" class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          {{ isSubmitting ? 'Creating Task...' : 'Create Task' }}
        </span>
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { AOClient } from '~/lib/aoconnect';

interface Props {
  aoClient: AOClient;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  taskCreated: [];
}>();

const form = ref({
  title: '',
  description: '',
  priority: 'medium' as 'low' | 'medium' | 'high'
});

const isSubmitting = ref(false);

const getPriorityConfig = (priority: string) => {
  switch (priority) {
    case 'high': 
      return { 
        color: 'text-red-600', 
        bg: 'bg-red-50', 
        border: 'border-red-200',
        icon: '🔴',
        gradient: 'from-red-500 to-pink-500'
      };
    case 'medium': 
      return { 
        color: 'text-yellow-600', 
        bg: 'bg-yellow-50', 
        border: 'border-yellow-200',
        icon: '🟡',
        gradient: 'from-yellow-500 to-orange-500'
      };
    case 'low': 
      return { 
        color: 'text-green-600', 
        bg: 'bg-green-50', 
        border: 'border-green-200',
        icon: '🟢',
        gradient: 'from-green-500 to-emerald-500'
      };
    default: 
      return { 
        color: 'text-gray-600', 
        bg: 'bg-gray-50', 
        border: 'border-gray-200',
        icon: '⚪',
        gradient: 'from-gray-500 to-slate-500'
      };
  }
};

const handleSubmit = async () => {
  if (!props.aoClient) return;
  
  isSubmitting.value = true;
  try {
    const result = await props.aoClient.createTask({
      title: form.value.title,
      description: form.value.description,
      priority: form.value.priority
    });
    
    if (result.success) {
      // Reset form
      form.value = {
        title: '',
        description: '',
        priority: 'medium'
      };
      
      // Emit event to parent
      emit('taskCreated');
      
      // Show success message (you could add a toast notification here)
      console.log('Task created successfully!');
    } else {
      console.error('Failed to create task:', result.error);
    }
  } catch (error) {
    console.error('Error creating task:', error);
  } finally {
    isSubmitting.value = false;
  }
};
</script>`;

    await fs.writeFile(path.join(this.projectPath, 'app/components/CreateTask.vue'), createTaskVue);

    // Create app/components/TaskList.vue
    const taskListVue = `<template>
  <div class="task-list">
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
        Your Tasks
      </h2>
      <button
        @click="fetchTasks"
        :disabled="loading"
        class="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <svg :class="['w-5 h-5', loading ? 'animate-spin' : '']" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>
    </div>
    
    <div v-if="loading" class="flex flex-col items-center justify-center py-12">
      <div class="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
      <p class="text-gray-500 text-lg">Loading your tasks...</p>
    </div>
    
    <div v-else-if="tasks.length === 0" class="text-center py-16">
      <div class="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center">
        <svg class="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      </div>
      <h3 class="text-xl font-semibold text-gray-700 mb-2">No tasks yet</h3>
      <p class="text-gray-500 mb-6">Create your first task to get started!</p>
    </div>
    
    <div v-else class="space-y-4">
      <div
        v-for="(task, index) in tasks"
        :key="task.id"
        :class="[
          'group relative p-6 rounded-2xl shadow-sm border transition-all duration-300 hover:shadow-lg hover:scale-[1.02]',
          task.completed 
            ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200' 
            : 'bg-white border-gray-200 hover:border-gray-300'
        ]"
        :style="{ animationDelay: \`\${index * 100}ms\` }"
      >
        <div class="flex items-start gap-4">
          <!-- Priority Indicator -->
          <div :class="[
            'flex-shrink-0 w-3 h-3 rounded-full mt-2 bg-gradient-to-r',
            getPriorityConfig(task.priority).gradient
          ]"></div>
          
          <!-- Task Content -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-3 mb-3">
              <span :class="[
                'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border',
                getPriorityConfig(task.priority).bg,
                getPriorityConfig(task.priority).color,
                getPriorityConfig(task.priority).border
              ]">
                <span>{{ getPriorityConfig(task.priority).icon }}</span>
                {{ task.priority.toUpperCase() }}
              </span>
              <span
                v-if="task.completed"
                class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200"
              >
                <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                </svg>
                Completed
              </span>
            </div>
            
            <h3 :class="[
              'text-lg font-semibold mb-2',
              task.completed ? 'line-through text-gray-500' : 'text-gray-900'
            ]">
              {{ task.title }}
            </h3>
            
            <p
              v-if="task.description"
              :class="[
                'text-sm mb-3',
                task.completed ? 'text-gray-400' : 'text-gray-600'
              ]"
            >
              {{ task.description }}
            </p>
            
            <div class="flex items-center gap-4 text-xs text-gray-500">
              <span class="flex items-center gap-1">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {{ formatDate(task.created) }}
              </span>
              <span
                v-if="task.completedAt"
                class="flex items-center gap-1 text-green-600"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Completed {{ formatDate(task.completedAt) }}
              </span>
            </div>
          </div>
          
          <!-- Action Buttons -->
          <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button
              v-if="!task.completed"
              @click="completeTask(task.id)"
              :disabled="completingTask === task.id"
              class="p-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:shadow-lg transform hover:scale-105 transition-all duration-200 disabled:opacity-50"
              title="Complete task"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
            </button>
            <button
              @click="deleteTask(task.id)"
              class="p-2 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-lg hover:shadow-lg transform hover:scale-105 transition-all duration-200"
              title="Delete task"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { AOClient, Task } from '~/lib/aoconnect';

interface Props {
  aoClient: AOClient;
}

const props = defineProps<Props>();

const tasks = ref<Task[]>([]);
const loading = ref(false);
const completingTask = ref<string | null>(null);

const getPriorityConfig = (priority: string) => {
  switch (priority) {
    case 'high': 
      return { 
        color: 'text-red-600', 
        bg: 'bg-red-50', 
        border: 'border-red-200',
        icon: '🔴',
        gradient: 'from-red-500 to-pink-500'
      };
    case 'medium': 
      return { 
        color: 'text-yellow-600', 
        bg: 'bg-yellow-50', 
        border: 'border-yellow-200',
        icon: '🟡',
        gradient: 'from-yellow-500 to-orange-500'
      };
    case 'low': 
      return { 
        color: 'text-green-600', 
        bg: 'bg-green-50', 
        border: 'border-green-200',
        icon: '🟢',
        gradient: 'from-green-500 to-emerald-500'
      };
    default: 
      return { 
        color: 'text-gray-600', 
        bg: 'bg-gray-50', 
        border: 'border-gray-200',
        icon: '⚪',
        gradient: 'from-gray-500 to-slate-500'
      };
  }
};

const fetchTasks = async () => {
  if (!props.aoClient) return;
  
  loading.value = true;
  try {
    const result = await props.aoClient.getTasks();
    if (result.success && result.data) {
      tasks.value = result.data.tasks || [];
    }
  } catch (error) {
    console.error('Failed to fetch tasks:', error);
  } finally {
    loading.value = false;
  }
};

const completeTask = async (taskId: string) => {
  if (!props.aoClient) return;
  
  completingTask.value = taskId;
  try {
    const result = await props.aoClient.completeTask(taskId);
    if (result.success) {
      // Refresh tasks
      await fetchTasks();
    } else {
      console.error('Failed to complete task:', result.error);
    }
  } catch (error) {
    console.error('Error completing task:', error);
  } finally {
    completingTask.value = null;
  }
};

const deleteTask = async (taskId: string) => {
  if (!props.aoClient) return;
  
  try {
    const result = await props.aoClient.deleteTask(taskId);
    if (result.success) {
      await fetchTasks();
    } else {
      console.error('Failed to delete task:', result.error);
    }
  } catch (error) {
    console.error('Error deleting task:', error);
  }
};

const formatDate = (timestamp: number) => {
  return new Date(timestamp * 1000).toLocaleDateString();
};

// Fetch tasks on mount and when aoClient changes
watch(() => props.aoClient, fetchTasks, { immediate: true });

// Refresh tasks every 30 seconds
onMounted(() => {
  const interval = setInterval(fetchTasks, 30000);
  onUnmounted(() => clearInterval(interval));
});
</script>`;

    await fs.writeFile(path.join(this.projectPath, 'app/components/TaskList.vue'), taskListVue);
  }

  private async createSvelteFiles(): Promise<void> {
    // Ensure directories exist (SvelteKit structure)
    await fs.ensureDir(path.join(this.projectPath, 'src/lib'));
    await fs.ensureDir(path.join(this.projectPath, 'src/lib/components'));
    await fs.ensureDir(path.join(this.projectPath, 'src/routes'));
    await fs.ensureDir(path.join(this.projectPath, 'static'));
    
    // Create lib/aoconnect.ts (same as Next.js)
    const aoConnectContent = `import { message, createDataItemSigner, connect } from '@permaweb/aoconnect';

export interface Task {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  created: number;
  owner: string;
  priority: 'high' | 'medium' | 'low';
  completedAt?: number;
}

export interface AOResponse {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
}

export class AOClient {
  private signer: any;
  private processId: string;

  constructor(wallet: any, processId: string) {
    this.signer = createDataItemSigner(wallet);
    this.processId = processId;
  }

  async createTask(taskData: { title: string; description?: string; priority?: string }): Promise<AOResponse> {
    try {
      const result = await message({
        process: this.processId,
        tags: [{ name: 'Action', value: 'CreateTask' }],
        data: JSON.stringify(taskData),
        signer: this.signer
      });
      
      return JSON.parse(result.data);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async completeTask(taskId: string): Promise<AOResponse> {
    try {
      const result = await message({
        process: this.processId,
        tags: [
          { name: 'Action', value: 'CompleteTask' },
          { name: 'TaskId', value: taskId }
        ],
        data: 'complete',
        signer: this.signer
      });
      
      return JSON.parse(result.data);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getTasks(): Promise<AOResponse> {
    try {
      const result = await message({
        process: this.processId,
        tags: [{ name: 'Action', value: 'GetTasks' }],
        data: 'get',
        signer: this.signer
      });
      
      return JSON.parse(result.data);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getPoints(): Promise<AOResponse> {
    try {
      const result = await message({
        process: this.processId,
        tags: [{ name: 'Action', value: 'GetPoints' }],
        data: 'get',
        signer: this.signer
      });
      
      return JSON.parse(result.data);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getLeaderboard(): Promise<AOResponse> {
    try {
      const result = await message({
        process: this.processId,
        tags: [{ name: 'Action', value: 'GetLeaderboard' }],
        data: 'get',
        signer: this.signer
      });
      
      return JSON.parse(result.data);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async deleteTask(taskId: string): Promise<AOResponse> {
    try {
      const result = await message({
        process: this.processId,
        tags: [
          { name: 'Action', value: 'DeleteTask' },
          { name: 'TaskId', value: taskId }
        ],
        data: 'delete',
        signer: this.signer
      });
      
      return JSON.parse(result.data);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}`;

    await fs.writeFile(path.join(this.projectPath, 'src/lib/aoconnect.ts'), aoConnectContent);

    // Create routes/+page.svelte
    const mainPageSvelte = `<script lang="ts">
  import { onMount } from 'svelte';
  import { AOClient } from '$lib/aoconnect';
  import PointsDisplay from '$lib/components/PointsDisplay.svelte';
  import CreateTask from '$lib/components/CreateTask.svelte';
  import TaskList from '$lib/components/TaskList.svelte';
  
  let wallet: any = null;
  let aoClient: AOClient | null = null;
  let processId = '';
  let connected = false;
  let connecting = false;

  const handleTaskCreated = () => {
    // This will trigger a refresh of the task list
  };

  const connectWallet = async () => {
    if (typeof window !== 'undefined' && window.arweaveWallet) {
      connecting = true;
      try {
        await window.arweaveWallet.connect(['ACCESS_ADDRESS', 'SIGN_TRANSACTION']);
        wallet = window.arweaveWallet;
        connected = true;
      } catch (error) {
        console.error('Failed to connect wallet:', error);
      } finally {
        connecting = false;
      }
    } else {
      alert('Please install ArConnect or another Arweave wallet extension');
    }
  };

  $: if (wallet && processId) {
    aoClient = new AOClient(wallet, processId);
  }
</script>

<div class="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
  <!-- Background decoration -->
  <div class="fixed inset-0 bg-gradient-to-br from-blue-400/5 via-purple-400/5 to-pink-400/5"></div>
  <div class="fixed top-0 left-1/4 w-96 h-96 bg-blue-300/10 rounded-full blur-3xl"></div>
  <div class="fixed bottom-0 right-1/4 w-96 h-96 bg-purple-300/10 rounded-full blur-3xl"></div>
  
  <div class="relative z-10">
    <div class="container mx-auto px-4 py-8">
      <header class="text-center mb-12">
        <div class="inline-flex items-center gap-4 mb-6">
          <div class="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
            <span class="text-3xl">🎯</span>
          </div>
          <div>
            <h1 class="text-5xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-purple-800 bg-clip-text text-transparent">
              TaskMaster
            </h1>
            <p class="text-xl text-gray-600 mt-2">
              Decentralized task management powered by AO and Arweave
            </p>
          </div>
        </div>
      </header>

      <div class="max-w-6xl mx-auto">
        <!-- Wallet Connection -->
        <div class="bg-white/80 backdrop-blur-sm p-8 rounded-3xl shadow-xl border border-white/20 mb-8">
          <div class="flex items-center gap-3 mb-6">
            <div class="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 class="text-2xl font-bold text-gray-900">Connect Your Wallet</h2>
          </div>
          <div class="wallet-connect">
            {#if !connected}
              <button 
                on:click={connectWallet}
                disabled={connecting}
                class="group relative inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-white bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                <div class="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl blur opacity-75 group-hover:opacity-100 transition-opacity duration-200"></div>
                <span class="relative flex items-center gap-3">
                  {#if connecting}
                    <div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Connecting...
                  {:else}
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" />
                    </svg>
                    Connect Arweave Wallet
                  {/if}
                </span>
              </button>
            {:else}
              <div class="flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl">
                <div class="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span class="text-green-700 font-semibold text-lg">Wallet Connected!</span>
                <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            {/if}
          </div>
        </div>

        <!-- Process ID Input -->
        {#if wallet}
          <div class="bg-white/80 backdrop-blur-sm p-8 rounded-3xl shadow-xl border border-white/20 mb-8">
            <div class="flex items-center gap-3 mb-6">
              <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h2 class="text-2xl font-bold text-gray-900">AO Process Configuration</h2>
            </div>
            <div class="space-y-4">
              <div>
                <label for="processId" class="block text-sm font-semibold text-gray-700 mb-2">
                  Process ID
                </label>
                <input
                  type="text"
                  id="processId"
                  bind:value={processId}
                  class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                  placeholder="Enter your AO process ID"
                />
                <p class="text-sm text-gray-500 mt-2">
                  Deploy the TaskMaster process and enter the process ID here
                </p>
              </div>
            </div>
          </div>
        {/if}

        <!-- Main Content -->
        {#if aoClient}
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <!-- Left Column - Create Task & Points -->
            <div class="lg:col-span-1 space-y-8">
              <PointsDisplay {aoClient} />
              <CreateTask {aoClient} on:taskCreated={handleTaskCreated} />
            </div>
            
            <!-- Right Column - Task List -->
            <div class="lg:col-span-2">
              <div class="bg-white/80 backdrop-blur-sm p-8 rounded-3xl shadow-xl border border-white/20">
                <TaskList {aoClient} />
              </div>
            </div>
          </div>
        {/if}

        <!-- Instructions -->
        {#if !aoClient && wallet}
          <div class="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-3xl p-8 shadow-lg">
            <div class="flex items-center gap-3 mb-6">
              <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 class="text-2xl font-bold text-blue-900">
                Getting Started
              </h3>
            </div>
            <ol class="list-decimal list-inside space-y-3 text-blue-800 text-lg">
              <li>Deploy the TaskMaster AO process using the aos CLI</li>
              <li>Enter the process ID in the field above</li>
              <li>Start creating and managing your tasks!</li>
            </ol>
            <div class="mt-6 p-6 bg-blue-100 rounded-2xl border border-blue-200">
              <p class="text-blue-800">
                <strong>Quick Deploy:</strong> Run <code class="bg-blue-200 px-2 py-1 rounded-lg font-mono text-sm">aos taskmaster</code> then <code class="bg-blue-200 px-2 py-1 rounded-lg font-mono text-sm">.load src/ao/task-process.lua</code> and <code class="bg-blue-200 px-2 py-1 rounded-lg font-mono text-sm">.spawn</code>
              </p>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>`;

    await fs.writeFile(path.join(this.projectPath, 'src/routes/+page.svelte'), mainPageSvelte);

    // Create src/routes/+layout.svelte (SvelteKit root layout)
    const layoutSvelte = `<script>
  import '../app.css';
</script>

<main>
  <slot />
</main>

<style>
  main {
    min-height: 100vh;
    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
    font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
</style>`;

    await fs.writeFile(path.join(this.projectPath, 'src/routes/+layout.svelte'), layoutSvelte);

    // Create src/app.html (SvelteKit HTML template)
    const appHtml = `<!DOCTYPE html>
<html lang="en" class="scroll-smooth">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" href="%sveltekit.assets%/favicon.png" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>TaskMaster - AO Task Management</title>
    <meta name="description" content="Decentralized task management powered by AO and Arweave" />
    <meta name="keywords" content="AO, Arweave, Task Management, Decentralized, Web3" />
    <meta name="theme-color" content="#3B82F6" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
    %sveltekit.head%
  </head>
  <body data-sveltekit-preload-data="hover" class="antialiased">
    <div style="display: contents">%sveltekit.body%</div>
  </body>
</html>`;

    await fs.writeFile(path.join(this.projectPath, 'src/app.html'), appHtml);

    // Create src/app.css (SvelteKit global styles)
    const appCss = `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
@import 'tailwindcss/base';
@import 'tailwindcss/components';
@import 'tailwindcss/utilities';

:root {
  --foreground-rgb: 15, 23, 42;
  --background-start-rgb: 248, 250, 252;
  --background-end-rgb: 241, 245, 249;
  --primary-rgb: 59, 130, 246;
  --secondary-rgb: 147, 51, 234;
}

@media (prefers-color-scheme: dark) {
  :root {
    --foreground-rgb: 248, 250, 252;
    --background-start-rgb: 15, 23, 42;
    --background-end-rgb: 30, 41, 59;
  }
}

* {
  box-sizing: border-box;
  padding: 0;
  margin: 0;
}

html {
  scroll-behavior: smooth;
}

body {
  color: rgb(var(--foreground-rgb));
  background: linear-gradient(
      135deg,
      rgb(var(--background-start-rgb)) 0%,
      rgb(var(--background-end-rgb)) 100%
    );
  font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: rgb(241, 245, 249);
}

::-webkit-scrollbar-thumb {
  background: rgb(148, 163, 184);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgb(100, 116, 139);
}

/* Custom animations */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeInScale {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.animate-fade-in-up {
  animation: fadeInUp 0.6s ease-out;
}

.animate-fade-in-scale {
  animation: fadeInScale 0.4s ease-out;
}

/* Glass morphism effect */
.glass {
  background: rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.18);
}

/* Gradient text */
.gradient-text {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Custom focus styles */
.focus-ring {
  @apply focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2;
}

/* Button hover effects */
.btn-hover {
  @apply transition-all duration-200 hover:scale-105 hover:shadow-lg;
}

/* Card hover effects */
.card-hover {
  @apply transition-all duration-300 hover:shadow-xl hover:scale-[1.02];
}`;

    await fs.writeFile(path.join(this.projectPath, 'src/app.css'), appCss);

    // Create SvelteKit components
    await this.createSvelteComponents();
  }

  private async createSvelteComponents(): Promise<void> {
    // Create src/lib/components/PointsDisplay.svelte
    const pointsDisplaySvelte = `<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { AOClient } from '$lib/aoconnect';

  export let aoClient: AOClient;

  let points = 0;
  let interval: number;

  const fetchPoints = async () => {
    if (aoClient) {
      try {
        const result = await aoClient.getPoints();
        if (result.success && result.data) {
          points = result.data.points || 0;
        }
      } catch (error) {
        console.error('Failed to fetch points:', error);
      }
    }
  };

  onMount(() => {
    fetchPoints();
    interval = setInterval(fetchPoints, 30000);
  });

  onDestroy(() => {
    if (interval) clearInterval(interval);
  });

  $: if (aoClient) fetchPoints();
</script>

<div class="points-display">
  <div class="points-container">
    <div class="points-icon">
      <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    </div>
    <div class="points-content">
      <div class="points-value">{points}</div>
      <div class="points-label">Total Points</div>
    </div>
  </div>
  <div class="points-breakdown">
    <div class="breakdown-item">
      <span class="breakdown-icon">✓</span>
      <span class="breakdown-text">High Priority: 3 points</span>
    </div>
    <div class="breakdown-item">
      <span class="breakdown-icon">✓</span>
      <span class="breakdown-text">Medium Priority: 2 points</span>
    </div>
    <div class="breakdown-item">
      <span class="breakdown-icon">✓</span>
      <span class="breakdown-text">Low Priority: 1 point</span>
    </div>
  </div>
</div>

<style>
  .points-display {
    background: linear-gradient(135deg, #f8fafc 0%, #ffffff 100%);
    border: 1px solid #e2e8f0;
    border-radius: 1rem;
    padding: 1.5rem;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    position: relative;
    overflow: hidden;
  }

  .points-display::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, #3b82f6, #8b5cf6, #06b6d4);
  }

  .points-container {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .points-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 3rem;
    height: 3rem;
    background: linear-gradient(135deg, #3b82f6, #8b5cf6);
    border-radius: 0.75rem;
    color: white;
    box-shadow: 0 4px 14px 0 rgba(59, 130, 246, 0.3);
  }

  .points-content {
    flex: 1;
  }

  .points-value {
    font-size: 2rem;
    font-weight: 800;
    background: linear-gradient(135deg, #3b82f6, #8b5cf6);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    line-height: 1;
  }

  .points-label {
    color: #64748b;
    font-size: 0.875rem;
    font-weight: 500;
    margin-top: 0.25rem;
  }

  .points-breakdown {
    border-top: 1px solid #e2e8f0;
    padding-top: 1rem;
  }

  .breakdown-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
  }

  .breakdown-item:last-child {
    margin-bottom: 0;
  }

  .breakdown-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.25rem;
    height: 1.25rem;
    background: #10b981;
    color: white;
    border-radius: 50%;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .breakdown-text {
    color: #64748b;
    font-weight: 500;
  }
</style>`;

    await fs.writeFile(path.join(this.projectPath, 'src/lib/components/PointsDisplay.svelte'), pointsDisplaySvelte);

    // Create src/lib/components/CreateTask.svelte
    const createTaskSvelte = `<script lang="ts">
  import type { AOClient } from '$lib/aoconnect';

  export let aoClient: AOClient;

  let title = '';
  let description = '';
  let priority: 'low' | 'medium' | 'high' = 'medium';
  let isSubmitting = false;

  const handleSubmit = async () => {
    if (!aoClient) return;
    
    isSubmitting = true;
    try {
      const result = await aoClient.createTask({
        title,
        description,
        priority
      });
      
      if (result.success) {
        // Reset form
        title = '';
        description = '';
        priority = 'medium';
        
        // Dispatch event to parent
        dispatchEvent(new CustomEvent('taskCreated'));
        
        console.log('Task created successfully!');
      } else {
        console.error('Failed to create task:', result.error);
      }
    } catch (error) {
      console.error('Error creating task:', error);
    } finally {
      isSubmitting = false;
    }
  };
</script>

<div class="create-task-form">
  <div class="form-header">
    <div class="form-icon">
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
      </svg>
    </div>
    <h3 class="form-title">Create New Task</h3>
  </div>
  
  <form on:submit|preventDefault={handleSubmit} class="form-content">
    <div class="form-group">
      <label for="title" class="form-label">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Task Title *
      </label>
      <input
        id="title"
        bind:value={title}
        type="text"
        required
        class="form-input"
        placeholder="Enter task title"
      />
    </div>
    
    <div class="form-group">
      <label for="description" class="form-label">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7" />
        </svg>
        Description
      </label>
      <textarea
        id="description"
        bind:value={description}
        rows="3"
        class="form-textarea"
        placeholder="Enter task description"
      ></textarea>
    </div>
    
    <div class="form-group">
      <label class="form-label">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        Priority
      </label>
      <div class="priority-buttons">
        <button
          type="button"
          class="priority-btn {priority === 'low' ? 'priority-btn-active' : ''}"
          on:click={() => priority = 'low'}
        >
          <span class="priority-dot priority-dot-low"></span>
          Low
        </button>
        <button
          type="button"
          class="priority-btn {priority === 'medium' ? 'priority-btn-active' : ''}"
          on:click={() => priority = 'medium'}
        >
          <span class="priority-dot priority-dot-medium"></span>
          Medium
        </button>
        <button
          type="button"
          class="priority-btn {priority === 'high' ? 'priority-btn-active' : ''}"
          on:click={() => priority = 'high'}
        >
          <span class="priority-dot priority-dot-high"></span>
          High
        </button>
      </div>
    </div>
    
    <button
      type="submit"
      disabled={isSubmitting}
      class="submit-btn"
    >
      {#if isSubmitting}
        <div class="loading-spinner"></div>
        Creating Task...
      {:else}
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        Create Task
      {/if}
    </button>
  </form>
</div>

<style>
  .create-task-form {
    background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
    border: 1px solid #e2e8f0;
    border-radius: 1rem;
    padding: 1.5rem;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    position: relative;
    overflow: hidden;
  }

  .create-task-form::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, #10b981, #3b82f6, #8b5cf6);
  }

  .form-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }

  .form-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.5rem;
    height: 2.5rem;
    background: linear-gradient(135deg, #10b981, #3b82f6);
    border-radius: 0.75rem;
    color: white;
    box-shadow: 0 4px 14px 0 rgba(16, 185, 129, 0.3);
  }

  .form-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: #1e293b;
    margin: 0;
  }

  .form-content {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
  }

  .form-input,
  .form-textarea {
    width: 100%;
    padding: 0.75rem 1rem;
    border: 2px solid #e5e7eb;
    border-radius: 0.75rem;
    font-size: 0.875rem;
    transition: all 0.2s ease;
    background: #ffffff;
  }

  .form-input:focus,
  .form-textarea:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .form-textarea {
    resize: vertical;
    min-height: 5rem;
  }

  .priority-buttons {
    display: flex;
    gap: 0.5rem;
  }

  .priority-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border: 2px solid #e5e7eb;
    border-radius: 0.75rem;
    background: #ffffff;
    font-size: 0.875rem;
    font-weight: 500;
    color: #6b7280;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .priority-btn:hover {
    border-color: #d1d5db;
    background: #f9fafb;
  }

  .priority-btn-active {
    border-color: #3b82f6;
    background: #eff6ff;
    color: #1d4ed8;
  }

  .priority-dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
  }

  .priority-dot-low {
    background: #10b981;
  }

  .priority-dot-medium {
    background: #f59e0b;
  }

  .priority-dot-high {
    background: #ef4444;
  }

  .submit-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.875rem 1.5rem;
    background: linear-gradient(135deg, #3b82f6, #8b5cf6);
    color: white;
    border: none;
    border-radius: 0.75rem;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 4px 14px 0 rgba(59, 130, 246, 0.3);
  }

  .submit-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 6px 20px 0 rgba(59, 130, 246, 0.4);
  }

  .submit-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .loading-spinner {
    width: 1rem;
    height: 1rem;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top: 2px solid white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
</style>`;

    await fs.writeFile(path.join(this.projectPath, 'src/lib/components/CreateTask.svelte'), createTaskSvelte);

    // Create src/lib/components/TaskList.svelte
    const taskListSvelte = `<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { AOClient, Task } from '$lib/aoconnect';

  export let aoClient: AOClient;

  let tasks: Task[] = [];
  let loading = false;
  let completingTask: string | null = null;
  let interval: number;

  const fetchTasks = async () => {
    if (!aoClient) return;
    
    loading = true;
    try {
      const result = await aoClient.getTasks();
      if (result.success && result.data) {
        tasks = result.data.tasks || [];
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    } finally {
      loading = false;
    }
  };

  const completeTask = async (taskId: string) => {
    if (!aoClient) return;
    
    completingTask = taskId;
    try {
      const result = await aoClient.completeTask(taskId);
      if (result.success) {
        await fetchTasks();
      } else {
        console.error('Failed to complete task:', result.error);
      }
    } catch (error) {
      console.error('Error completing task:', error);
    } finally {
      completingTask = null;
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  onMount(() => {
    fetchTasks();
    interval = setInterval(fetchTasks, 30000);
  });

  onDestroy(() => {
    if (interval) clearInterval(interval);
  });

  $: if (aoClient) fetchTasks();
</script>

<div class="task-list-container">
  <div class="task-list-header">
    <div class="header-content">
      <div class="header-icon">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      </div>
      <div class="header-text">
        <h3 class="header-title">Your Tasks</h3>
        <p class="header-subtitle">{tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}</p>
      </div>
    </div>
  </div>
  
  <div class="task-list-content">
    {#if loading}
      <div class="loading-state">
        <div class="loading-spinner"></div>
        <p class="loading-text">Loading tasks...</p>
      </div>
    {:else if tasks.length === 0}
      <div class="empty-state">
        <div class="empty-icon">
          <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        </div>
        <h4 class="empty-title">No tasks yet</h4>
        <p class="empty-text">Create your first task to get started!</p>
      </div>
    {:else}
      <div class="tasks-grid">
        {#each tasks as task (task.id)}
          <div class="task-card {task.completed ? 'task-completed' : ''}">
            <div class="task-header">
              <div class="task-title-section">
                <h4 class="task-title">{task.title}</h4>
                <div class="task-badges">
                  <span class="priority-badge priority-{task.priority}">
                    {#if task.priority === 'high'}
                      <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clip-rule="evenodd" />
                      </svg>
                    {:else if task.priority === 'medium'}
                      <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd" />
                      </svg>
                    {:else}
                      <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd" />
                      </svg>
                    {/if}
                    {task.priority}
                  </span>
                  {#if task.completed}
                    <span class="status-badge status-completed">
                      <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                      </svg>
                      Completed
                    </span>
                  {/if}
                </div>
              </div>
            </div>
            
            {#if task.description}
              <p class="task-description">{task.description}</p>
            {/if}
            
            <div class="task-footer">
              <div class="task-dates">
                <span class="task-date">
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Created {formatDate(task.created)}
                </span>
                {#if task.completedAt}
                  <span class="task-date">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Completed {formatDate(task.completedAt)}
                  </span>
                {/if}
              </div>
              
              {#if !task.completed}
                <button
                  on:click={() => completeTask(task.id)}
                  disabled={completingTask === task.id}
                  class="complete-btn"
                >
                  {#if completingTask === task.id}
                    <div class="btn-spinner"></div>
                    Completing...
                  {:else}
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Complete
                  {/if}
                </button>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .task-list-container {
    background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
    border: 1px solid #e2e8f0;
    border-radius: 1rem;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    overflow: hidden;
  }

  .task-list-header {
    background: linear-gradient(135deg, #f8fafc 0%, #ffffff 100%);
    border-bottom: 1px solid #e2e8f0;
    padding: 1.5rem;
  }

  .header-content {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .header-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 3rem;
    height: 3rem;
    background: linear-gradient(135deg, #3b82f6, #8b5cf6);
    border-radius: 0.75rem;
    color: white;
    box-shadow: 0 4px 14px 0 rgba(59, 130, 246, 0.3);
  }

  .header-text {
    flex: 1;
  }

  .header-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: #1e293b;
    margin: 0 0 0.25rem 0;
  }

  .header-subtitle {
    font-size: 0.875rem;
    color: #64748b;
    margin: 0;
  }

  .task-list-content {
    padding: 1.5rem;
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 1rem;
  }

  .loading-spinner {
    width: 2rem;
    height: 2rem;
    border: 3px solid #e5e7eb;
    border-top: 3px solid #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .loading-text {
    margin-top: 1rem;
    color: #64748b;
    font-size: 0.875rem;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 1rem;
    text-align: center;
  }

  .empty-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 4rem;
    height: 4rem;
    background: #f1f5f9;
    border-radius: 1rem;
    color: #94a3b8;
    margin-bottom: 1rem;
  }

  .empty-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #374151;
    margin: 0 0 0.5rem 0;
  }

  .empty-text {
    color: #64748b;
    font-size: 0.875rem;
    margin: 0;
  }

  .tasks-grid {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .task-card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 0.75rem;
    padding: 1.25rem;
    transition: all 0.2s ease;
    position: relative;
    overflow: hidden;
  }

  .task-card:hover {
    box-shadow: 0 4px 12px -2px rgba(0, 0, 0, 0.1);
    transform: translateY(-1px);
  }

  .task-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, #e2e8f0, #cbd5e1);
  }

  .task-completed {
    opacity: 0.8;
  }

  .task-completed::before {
    background: linear-gradient(90deg, #10b981, #059669);
  }

  .task-header {
    margin-bottom: 0.75rem;
  }

  .task-title-section {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }

  .task-title {
    font-size: 1rem;
    font-weight: 600;
    color: #1e293b;
    margin: 0;
    flex: 1;
  }

  .task-badges {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .priority-badge {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    border-radius: 0.5rem;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: capitalize;
  }

  .priority-high {
    background: #fef2f2;
    color: #dc2626;
    border: 1px solid #fecaca;
  }

  .priority-medium {
    background: #fffbeb;
    color: #d97706;
    border: 1px solid #fed7aa;
  }

  .priority-low {
    background: #f0fdf4;
    color: #16a34a;
    border: 1px solid #bbf7d0;
  }

  .status-badge {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    border-radius: 0.5rem;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .status-completed {
    background: #f0fdf4;
    color: #16a34a;
    border: 1px solid #bbf7d0;
  }

  .task-description {
    color: #64748b;
    font-size: 0.875rem;
    line-height: 1.5;
    margin: 0 0 1rem 0;
  }

  .task-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .task-dates {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .task-date {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    color: #64748b;
    font-size: 0.75rem;
  }

  .complete-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: linear-gradient(135deg, #10b981, #059669);
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 2px 4px 0 rgba(16, 185, 129, 0.2);
  }

  .complete-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 8px 0 rgba(16, 185, 129, 0.3);
  }

  .complete-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .btn-spinner {
    width: 0.75rem;
    height: 0.75rem;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top: 2px solid white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
</style>`;

    await fs.writeFile(path.join(this.projectPath, 'src/lib/components/TaskList.svelte'), taskListSvelte);
  }

  private async createTaskMasterREADME(): Promise<void> {
    const readmeContent = `# 🎯 TaskMaster - Decentralized Task Management

A powerful, gamified task management application built with AO (Arweave Operating System) and modern web frameworks. TaskMaster demonstrates the ease and power of building decentralized applications with AO, Lua, and Arweave.

## ✨ Features

### 🎮 Gamified Task Management
- **Create Tasks** - Add tasks with title, description, and priority levels
- **Complete Tasks** - Mark tasks as done and earn points
- **Points System** - Earn +10 points for creating tasks, +25 for completing them
- **Leaderboard** - Compete with other users on the global leaderboard
- **Task Priority** - Organize tasks by high, medium, or low priority

### 🔗 AO Integration
- **Decentralized Storage** - All data stored permanently on Arweave
- **AO Processes** - Smart contract logic written in Lua
- **Wallet Integration** - Connect with ArConnect or other Arweave wallets
- **Real-time Updates** - Instant task creation and completion

### 🛠️ Framework Support
This project is available in multiple frameworks:
- **Next.js** - React-based full-stack framework
- **Nuxt.js** - Vue.js-based full-stack framework  
- **Svelte** - Modern reactive framework

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm/yarn/pnpm
- ArConnect wallet extension (or compatible Arweave wallet)
- aos CLI for AO process deployment

### 1. Install Dependencies
\`\`\`bash
npm install
# or
yarn install
# or
pnpm install
\`\`\`

### 2. Deploy the AO Process
\`\`\`bash
# Start aos CLI
aos taskmaster

# Load the TaskMaster process
.load src/ao/task-process.lua

# Spawn the process (this will give you a Process ID)
.spawn

# Copy the Process ID - you'll need it for the frontend
\`\`\`

### 3. Start Development Server
\`\`\`bash
npm run dev
# or
yarn dev
# or
pnpm dev
\`\`\`

### 4. Connect and Use
1. Open your browser to the development server (usually http://localhost:3000)
2. Click "Connect Arweave Wallet" and approve the connection
3. Enter your AO Process ID from step 2
4. Start creating and managing your tasks!

## 🏗️ Project Structure

\`\`\`
├── app/                       # Next.js App Router
│   ├── globals.css            # Global styles
│   ├── layout.tsx             # Root layout
│   └── page.tsx               # Home page
├── components/                # React components
│   ├── WalletConnect.tsx      # Wallet connection
│   ├── TaskList.tsx           # Task list component
│   ├── CreateTask.tsx         # Task creation form
│   └── PointsDisplay.tsx      # Points display
├── lib/                       # Utility libraries
│   └── aoconnect.ts           # AO client library
├── public/                    # Static assets
├── src/                       # AO-specific files
│   ├── ao/                    # AO process files
│   │   ├── task-process.lua   # Main TaskMaster AO process
│   │   ├── utils.lua          # Shared AO utilities
│   │   └── README.md          # AO documentation
│   ├── contracts/             # Smart contract files
│   └── utils/                 # AO utilities
├── package.json               # Dependencies and scripts
└── README.md                  # This file
\`\`\`

## 🔧 AO Process API

The TaskMaster AO process supports the following actions:

### CreateTask
Creates a new task and awards 10 points.
\`\`\`json
{
  "title": "Task Title",
  "description": "Task description",
  "priority": "high|medium|low"
}
\`\`\`

### CompleteTask
Marks a task as completed and awards 25 points.
\`\`\`
Tags: {"TaskId": "task-id"}
\`\`\`

### GetTasks
Retrieves all tasks for the current user.

### GetPoints
Gets the current user's point balance.

### GetLeaderboard
Retrieves the top 10 users by points.

### DeleteTask
Deletes a task (only by the task owner).
\`\`\`
Tags: {"TaskId": "task-id"}
\`\`\`

## 🎯 Learning AO Development

This project demonstrates key AO development concepts:

### 1. **AO Processes**
- Lua-based smart contracts
- Message handling with Handlers.add()
- State management with local variables
- Cross-process communication with ao.send()

### 2. **aoconnect Integration**
- JavaScript/TypeScript client library
- Wallet integration with createDataItemSigner()
- Message sending with proper tags and data
- Error handling and response parsing

### 3. **Arweave Integration**
- Permanent data storage
- Wallet-based authentication
- Transaction signing and submission

### 4. **Decentralized Architecture**
- No central server required
- Data ownership by users
- Censorship-resistant storage
- Global accessibility

## 🛠️ Development

### Adding New Features
1. **AO Process**: Add new handlers in \`src/ao/task-process.lua\`
2. **Frontend**: Update components and AO client in \`src/lib/aoconnect.ts\`
3. **UI**: Modify framework-specific components

### Testing
\`\`\`bash
# Test AO process
aos taskmaster
.load src/ao/task-process.lua
.spawn

# Test individual actions
Send({Target = ao.id, Action = "CreateTask", Data = '{"title": "Test", "priority": "high"}'})
Send({Target = ao.id, Action = "GetTasks", Data = "get"})
\`\`\`

### Deployment
\`\`\`bash
# Build the project
npm run build

# Deploy to production
npm run deploy
\`\`\`

## 🔗 Resources

- [AO Documentation](https://cookbook_ao.arweave.net/)
- [aoconnect Guide](https://cookbook_ao.arweave.net/guides/aoconnect/)
- [Arweave Documentation](https://docs.arweave.org/)
- [Forge CLI](https://github.com/your-org/ao-forge) - AO development toolkit

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is open source and available under the MIT License.

---

**Built with ❤️ using AO, Arweave, and modern web frameworks**

*TaskMaster demonstrates the power and simplicity of decentralized application development with AO.*`;

    await fs.writeFile(path.join(this.projectPath, 'README.md'), readmeContent);
  }

  private showProjectInfo(options: CreateProjectOptions): void {
    logger.info('\n🎯 TaskMaster project created successfully!');
    logger.info(`\n📁 Project: ${options.name}`);
    logger.info(`🚀 Framework: ${options.framework}`);
    logger.info(`📦 Package Manager: ${options.packageManager}`);
    
    logger.info('\n📋 Next steps:');
    logger.info(`  cd ${options.name}`);
    logger.info('  npm install        # Install dependencies');
    logger.info('  # Deploy the AO process:');
    logger.info('  aos taskmaster');
    logger.info('  .load src/ao/task-process.lua');
    logger.info('  .spawn');
    logger.info('  npm run dev        # Start development server');
    logger.info('  # Connect your Arweave wallet and enter the Process ID');
    
    logger.info('\n🎮 TaskMaster Features:');
    logger.info('  • Create and manage tasks with priority levels');
    logger.info('  • Earn points for creating (+10) and completing (+25) tasks');
    logger.info('  • View leaderboard and compete with other users');
    logger.info('  • Decentralized storage on Arweave');
    
    logger.info('\n📚 Documentation:');
    logger.info('  README.md          # Detailed project guide');
    logger.info('  https://cookbook_ao.arweave.net/');
    logger.info('  https://docs.arweave.org/developers/ao');
  }

  async startDevServer(config: AOConfig, quietFramework: boolean = false): Promise<ChildProcessWithoutNullStreams> {
    logger.info('Starting development server...');
    
    try {
      const port = config.ports?.dev || 3000;
      const pm = config.packageManager || 'npm';
      // Use framework-specific dev commands to avoid infinite loops
      const framework = config.framework || 'nextjs';
      let devCommand: string;
      
      if (framework === 'nextjs') {
        devCommand = `${pm} exec next dev`;
      } else if (framework === 'nuxtjs') {
        devCommand = `${pm} exec nuxt dev`;
      } else if (framework === 'svelte') {
        devCommand = `${pm} exec vite`;
      } else {
        throw new Error(`Unsupported framework: ${framework}`);
      }

      if (!devCommand) {
        throw new Error(`Unsupported package manager: ${pm}`);
      }
      
      const installCommand = {
        'npm': 'npm install',
        'yarn': 'yarn install',
        'pnpm': 'pnpm install'
      }[pm];
      
      // Check if dependencies are installed
      if (await this.checkDependenciesInstalled(pm)) {
        logger.info('Dependencies already installed');
      } else {
        logger.info('Installing dependencies...');
        await this.installDependencies(this.projectPath, pm);
      }
      
      logger.info('Starting development server...');
      const devProcess = spawn(devCommand, [], {
        cwd: this.projectPath,
        shell: true,
        stdio: ['inherit', 'pipe', 'pipe']
      });

      let serverStarted = false;

      // Handle stdout and detect server ready state
      devProcess.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();
        
        if (!serverStarted && output.includes('http://localhost:')) {
          serverStarted = true;
          logger.success('Development server started successfully!');
          
          // Extract the port from the output
          const match = output.match(/Local:\s+http:\/\/localhost:(\d+)/);
          const serverPort = match ? match[1] : port;
          const url = `http://localhost:${serverPort}`;
          logger.info(`Your application is running at: ${url}`);
          
          open(url).catch(() => {
            logger.warn('Could not open browser automatically');
          });
        }

        // Only show framework output if not running with AO process
        if (!quietFramework) {
          process.stdout.write(output);
        }
      });

      // Handle stderr
      devProcess.stderr?.on('data', (data: Buffer) => {
        const error = data.toString();
        if (error.includes('error')) {
          logger.error('Development server error');
        }
        // Only show error output if not in quiet mode
        if (!quietFramework) {
          process.stderr.write(error);
        }
      });

      // Handle process exit
      devProcess.on('close', (code: number) => {
        if (code !== 0) {
          logger.error('Development server stopped unexpectedly');
          process.exit(code);
        }
      });

      // Handle process errors
      devProcess.on('error', (error) => {
        logger.error('Failed to start development server', error);
        process.exit(1);
      });

      return devProcess as unknown as ChildProcessWithoutNullStreams;

    } catch (error) {
      logger.error('Failed to start development server', error as Error);
      throw error;
    }
  }

  async checkDependenciesInstalled(packageManager: string): Promise<boolean> {
    try {
      const lockFiles = {
        'npm': 'package-lockon',
        'yarn': 'yarn.lock',
        'pnpm': 'pnpm-lock.yaml'
      };

      const lockFile = lockFiles[packageManager as keyof typeof lockFiles];
      if (!lockFile) {
        return false;
      }

      return await fs.pathExists(path.join(this.projectPath, lockFile));
    } catch {
      return false;
    }
  }

  async getProjectInfo(): Promise<any> {
    try {
      const packageJsonPath = path.join(this.projectPath, 'packageon');
      if (await fs.pathExists(packageJsonPath)) {
        return await fs.readJSON(packageJsonPath);
      }
      return null;
    } catch {
      return null;
    }
  }

  getProjectPath(): string {
    return this.projectPath;
  }

  private async updateConfigWithLuaFiles(config: AOConfig): Promise<void> {
    try {
      // Find all Lua files that were created during project setup
      const luaFiles = await this.findCreatedLuaFiles();
      
      if (luaFiles.length > 0) {
        // Update the config with the found Lua files
        config.luaFiles = luaFiles;

        // Save the updated config
        await this.configManager.saveConfig(config);

        logger.info(`Updated config with ${luaFiles.length} Lua files: ${luaFiles.join(', ')}`);
      } else {
        logger.warn('No Lua files found to add to config');
      }
    } catch (error) {
      logger.error('Failed to update config with Lua files', error as Error);
      // Don't throw - this is not critical for project creation
    }
  }

  private async findCreatedLuaFiles(): Promise<string[]> {
    try {
      const luaFiles: string[] = [];
      
      // Check for the specific Lua files we create during project setup
      const expectedLuaFiles = [
        'src/ao/task-process.lua',  // Main TaskMaster AO process
        'src/ao/utils.lua'          // AO utility functions
      ];

      for (const file of expectedLuaFiles) {
        const filePath = path.join(this.projectPath, file);
        if (await fs.pathExists(filePath)) {
          luaFiles.push(file);
          logger.debug(`Found Lua file: ${file}`);
        } else {
          logger.debug(`Lua file not found: ${file}`);
        }
      }

      // Also scan for any additional Lua files that might have been created
      const additionalLuaFiles = await this.scanForAdditionalLuaFiles();
      luaFiles.push(...additionalLuaFiles);

      return luaFiles;
    } catch (error) {
      logger.error('Failed to find created Lua files', error as Error);
      return [];
    }
  }

  private async scanForAdditionalLuaFiles(): Promise<string[]> {
    try {
      const additionalFiles: string[] = [];
      
      // Scan common directories for additional Lua files
      const scanDirs = ['src/ao', 'src/contracts', 'src/utils'];
      
      for (const dir of scanDirs) {
        const dirPath = path.join(this.projectPath, dir);
        if (await fs.pathExists(dirPath)) {
          const entries = await fs.readdir(dirPath, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isFile() && entry.name.endsWith('.lua')) {
              const relativePath = path.join(dir, entry.name);
              // Only add if not already in our expected files
              if (!['src/ao/task-process.lua', 'src/ao/utils.lua'].includes(relativePath)) {
                additionalFiles.push(relativePath);
                logger.debug(`Found additional Lua file: ${relativePath}`);
              }
            }
          }
        }
      }

      return additionalFiles;
    } catch (error) {
      logger.error('Failed to scan for additional Lua files', error as Error);
      return [];
    }
  }

  private async createDefaultConfig(options: CreateProjectOptions): Promise<AOConfig> {
    return {
      luaFiles: [],
      packageManager: options.packageManager || 'npm',
      framework: options.framework || 'nextjs',
      processName: options.processName || 'ao-process',
      ports: {
        dev: options.port || 3000
      },
      aos: {
        version: '2.x',
        features: {
          coroutines: true,
          bootloader: false,
          weavedrive: false,
        },
      },
      runWithAO: options.runWithAO || false,
      tags: {
        'Environment': 'development'
      }
    };
  }

  private async ensureTailwindCSS(packageManager: string, framework: string): Promise<void> {
    try {
      logger.info('Installing Tailwind CSS...');
      
      if (framework === 'nuxtjs') {
        // Nuxt.js: use nuxi module add command
        await this.executeCommand('npx', ['nuxi@latest', 'module', 'add', 'tailwindcss'], { cwd: this.projectPath });
      } else if (framework === 'svelte') {
        // SvelteKit: use sv add command
        await this.executeCommand('npx', ['sv', 'add', 'tailwindcss'], { cwd: this.projectPath });
      } else {
        return;
      }

      logger.success('Tailwind CSS installed successfully');
    } catch (error) {
      logger.error('Failed to install Tailwind CSS', error as Error);
      throw error;
    }
  }
} 