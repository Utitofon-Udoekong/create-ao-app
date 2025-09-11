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
    it('should return true for empty directory', async () => {
      const fs = require('fs-extra');
      fs.stat = jest.fn().mockResolvedValue({ isDirectory: () => true });
      fs.readdir = jest.fn().mockResolvedValue([]);

      const result = await projectManager.validateDirectory('/test/dir');
      expect(result).toBe(true);
    });

    it('should return false for non-empty directory', async () => {
      const fs = require('fs-extra');
      fs.stat = jest.fn().mockResolvedValue({ isDirectory: () => true });
      fs.readdir = jest.fn().mockResolvedValue(['file1.txt']);

      const result = await projectManager.validateDirectory('/test/dir');
      expect(result).toBe(false);
    });

    it('should return false for non-existent directory', async () => {
      const fs = require('fs-extra');
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
      expect(fs.writeFile).toHaveBeenCalled();
      expect(fs.writeJSON).toHaveBeenCalled();
    });

    it('should throw error for non-empty directory', async () => {
      const fs = require('fs-extra');
      fs.stat = jest.fn().mockResolvedValue({ isDirectory: () => true });
      fs.readdir = jest.fn().mockResolvedValue(['existing-file.txt']);

      const options: CreateProjectOptions = {
        name: 'test-project',
        framework: 'nextjs',
        packageManager: 'npm'
      };

      await expect(projectManager.createProject(options)).rejects.toThrow(
        'Directory /test/project is not empty or does not exist'
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

      expect(mockSpawn).toHaveBeenCalledWith('npm run dev', [], {
        cwd: '/test/project',
        shell: true,
        stdio: ['inherit', 'pipe', 'pipe']
      });
      expect(result).toBeDefined();
    });

    it('should throw error for unsupported package manager', async () => {
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

      await expect(projectManager.startDevServer(config, false)).rejects.toThrow(
        'Unsupported package manager: unsupported'
      );
    });
  });

  describe('checkDependenciesInstalled', () => {
    it('should return true when dependencies are installed', async () => {
      const fs = require('fs-extra');
      fs.pathExists = jest.fn().mockResolvedValue(true);

      const result = await projectManager.checkDependenciesInstalled('npm');
      expect(result).toBe(true);
    });

    it('should return false when dependencies are not installed', async () => {
      const fs = require('fs-extra');
      fs.pathExists = jest.fn().mockResolvedValue(false);

      const result = await projectManager.checkDependenciesInstalled('npm');
      expect(result).toBe(false);
    });

    it('should return false for unsupported package manager', async () => {
      const result = await projectManager.checkDependenciesInstalled('unsupported');
      expect(result).toBe(false);
    });
  });

  describe('getProjectInfo', () => {
    it('should return project info when packageon exists', async () => {
      const mockPackageJson = {
        name: 'test-project',
        version: '1.0.0'
      };

      const fs = require('fs-extra');
      fs.pathExists = jest.fn().mockResolvedValue(true);
      fs.readJSON = jest.fn().mockResolvedValue(mockPackageJson);

      const result = await projectManager.getProjectInfo();
      expect(result).toEqual(mockPackageJson);
    });

    it('should return null when packageon does not exist', async () => {
      const fs = require('fs-extra');
      fs.pathExists = jest.fn().mockResolvedValue(false);

      const result = await projectManager.getProjectInfo();
      expect(result).toBeNull();
    });
  });

  describe('getProjectPath', () => {
    it('should return the project path', () => {
      const result = projectManager.getProjectPath();
      expect(result).toBe('/test/project');
    });
  });
}); 