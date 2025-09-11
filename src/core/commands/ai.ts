import { BaseCommand } from './base-command.js';
import { CommandOption } from '../../types/cli.js';
import { AIManager, AIGenerationRequest } from '../managers/ai-manager.js';
import { ConfigManager } from '../managers/config-manager.js';
import { AIProvider } from '../../types/ai.js';
import { logger } from '../utils/logging.js';
import fs from 'fs-extra';
import path from 'path';

export class AICommand extends BaseCommand {
  name = 'ai';
  description = 'AI-powered code generation and assistance';
  options: CommandOption[] = [
    {
      flag: '-p, --prompt <text>',
      description: 'Generate code from text prompt',
      required: false
    },
    {
      flag: '-f, --file <path>',
      description: 'Generate code for specific file',
      required: false
    },
    {
      flag: '-i, --interactive',
      description: 'Start interactive AI session',
      required: false
    },
    {
      flag: '--refactor',
      description: 'Refactor existing code',
      required: false
    },
    {
      flag: '--test',
      description: 'Generate tests for file',
      required: false
    },
    {
      flag: '--analyze',
      description: 'Analyze code quality',
      required: false
    },
    {
      flag: '--template <name>',
      description: 'Generate from template (counter, token, nft, dao, marketplace, oracle, multisig, lending)',
      required: false
    },
    {
      flag: '--optimize <type>',
      description: 'Optimize code (performance, security, readability)',
      required: false
    },
    {
      flag: '--document <format>',
      description: 'Generate documentation (markdown, html, json)',
      required: false
    },
    {
      flag: '--audit',
      description: 'Perform security audit',
      required: false
    },
    {
      flag: '--batch <operation>',
      description: 'Batch process files (analyze, optimize, document, test)',
      required: false
    },
    {
      flag: '--migrate <framework>',
      description: 'Generate migration script to target framework',
      required: false
    },
    {
      flag: '--integration-tests <type>',
      description: 'Generate integration tests (api, database, external)',
      required: false
    },
    {
      flag: '-o, --output <path>',
      description: 'Output file path for generated code',
      required: false
    },
    {
      flag: '--provider <name>',
      description: 'AI provider (openai, anthropic)',
      required: false
    },
    {
      flag: '--model <name>',
      description: 'AI model to use',
      required: false
    },
    {
      flag: '--temperature <number>',
      description: 'AI temperature (0.0-1.0)',
      required: false
    }
  ];

  async execute(options: any): Promise<void> {
    logger.aiStart('Initializing AI assistant');
    
    try {
      // Load configuration
      const configManager = new ConfigManager(process.cwd());
      const config = await configManager.loadConfig();
      
      // Initialize AI manager
      const aiManager = new AIManager(config);
      await aiManager.initialize();
      
      // Execute requested action
      if (options.interactive) {
        await this.startInteractiveSession(aiManager);
      } else if (options.optimize && options.file) {
        await this.optimizeCode(aiManager, options);
      } else if (options.document && options.file) {
        await this.generateDocumentation(aiManager, options);
      } else if (options.audit && options.file) {
        await this.performSecurityAudit(aiManager, options);
      } else if (options.batch && options.file) {
        await this.batchProcess(aiManager, options);
      } else if (options.migrate && options.file) {
        await this.generateMigrationScript(aiManager, options);
      } else if (options.integrationTests && options.file) {
        await this.generateIntegrationTests(aiManager, options);
      } else if (options.analyze && options.file) {
        await this.analyzeCode(aiManager, options);
      } else if (options.refactor && options.file) {
        await this.refactorCode(aiManager, options);
      } else if (options.test && options.file) {
        await this.generateTests(aiManager, options);
      } else if (options.template) {
        await this.generateFromTemplate(aiManager, options);
      } else if (options.prompt) {
        await this.generateFromPrompt(aiManager, options);
      } else if (options.file) {
        await this.generateForFile(aiManager, options);
      } else {
        logger.aiError('No action specified');
        this.logError('No action specified. Use --prompt, --file, --interactive, --refactor, --test, --analyze, --template, --optimize, --document, --audit, --batch, --migrate, or --integration-tests');
        return;
      }
      
      logger.aiSuccess('AI operation');
    } catch (error) {
      logger.aiError('AI operation', error as Error);
      throw error;
    }
  }

  private async startInteractiveSession(aiManager: AIManager): Promise<void> {
    this.logStart('Starting interactive AI session');
    
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const question = (prompt: string): Promise<string> => {
      return new Promise((resolve) => {
        rl.question(prompt, resolve);
      });
    };

    let conversationHistory: Array<{role: 'user' | 'assistant', content: string}> = [];
    let currentContext = 'AO Smart Contract Development';

    this.logInfo('\n🤖 Interactive AI Session Started');
    this.logInfo('Type "help" for commands, "exit" to quit, or just ask questions!');
    this.logInfo('Context: ' + currentContext);

    try {
      while (true) {
        const userInput = await question('\n> ');
        const trimmedInput = userInput.trim();

        if (trimmedInput.toLowerCase() === 'exit' || trimmedInput.toLowerCase() === 'quit') {
          this.logInfo('Goodbye! 👋');
          break;
        }

        if (trimmedInput.toLowerCase() === 'help') {
          this.showInteractiveHelp();
          continue;
        }

        if (trimmedInput.toLowerCase() === 'clear') {
          conversationHistory = [];
          currentContext = 'AO Smart Contract Development';
          this.logInfo('Conversation history cleared');
          continue;
        }

        if (trimmedInput.toLowerCase() === 'context') {
          this.logInfo(`Current context: ${currentContext}`);
          continue;
        }

        if (trimmedInput.toLowerCase().startsWith('context ')) {
          currentContext = trimmedInput.substring(8);
          this.logInfo(`Context updated: ${currentContext}`);
          continue;
        }

        if (trimmedInput.toLowerCase().startsWith('generate ')) {
          await this.handleGenerateCommand(aiManager, trimmedInput.substring(9), conversationHistory);
          continue;
        }

        if (trimmedInput.toLowerCase().startsWith('refactor ')) {
          await this.handleRefactorCommand(aiManager, trimmedInput.substring(9));
          continue;
        }

        if (trimmedInput.toLowerCase().startsWith('analyze ')) {
          await this.handleAnalyzeCommand(aiManager, trimmedInput.substring(8));
          continue;
        }

        if (trimmedInput.toLowerCase().startsWith('template ')) {
          await this.handleTemplateCommand(aiManager, trimmedInput.substring(9));
          continue;
        }

        if (trimmedInput.toLowerCase().startsWith('optimize ')) {
          const parts = trimmedInput.substring(9).split(' ');
          if (parts.length >= 2) {
            await this.handleOptimizeCommand(aiManager, parts[0], parts[1]);
          } else {
            this.logInfo('Usage: optimize <file> <type> (performance/security/readability)');
          }
          continue;
        }

        if (trimmedInput.toLowerCase().startsWith('document ')) {
          const parts = trimmedInput.substring(9).split(' ');
          if (parts.length >= 2) {
            await this.handleDocumentCommand(aiManager, parts[0], parts[1]);
          } else {
            this.logInfo('Usage: document <file> <format> (markdown/html/json)');
          }
          continue;
        }

        if (trimmedInput.toLowerCase().startsWith('audit ')) {
          await this.handleAuditCommand(aiManager, trimmedInput.substring(6));
          continue;
        }

        if (trimmedInput.toLowerCase().startsWith('migrate ')) {
          const parts = trimmedInput.substring(8).split(' ');
          if (parts.length >= 2) {
            await this.handleMigrateCommand(aiManager, parts[0], parts[1]);
          } else {
            this.logInfo('Usage: migrate <file> <target-framework>');
          }
          continue;
        }

        if (trimmedInput.toLowerCase().startsWith('tests ')) {
          const parts = trimmedInput.substring(6).split(' ');
          if (parts.length >= 2) {
            await this.handleTestsCommand(aiManager, parts[0], parts[1]);
          } else {
            this.logInfo('Usage: tests <file> <type> (api/database/external)');
          }
          continue;
        }

        // Default: treat as a general question
        await this.handleGeneralQuestion(aiManager, trimmedInput, conversationHistory, currentContext);
      }
    } finally {
      rl.close();
    }
  }

  private showInteractiveHelp(): void {
    this.logInfo('\n📚 Available Commands:');
    this.logInfo('  help                    - Show this help message');
    this.logInfo('  exit / quit             - Exit the interactive session');
    this.logInfo('  clear                   - Clear conversation history');
    this.logInfo('  context                 - Show current context');
    this.logInfo('  context <new context>   - Set new context');
    this.logInfo('  generate <prompt>       - Generate code from prompt');
    this.logInfo('  refactor <file>         - Refactor a file');
    this.logInfo('  analyze <file>          - Analyze a file');
    this.logInfo('  optimize <file> <type>  - Optimize code (performance/security/readability)');
    this.logInfo('  document <file> <format> - Generate documentation (markdown/html/json)');
    this.logInfo('  audit <file>            - Perform security audit');
    this.logInfo('  template <name>         - Generate from template');
    this.logInfo('  migrate <file> <target> - Generate migration script');
    this.logInfo('  tests <file> <type>     - Generate integration tests (api/database/external)');
    this.logInfo('  <any question>          - Ask general questions');
    this.logInfo('\n💡 Tips:');
    this.logInfo('  - Be specific in your prompts for better results');
    this.logInfo('  - Use context to maintain conversation flow');
    this.logInfo('  - Ask follow-up questions for clarification');
    this.logInfo('  - Templates: counter, token, nft, dao, marketplace, oracle, multisig, lending');
  }

  private async handleGenerateCommand(
    aiManager: AIManager, 
    prompt: string, 
    history: Array<{role: 'user' | 'assistant', content: string}>
  ): Promise<void> {
    try {
      this.logInfo('🔄 Generating code...');
      
      const request: AIGenerationRequest = {
        prompt: prompt,
        type: 'contract',
        context: history.length > 0 ? 'Continuing from previous conversation' : undefined,
        options: {
          provider: 'openai',
          temperature: 0.7
        }
      };

      const result = await aiManager.generateCode(request);
      
      this.logSuccess('✅ Code generated successfully!');
      this.logInfo('\n📝 Generated Code:');
      console.log(result.code);
      
      // Add to conversation history
      history.push({ role: 'user', content: prompt });
      history.push({ role: 'assistant', content: result.code });
      
      this.logInfo('\n💡 You can ask follow-up questions or request modifications!');
      
    } catch (error) {
      this.logError('❌ Code generation failed:', error as Error);
    }
  }

  private async handleRefactorCommand(aiManager: AIManager, filePath: string): Promise<void> {
    try {
      this.logInfo(`🔄 Refactoring ${filePath}...`);
      
      const result = await aiManager.refactorCode(filePath, 'Improve code quality and readability');
      
      this.logSuccess('✅ Code refactored successfully!');
      this.logInfo('\n📝 Refactored Code:');
      console.log(result.code);
      
    } catch (error) {
      this.logError('❌ Refactoring failed:', error as Error);
    }
  }

  private async handleAnalyzeCommand(aiManager: AIManager, filePath: string): Promise<void> {
    try {
      this.logInfo(`🔍 Analyzing ${filePath}...`);
      
      const analysis = await aiManager.analyzeCode(filePath);
      
      this.logSuccess('✅ Analysis completed!');
      this.logInfo('\n📊 Analysis Results:');
      
      if (analysis.suggestions.length > 0) {
        this.logInfo('\n💡 Suggestions:');
        analysis.suggestions.forEach(suggestion => this.logInfo(`  • ${suggestion}`));
      }
      
      if (analysis.improvements.length > 0) {
        this.logInfo('\n🔧 Improvements:');
        analysis.improvements.forEach(improvement => this.logInfo(`  • ${improvement}`));
      }
      
      if (analysis.issues.length > 0) {
        this.logInfo('\n⚠️  Issues:');
        analysis.issues.forEach(issue => this.logInfo(`  • ${issue}`));
      }
      
      this.logInfo(`\n📈 Complexity: ${analysis.complexity}`);
      
    } catch (error) {
      this.logError('❌ Analysis failed:', error as Error);
    }
  }

  private async handleTemplateCommand(aiManager: AIManager, templateName: string): Promise<void> {
    try {
      this.logInfo(`🔄 Generating from template: ${templateName}...`);
      
      const result = await aiManager.generateFromTemplate(templateName, {});
      
      this.logSuccess('✅ Template code generated successfully!');
      this.logInfo('\n📝 Generated Code:');
      console.log(result.code);
      
    } catch (error) {
      this.logError('❌ Template generation failed:', error as Error);
    }
  }

  private async handleGeneralQuestion(
    aiManager: AIManager, 
    question: string, 
    history: Array<{role: 'user' | 'assistant', content: string}>,
    context: string
  ): Promise<void> {
    try {
      this.logInfo('🤔 Thinking...');
      
      // Build context-aware prompt
      let fullPrompt = `Context: ${context}\n\nQuestion: ${question}`;
      
      if (history.length > 0) {
        const recentHistory = history.slice(-4); // Last 2 exchanges
        const historyText = recentHistory.map(h => `${h.role}: ${h.content}`).join('\n');
        fullPrompt = `Previous conversation:\n${historyText}\n\n${fullPrompt}`;
      }
      
      const request: AIGenerationRequest = {
        prompt: fullPrompt,
        type: 'template', // Use template type for general questions
        context: context,
        options: {
          provider: 'openai',
          temperature: 0.7
        }
      };

      const result = await aiManager.generateCode(request);
      
      this.logSuccess('💬 Response:');
      console.log(result.code);
      
      // Add to conversation history
      history.push({ role: 'user', content: question });
      history.push({ role: 'assistant', content: result.code });
      
    } catch (error) {
      this.logError('❌ Failed to get response:', error as Error);
    }
  }

  private async generateFromPrompt(aiManager: AIManager, options: any): Promise<void> {
    logger.aiStart(`Generating code from prompt`);
    
    try {
      logger.aiThinking();
      
      const request: AIGenerationRequest = {
        prompt: options.prompt,
        type: options.type || 'contract',
        options: {
          provider: options.provider as AIProvider,
          model: options.model,
          temperature: options.temperature
        }
      };
      
      const result = await aiManager.generateCode(request);
      await this.saveGeneratedCode(result, options.output);
      
      logger.aiSuccess('Code generation');
    } catch (error) {
      logger.aiError('Code generation', error as Error);
      throw error;
    }
  }

  private async generateForFile(aiManager: AIManager, options: any): Promise<void> {
    this.logStart(`Generating code for file: ${options.file}`);
    
    const request: AIGenerationRequest = {
      prompt: `Generate complementary code for the file: ${options.file}`,
      type: options.type || 'module',
      filePath: options.file,
      options: {
        provider: options.provider as AIProvider,
        model: options.model
      }
    };
    
    const result = await aiManager.generateCode(request);
    await this.saveGeneratedCode(result, options.output);
  }

  private async refactorCode(aiManager: AIManager, options: any): Promise<void> {
    this.logStart(`Refactoring code in: ${options.file}`);
    
    const instructions = options.prompt || 'Improve code quality, readability, and performance';
    const result = await aiManager.refactorCode(options.file, instructions);
    await this.saveGeneratedCode(result, options.output);
  }

  private async generateTests(aiManager: AIManager, options: any): Promise<void> {
    this.logStart(`Generating tests for: ${options.file}`);
    
    const framework = options.framework || 'jest';
    const result = await aiManager.generateTests(options.file, framework);
    await this.saveGeneratedCode(result, options.output);
  }

  private async analyzeCode(aiManager: AIManager, options: any): Promise<void> {
    this.logStart(`Analyzing code in: ${options.file}`);
    
    const analysis = await aiManager.analyzeCode(options.file);
    
    this.logInfo('\n📊 Code Analysis Results:');
    
    if (analysis.suggestions.length > 0) {
      this.logInfo('\n💡 Suggestions:');
      analysis.suggestions.forEach(suggestion => this.logInfo(`  • ${suggestion}`));
    }
    
    if (analysis.improvements.length > 0) {
      this.logInfo('\n🔧 Improvements:');
      analysis.improvements.forEach(improvement => this.logInfo(`  • ${improvement}`));
    }
    
    if (analysis.issues.length > 0) {
      this.logInfo('\n⚠️  Issues:');
      analysis.issues.forEach(issue => this.logInfo(`  • ${issue}`));
    }
    
    this.logInfo(`\n📈 Complexity: ${analysis.complexity}`);
  }

  private async generateFromTemplate(aiManager: AIManager, options: any): Promise<void> {
    this.logStart(`Generating code from template: ${options.template}`);
    
    try {
      const result = await aiManager.generateFromTemplate(options.template, {});
      await this.saveGeneratedCode(result, options.output);
      this.logSuccess('Template code generated successfully');
    } catch (error) {
      this.logError('Template generation failed', error as Error);
      throw error;
    }
  }

  private async optimizeCode(aiManager: AIManager, options: any): Promise<void> {
    const optimizationType = options.optimize || 'performance';
    this.logStart(`Optimizing code in ${options.file} for ${optimizationType}`);
    
    try {
      const result = await aiManager.optimizeCode(options.file, optimizationType as 'performance' | 'security' | 'readability');
      await this.saveGeneratedCode(result, options.output);
      this.logSuccess(`Code optimized for ${optimizationType} successfully`);
    } catch (error) {
      this.logError('Code optimization failed', error as Error);
      throw error;
    }
  }

  private async generateDocumentation(aiManager: AIManager, options: any): Promise<void> {
    const format = options.document || 'markdown';
    this.logStart(`Generating ${format} documentation for ${options.file}`);
    
    try {
      const result = await aiManager.generateDocumentation(options.file, format as 'markdown' | 'html' | 'json');
      await this.saveGeneratedCode(result, options.output);
      this.logSuccess(`${format} documentation generated successfully`);
    } catch (error) {
      this.logError('Documentation generation failed', error as Error);
      throw error;
    }
  }

  private async performSecurityAudit(aiManager: AIManager, options: any): Promise<void> {
    this.logStart(`Performing security audit on ${options.file}`);
    
    try {
      const result = await aiManager.performSecurityAudit(options.file);
      
      this.logSuccess('Security audit completed');
      this.logInfo('\n🔒 Security Audit Results:');
      
      if (result.issues.length > 0) {
        this.logInfo('\n⚠️  Security Issues:');
        result.issues.forEach(issue => this.logInfo(`  • ${issue}`));
      }
      
      if (result.suggestions.length > 0) {
        this.logInfo('\n💡 Security Suggestions:');
        result.suggestions.forEach(suggestion => this.logInfo(`  • ${suggestion}`));
      }
      
      if (result.improvements.length > 0) {
        this.logInfo('\n🔧 Security Improvements:');
        result.improvements.forEach(improvement => this.logInfo(`  • ${improvement}`));
      }
      
      this.logInfo(`\n📊 Security Complexity: ${result.complexity}`);
      
    } catch (error) {
      this.logError('Security audit failed', error as Error);
      throw error;
    }
  }

  private async batchProcess(aiManager: AIManager, options: any): Promise<void> {
    const operation = options.batch;
    const files = options.file.split(',').map((f: string) => f.trim());
    
    this.logStart(`Starting batch ${operation} for ${files.length} files`);
    
    try {
      const results = await aiManager.batchProcess(files, operation as 'analyze' | 'optimize' | 'document' | 'test');
      
      this.logSuccess(`Batch ${operation} completed`);
      this.logInfo('\n📊 Batch Processing Results:');
      
      let successCount = 0;
      let failureCount = 0;
      
      for (const [file, result] of results) {
        if (result.success) {
          successCount++;
          this.logInfo(`  ✅ ${file}: Success`);
        } else {
          failureCount++;
          this.logInfo(`  ❌ ${file}: ${result.error}`);
        }
      }
      
      this.logInfo(`\n📈 Summary: ${successCount} successful, ${failureCount} failed`);
      
    } catch (error) {
      this.logError('Batch processing failed', error as Error);
      throw error;
    }
  }

  private async generateMigrationScript(aiManager: AIManager, options: any): Promise<void> {
    const targetFramework = options.migrate;
    this.logStart(`Generating migration script from ${options.file} to ${targetFramework}`);
    
    try {
      const result = await aiManager.generateMigrationScript(options.file, targetFramework);
      await this.saveGeneratedCode(result, options.output);
      this.logSuccess(`Migration script to ${targetFramework} generated successfully`);
    } catch (error) {
      this.logError('Migration script generation failed', error as Error);
      throw error;
    }
  }

  private async generateIntegrationTests(aiManager: AIManager, options: any): Promise<void> {
    const integrationType = options.integrationTests || 'api';
    this.logStart(`Generating ${integrationType} integration tests for ${options.file}`);
    
    try {
      const result = await aiManager.generateIntegrationTests(options.file, integrationType as 'api' | 'database' | 'external');
      await this.saveGeneratedCode(result, options.output);
      this.logSuccess(`${integrationType} integration tests generated successfully`);
    } catch (error) {
      this.logError('Integration test generation failed', error as Error);
      throw error;
    }
  }

  private async saveGeneratedCode(result: any, outputPath?: string): Promise<void> {
    if (!outputPath) {
      // Generate default output path
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      outputPath = `generated-${result.metadata.type}-${timestamp}.lua`;
    }
    
    try {
      await fs.writeFile(outputPath, result.code, 'utf8');
      this.logSuccess(`Code saved to: ${outputPath}`);
      
      // Show validation results
      if (result.validation.warnings.length > 0) {
        this.logInfo('\n⚠️  Warnings:');
        result.validation.warnings.forEach((warning: string) => this.logInfo(`  • ${warning}`));
      }
      
      if (result.validation.suggestions.length > 0) {
        this.logInfo('\n💡 Suggestions:');
        result.validation.suggestions.forEach((suggestion: string) => this.logInfo(`  • ${suggestion}`));
      }
      
    } catch (error) {
      this.logError('Failed to save generated code:', error as Error);
      throw error;
    }
  }

  private async handleOptimizeCommand(aiManager: AIManager, filePath: string, optimizationType: string): Promise<void> {
    try {
      this.logInfo(`🔄 Optimizing ${filePath} for ${optimizationType}...`);
      
      const result = await aiManager.optimizeCode(filePath, optimizationType as 'performance' | 'security' | 'readability');
      
      this.logSuccess('✅ Code optimized successfully!');
      this.logInfo('\n📝 Optimized Code:');
      console.log(result.code);
      
    } catch (error) {
      this.logError('❌ Optimization failed:', error as Error);
    }
  }

  private async handleDocumentCommand(aiManager: AIManager, filePath: string, format: string): Promise<void> {
    try {
      this.logInfo(`📚 Generating ${format} documentation for ${filePath}...`);
      
      const result = await aiManager.generateDocumentation(filePath, format as 'markdown' | 'html' | 'json');
      
      this.logSuccess('✅ Documentation generated successfully!');
      this.logInfo('\n📝 Generated Documentation:');
      console.log(result.code);
      
    } catch (error) {
      this.logError('❌ Documentation generation failed:', error as Error);
    }
  }

  private async handleAuditCommand(aiManager: AIManager, filePath: string): Promise<void> {
    try {
      this.logInfo(`🔒 Performing security audit on ${filePath}...`);
      
      const result = await aiManager.performSecurityAudit(filePath);
      
      this.logSuccess('✅ Security audit completed!');
      this.logInfo('\n🔒 Security Audit Results:');
      
      if (result.issues.length > 0) {
        this.logInfo('\n⚠️  Security Issues:');
        result.issues.forEach(issue => this.logInfo(`  • ${issue}`));
      }
      
      if (result.suggestions.length > 0) {
        this.logInfo('\n💡 Security Suggestions:');
        result.suggestions.forEach(suggestion => this.logInfo(`  • ${suggestion}`));
      }
      
      if (result.improvements.length > 0) {
        this.logInfo('\n🔧 Security Improvements:');
        result.improvements.forEach(improvement => this.logInfo(`  • ${improvement}`));
      }
      
      this.logInfo(`\n📊 Security Complexity: ${result.complexity}`);
      
    } catch (error) {
      this.logError('❌ Security audit failed:', error as Error);
    }
  }

  private async handleMigrateCommand(aiManager: AIManager, filePath: string, targetFramework: string): Promise<void> {
    try {
      this.logInfo(`🔄 Generating migration script from ${filePath} to ${targetFramework}...`);
      
      const result = await aiManager.generateMigrationScript(filePath, targetFramework);
      
      this.logSuccess('✅ Migration script generated successfully!');
      this.logInfo('\n📝 Migration Script:');
      console.log(result.code);
      
    } catch (error) {
      this.logError('❌ Migration script generation failed:', error as Error);
    }
  }

  private async handleTestsCommand(aiManager: AIManager, filePath: string, testType: string): Promise<void> {
    try {
      this.logInfo(`🧪 Generating ${testType} integration tests for ${filePath}...`);
      
      const result = await aiManager.generateIntegrationTests(filePath, testType as 'api' | 'database' | 'external');
      
      this.logSuccess('✅ Integration tests generated successfully!');
      this.logInfo('\n📝 Generated Tests:');
      console.log(result.code);
      
    } catch (error) {
      this.logError('❌ Integration test generation failed:', error as Error);
    }
  }

  protected getHelpText(): string {
    return `
AI-powered code generation and assistance for AO smart contracts.

Examples:
  ao-forge ai --prompt "Create a counter process"                    # Generate from prompt
  ao-forge ai --file contract.lua --refactor                         # Refactor existing file
  ao-forge ai --file contract.lua --test                             # Generate tests
  ao-forge ai --file contract.lua --analyze                          # Analyze code
  ao-forge ai --template counter --output counter.lua                # Generate from template
  ao-forge ai --interactive                                          # Start interactive session
  ao-forge ai --provider anthropic --model claude-3-5-sonnet-latest # Use specific provider/model
  ao-forge ai --type module --prompt "Create a utility module"       # Generate specific type

Supported types: contract, module, test, template, refactor
Supported providers: openai, anthropic
    `;
  }
} 