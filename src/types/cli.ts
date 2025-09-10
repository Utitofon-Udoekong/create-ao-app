import { Command } from 'commander';

export interface CommandOption {
  flag: string;
  description: string;
  defaultValue?: any;
  required?: boolean;
}

export interface CommandContext {
  program: Command;
  options: Record<string, any>;
}

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

export interface PerformanceMetric {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
}

export interface PerformanceReport {
  metrics: PerformanceMetric[];
  summary: {
    totalDuration: number;
    averageDuration: number;
    slowestOperation: string;
  };
} 