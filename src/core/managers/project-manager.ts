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

// Fallback template creation for when cloning fails
const FALLBACK_TEMPLATES = {
  nextjs: {
    createCommand: 'npx',
    createArgs: ['create-next-app@latest', '.', '--typescript', '--tailwind', '--eslint', '--app', '--src-dir', '--import-alias', '@/*', '--yes']
  },
  nuxtjs: {
    createCommand: 'npx',
    createArgs: ['nuxi@latest', 'init', '.', '--yes', '-f', '--gitInit', 'no']
  },
  svelte: {
    createCommand: 'npx',
    createArgs: ['sv', 'create', '.', '--typescript', '--prettier', '--eslint', '--yes']
  }
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
      const fallbackTemplate = FALLBACK_TEMPLATES[template as keyof typeof FALLBACK_TEMPLATES];
      
      if (!fallbackTemplate) {
        throw new Error(`Unsupported template: ${template}`);
      }

      // Use framework's official create command with package manager
      let createArgs = [...fallbackTemplate.createArgs];
      
      // Add package manager flag for frameworks that support it
      if (template === 'nuxtjs') {
        createArgs = ['nuxi@latest', 'init', '.', '-f', '--yes', '--package-manager', packageManager, '--gitInit', 'no'];
      } else if (template === 'svelte') {
        createArgs = ['sv', 'create', '.', '--no-add-ons', '--install', packageManager, '--types', 'ts'];
      }
      // Next.js already has --yes flag

      await this.executeCommand(fallbackTemplate.createCommand, createArgs, {
        cwd: targetPath
      });

      logger.success(`${template} project created successfully`);
    } catch (error) {
      logger.error('Failed to create template', error as Error);
      throw error;
    }
  }

  private async ensureTailwindCSS(framework: string, packageManager: string = 'pnpm'): Promise<void> {
    try {
      if (framework === 'nuxtjs') {
        logger.info('Installing Tailwind CSS for Nuxt.js...');
        
        // Use official Nuxt Tailwind module
        await this.executeCommand('npx', ['nuxi@latest', 'module', 'add', 'tailwindcss'], {
          cwd: this.projectPath
        });
        
        logger.success('Tailwind CSS installed for Nuxt.js using official module');
        
      } else if (framework === 'svelte') {
        logger.info('Installing Tailwind CSS for SvelteKit...');
        
        // Install official Tailwind CSS Vite plugin for SvelteKit
        await this.executeCommand(packageManager, ['install', 'tailwindcss', '@tailwindcss/vite'], {
          cwd: this.projectPath
        });
        
        // Update Vite config to include Tailwind plugin
        const viteConfigPath = path.join(this.projectPath, 'vite.config.ts');
        if (await fs.pathExists(viteConfigPath)) {
          let viteConfig = await fs.readFile(viteConfigPath, 'utf-8');
          
          // Add Tailwind import and plugin
          if (!viteConfig.includes('@tailwindcss/vite')) {
            viteConfig = viteConfig.replace(
              "import { sveltekit } from '@sveltejs/kit/vite';",
              `import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';`
            );
            
            viteConfig = viteConfig.replace(
              "plugins: [sveltekit()]",
              `plugins: [
    tailwindcss(),
    sveltekit(),
  ]`
            );
          }
          
          await fs.writeFile(viteConfigPath, viteConfig);
        }
        
        // Create app.css with Tailwind import
        const appCssPath = path.join(this.projectPath, 'src', 'app.css');
        const appCss = `@import "tailwindcss";`;
        await fs.writeFile(appCssPath, appCss);
        
        // Create or update +layout.svelte to import CSS
        const layoutPath = path.join(this.projectPath, 'src', 'routes', '+layout.svelte');
        const layoutContent = `<script>
  let { children } = $props();
  import "../app.css";
</script>

{@render children()}`;
        
        await fs.writeFile(layoutPath, layoutContent);
        
        logger.success('Tailwind CSS installed for SvelteKit using official Vite plugin');
      }
    } catch (error) {
      logger.warn('Failed to install Tailwind CSS, continuing without it', error as Error);
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
        shell: true,
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

      // Install Tailwind CSS for frameworks that need it
      await this.ensureTailwindCSS(options.framework, options.packageManager);

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
        
        packageJson.scripts = {
          ...packageJson.scripts,
          'dev': 'forge dev',
          'build': 'forge build',
          'deploy': 'forge deploy',
          'test': 'forge test'
        };

        // Add AO-related keywords
        if (!packageJson.keywords) {
          packageJson.keywords = [];
        }
        packageJson.keywords.push('ao', 'arweave', 'forge');

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
2. Use \`forge dev\` to start development with AO integration
3. Use \`forge build\` to build your processes
4. Use \`forge deploy\` to deploy to Arweave

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
    await fs.ensureDir(path.join(this.projectPath, 'lib'));
    await fs.ensureDir(path.join(this.projectPath, 'components'));
    await fs.ensureDir(path.join(this.projectPath, 'app'));
    
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
          className="bg-blue-500 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded transition-colors"
        >
          {connecting ? 'Connecting...' : 'Connect Arweave Wallet'}
        </button>
      ) : (
        <div className="text-green-600 font-semibold">
          ✅ Wallet Connected!
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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="task-list">
      <h2 className="text-2xl font-bold mb-4">Your Tasks</h2>
      {loading ? (
        <div className="text-center py-4">Loading tasks...</div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No tasks yet. Create your first task!
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <div 
              key={task.id} 
              className={\`p-4 border rounded-lg shadow-sm \${task.completed ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}\`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={\`text-sm font-medium \${getPriorityColor(task.priority)}\`}>
                      {task.priority.toUpperCase()}
                    </span>
                    {task.completed && (
                      <span className="text-green-600 text-sm">✓ Completed</span>
                    )}
                  </div>
                  <h3 className={\`font-semibold \${task.completed ? 'line-through text-gray-500' : ''}\`}>
                    {task.title}
                  </h3>
                  {task.description && (
                    <p className={\`text-sm mt-1 \${task.completed ? 'text-gray-400' : 'text-gray-600'}\`}>
                      {task.description}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-2">
                    Created: {new Date(task.created * 1000).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2 ml-4">
                  {!task.completed && (
                    <button
                      onClick={() => completeTask(task.id)}
                      className="bg-green-500 hover:bg-green-700 text-white px-3 py-1 rounded text-sm transition-colors"
                    >
                      Complete
                    </button>
                  )}
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="bg-red-500 hover:bg-red-700 text-white px-3 py-1 rounded text-sm transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
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

  return (
    <div className="create-task bg-white p-6 rounded-lg shadow-sm border">
      <h2 className="text-xl font-bold mb-4">Create New Task</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
            Task Title *
          </label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter task title"
            required
          />
        </div>
        
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter task description"
            rows={3}
          />
        </div>
        
        <div>
          <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-1">
            Priority
          </label>
          <select
            id="priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as 'high' | 'medium' | 'low')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        
        <button
          type="submit"
          disabled={loading || !title.trim()}
          className="w-full bg-blue-500 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded transition-colors"
        >
          {loading ? 'Creating...' : 'Create Task'}
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
    <div className="points-display bg-gradient-to-r from-purple-500 to-pink-500 text-white p-4 rounded-lg">
      <h3 className="text-lg font-semibold mb-2">Your Points</h3>
      {loading ? (
        <div className="text-center">Loading...</div>
      ) : (
        <div className="text-3xl font-bold">{points}</div>
      )}
      <p className="text-sm opacity-90 mt-1">
        Earn points by creating (+10) and completing (+25) tasks!
      </p>
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
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            🎯 TaskMaster
          </h1>
          <p className="text-lg text-gray-600">
            Decentralized task management powered by AO and Arweave
          </p>
        </header>

        <div className="max-w-4xl mx-auto">
          {/* Wallet Connection */}
          <div className="bg-white p-6 rounded-lg shadow-sm border mb-6">
            <h2 className="text-xl font-bold mb-4">Connect Your Wallet</h2>
            <WalletConnect onConnect={handleWalletConnect} />
          </div>

          {/* Process ID Input */}
          {wallet && (
            <div className="bg-white p-6 rounded-lg shadow-sm border mb-6">
              <h2 className="text-xl font-bold mb-4">AO Process Configuration</h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="processId" className="block text-sm font-medium text-gray-700 mb-1">
                    Process ID
                  </label>
                  <input
                    type="text"
                    id="processId"
                    value={processId}
                    onChange={(e) => setProcessId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter your AO process ID"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Deploy the TaskMaster process and enter the process ID here
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Main Content */}
          {aoClient && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - Create Task & Points */}
              <div className="lg:col-span-1 space-y-6">
                <PointsDisplay aoClient={aoClient} />
                <CreateTask aoClient={aoClient} onTaskCreated={handleTaskCreated} />
              </div>
              
              {/* Right Column - Task List */}
              <div className="lg:col-span-2">
                <TaskList aoClient={aoClient} />
              </div>
            </div>
          )}

          {/* Instructions */}
          {!aoClient && wallet && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-2">
                Getting Started
              </h3>
              <ol className="list-decimal list-inside space-y-2 text-blue-800">
                <li>Deploy the TaskMaster AO process using the aos CLI</li>
                <li>Enter the process ID in the field above</li>
                <li>Start creating and managing your tasks!</li>
              </ol>
              <div className="mt-4 p-4 bg-blue-100 rounded">
                <p className="text-sm text-blue-800">
                  <strong>Quick Deploy:</strong> Run <code className="bg-blue-200 px-1 rounded">aos taskmaster</code> then <code className="bg-blue-200 px-1 rounded">.load src/ao/task-process.lua</code> and <code className="bg-blue-200 px-1 rounded">.spawn</code>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}`;

    await fs.writeFile(path.join(this.projectPath, 'app/page.tsx'), mainPageContent);
  }

  private async createNuxtJSFiles(): Promise<void> {
    // Ensure directories exist
    await fs.ensureDir(path.join(this.projectPath, 'lib'));
    await fs.ensureDir(path.join(this.projectPath, 'components'));
    await fs.ensureDir(path.join(this.projectPath, 'app'));
    
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

    await fs.writeFile(path.join(this.projectPath, 'lib/aoconnect.ts'), aoConnectContent);

    // Create components/WalletConnect.vue
    const walletConnectVue = `<template>
  <div class="wallet-connect">
    <button 
      v-if="!connected"
      @click="connectWallet"
      :disabled="connecting"
      class="bg-blue-500 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded transition-colors"
    >
      {{ connecting ? 'Connecting...' : 'Connect Arweave Wallet' }}
    </button>
    <div v-else class="text-green-600 font-semibold">
      ✅ Wallet Connected!
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

    await fs.writeFile(path.join(this.projectPath, 'components/WalletConnect.vue'), walletConnectVue);

    // Create app/index.vue (Nuxt 4 structure)
    const mainPageVue = `<template>
  <div class="min-h-screen bg-gray-50">
    <div class="container mx-auto px-4 py-8">
      <header class="text-center mb-8">
        <h1 class="text-4xl font-bold text-gray-900 mb-2">
          🎯 TaskMaster
        </h1>
        <p class="text-lg text-gray-600">
          Decentralized task management powered by AO and Arweave
        </p>
      </header>

      <div class="max-w-4xl mx-auto">
        <!-- Wallet Connection -->
        <div class="bg-white p-6 rounded-lg shadow-sm border mb-6">
          <h2 class="text-xl font-bold mb-4">Connect Your Wallet</h2>
          <WalletConnect @connect="handleWalletConnect" />
        </div>

        <!-- Process ID Input -->
        <div v-if="wallet" class="bg-white p-6 rounded-lg shadow-sm border mb-6">
          <h2 class="text-xl font-bold mb-4">AO Process Configuration</h2>
          <div class="space-y-4">
            <div>
              <label for="processId" class="block text-sm font-medium text-gray-700 mb-1">
                Process ID
              </label>
              <input
                type="text"
                id="processId"
                v-model="processId"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your AO process ID"
              />
              <p class="text-sm text-gray-500 mt-1">
                Deploy the TaskMaster process and enter the process ID here
              </p>
            </div>
          </div>
        </div>

        <!-- Main Content -->
        <div v-if="aoClient" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- Left Column - Create Task & Points -->
          <div class="lg:col-span-1 space-y-6">
            <PointsDisplay :ao-client="aoClient" />
            <CreateTask :ao-client="aoClient" @task-created="handleTaskCreated" />
          </div>
          
          <!-- Right Column - Task List -->
          <div class="lg:col-span-2">
            <TaskList :ao-client="aoClient" />
          </div>
        </div>

        <!-- Instructions -->
        <div v-if="!aoClient && wallet" class="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 class="text-lg font-semibold text-blue-900 mb-2">
            Getting Started
          </h3>
          <ol class="list-decimal list-inside space-y-2 text-blue-800">
            <li>Deploy the TaskMaster AO process using the aos CLI</li>
            <li>Enter the process ID in the field above</li>
            <li>Start creating and managing your tasks!</li>
          </ol>
          <div class="mt-4 p-4 bg-blue-100 rounded">
            <p class="text-sm text-blue-800">
              <strong>Quick Deploy:</strong> Run <code class="bg-blue-200 px-1 rounded">aos taskmaster</code> then <code class="bg-blue-200 px-1 rounded">.load src/ao/task-process.lua</code> and <code class="bg-blue-200 px-1 rounded">.spawn</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { AOClient } from '../lib/aoconnect';

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

    await fs.writeFile(path.join(this.projectPath, 'app/index.vue'), mainPageVue);
  }

  private async createSvelteFiles(): Promise<void> {
    // Ensure directories exist
    await fs.ensureDir(path.join(this.projectPath, 'src/lib'));
    await fs.ensureDir(path.join(this.projectPath, 'src/lib/components'));
    await fs.ensureDir(path.join(this.projectPath, 'src/routes'));
    
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
  
  let wallet: any = null;
  let aoClient: AOClient | null = null;
  let processId = '';
  let connected = false;
  let connecting = false;

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

<div class="min-h-screen bg-gray-50">
  <div class="container mx-auto px-4 py-8">
    <header class="text-center mb-8">
      <h1 class="text-4xl font-bold text-gray-900 mb-2">
        🎯 TaskMaster
      </h1>
      <p class="text-lg text-gray-600">
        Decentralized task management powered by AO and Arweave
      </p>
    </header>

    <div class="max-w-4xl mx-auto">
      <!-- Wallet Connection -->
      <div class="bg-white p-6 rounded-lg shadow-sm border mb-6">
        <h2 class="text-xl font-bold mb-4">Connect Your Wallet</h2>
        <div class="wallet-connect">
          {#if !connected}
            <button 
              on:click={connectWallet}
              disabled={connecting}
              class="bg-blue-500 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded transition-colors"
            >
              {connecting ? 'Connecting...' : 'Connect Arweave Wallet'}
            </button>
          {:else}
            <div class="text-green-600 font-semibold">
              ✅ Wallet Connected!
            </div>
          {/if}
        </div>
      </div>

      <!-- Process ID Input -->
      {#if wallet}
        <div class="bg-white p-6 rounded-lg shadow-sm border mb-6">
          <h2 class="text-xl font-bold mb-4">AO Process Configuration</h2>
          <div class="space-y-4">
            <div>
              <label for="processId" class="block text-sm font-medium text-gray-700 mb-1">
                Process ID
              </label>
              <input
                type="text"
                id="processId"
                bind:value={processId}
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your AO process ID"
              />
              <p class="text-sm text-gray-500 mt-1">
                Deploy the TaskMaster process and enter the process ID here
              </p>
            </div>
          </div>
        </div>
      {/if}

      <!-- Instructions -->
      {#if !aoClient && wallet}
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 class="text-lg font-semibold text-blue-900 mb-2">
            Getting Started
          </h3>
          <ol class="list-decimal list-inside space-y-2 text-blue-800">
            <li>Deploy the TaskMaster AO process using the aos CLI</li>
            <li>Enter the process ID in the field above</li>
            <li>Start creating and managing your tasks!</li>
          </ol>
          <div class="mt-4 p-4 bg-blue-100 rounded">
            <p class="text-sm text-blue-800">
              <strong>Quick Deploy:</strong> Run <code class="bg-blue-200 px-1 rounded">aos taskmaster</code> then <code class="bg-blue-200 px-1 rounded">.load src/ao/task-process.lua</code> and <code class="bg-blue-200 px-1 rounded">.spawn</code>
            </p>
          </div>
        </div>
      {/if}

      <!-- Main Content -->
      {#if aoClient}
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- Left Column - Create Task & Points -->
          <div class="lg:col-span-1 space-y-6">
            <div class="points-display bg-gradient-to-r from-purple-500 to-pink-500 text-white p-4 rounded-lg">
              <h3 class="text-lg font-semibold mb-2">Your Points</h3>
              <div class="text-3xl font-bold">0</div>
              <p class="text-sm opacity-90 mt-1">
                Earn points by creating (+10) and completing (+25) tasks!
              </p>
            </div>
            
            <div class="create-task bg-white p-6 rounded-lg shadow-sm border">
              <h2 class="text-xl font-bold mb-4">Create New Task</h2>
              <p class="text-gray-600">Task creation component will be implemented here</p>
            </div>
          </div>
          
          <!-- Right Column - Task List -->
          <div class="lg:col-span-2">
            <div class="task-list bg-white p-6 rounded-lg shadow-sm border">
              <h2 class="text-2xl font-bold mb-4">Your Tasks</h2>
              <p class="text-gray-600">Task list component will be implemented here</p>
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>`;

    await fs.writeFile(path.join(this.projectPath, 'src/routes/+page.svelte'), mainPageSvelte);
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
├── src/
│   ├── ao/                    # AO process files
│   │   ├── task-process.lua   # Main TaskMaster AO process
│   │   ├── utils.lua          # Shared AO utilities
│   │   └── README.md          # AO documentation
│   ├── lib/
│   │   └── aoconnect.ts       # AO client library
│   ├── components/            # UI components (framework-specific)
│   └── [framework files]      # Framework-specific pages/routes
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
- [Forge CLI](https://github.com/your-org/forge) - AO development toolkit

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
      const devCommand = {
        'npm': 'npm run dev',
        'yarn': 'yarn run dev',
        'pnpm': 'pnpm run dev'
      }[pm];

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
} 