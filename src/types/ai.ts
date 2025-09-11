export type AIProvider = 'openai' | 'anthropic';

export interface GenerationOptions {
  provider: AIProvider;
  model: string;
  temperature?: number;
  maxTokens?: number;
  type: 'contract' | 'module' | 'test' | 'template';
  context?: string;
}

export interface GeneratedCode {
  code: string;
  metadata: {
    provider: AIProvider;
    model: string;
    type: string;
    timestamp: Date;
    tokens: number;
  };
  validation: ValidationResult;
}

export interface ContractTemplate {
  name: string;
  type: ContractType;
  description: string;
  template: string;
  variables: TemplateVariable[];
  examples: string[];
}

export type ContractType = 'token' | 'counter' | 'oracle' | 'game' | 'dao' | 'custom';

export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean';
  description: string;
  required: boolean;
  defaultValue?: any;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export interface AIAnalysisResult {
  suggestions: string[];
  improvements: string[];
  issues: string[];
  complexity: 'low' | 'medium' | 'high';
} 