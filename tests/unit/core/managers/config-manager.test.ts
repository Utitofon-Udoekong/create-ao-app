import { ConfigManager, DEFAULT_CONFIG } from '../../../../src/core/managers/config-manager';
import { AOConfig } from '../../../../src/types/aos';
import { logger } from '../../../../src/core/utils/logging';

// Mock dependencies
jest.mock('../../../../src/core/utils/logging');
jest.mock('../../../../src/core/utils/validation');
jest.mock('fs-extra');
jest.mock('js-yaml');

describe('ConfigManager', () => {
  let configManager: ConfigManager;
  let mockValidator: any;

  beforeEach(() => {
    mockValidator = {
      validateConfig: jest.fn((config) => config)
    };

    const { Validator } = require('../../../../src/core/utils/validation');
    Validator.validateConfig = mockValidator.validateConfig;

    configManager = new ConfigManager('/test/project');
  });

  describe('loadConfig', () => {
    it('should load existing config file', async () => {
      const mockConfig = {
        processName: 'test-process',
        packageManager: 'npm'
      };

      const fs = require('fs-extra');
      fs.pathExists = jest.fn().mockResolvedValue(true);
      fs.readFile = jest.fn().mockResolvedValue('processName: test-process');

      const yaml = require('js-yaml');
      yaml.load = jest.fn().mockReturnValue(mockConfig);

      const result = await configManager.loadConfig();

      expect(fs.pathExists).toHaveBeenCalledWith('/test/project/ao.config.yml');
      expect(fs.readFile).toHaveBeenCalledWith('/test/project/ao.config.yml', 'utf8');
      expect(yaml.load).toHaveBeenCalled();
      expect(mockValidator.validateConfig).toHaveBeenCalled();
      // Should include all default fields merged with mockConfig
      expect(result).toEqual(expect.objectContaining({
        ...DEFAULT_CONFIG,
        ...mockConfig
      }));
    });

    it('should return default config when file does not exist', async () => {
      const fs = require('fs-extra');
      fs.pathExists = jest.fn().mockResolvedValue(false);

      const result = await configManager.loadConfig();

      expect(result).toEqual(DEFAULT_CONFIG);
    });

    it('should merge with default config', async () => {
      const mockConfig = {
        processName: 'custom-process'
      };

      const fs = require('fs-extra');
      fs.pathExists = jest.fn().mockResolvedValue(true);
      fs.readFile = jest.fn().mockResolvedValue('processName: custom-process');

      const yaml = require('js-yaml');
      yaml.load = jest.fn().mockReturnValue(mockConfig);

      const result = await configManager.loadConfig();

      expect(result).toEqual(expect.objectContaining({
        ...DEFAULT_CONFIG,
        ...mockConfig
      }));
    });
  });

  describe('saveConfig', () => {
    it('should save config to file', async () => {
      const mockConfig: AOConfig = {
        luaFiles: [],
        processName: 'test-process',
        packageManager: 'npm',
        framework: 'nextjs',
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

      const fs = require('fs-extra');
      fs.writeFile = jest.fn().mockResolvedValue(undefined);

      const yaml = require('js-yaml');
      yaml.dump = jest.fn().mockReturnValue('processName: test-process');

      await configManager.saveConfig(mockConfig);

      expect(mockValidator.validateConfig).toHaveBeenCalledWith(mockConfig);
      expect(yaml.dump).toHaveBeenCalledWith(mockConfig);
      expect(fs.writeFile).toHaveBeenCalledWith('/test/project/ao.config.yml', 'processName: test-process', 'utf8');
    });
  });

  describe('updateConfig', () => {
    it('should update existing config', async () => {
      const existingConfig = {
        luaFiles: [],
        processName: 'old-process',
        packageManager: 'npm',
        framework: 'nextjs',
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

      const updates = {
        processName: 'new-process'
      };

      const fs = require('fs-extra');
      fs.pathExists = jest.fn().mockResolvedValue(true);
      fs.readFile = jest.fn().mockResolvedValue('processName: old-process');
      fs.writeFile = jest.fn().mockResolvedValue(undefined);

      const yaml = require('js-yaml');
      yaml.load = jest.fn().mockReturnValue(existingConfig);
      yaml.dump = jest.fn().mockReturnValue('processName: new-process');

      const result = await configManager.updateConfig(updates);

      expect(result).toEqual(expect.objectContaining({
        ...existingConfig,
        ...updates
      }));
    });
  });

  describe('getConfigValue', () => {
    it('should get nested config value', async () => {
      const mockConfig = {
        ports: { dev: 3000 }
      };

      const fs = require('fs-extra');
      fs.pathExists = jest.fn().mockResolvedValue(true);
      fs.readFile = jest.fn().mockResolvedValue('ports:\n  dev: 3000');

      const yaml = require('js-yaml');
      yaml.load = jest.fn().mockReturnValue(mockConfig);

      const result = await configManager.getConfigValue('ports.dev');

      expect(result).toBe(3000);
    });

    it('should return undefined for non-existent key', async () => {
      const fs = require('fs-extra');
      fs.pathExists = jest.fn().mockResolvedValue(true);
      fs.readFile = jest.fn().mockResolvedValue('processName: test');

      const yaml = require('js-yaml');
      yaml.load = jest.fn().mockReturnValue({ processName: 'test' });

      const result = await configManager.getConfigValue('nonexistent.key');

      expect(result).toBeUndefined();
    });
  });

  describe('setConfigValue', () => {
    it('should set nested config value', async () => {
      const fs = require('fs-extra');
      fs.pathExists = jest.fn().mockResolvedValue(true);
      fs.readFile = jest.fn().mockResolvedValue('processName: test');
      fs.writeFile = jest.fn().mockResolvedValue(undefined);

      const yaml = require('js-yaml');
      yaml.load = jest.fn().mockReturnValue({ processName: 'test' });
      yaml.dump = jest.fn().mockReturnValue('processName: test\nports:\n  dev: 8080');

      await configManager.setConfigValue('ports.dev', 8080);

      expect(fs.writeFile).toHaveBeenCalled();
    });
  });

  describe('configExists', () => {
    it('should return true when config file exists', async () => {
      const fs = require('fs-extra');
      fs.pathExists = jest.fn().mockResolvedValue(true);

      const result = await configManager.configExists();
      expect(result).toBe(true);
    });

    it('should return false when config file does not exist', async () => {
      const fs = require('fs-extra');
      fs.pathExists = jest.fn().mockResolvedValue(false);

      const result = await configManager.configExists();
      expect(result).toBe(false);
    });
  });

  describe('createDefaultConfig', () => {
    it('should create default config file', async () => {
      const fs = require('fs-extra');
      fs.writeFile = jest.fn().mockResolvedValue(undefined);

      const yaml = require('js-yaml');
      yaml.dump = jest.fn().mockReturnValue('default config yaml');

      const result = await configManager.createDefaultConfig();

      expect(fs.writeFile).toHaveBeenCalledWith('/test/project/ao.config.yml', 'default config yaml', 'utf8');
      expect(result).toEqual(DEFAULT_CONFIG);
    });
  });

  describe('validateConfigFile', () => {
    it('should return true for valid config', async () => {
      const fs = require('fs-extra');
      fs.pathExists = jest.fn().mockResolvedValue(true);
      fs.readFile = jest.fn().mockResolvedValue('valid config');

      const yaml = require('js-yaml');
      yaml.load = jest.fn().mockReturnValue({});

      const result = await configManager.validateConfigFile();
      expect(result).toBe(true);
    });

    it('should return false for invalid config', async () => {
      const fs = require('fs-extra');
      fs.pathExists = jest.fn().mockResolvedValue(true);
      fs.readFile = jest.fn().mockResolvedValue('invalid config');

      const yaml = require('js-yaml');
      yaml.load = jest.fn().mockReturnValue({ invalid: 'config' });

      // Mock validator to throw error
      const mockValidator = require('../../../../src/core/utils/validation');
      mockValidator.Validator.validateConfig = jest.fn(() => { throw new Error('Invalid config'); });

      const result = await configManager.validateConfigFile();
      expect(result).toBe(false);
    });
  });

  describe('backupConfig', () => {
    it('should create backup of config file', async () => {
      const fs = require('fs-extra');
      fs.copy = jest.fn().mockResolvedValue(undefined);

      const result = await configManager.backupConfig();

      expect(fs.copy).toHaveBeenCalled();
      expect(result).toMatch(/\.backup\.\d+$/);
    });
  });

  describe('restoreConfig', () => {
    it('should restore config from backup', async () => {
      const fs = require('fs-extra');
      fs.copy = jest.fn().mockResolvedValue(undefined);

      await configManager.restoreConfig('/backup/path');

      expect(fs.copy).toHaveBeenCalledWith('/backup/path', '/test/project/ao.config.yml');
    });

    it('should throw error when backup file does not exist', async () => {
      const fs = require('fs-extra');
      fs.pathExists = jest.fn().mockResolvedValue(false);

      await expect(configManager.restoreConfig('/backup/path')).rejects.toThrow(
        'Backup file not found: /backup/path'
      );
    });
  });

  describe('getConfigPath', () => {
    it('should return config file path', () => {
      const result = configManager.getConfigPath();
      expect(result).toBe('/test/project/ao.config.yml');
    });
  });
}); 