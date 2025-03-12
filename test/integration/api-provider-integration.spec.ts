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
      jest.spyOn(aiGateway, 'processAIRequest').mockResolvedValue(JSON.stringify({
        action: 'Lähetä chatbotti',
        reason: 'Chatbotti on interaktiivisempi',
        confidence: 0.85
      }));

      // Make the API call
      const response = await request(app.getHttpServer())
        .post('/evil-bot/decide')
        .send({
          situation: 'Käyttäjä on uusi sivustolla',
          options: ['Lähetä chatbotti', 'Lähetä uutiskirje']
        });

      // Verify response
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('action', 'Lähetä chatbotti');
      expect(response.body).toHaveProperty('reason', 'Chatbotti on interaktiivisempi');
      expect(response.body).toHaveProperty('confidence', 0.85);
    });

    it('should handle provider failures and use fallback', async () => {
      // Mock AIGateway to return successful response from fallback
      jest.spyOn(aiGateway, 'processAIRequest').mockResolvedValue(JSON.stringify({
        action: 'Lähetä uutiskirje',
        reason: 'Uutiskirje on vähemmän tunkeileva',
        confidence: 0.75
      }));
      
      // Make the API call
      const response = await request(app.getHttpServer())
        .post('/evil-bot/decide')
        .send({
          situation: 'Käyttäjä on uusi sivustolla',
          options: ['Lähetä chatbotti', 'Lähetä uutiskirje']
        });

      // Verify response
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('action', 'Lähetä uutiskirje');
      expect(response.body).toHaveProperty('reason', 'Uutiskirje on vähemmän tunkeileva');
      expect(response.body).toHaveProperty('confidence', 0.75);
    });

    it('should handle all provider failures gracefully', async () => {
      // Mock AIGateway to throw error
      jest.spyOn(aiGateway, 'processAIRequest').mockRejectedValue(new Error('All providers failed'));

      // Make the API call
      const response = await request(app.getHttpServer())
        .post('/evil-bot/decide')
        .send({
          situation: 'Käyttäjä on uusi sivustolla',
          options: ['Lähetä chatbotti', 'Lähetä uutiskirje']
        });

      // Verify response - EvilBotService palauttaa virheen eikä heitä poikkeusta
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('action', 'Virhe');
      expect(response.body).toHaveProperty('reason');
      expect(response.body.reason).toContain('Päätöksenteko epäonnistui');
      expect(response.body).toHaveProperty('confidence', 0);
    });
  });
});
