export interface ProcessState {
  id: string;
  status: 'starting' | 'running' | 'stopped' | 'error';
  startTime: Date;
  endTime?: Date;
  uptime?: number;
  features: AOSFeatures;
  messages: Message[];
  errors: Error[];
  config: ProcessConfig;
}

export interface AOSFeatures {
  coroutines: boolean;
  requestResponse: boolean;
  defaultActions: boolean;
  bootloader: boolean;
  weavedrive: boolean;
  version: '1.x' | '2.x';
}

export interface ProcessConfig {
  name: string;
  wallet?: string;
  module?: string;
  cron?: string;
  monitor: boolean;
  sqlite: boolean;
  tags: Record<string, string>;
  luaFiles: string[];
}

export interface Message {
  id: string;
  action: string;
  data: any;
  tags: Record<string, string>;
  timestamp: Date;
  sender: string;
  recipient: string;
}

export interface ProcessOptions {
  name: string;
  wallet?: string;
  module?: string;
  cron?: string;
  monitor?: boolean;
  sqlite?: boolean;
  tags?: Record<string, string>;
  luaFiles?: string[];
  bootloader?: BootloaderConfig;
}

export interface BootloaderConfig {
  script?: string;
  txId?: string;
  data?: any;
}

export interface SchedulerConfig {
  interval: number;
  tick: string;
  maxRetries: number;
  onError: string;
  patterns?: string[];
}

export interface AOConfig {
  luaFiles: string[];
  packageManager: 'npm' | 'yarn' | 'pnpm';
  framework: 'nextjs' | 'nuxtjs' | 'svelte' | 'react' | 'vue';
  processName: string;
  ports: {
    dev: number;
    build?: number;
  };
  aos: {
    version: '1.x' | '2.x';
    features: {
      coroutines: boolean;
      bootloader: boolean;
      weavedrive: boolean;
    };
  };
  runWithAO: boolean;
  tags: Record<string, string>;
}

export interface CreateProjectOptions {
  name: string;
  framework: 'nextjs' | 'nuxtjs' | 'svelte' | 'react' | 'vue';
  packageManager: 'npm' | 'yarn' | 'pnpm';
  port?: number;
  processName?: string;
  runWithAO?: boolean;
  initializeGit?: boolean;
}

export interface ProcessInfo {
  name: string;
  pid: number;
  startTime: string;
  config: AOConfig;
} 