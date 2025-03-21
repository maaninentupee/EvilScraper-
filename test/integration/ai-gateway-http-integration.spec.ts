import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { environment } from '../../src/config/environment';
import { ProviderType } from '../../src/services/ModelSelector';

// Mock environment configuration
jest.mock('../../src/config/environment', () => {
  const originalModule = jest.requireActual('../../src/config/environment');
  return {
    ...originalModule,
    environment: {
      ...originalModule.environment,
      providerPriority: {
        ollama: 1,
        openai: 2,
        anthropic: 3,
        local: 4,
        lmstudio: 5
      },
      providerPriorityArray: ['ollama', 'openai', 'anthropic', 'local', 'lmstudio'] as ProviderType[],
      useOllama: true,
      useOpenAI: true,
      useAnthropic: true,
      useLocalModels: true,
      useLMStudio: true
    }
  };
});

// Mock providers
jest.mock('../../src/services/providers/OllamaProvider', () => {
  return {
    OllamaProvider: jest.fn().mockImplementation(() => ({
      generateCompletion: jest.fn().mockImplementation((request) => {
        if (process.env.OLLAMA_API_DISABLED === 'true') {
          return Promise.reject(new Error('Ollama API is disabled'));
        }
        return Promise.resolve({
          success: true,
          text: 'This is the response from the Ollama provider',
          provider: 'ollama',
          model: request.modelName || 'mistral',
          latency: 150
        });
      }),
      isAvailable: jest.fn().mockImplementation(() => {
        return Promise.resolve(process.env.OLLAMA_API_DISABLED !== 'true');
      }),
      getName: jest.fn().mockReturnValue('ollama'),
      getServiceStatus: jest.fn().mockReturnValue({
        isAvailable: process.env.OLLAMA_API_DISABLED !== 'true',
        lastError: null,
        lastErrorTime: null,
        consecutiveFailures: 0,
        totalRequests: 10,
        successfulRequests: 9,
        successRate: '90%',
        averageLatency: 150
      })
    }))
  };
});

jest.mock('../../src/services/providers/OpenAIProvider', () => {
  return {
    OpenAIProvider: jest.fn().mockImplementation(() => ({
      generateCompletion: jest.fn().mockImplementation((request) => {
        return Promise.resolve({
          success: true,
          text: 'This is the response from the OpenAI provider',
          provider: 'openai',
          model: request.modelName || 'gpt-4-turbo',
          latency: 250
        });
      }),
      isAvailable: jest.fn().mockReturnValue(Promise.resolve(true)),
      getName: jest.fn().mockReturnValue('openai'),
      getServiceStatus: jest.fn().mockReturnValue({
        isAvailable: true,
        lastError: null,
        lastErrorTime: null,
        consecutiveFailures: 0,
        totalRequests: 20,
        successfulRequests: 20,
        successRate: '100%',
        averageLatency: 250
      })
    }))
  };
});

jest.mock('../../src/services/providers/AnthropicProvider', () => {
  return {
    AnthropicProvider: jest.fn().mockImplementation(() => ({
      generateCompletion: jest.fn().mockImplementation((request) => {
        return Promise.resolve({
          success: true,
          text: 'This is the response from the Anthropic provider',
          provider: 'anthropic',
          model: request.modelName || 'claude-3-opus-20240229',
          latency: 300
        });
      }),
      isAvailable: jest.fn().mockReturnValue(Promise.resolve(true)),
      getName: jest.fn().mockReturnValue('anthropic'),
      getServiceStatus: jest.fn().mockReturnValue({
        isAvailable: true,
        lastError: null,
        lastErrorTime: null,
        consecutiveFailures: 0,
        totalRequests: 15,
        successfulRequests: 15,
        successRate: '100%',
        averageLatency: 300
      })
    }))
  };
});

jest.mock('../../src/services/providers/LocalProvider', () => {
  return {
    LocalProvider: jest.fn().mockImplementation(() => ({
      generateCompletion: jest.fn().mockImplementation((request) => {
        return Promise.resolve({
          success: true,
          text: 'This is the response from the Local provider',
          provider: 'local',
          model: request.modelName || 'mistral-7b-instruct-q8_0.gguf',
          latency: 100
        });
      }),
      isAvailable: jest.fn().mockReturnValue(Promise.resolve(true)),
      getName: jest.fn().mockReturnValue('local'),
      getServiceStatus: jest.fn().mockReturnValue({
        isAvailable: true,
        lastError: null,
        lastErrorTime: null,
        consecutiveFailures: 0,
        totalRequests: 5,
        successfulRequests: 5,
        successRate: '100%',
        averageLatency: 100
      })
    }))
  };
});

jest.mock('../../src/services/providers/LMStudioProvider', () => {
  return {
    LMStudioProvider: jest.fn().mockImplementation(() => ({
      generateCompletion: jest.fn().mockImplementation((request) => {
        return Promise.resolve({
          success: true,
          text: 'This is the response from the LM Studio provider',
          provider: 'lmstudio',
          model: request.modelName || 'mistral-7b-instruct-v0.2',
          latency: 120
        });
      }),
      isAvailable: jest.fn().mockReturnValue(Promise.resolve(true)),
      getName: jest.fn().mockReturnValue('lmstudio'),
      getServiceStatus: jest.fn().mockReturnValue({
        isAvailable: true,
        lastError: null,
        lastErrorTime: null,
        consecutiveFailures: 0,
        totalRequests: 8,
        successfulRequests: 8,
        successRate: '100%',
        averageLatency: 120
      })
    }))
  };
});

describe('AIGateway HTTP Integration Tests', () => {
  let app: INestApplication;
  let originalOllamaDisabled: string | undefined;

  beforeAll(async () => {
    // Save the original Ollama setting
    originalOllamaDisabled = process.env.OLLAMA_API_DISABLED;
    
    // Ensure that Ollama is enabled in the first test
    process.env.OLLAMA_API_DISABLED = "false";

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    // Restore the original Ollama setting
    if (originalOllamaDisabled) {
      process.env.OLLAMA_API_DISABLED = originalOllamaDisabled;
    } else {
      delete process.env.OLLAMA_API_DISABLED;
    }
    
    await app.close();
  });

  it('should return response from Ollama if available', async () => {
    // Ensure that Ollama is enabled
    process.env.OLLAMA_API_DISABLED = "false";

    const response = await request(app.getHttpServer())
      .post('/ai/process')
      .send({ taskType: "seo", input: "Test" })
      .expect(201);

    expect(response.body).toBeDefined();
    expect(response.body.result).toBeDefined();
    
    // Check that the response contains the provider field
    expect(response.body.result.provider).toBeDefined();
    
    // Check that the response came from Ollama
    expect(response.body.result.provider).toBe('ollama');
  }, 30000); // Add more time for test execution

  it('should fallback to OpenAI if Ollama fails', async () => {
    // Simulate a situation where Ollama is disabled
    process.env.OLLAMA_API_DISABLED = "true";

    const response = await request(app.getHttpServer())
      .post('/ai/process')
      .send({ taskType: "seo", input: "Test" })
      .expect(201);

    expect(response.body).toBeDefined();
    expect(response.body.result).toBeDefined();
    
    // Check that the response contains the provider field
    expect(response.body.result.provider).toBeDefined();
    
    // Check that the response did not come from Ollama
    expect(response.body.result.provider).not.toBe('ollama');
    
    // Check that the response came from OpenAI (next in priority)
    expect(response.body.result.provider).toBe('openai');
  }, 30000); // Add more time for test execution

  it('should include wasFailover flag when fallback occurs', async () => {
    // Simulate a situation where Ollama is disabled
    process.env.OLLAMA_API_DISABLED = "true";

    const response = await request(app.getHttpServer())
      .post('/ai/process')
      .send({ taskType: "seo", input: "Test" })
      .expect(201);

    expect(response.body).toBeDefined();
    expect(response.body.result).toBeDefined();
    
    // Check that the response contains the wasFailover field and it is true
    expect(response.body.result.wasFailover).toBeDefined();
    expect(response.body.result.wasFailover).toBe(true);
  }, 30000); // Add more time for test execution
});
