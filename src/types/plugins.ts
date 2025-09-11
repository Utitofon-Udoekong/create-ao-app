import { CommandRegistry } from '../core/commands/registry.js';
import { CLI } from '../core/cli.js';

export enum PluginHook {
  // CLI lifecycle hooks
  CLI_INIT = 'cli:init',
  CLI_READY = 'cli:ready',
  CLI_SHUTDOWN = 'cli:shutdown',
  
  // Command lifecycle hooks
  COMMAND_BEFORE_EXECUTE = 'command:before:execute',
  COMMAND_AFTER_EXECUTE = 'command:after:execute',
  COMMAND_ERROR = 'command:error',
  
  // Build lifecycle hooks
  BUILD_BEFORE = 'build:before',
  BUILD_AFTER = 'build:after',
  BUILD_ERROR = 'build:error',
  
  // Deploy lifecycle hooks
  DEPLOY_BEFORE = 'deploy:before',
  DEPLOY_AFTER = 'deploy:after',
  DEPLOY_ERROR = 'deploy:error',
  
  // Development hooks
  DEV_START = 'dev:start',
  DEV_STOP = 'dev:stop',
  DEV_RELOAD = 'dev:reload',
  
  // AI hooks
  AI_BEFORE_GENERATE = 'ai:before:generate',
  AI_AFTER_GENERATE = 'ai:after:generate',
  AI_ERROR = 'ai:error',
  
  // Custom hooks
  CUSTOM = 'custom'
}

export interface PluginContext {
  cli: CLI;
  commandRegistry?: CommandRegistry | null;
  config: any;
  logger: any;
  version: string;
  platform: string;
  arch: string;
}

export interface PluginHooks {
  [PluginHook.CLI_INIT]?: (data: any, context: PluginContext) => Promise<any>;
  [PluginHook.CLI_READY]?: (data: any, context: PluginContext) => Promise<any>;
  [PluginHook.CLI_SHUTDOWN]?: (data: any, context: PluginContext) => Promise<any>;
  [PluginHook.COMMAND_BEFORE_EXECUTE]?: (data: any, context: PluginContext) => Promise<any>;
  [PluginHook.COMMAND_AFTER_EXECUTE]?: (data: any, context: PluginContext) => Promise<any>;
  [PluginHook.COMMAND_ERROR]?: (data: any, context: PluginContext) => Promise<any>;
  [PluginHook.BUILD_BEFORE]?: (data: any, context: PluginContext) => Promise<any>;
  [PluginHook.BUILD_AFTER]?: (data: any, context: PluginContext) => Promise<any>;
  [PluginHook.BUILD_ERROR]?: (data: any, context: PluginContext) => Promise<any>;
  [PluginHook.DEPLOY_BEFORE]?: (data: any, context: PluginContext) => Promise<any>;
  [PluginHook.DEPLOY_AFTER]?: (data: any, context: PluginContext) => Promise<any>;
  [PluginHook.DEPLOY_ERROR]?: (data: any, context: PluginContext) => Promise<any>;
  [PluginHook.DEV_START]?: (data: any, context: PluginContext) => Promise<any>;
  [PluginHook.DEV_STOP]?: (data: any, context: PluginContext) => Promise<any>;
  [PluginHook.DEV_RELOAD]?: (data: any, context: PluginContext) => Promise<any>;
  [PluginHook.AI_BEFORE_GENERATE]?: (data: any, context: PluginContext) => Promise<any>;
  [PluginHook.AI_AFTER_GENERATE]?: (data: any, context: PluginContext) => Promise<any>;
  [PluginHook.AI_ERROR]?: (data: any, context: PluginContext) => Promise<any>;
  [PluginHook.CUSTOM]?: (data: any, context: PluginContext) => Promise<any>;
}

export interface Plugin {
  name: string;
  version: string;
  description?: string;
  author?: string;
  license?: string;
  homepage?: string;
  repository?: string;
  keywords?: string[];
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  
  // Plugin lifecycle
  activate: (context: PluginContext) => Promise<void>;
  deactivate?: (context: PluginContext) => Promise<void>;
  
  // Plugin hooks
  hooks?: PluginHooks;
  
  // Plugin commands (optional)
  commands?: any[];
  
  // Plugin configuration
  configSchema?: any;
  defaultConfig?: any;
}

export interface PluginManifest {
  name: string;
  version: string;
  description?: string;
  author?: string;
  license?: string;
  homepage?: string;
  repository?: string;
  keywords?: string[];
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  main: string;
  type: 'module' | 'commonjs';
  aoForge?: {
    hooks?: string[];
    commands?: string[];
    configSchema?: any;
    defaultConfig?: any;
  };
}

export interface PluginInfo {
  name: string;
  version: string;
  description?: string;
  author?: string;
  license?: string;
  homepage?: string;
  repository?: string;
  keywords?: string[];
  isLoaded: boolean;
  isEnabled: boolean;
  loadTime?: number;
  error?: string;
} 