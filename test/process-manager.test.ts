import fs from 'fs-extra';
import path from 'path';
import { ProjectManager } from '../src/project-manager';
import { execAsync } from '../src/utils';
import ora from 'ora';

jest.mock('fs-extra');
jest.mock('child_process');
jest.mock('ora');
jest.mock('../src/utils', () => ({
  execAsync: jest.fn()
}));

describe('ProjectManager', () => {
  let projectManager: ProjectManager;
  const mockTargetPath = '/mock/project/path';

  beforeEach(() => {
    projectManager = new ProjectManager();
    jest.clearAllMocks();
  });

  describe('cloneTemplate', () => {
    it('should clone template successfully', async () => {
      const mockSpinner = {
        start: jest.fn().mockReturnThis(),
        succeed: jest.fn().mockReturnThis(),
        fail: jest.fn().mockReturnThis()
      };
      (ora as jest.Mock).mockReturnValue(mockSpinner);
      (execAsync as jest.Mock).mockResolvedValue({ stdout: '', stderr: '' });
      (fs.remove as jest.Mock).mockResolvedValue(undefined);

      await projectManager.cloneTemplate('https://template.git', mockTargetPath);

      expect(execAsync).toHaveBeenCalledWith(`git clone https://template.git ${mockTargetPath}`);
      expect(fs.remove).toHaveBeenCalledWith(path.join(mockTargetPath, '.git'));
      expect(mockSpinner.succeed).toHaveBeenCalledWith('Template cloned successfully');
    });

    it('should handle clone failure', async () => {
      const mockSpinner = {
        start: jest.fn().mockReturnThis(),
        succeed: jest.fn().mockReturnThis(),
        fail: jest.fn().mockReturnThis()
      };
      (ora as jest.Mock).mockReturnValue(mockSpinner);
      (execAsync as jest.Mock).mockRejectedValue(new Error('Clone failed'));

      await expect(
        projectManager.cloneTemplate('https://template.git', mockTargetPath)
      ).rejects.toThrow('Clone failed');

      expect(mockSpinner.fail).toHaveBeenCalledWith('Failed to clone template');
    });
  });

  describe('initializeGit', () => {
    it('should initialize git repository', async () => {
      const mockSpinner = {
        start: jest.fn().mockReturnThis(),
        succeed: jest.fn().mockReturnThis(),
        fail: jest.fn().mockReturnThis()
      };
      (ora as jest.Mock).mockReturnValue(mockSpinner);
      (execAsync as jest.Mock).mockResolvedValue({ stdout: '', stderr: '' });

      await projectManager.initializeGit(mockTargetPath);

      expect(execAsync).toHaveBeenCalledWith('git init', { cwd: mockTargetPath });
      expect(execAsync).toHaveBeenCalledWith('git add .', { cwd: mockTargetPath });
      expect(execAsync).toHaveBeenCalledWith('git commit -m "Initial commit from AO CLI"', { cwd: mockTargetPath });
      expect(mockSpinner.succeed).toHaveBeenCalledWith('Git repository initialized');
    });

    it('should handle git initialization failure', async () => {
      const mockSpinner = {
        start: jest.fn().mockReturnThis(),
        succeed: jest.fn().mockReturnThis(),
        fail: jest.fn().mockReturnThis()
      };
      (ora as jest.Mock).mockReturnValue(mockSpinner);
      (execAsync as jest.Mock).mockRejectedValue(new Error('Git init failed'));

      await expect(
        projectManager.initializeGit(mockTargetPath)
      ).rejects.toThrow('Git init failed');

      expect(mockSpinner.fail).toHaveBeenCalledWith('Failed to initialize git repository');
    });
  });

  describe('installDependencies', () => {
    it('should install dependencies with pnpm', async () => {
      const mockSpinner = {
        start: jest.fn().mockReturnThis(),
        succeed: jest.fn().mockReturnThis(),
        fail: jest.fn().mockReturnThis()
      };
      (ora as jest.Mock).mockReturnValue(mockSpinner);
      (execAsync as jest.Mock).mockResolvedValue({ stdout: '', stderr: '' });

      await projectManager.installDependencies(mockTargetPath, 'pnpm');

      expect(execAsync).toHaveBeenCalledWith('pnpm install', { cwd: mockTargetPath });
      expect(mockSpinner.succeed).toHaveBeenCalledWith('Dependencies installed');
    });

    it('should handle dependency installation failure', async () => {
      const mockSpinner = {
        start: jest.fn().mockReturnThis(),
        succeed: jest.fn().mockReturnThis(),
        fail: jest.fn().mockReturnThis()
      };
      (ora as jest.Mock).mockReturnValue(mockSpinner);
      (execAsync as jest.Mock).mockRejectedValue(new Error('Install failed'));

      await expect(
        projectManager.installDependencies(mockTargetPath, 'pnpm')
      ).rejects.toThrow('Install failed');

      expect(mockSpinner.fail).toHaveBeenCalledWith('Failed to install dependencies');
    });
  });

  describe('validateDirectory', () => {
    it('should return true for empty directory', async () => {
      (fs.stat as unknown as jest.Mock).mockResolvedValue({ isDirectory: () => true });
      (fs.readdir as unknown as jest.Mock).mockResolvedValue([]);

      const result = await projectManager.validateDirectory(mockTargetPath);
      
      expect(result).toBeTruthy();
    });

    it('should return false for non-empty directory', async () => {
      (fs.stat as unknown as jest.Mock).mockResolvedValue({ isDirectory: () => true });
      (fs.readdir as unknown as jest.Mock).mockResolvedValue(['somefile.txt']);

      const result = await projectManager.validateDirectory(mockTargetPath);
      
      expect(result).toBeFalsy();
    });

    it('should return false for non-existent directory', async () => {
      (fs.stat as unknown as jest.Mock).mockRejectedValue(new Error('Not found'));

      const result = await projectManager.validateDirectory(mockTargetPath);
      
      expect(result).toBeFalsy();
    });
  });

  describe('promptForMissingOptions', () => {
    it('should prompt for missing framework', async () => {
      const mockInquirer = {
        prompt: jest.fn().mockResolvedValue({
          framework: 'nextjs',
          name: 'test-project',
          packageManager: 'pnpm',
          aosProcess: true
        })
      };

      const result = await projectManager.promptForMissingOptions(mockInquirer.prompt);

      expect(result).toEqual({
        framework: 'nextjs',
        name: 'test-project',
        packageManager: 'pnpm',
        aosProcess: true
      });
    });
  });
});