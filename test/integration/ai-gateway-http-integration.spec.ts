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
          text: 'Tämä on Ollama-palveluntarjoajan vastaus',
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
          text: 'Tämä on OpenAI-palveluntarjoajan vastaus',
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
          text: 'Tämä on Anthropic-palveluntarjoajan vastaus',
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
          text: 'Tämä on Local-palveluntarjoajan vastaus',
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
          text: 'Tämä on LM Studio -palveluntarjoajan vastaus',
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
    // Tallenna alkuperäinen Ollama-asetus
    originalOllamaDisabled = process.env.OLLAMA_API_DISABLED;
    
    // Varmista, että Ollama on käytössä ensimmäisessä testissä
    process.env.OLLAMA_API_DISABLED = "false";

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    // Palauta alkuperäinen Ollama-asetus
    if (originalOllamaDisabled) {
      process.env.OLLAMA_API_DISABLED = originalOllamaDisabled;
    } else {
      delete process.env.OLLAMA_API_DISABLED;
    }
    
    await app.close();
  });

  it('should return response from Ollama if available', async () => {
    // Varmista, että Ollama on käytössä
    process.env.OLLAMA_API_DISABLED = "false";

    const response = await request(app.getHttpServer())
      .post('/ai/process')
      .send({ taskType: "seo", input: "Testi" })
      .expect(201);

    expect(response.body).toBeDefined();
    expect(response.body.result).toBeDefined();
    
    // Tarkista, että vastaus sisältää provider-kentän
    expect(response.body.result.provider).toBeDefined();
    
    // Tarkista, että vastaus tuli Ollamalta
    expect(response.body.result.provider).toBe('ollama');
  }, 30000); // Lisää aikaa testin suorittamiseen

  it('should fallback to OpenAI if Ollama fails', async () => {
    // Simuloidaan tilanne, jossa Ollama on pois käytöstä
    process.env.OLLAMA_API_DISABLED = "true";

    const response = await request(app.getHttpServer())
      .post('/ai/process')
      .send({ taskType: "seo", input: "Testi" })
      .expect(201);

    expect(response.body).toBeDefined();
    expect(response.body.result).toBeDefined();
    
    // Tarkista, että vastaus sisältää provider-kentän
    expect(response.body.result.provider).toBeDefined();
    
    // Tarkista, että vastaus ei tullut Ollamalta
    expect(response.body.result.provider).not.toBe('ollama');
    
    // Tarkista, että vastaus tuli OpenAI:lta (seuraava prioriteetissa)
    expect(response.body.result.provider).toBe('openai');
  }, 30000); // Lisää aikaa testin suorittamiseen

  it('should include wasFailover flag when fallback occurs', async () => {
    // Simuloidaan tilanne, jossa Ollama on pois käytöstä
    process.env.OLLAMA_API_DISABLED = "true";

    const response = await request(app.getHttpServer())
      .post('/ai/process')
      .send({ taskType: "seo", input: "Testi" })
      .expect(201);

    expect(response.body).toBeDefined();
    expect(response.body.result).toBeDefined();
    
    // Tarkista, että vastaus sisältää wasFailover-kentän ja se on true
    expect(response.body.result.wasFailover).toBeDefined();
    expect(response.body.result.wasFailover).toBe(true);
  }, 30000); // Lisää aikaa testin suorittamiseen
});
