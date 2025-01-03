export interface SchedulerConfig {
    interval: number;
    tick: string;
    patterns?: string[];
    maxRetries?: number;
    onError?: string;
  }
  
  export interface AOConfig {
    luaFiles: string[];
    packageManager: 'npm' | 'yarn' | 'pnpm';
    env?: { [key: string]: string };
    scheduler?: SchedulerConfig;
    evaluator?: string;
    messageHandler?: string;
    monitor?: boolean;
    framework?: 'nextjs' | 'nuxtjs';
    ports?: {
      dev?: number;
      [key: string]: number | undefined;
    };
    cronInterval?: string;
    tags?: { [key: string]: string };
    processName?: string;
    runWithAO?: boolean;
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
    packageManager?: 'npm' | 'yarn' | 'pnpm';
    config?: AOConfig;
    name?: string;
    processName?: string;
  }

  export interface StartDevelopmentServerOptions {
    skipAos?: boolean;
    configPath?: string;
    monitorProcess?: boolean;
    evaluate?: string;
    processName?: string;
  }

  export interface CodeGenerationOptions {
    prompt: string;
    type: 'contract' | 'module' | 'test';
    output?: string;
    provider?: 'openai' | 'anthropic';
    model?: string;
  }

  export interface ProcessInfo {
    pid: number;
    name: string;
    startTime: string;
    configPath: string;
  }
  
  export interface AOProcessOptions {
    name?: string;
    wallet?: string;
    watch?: string;
    load?: string[];
    data?: string;
    tagName?: string;
    tagValue?: string;
    module?: string;
    cron?: string;
    monitor?: boolean;
    sqlite?: boolean;
    gatewayUrl?: string;
    cuUrl?: string;
    muUrl?: string;
  }