import { ProjectManager } from '../../../../src/core/managers/project-manager';
import { CreateProjectOptions } from '../../../../src/types/aos';
import { logger } from '../../../../src/core/utils/logging';

// Mock dependencies
jest.mock('../../../../src/core/utils/logging');
jest.mock('../../../../src/core/managers/config-manager');
jest.mock('fs-extra');
jest.mock('child_process');
jest.mock('open');

describe('ProjectManager', () => {
  let projectManager: ProjectManager;
  let mockConfigManager: any;

  beforeEach(() => {
    mockConfigManager = {
      saveConfig: jest.fn().mockResolvedValue(undefined),
      loadConfig: jest.fn().mockResolvedValue({
        packageManager: 'npm',
        ports: { dev: 3000 }
      })
    };

    const { ConfigManager } = require('../../../../src/core/managers/config-manager');
    ConfigManager.mockImplementation(() => mockConfigManager);

    projectManager = new ProjectManager('/test/project');
  });

  describe('validateDirectory', () => {
    it('should return true for existing directory', async () => {
      const fs = require('fs-extra');
      fs.pathExists = jest.fn().mockResolvedValue(true);
      fs.stat = jest.fn().mockResolvedValue({ isDirectory: () => true });

      const result = await projectManager.validateDirectory('/test/dir');
      expect(result).toBe(true);
    });

    it('should return false for non-existent directory', async () => {
      const fs = require('fs-extra');
      fs.pathExists = jest.fn().mockResolvedValue(false);

      const result = await projectManager.validateDirectory('/test/dir');
      expect(result).toBe(false);
    });

    it('should return false when stat fails', async () => {
      const fs = require('fs-extra');
      fs.pathExists = jest.fn().mockResolvedValue(true);
      fs.stat = jest.fn().mockRejectedValue(new Error('ENOENT'));

      const result = await projectManager.validateDirectory('/test/dir');
      expect(result).toBe(false);
    });
  });

  describe('createProject', () => {
    it('should create a project successfully', async () => {
      const fs = require('fs-extra');
      fs.stat = jest.fn().mockResolvedValue({ isDirectory: () => true });
      fs.readdir = jest.fn().mockResolvedValue([]);
      fs.ensureDir = jest.fn().mockResolvedValue(undefined);
      fs.writeFile = jest.fn().mockResolvedValue(undefined);
      fs.writeJSON = jest.fn().mockResolvedValue(undefined);
      fs.readJSON = jest.fn().mockResolvedValue({ name: 'template-project' });
      fs.pathExists = jest.fn().mockImplementation((path: string) => {
        if (path.includes('package.json')) {
          return Promise.resolve(true);
        }
        return Promise.resolve(false); // Directory doesn't exist initially
      });

      // Mock child process for executeCommand
      const mockChild: any = {
        on: jest.fn((event: string, callback: Function) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 0); // Simulate successful exit
          }
          return mockChild;
        })
      };

      const { spawn } = require('child_process');
      spawn.mockReturnValue(mockChild);

      const options: CreateProjectOptions = {
        name: 'test-project',
        framework: 'nextjs',
        packageManager: 'npm',
        port: 3000,
        processName: 'test-process',
        runWithAO: false,
        initializeGit: false
      };

      await projectManager.createProject(options);

      expect(mockConfigManager.saveConfig).toHaveBeenCalled();
      expect(fs.ensureDir).toHaveBeenCalled();
    });

    it('should throw error for non-empty directory', async () => {
      const fs = require('fs-extra');
      fs.stat = jest.fn().mockResolvedValue({ isDirectory: () => true });
      fs.readdir = jest.fn().mockResolvedValue(['existing-file.txt']);
      fs.pathExists = jest.fn().mockResolvedValue(true); // Directory exists
      fs.ensureDir = jest.fn().mockResolvedValue(undefined);
      fs.writeFile = jest.fn().mockResolvedValue(undefined);
      fs.writeJSON = jest.fn().mockResolvedValue(undefined);

      const options: CreateProjectOptions = {
        name: 'test-project',
        framework: 'nextjs',
        packageManager: 'npm'
      };

      await expect(projectManager.createProject(options)).rejects.toThrow(
        'Directory /test/project is not empty. Please choose a different location or remove existing files.'
      );
    });
  });

  describe('startDevServer', () => {
    it('should start development server successfully', async () => {
      const mockSpawn = jest.fn().mockReturnValue({
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
        kill: jest.fn()
      });

      const { spawn } = require('child_process');
      spawn.mockImplementation(mockSpawn);

      const fs = require('fs-extra');
      fs.pathExists = jest.fn().mockResolvedValue(true);

      const config = {
        luaFiles: [],
        packageManager: 'npm' as const,
        framework: 'nextjs' as const,
        processName: 'test-process',
        ports: { dev: 3000 },
        aos: {
          version: '1.x' as const,
          features: {
            coroutines: false,
            bootloader: false,
            weavedrive: false
          }
        },
        runWithAO: false,
        tags: {}
      };

      const result = await projectManager.startDevServer(config, false);

      expect(mockSpawn).toHaveBeenCalledWith('npm', ['run', 'dev'], {
        cwd: '/test/project',
        shell: true,
        stdio: 'inherit'
      });
      expect(result).toBeDefined();
    });

    it('should use default command for unsupported package manager', async () => {
      const mockSpawn = jest.fn().mockReturnValue({
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
        kill: jest.fn()
      });

      const { spawn } = require('child_process');
      spawn.mockImplementation(mockSpawn);

      const config = {
        luaFiles: [],
        packageManager: 'unsupported' as any,
        framework: 'nextjs' as const,
        processName: 'test-process',
        ports: { dev: 3000 },
        aos: {
          version: '1.x' as const,
          features: {
            coroutines: false,
            bootloader: false,
            weavedrive: false
          }
        },
        runWithAO: false,
        tags: {}
      };

      const result = await projectManager.startDevServer(config, false);

      expect(mockSpawn).toHaveBeenCalledWith('unsupported', ['run', 'dev'], {
        cwd: '/test/project',
        shell: true,
        stdio: 'inherit'
      });
      expect(result).toBeDefined();
    });
  });

  // Note: checkDependenciesInstalled method was removed in the streamlined project manager

  // Note: getProjectInfo method was removed in the streamlined project manager

  // Note: getProjectPath method was removed in the streamlined project manager
}); 