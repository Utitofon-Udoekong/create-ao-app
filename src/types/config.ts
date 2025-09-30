import { z } from 'zod';
import { ProcessState } from './aos.js';

export const AOConfigSchema = z.object({
  luaFiles: z.array(z.string()).default([]),
  packageManager: z.enum(['npm', 'yarn', 'pnpm']).default('pnpm'),
  framework: z.enum(['nextjs', 'nuxtjs', 'svelte', 'react', 'vue']).default('nextjs'),
  processName: z.string().default('ao-process'),
  ports: z.object({
    dev: z.number().default(3000),
  }).default({ dev: 3000 }),
  aos: z.object({
    version: z.enum(['1.x', '2.x']).default('2.x'),
    features: z.object({
      coroutines: z.boolean().default(true),
      bootloader: z.boolean().default(false),
      weavedrive: z.boolean().default(false),
    }).default({
      coroutines: true,
      bootloader: false,
      weavedrive: false,
    }),
  }).default({
    version: '2.x',
    features: {
      coroutines: true,
      bootloader: false,
      weavedrive: false,
    },
  }),
  ai: z.object({
    provider: z.enum(['openai', 'anthropic']).default('openai'),
    model: z.string().default('gpt-4o'),
    apiKey: z.string().optional(),
  }).optional(),
  runWithAO: z.boolean().default(false),
  tags: z.record(z.string()).default({}),
});

export type AOConfig = z.infer<typeof AOConfigSchema>;

export interface ApplicationState {
  processes: Map<string, ProcessState>;
  projects: Map<string, ProjectState>;
  sessions: Map<string, SessionState>;
}

export interface ProjectState {
  id: string;
  name: string;
  path: string;
  framework: string;
  config: AOConfig;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionState {
  id: string;
  startTime: Date;
  endTime?: Date;
  commands: string[];
  errors: Error[];
} 