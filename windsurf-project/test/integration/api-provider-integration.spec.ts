import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { AIGateway } from '../../src/services/AIGateway';

// Mock environment configuration
jest.mock('../../src/config/environment', () => ({
  environment: {
    useLocalModels: true,
    useLMStudio: true,
    useOllama: true,
    useOpenAI: true,
    useAnthropic: true,
    providerPriorityArray: ['local', 'lmstudio', 'ollama', 'openai', 'anthropic'],
    providerPriority: {
      local: 1,
      lmstudio: 2,
      ollama: 3,
      openai: 4,
      anthropic: 5
    }
  }
}));

describe('API-Provider Integration Tests', () => {
  let app: INestApplication;
  let aiGateway: AIGateway;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    aiGateway = moduleRef.get<AIGateway>(AIGateway);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  describe('/evil-bot/decide (POST)', () => {
    it('should make a decision with successful provider response', async () => {
      // Mock AIGateway to return successful response
      jest.spyOn(aiGateway, 'processAIRequest').mockResolvedValue({
        text: JSON.stringify({
          action: 'Send chatbot',
          reason: 'Chatbot is more interactive',
          confidence: 0.85
        }),
        success: true,
        provider: 'local',
        model: 'mistral-7b-instruct-q8_0.gguf'
      });

      // Make the API call
      const response = await request(app.getHttpServer())
        .post('/evil-bot/decide')
        .send({
          situation: 'User is new to the site',
          options: ['Send chatbot', 'Send newsletter']
        });

      // Verify response
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('action', 'Send chatbot');
      expect(response.body).toHaveProperty('reason', 'Chatbot is more interactive');
      expect(response.body).toHaveProperty('confidence', 0.85);
    });

    it('should handle provider failures and use fallback', async () => {
      // Mock AIGateway to return successful response from fallback
      jest.spyOn(aiGateway, 'processAIRequest').mockResolvedValue({
        text: JSON.stringify({
          action: 'Send newsletter',
          reason: 'Newsletter is less intrusive',
          confidence: 0.75
        }),
        success: true,
        provider: 'openai',
        model: 'gpt-4-turbo'
      });
      
      // Make the API call
      const response = await request(app.getHttpServer())
        .post('/evil-bot/decide')
        .send({
          situation: 'User is new to the site',
          options: ['Send chatbot', 'Send newsletter']
        });

      // Verify response
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('action', 'Send newsletter');
      expect(response.body).toHaveProperty('reason', 'Newsletter is less intrusive');
      expect(response.body).toHaveProperty('confidence', 0.75);
    });

    it('should handle all provider failures gracefully', async () => {
      // Mock AIGateway to throw error
      jest.spyOn(aiGateway, 'processAIRequest').mockRejectedValue(new Error('All providers failed'));

      // Make the API call
      const response = await request(app.getHttpServer())
        .post('/evil-bot/decide')
        .send({
          situation: 'User is new to the site',
          options: ['Send chatbot', 'Send newsletter']
        });

      // Verify response - EvilBotService returns an error and doesn't throw an exception
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('action', 'Error');
      expect(response.body).toHaveProperty('reason');
      expect(response.body.reason).toContain('Decision-making failed');
      expect(response.body).toHaveProperty('confidence', 0);
    });
  });
});
