// Global test setup
import { jest } from '@jest/globals';

// Mock chalk to avoid ESM import issues
jest.mock('chalk', () => ({
  blue: jest.fn((text: string) => `[BLUE]${text}[/BLUE]`),
  green: jest.fn((text: string) => `[GREEN]${text}[/GREEN]`),
  yellow: jest.fn((text: string) => `[YELLOW]${text}[/YELLOW]`),
  red: jest.fn((text: string) => `[RED]${text}[/RED]`),
  gray: jest.fn((text: string) => `[GRAY]${text}[/GRAY]`),
  cyan: jest.fn((text: string) => `[CYAN]${text}[/CYAN]`),
  magenta: jest.fn((text: string) => `[MAGENTA]${text}[/MAGENTA]`),
  white: jest.fn((text: string) => `[WHITE]${text}[/WHITE]`),
  black: jest.fn((text: string) => `[BLACK]${text}[/BLACK]`),
  bold: jest.fn((text: string) => `[BOLD]${text}[/BOLD]`),
  dim: jest.fn((text: string) => `[DIM]${text}[/DIM]`),
  italic: jest.fn((text: string) => `[ITALIC]${text}[/ITALIC]`),
  underline: jest.fn((text: string) => `[UNDERLINE]${text}[/UNDERLINE]`),
  inverse: jest.fn((text: string) => `[INVERSE]${text}[/INVERSE]`),
  hidden: jest.fn((text: string) => `[HIDDEN]${text}[/HIDDEN]`),
  strikethrough: jest.fn((text: string) => `[STRIKETHROUGH]${text}[/STRIKETHROUGH]`),
  reset: jest.fn((text: string) => `[RESET]${text}[/RESET]`),
}));



// Mock console methods to capture output in tests
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
  info: console.info,
  debug: console.debug,
};

beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();
  
  // Mock console methods to capture output
  console.log = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
  console.info = jest.fn();
  console.debug = jest.fn();
});

afterEach(() => {
  // Restore original console methods
  console.log = originalConsole.log;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
  console.info = originalConsole.info;
  console.debug = originalConsole.debug;
});

// Mock process.exit to prevent tests from exiting
const originalExit = process.exit;
beforeAll(() => {
  process.exit = jest.fn() as any;
});

afterAll(() => {
  process.exit = originalExit;
});

// Test utilities
export const testUtils = {
  getConsoleOutput: () => {
    const calls = (console.log as jest.Mock).mock.calls;
    return calls.map((call: any[]) => call.join(' ')).join('\n');
  },
  getConsoleWarnings: () => {
    const calls = (console.warn as jest.Mock).mock.calls;
    return calls.map((call: any[]) => call.join(' ')).join('\n');
  },
  getConsoleErrors: () => {
    const calls = (console.error as jest.Mock).mock.calls;
    return calls.map((call: any[]) => call.join(' ')).join('\n');
  },
};

// Global test utilities
export const createMockConfig = (overrides: any = {}) => ({
  luaFiles: [],
  packageManager: 'pnpm' as const,
  framework: 'nextjs' as const,
  processName: 'test-process',
  ports: { dev: 3000 },
  aos: {
    version: '2.x' as const,
    features: {
      coroutines: true,
      bootloader: false,
      weavedrive: false,
    },
  },
  runWithAO: false,
  tags: {},
  ...overrides,
});

export const createMockProcessState = (overrides: any = {}) => ({
  id: 'test-process',
  status: 'running' as const,
  startTime: new Date(),
  features: {
    coroutines: true,
    requestResponse: true,
    defaultActions: true,
    bootloader: false,
    weavedrive: false,
    version: '2.x' as const,
  },
  messages: [],
  errors: [],
  config: createMockConfig(),
  ...overrides,
}); 