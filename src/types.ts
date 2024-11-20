// src/types.ts
export interface SchedulerConfig {
    interval: number;
    tick: string;
    patterns?: string[];
    maxRetries?: number;
    onError?: string;
  }
  
  export interface LuaFileConfig {
    processName: string;
    scheduler?: SchedulerConfig;
    evaluator?: string;
    messageHandler?: string;
  }
  
  export interface Config {
    luaFiles: {
      [key: string]: LuaFileConfig;
    };
    packageManager: 'npm' | 'yarn' | 'pnpm';
    autoStart?: boolean;
    ports?: {
      dev?: number;
      [key: string]: number | undefined;
    };
  }

  export interface CliOptions {
    framework?: 'nextjs' | 'nuxtjs';
    name?: string;
    path?: string;
    packageManager?: 'npm' | 'yarn' | 'pnpm';
    aosProcess?: boolean;
    processName?: string;
  }

  export interface CreateProjectOptions {
    framework?: 'nextjs' | 'nuxtjs';
    path?: string;
    aosProcess?: boolean;
    packageManager?: 'npm' | 'yarn' | 'pnpm';
    config?: string;
    monitor?: boolean;
    eval?: string;
    name?: string;
    processName?: string;
  }