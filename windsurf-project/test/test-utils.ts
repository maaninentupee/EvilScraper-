import { Logger } from '@nestjs/common';
import { CompletionResult } from '../src/services/providers/BaseProvider';

// Mock environment variables for testing
export const mockEnvironment = {
  useLocalModels: true,
  useLMStudio: true,
  useOllama: true,
  useOpenAI: true,
  useAnthropic: true,
  defaultModelType: 'seo',
  fallbackThreshold: 0.7,
  openAIApiKey: 'test-openai-key',
  anthropicApiKey: 'test-anthropic-key',
  localModelHost: 'http://localhost:5000',
  lmStudioEndpoint: 'http://localhost:1234/v1',
  ollamaEndpoint: 'http://localhost:11434/api',
  providerPriorityArray: ['local', 'lmstudio', 'ollama', 'openai', 'anthropic']
};

// Mocked logger that captures logs
export class MockLogger {
  logs: Record<string, string[]> = {
    log: [],
    error: [],
    warn: [],
    debug: [],
    verbose: []
  };

  log(message: string) {
    this.logs.log.push(message);
  }

  error(message: string) {
    this.logs.error.push(message);
  }

  warn(message: string) {
    this.logs.warn.push(message);
  }

  debug(message: string) {
    this.logs.debug.push(message);
  }

  verbose(message: string) {
    this.logs.verbose.push(message);
  }

  // Helper to clear logs between tests
  clear() {
    this.logs.log = [];
    this.logs.error = [];
    this.logs.warn = [];
    this.logs.debug = [];
    this.logs.verbose = [];
  }
}

// Mock HTTP response builder for API mocking
export const createMockResponse = (status: number, data: any) => {
  return {
    status,
    data,
    headers: {},
  };
};

// Mock Axios implementation
export const mockAxios = {
  post: jest.fn(),
  get: jest.fn(),
  create: jest.fn().mockReturnThis(),
  interceptors: {
    request: { use: jest.fn(), eject: jest.fn() },
    response: { use: jest.fn(), eject: jest.fn() }
  }
};

// API response mocks
export const mockOpenAIResponse = {
  choices: [
    {
      message: {
        content: 'This is OpenAI\'s response'
      }
    }
  ]
};

export const mockAnthropicResponse = {
  content: [
    {
      text: 'This is Anthropic\'s response',
      type: 'text'
    }
  ]
};

// Mock provider completion results
export const mockProviderResults = {
  successLocal: (): CompletionResult => ({
    text: 'Local model response',
    provider: 'local',
    model: 'mistral-7b-instruct-q8_0.gguf',
    success: true,
    qualityScore: 0.8
  }),
  successLMStudio: (): CompletionResult => ({
    text: 'LM Studio response',
    provider: 'lmstudio',
    model: 'mistral-7b-instruct-v0.2',
    success: true,
    qualityScore: 0.9
  }),
  successOllama: (): CompletionResult => ({
    text: 'Ollama response',
    provider: 'ollama',
    model: 'mistral',
    success: true,
    qualityScore: 0.85
  }),
  successOpenAI: (): CompletionResult => ({
    text: 'OpenAI response',
    provider: 'openai',
    model: 'gpt-4-turbo',
    success: true,
    qualityScore: 0.95
  }),
  successAnthropic: (): CompletionResult => ({
    text: 'Anthropic response',
    provider: 'anthropic',
    model: 'claude-3-opus-20240229',
    success: true,
    qualityScore: 0.92
  }),
  failedResult: (provider: string, model: string, error: string = 'Model error'): CompletionResult => ({
    text: '',
    provider,
    model,
    success: false,
    error,
    qualityScore: 0
  })
};

// Test errors
export const mockApiErrors = {
  network: new Error('Network error'),
  unauthorized: { response: { status: 401, data: { error: 'Unauthorized' } } },
  badRequest: { response: { status: 400, data: { error: 'Bad request' } } },
  serverError: { response: { status: 500, data: { error: 'Server error' } } },
  timeout: { code: 'ECONNABORTED', message: 'Timeout error' }
};
