import { ProcessManager, Schedule } from '../../../../src/core/managers/process-manager';
import { AOConfig } from '../../../../src/types/aos';
import { logger } from '../../../../src/core/utils/logging';

// Mock dependencies
jest.mock('../../../../src/core/utils/logging');
jest.mock('fs-extra');
jest.mock('child_process');

describe('ProcessManager', () => {
  let processManager: ProcessManager;
  let mockConfig: AOConfig;

  beforeEach(() => {
    processManager = new ProcessManager();
    mockConfig = {
      luaFiles: ['test.lua'],
      packageManager: 'npm',
      framework: 'nextjs',
      processName: 'test-process',
      ports: { dev: 3000 },
      aos: {
        version: '2.x',
        features: {
          coroutines: true,
          bootloader: false,
          weavedrive: false,
        },
      },
      runWithAO: false,
      tags: { 'Environment': 'development' }
    };
  });

  describe('checkAOSInstallation', () => {
    it('should return true for AOS installation check', async () => {
      const result = await processManager.checkAOSInstallation();
      expect(result).toBe(true);
    });
  });

  describe('findLuaFiles', () => {
    it('should find Lua files in the target path', async () => {
      const mockFiles = ['test1.lua', 'test2.lua'];
      const mockReaddir = jest.fn().mockResolvedValue([
        { name: 'test1.lua', isFile: () => true, isDirectory: () => false },
        { name: 'test2.lua', isFile: () => true, isDirectory: () => false },
        { name: 'test.txt', isFile: () => true, isDirectory: () => false }
      ]);

      const fs = require('fs-extra');
      fs.readdir = mockReaddir;
      fs.pathExists = jest.fn().mockResolvedValue(true);

      const result = await processManager.findLuaFiles('/test/path');
      expect(result).toEqual(mockFiles);
    });
  });

  describe('startAOProcess', () => {
    it('should start an AO process with correct arguments', async () => {
      const mockSpawn = jest.fn().mockReturnValue({
        pid: 12345,
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn()
      });

      const { spawn } = require('child_process');
      spawn.mockImplementation(mockSpawn);

      const result = await processManager.startAOProcess('/test/path', mockConfig);
      
      expect(mockSpawn).toHaveBeenCalledWith('aos', expect.arrayContaining(['test-process']), {
        cwd: '/test/path',
        stdio: 'inherit'
      });
      expect(result).toBeDefined();
    });
  });

  describe('stopProcess', () => {
    it('should stop a running process', async () => {
      const mockKill = jest.fn();
      const mockProcess = {
        kill: mockKill,
        killed: false
      };

      // Mock the process property
      (processManager as any).process = mockProcess;

      await processManager.stopProcess();
      
      expect(mockKill).toHaveBeenCalled();
    });
  });

  describe('isProcessRunning', () => {
    it('should return true when process is running', () => {
      const mockProcess = { killed: false };
      (processManager as any).process = mockProcess;

      const result = processManager.isProcessRunning();
      expect(result).toBe(true);
    });

    it('should return false when no process is running', () => {
      (processManager as any).process = null;

      const result = processManager.isProcessRunning();
      expect(result).toBe(false);
    });
  });

  describe('getProcessState', () => {
    it('should return process state when available', () => {
      const mockState = { id: 'test', status: 'running' };
      (processManager as any).processState = mockState;

      const result = processManager.getProcessState();
      expect(result).toBe(mockState);
    });

    it('should return null when no process state', () => {
      (processManager as any).processState = null;

      const result = processManager.getProcessState();
      expect(result).toBeNull();
    });
  });
});

describe('Schedule', () => {
  let schedule: Schedule;
  let mockProcessManager: ProcessManager;

  beforeEach(() => {
    mockProcessManager = new ProcessManager();
    schedule = new Schedule('test-process', { interval: 1000 }, mockProcessManager);
  });

  describe('start', () => {
    it('should start the scheduler', async () => {
      jest.spyOn(mockProcessManager, 'evaluateProcess').mockResolvedValue();

      await schedule.start();
      
      expect(schedule.isRunning()).toBe(true);
    });

    it('should throw error if already running', async () => {
      jest.spyOn(mockProcessManager, 'evaluateProcess').mockResolvedValue();

      await schedule.start();
      
      await expect(schedule.start()).rejects.toThrow('Scheduler already running');
    });
  });

  describe('stop', () => {
    it('should stop the scheduler', async () => {
      jest.spyOn(mockProcessManager, 'evaluateProcess').mockResolvedValue();

      await schedule.start();
      await schedule.stop();
      
      expect(schedule.isRunning()).toBe(false);
    });
  });

  describe('isRunning', () => {
    it('should return true when scheduler is running', async () => {
      jest.spyOn(mockProcessManager, 'evaluateProcess').mockResolvedValue();

      await schedule.start();
      expect(schedule.isRunning()).toBe(true);
    });

    it('should return false when scheduler is not running', () => {
      expect(schedule.isRunning()).toBe(false);
    });
  });
}); 