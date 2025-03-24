import { Test, TestingModule } from '@nestjs/testing';
import { AIController } from '../../src/controllers/ai.controller';
import { AIGateway, AIResponse } from '../../src/services/AIGateway';
import { EvilBotService } from '../../src/services/EvilBotService';
import { ConfigService } from '@nestjs/config';
import { MockLogger } from '../test-utils';

// Define mock interfaces to match the actual implementations
interface MockAIGateway {
  processAIRequest: jest.Mock;
  processAIRequestWithFallback: jest.Mock;
  getAvailableProviders: jest.Mock;
  getModels: jest.Mock;
  processBatch: jest.Mock;
  process: jest.Mock;
  logger: any;
}

interface MockEvilBotService {
  generateResponse: jest.Mock;
}

describe('AIController', () => {
  let controller: AIController;
  let mockAIGateway: MockAIGateway;
  let mockEvilBotService: MockEvilBotService;
  let mockConfigService: Partial<ConfigService>;

  beforeEach(async () => {
    // Create mock implementations
    mockAIGateway = {
      processAIRequest: jest.fn(),
      processAIRequestWithFallback: jest.fn(),
      getAvailableProviders: jest.fn(),
      getModels: jest.fn(),
      processBatch: jest.fn(),
      process: jest.fn(),
      logger: new MockLogger()
    };

    mockEvilBotService = {
      generateResponse: jest.fn()
    };

    mockConfigService = {
      get: jest.fn()
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AIController],
      providers: [
        { provide: AIGateway, useValue: mockAIGateway },
        { provide: EvilBotService, useValue: mockEvilBotService },
        { provide: ConfigService, useValue: mockConfigService }
      ],
    }).compile();

    controller = module.get<AIController>(AIController);
    // @ts-ignore - Replace private logger with mock
    controller['logger'] = new MockLogger();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('generateCompletion', () => {
    it('should call AIGateway.process with correct parameters', async () => {
      const mockResponse: AIResponse = {
        success: true,
        provider: 'openai',
        model: 'gpt-4',
        result: 'Generated text'
      };
      
      mockAIGateway.process.mockResolvedValue(mockResponse);

      const result = await controller.generateCompletion({
        input: 'Test prompt',
        taskType: 'seo'
      }, '127.0.0.1');

      expect(mockAIGateway.process).toHaveBeenCalledWith(
        expect.objectContaining({
          input: 'Test prompt',
          taskType: 'seo'
        })
      );
      
      expect(result).toEqual(mockResponse);
    });

    it('should use default task type if not provided', async () => {
      const mockResponse: AIResponse = {
        success: true,
        provider: 'openai',
        model: 'gpt-4',
        result: 'Generated text'
      };
      
      mockAIGateway.process.mockResolvedValue(mockResponse);

      await controller.generateCompletion({
        input: 'Test prompt'
      }, '127.0.0.1');

      expect(mockAIGateway.process).toHaveBeenCalledWith(
        expect.objectContaining({
          input: 'Test prompt'
        })
      );
    });
  });

  describe('generateEvilBotResponse', () => {
    it('should call EvilBotService.generateResponse with correct parameters', async () => {
      mockEvilBotService.generateResponse.mockResolvedValue('Evil response');

      const result = await controller.generateEvilBotResponse({
        input: 'Test prompt'
      }, '127.0.0.1');

      expect(mockEvilBotService.generateResponse).toHaveBeenCalledWith('Test prompt');
      expect(result).toEqual({
        result: 'Evil response',
        success: true,
        provider: 'evilbot',
        model: 'evilbot-v1'
      });
    });
  });

  describe('processBatch', () => {
    it('should call AIGateway.processBatch with correct parameters', async () => {
      const mockResponses: AIResponse[] = [
        {
          success: true,
          provider: 'openai',
          model: 'gpt-4',
          result: 'Result 1'
        },
        {
          success: true,
          provider: 'openai',
          model: 'gpt-4',
          result: 'Result 2'
        }
      ];
      
      mockAIGateway.processBatch.mockResolvedValue(mockResponses);

      const result = await controller.processBatch({
        inputs: ['Input 1', 'Input 2'],
        taskType: 'code'
      }, '127.0.0.1');

      expect(mockAIGateway.processBatch).toHaveBeenCalledWith(
        expect.objectContaining({
          inputs: ['Input 1', 'Input 2'],
          taskType: 'code'
        })
      );
      
      expect(result).toEqual(mockResponses);
    });
  });

  describe('getProviders', () => {
    it('should return available providers', async () => {
      const providers = [
        { name: 'openai', available: true },
        { name: 'anthropic', available: true },
        { name: 'ollama', available: false }
      ];
      
      mockAIGateway.getAvailableProviders.mockResolvedValue(providers);

      const result = await controller.getProviders();

      expect(result).toEqual(providers);
    });
  });

  describe('getModels', () => {
    it('should return models for all task types and providers', () => {
      const models = {
        seo: {
          openai: 'openai:gpt-4',
          anthropic: 'anthropic:claude-2',
          ollama: 'ollama:llama2'
        },
        code: {
          openai: 'openai:gpt-3.5-turbo',
          anthropic: 'anthropic:claude-instant',
          ollama: 'ollama:mistral'
        }
      };

      mockAIGateway.getModels.mockReturnValue(models);

      const result = controller.getModels();

      expect(result).toEqual(models);
    });
  });
});
