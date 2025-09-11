import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AIManager } from '../../../../src/core/managers/ai-manager';
import { AOConfig } from '../../../../src/types/aos';

// Mock dependencies
jest.mock('../../../../src/core/utils/logging');
jest.mock('fs-extra');

// Mock OpenAI and Anthropic SDKs
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: function OpenAI() {
      return {
        chat: {
          completions: {
            // @ts-expect-error
            create: jest.fn().mockResolvedValue({
              choices: [{ message: { content: 'Mocked OpenAI response' } }]
            })
          }
        }
      };
    }
  };
});

jest.mock('@anthropic-ai/sdk', () => {
  return {
    __esModule: true,
    default: function Anthropic() {
      return {
        messages: {
          // @ts-expect-error
          create: jest.fn().mockResolvedValue({
            content: [{ type: 'text', text: 'Mocked Anthropic response' }]
          })
        }
      };
    }
  };
});

// Mock fs-extra
jest.mock('fs-extra', () => ({
  // @ts-expect-error
  readFile: jest.fn().mockResolvedValue('mock file content'),
  // @ts-expect-error
  writeFile: jest.fn().mockResolvedValue(undefined),
  // @ts-expect-error
  ensureDir: jest.fn().mockResolvedValue(undefined)
}));

// Mock logger
jest.mock('../../../../src/core/utils/logging', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    success: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('AIManager', () => {
  let aiManager: AIManager;
  let mockConfig: AOConfig;

  beforeEach(() => {
    mockConfig = {
      luaFiles: [],
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
      tags: {}
    };

    // Set up environment variables for testing
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';

    aiManager = new AIManager(mockConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
  });

  describe('initialize', () => {
    it('should initialize successfully with API keys', async () => {
      await expect(aiManager.initialize()).resolves.not.toThrow();
    });

    it('should throw error when no API keys are available', async () => {
      delete process.env.OPENAI_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      
      const aiManagerWithoutKeys = new AIManager(mockConfig);
      await expect(aiManagerWithoutKeys.initialize()).rejects.toThrow('No AI API keys configured');
    });
  });

  describe('generateCode', () => {
    beforeEach(async () => {
      await aiManager.initialize();
    });

    it('should generate code successfully', async () => {
      const request = {
        prompt: 'Create a simple counter contract',
        type: 'contract' as const,
        options: {
          provider: 'openai' as const,
          model: 'gpt-4o-mini'
        }
      };

      const result = await aiManager.generateCode(request);

      expect(result).toBeDefined();
      expect(result.code).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.validation).toBeDefined();
    });

    it('should handle different generation types', async () => {
      const request = {
        prompt: 'Create a test for a function',
        type: 'test' as const,
        options: {
          provider: 'anthropic' as const,
          model: 'claude-3-5-sonnet-latest'
        }
      };

      const result = await aiManager.generateCode(request);

      expect(result).toBeDefined();
      expect(result.metadata.type).toBe('test');
    });
  });

  describe('refactorCode', () => {
    beforeEach(async () => {
      await aiManager.initialize();
    });

    it('should refactor code successfully', async () => {
      const result = await aiManager.refactorCode('test.lua', 'Improve readability');

      expect(result).toBeDefined();
      expect(result.code).toBeDefined();
    });
  });

  describe('generateTests', () => {
    beforeEach(async () => {
      await aiManager.initialize();
    });

    it('should generate tests successfully', async () => {
      const result = await aiManager.generateTests('test.lua', 'jest');

      expect(result).toBeDefined();
      expect(result.code).toBeDefined();
    });
  });

  describe('analyzeCode', () => {
    beforeEach(async () => {
      await aiManager.initialize();
    });

    it('should analyze code successfully', async () => {
      const result = await aiManager.analyzeCode('test.lua');

      expect(result).toBeDefined();
      expect(result.suggestions).toBeDefined();
      expect(result.improvements).toBeDefined();
      expect(result.issues).toBeDefined();
      expect(result.complexity).toBeDefined();
    });
  });

  describe('generateFromTemplate', () => {
    beforeEach(async () => {
      await aiManager.initialize();
    });

    it('should generate from template successfully', async () => {
      const result = await aiManager.generateFromTemplate('counter', {});

      expect(result).toBeDefined();
      expect(result.code).toBeDefined();
    });

    it('should handle unknown template gracefully', async () => {
      const result = await aiManager.generateFromTemplate('unknown-template', {});

      expect(result).toBeDefined();
      expect(result.code).toContain('Mocked OpenAI response');
    });
  });

  describe('optimizeCode', () => {
    beforeEach(async () => {
      await aiManager.initialize();
    });

    it('should optimize code for performance', async () => {
      const result = await aiManager.optimizeCode('test.lua', 'performance');

      expect(result).toBeDefined();
      expect(result.code).toBeDefined();
    });

    it('should optimize code for security', async () => {
      const result = await aiManager.optimizeCode('test.lua', 'security');

      expect(result).toBeDefined();
      expect(result.code).toBeDefined();
    });

    it('should optimize code for readability', async () => {
      const result = await aiManager.optimizeCode('test.lua', 'readability');

      expect(result).toBeDefined();
      expect(result.code).toBeDefined();
    });
  });

  describe('generateDocumentation', () => {
    beforeEach(async () => {
      await aiManager.initialize();
    });

    it('should generate markdown documentation', async () => {
      const result = await aiManager.generateDocumentation('test.lua', 'markdown');

      expect(result).toBeDefined();
      expect(result.code).toBeDefined();
    });

    it('should generate HTML documentation', async () => {
      const result = await aiManager.generateDocumentation('test.lua', 'html');

      expect(result).toBeDefined();
      expect(result.code).toBeDefined();
    });

    it('should generate JSON documentation', async () => {
      const result = await aiManager.generateDocumentation('test.lua', 'json');

      expect(result).toBeDefined();
      expect(result.code).toBeDefined();
    });
  });

  describe('performSecurityAudit', () => {
    beforeEach(async () => {
      await aiManager.initialize();
    });

    it('should perform security audit successfully', async () => {
      const result = await aiManager.performSecurityAudit('test.lua');

      expect(result).toBeDefined();
      expect(result.suggestions).toBeDefined();
      expect(result.improvements).toBeDefined();
      expect(result.issues).toBeDefined();
      expect(result.complexity).toBeDefined();
    });
  });

  describe('batchProcess', () => {
    beforeEach(async () => {
      await aiManager.initialize();
    });

    it('should batch process files for analysis', async () => {
      const files = ['file1.lua', 'file2.lua'];
      const results = await aiManager.batchProcess(files, 'analyze');

      expect(results).toBeDefined();
      expect(results.size).toBe(2);
    });

    it('should handle batch processing errors gracefully', async () => {
      const files = ['file1.lua', 'nonexistent.lua'];
      const results = await aiManager.batchProcess(files, 'analyze');

      expect(results).toBeDefined();
      expect(results.size).toBe(2);
    });
  });

  describe('generateMigrationScript', () => {
    beforeEach(async () => {
      await aiManager.initialize();
    });

    it('should generate migration script successfully', async () => {
      const result = await aiManager.generateMigrationScript('test.lua', 'new-framework');

      expect(result).toBeDefined();
      expect(result.code).toBeDefined();
    });
  });

  describe('generateIntegrationTests', () => {
    beforeEach(async () => {
      await aiManager.initialize();
    });

    it('should generate API integration tests', async () => {
      const result = await aiManager.generateIntegrationTests('test.lua', 'api');

      expect(result).toBeDefined();
      expect(result.code).toBeDefined();
    });

    it('should generate database integration tests', async () => {
      const result = await aiManager.generateIntegrationTests('test.lua', 'database');

      expect(result).toBeDefined();
      expect(result.code).toBeDefined();
    });

    it('should generate external integration tests', async () => {
      const result = await aiManager.generateIntegrationTests('test.lua', 'external');

      expect(result).toBeDefined();
      expect(result.code).toBeDefined();
    });
  });

  describe('utility methods', () => {
    it('should return supported providers', () => {
      const providers = aiManager.getSupportedProviders();
      expect(providers).toContain('openai');
      expect(providers).toContain('anthropic');
    });

    it('should return supported models for OpenAI', () => {
      const models = aiManager.getSupportedModels('openai');
      expect(models).toContain('gpt-4o-mini');
      expect(models).toContain('gpt-4o');
    });

    it('should return supported models for Anthropic', () => {
      const models = aiManager.getSupportedModels('anthropic');
      expect(models).toContain('claude-3-5-sonnet-latest');
      expect(models).toContain('claude-3-5-haiku-latest');
    });
  });
}); 