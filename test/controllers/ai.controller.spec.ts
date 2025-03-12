import { Test, TestingModule } from '@nestjs/testing';
import { AIController } from '../../src/controllers/ai.controller';
import { AIGateway } from '../../src/services/AIGateway';
import { AIService } from '../../src/services/AIService';
import { ModelSelector } from '../../src/services/ModelSelector';
import { ProviderRegistry } from '../../src/services/providers/ProviderRegistry';
import { MockLogger } from '../test-utils';

describe('AIController', () => {
  let controller: AIController;
  let mockAIGateway: jest.Mocked<AIGateway>;
  let mockAIService: jest.Mocked<AIService>;
  let mockModelSelector: jest.Mocked<ModelSelector>;
  let mockProviderRegistry: jest.Mocked<ProviderRegistry>;

  beforeEach(async () => {
    mockAIGateway = {
      processAIRequest: jest.fn(),
      processAIRequestWithFallback: jest.fn()
    } as any;

    mockAIService = {
      analyzeSEO: jest.fn(),
      generateCode: jest.fn(),
      makeDecision: jest.fn()
    } as any;

    mockModelSelector = {
      getModel: jest.fn()
    } as any;

    mockProviderRegistry = {
      getProviderByName: jest.fn(),
      getAvailableProviders: jest.fn()
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AIController],
      providers: [
        { provide: AIGateway, useValue: mockAIGateway },
        { provide: AIService, useValue: mockAIService },
        { provide: ModelSelector, useValue: mockModelSelector },
        { provide: ProviderRegistry, useValue: mockProviderRegistry }
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
    it('should call AIGateway.processAIRequest with correct parameters', async () => {
      mockAIGateway.processAIRequest.mockResolvedValue('Generated text');

      const result = await controller.generateCompletion({
        prompt: 'Test prompt',
        modelType: 'seo'
      });

      expect(mockAIGateway.processAIRequest).toHaveBeenCalledWith(
        'seo',
        'Test prompt'
      );
      expect(result).toEqual({
        result: 'Generated text',
        success: true
      });
    });

    it('should use default model type if not provided', async () => {
      mockAIGateway.processAIRequest.mockResolvedValue('Generated text');

      await controller.generateCompletion({
        prompt: 'Test prompt'
      });

      expect(mockAIGateway.processAIRequest).toHaveBeenCalledWith(
        'seo',
        'Test prompt'
      );
    });
  });

  describe('processAIRequest', () => {
    it('should call AIGateway.processAIRequestWithFallback with correct parameters', async () => {
      mockAIGateway.processAIRequestWithFallback.mockResolvedValue('AI result');

      const result = await controller.processAIRequest({
        input: 'Test input',
        taskType: 'code'
      });

      expect(mockAIGateway.processAIRequestWithFallback).toHaveBeenCalledWith(
        'code',
        'Test input'
      );
      expect(result).toEqual({
        result: 'AI result',
        success: true
      });
    });

    it('should use default task type if not provided', async () => {
      mockAIGateway.processAIRequestWithFallback.mockResolvedValue('AI result');

      await controller.processAIRequest({
        input: 'Test input'
      });

      expect(mockAIGateway.processAIRequestWithFallback).toHaveBeenCalledWith(
        'seo',
        'Test input'
      );
    });
  });

  describe('analyzeSEO', () => {
    it('should call AIService.analyzeSEO with correct parameters', async () => {
      mockAIService.analyzeSEO.mockResolvedValue({
        result: 'SEO analysis',
        model: 'test-model'
      });

      const result = await controller.analyzeSEO({
        title: 'Test title',
        description: 'Test description',
        content: 'Test content'
      });

      expect(mockAIService.analyzeSEO).toHaveBeenCalledWith({
        title: 'Test title',
        description: 'Test description',
        content: 'Test content'
      });
      expect(result).toEqual({
        result: {
          result: 'SEO analysis',
          model: 'test-model'
        },
        success: true
      });
    });

    it('should handle errors from AIService.analyzeSEO', async () => {
      mockAIService.analyzeSEO.mockRejectedValue(new Error('SEO error'));

      const result = await controller.analyzeSEO({
        title: 'Test title'
      });

      expect(result).toEqual({
        result: null,
        success: false,
        error: 'SEO error'
      });
    });
  });

  describe('generateCode', () => {
    it('should call AIService.generateCode with correct parameters', async () => {
      mockAIService.generateCode.mockResolvedValue({
        result: 'Generated code',
        model: 'test-model'
      });

      const result = await controller.generateCode({
        language: 'typescript',
        description: 'Test function',
        requirements: ['Fast', 'Secure']
      });

      expect(mockAIService.generateCode).toHaveBeenCalledWith({
        language: 'typescript',
        description: 'Test function',
        requirements: ['Fast', 'Secure']
      });
      expect(result).toEqual({
        result: {
          result: 'Generated code',
          model: 'test-model'
        },
        success: true
      });
    });

    it('should handle errors from AIService.generateCode', async () => {
      mockAIService.generateCode.mockRejectedValue(new Error('Code generation error'));

      const result = await controller.generateCode({
        language: 'typescript',
        description: 'Test function'
      });

      expect(result).toEqual({
        result: null,
        success: false,
        error: 'Code generation error'
      });
    });
  });

  describe('makeDecision', () => {
    it('should call AIService.makeDecision with correct parameters', async () => {
      mockAIService.makeDecision.mockResolvedValue({
        result: 'Decision result',
        model: 'test-model'
      });

      const result = await controller.makeDecision({
        situation: 'Test situation',
        options: ['Option A', 'Option B']
      });

      expect(mockAIService.makeDecision).toHaveBeenCalledWith({
        situation: 'Test situation',
        options: ['Option A', 'Option B']
      });
      expect(result).toEqual({
        result: {
          result: 'Decision result',
          model: 'test-model'
        },
        success: true
      });
    });

    it('should handle errors from AIService.makeDecision', async () => {
      mockAIService.makeDecision.mockRejectedValue(new Error('Decision error'));

      const result = await controller.makeDecision({
        situation: 'Test situation',
        options: ['Option A', 'Option B']
      });

      expect(result).toEqual({
        result: null,
        success: false,
        error: 'Decision error'
      });
    });
  });

  describe('getModels', () => {
    it('should return models for all task types and providers', () => {
      // Mock ModelSelector.getAvailableModels
      mockModelSelector.getModel = jest.fn()
        // SEO models
        .mockReturnValueOnce('local-seo-model')
        .mockReturnValueOnce('lmstudio-seo-model')
        .mockReturnValueOnce('ollama-seo-model')
        .mockReturnValueOnce('openai-seo-model')
        .mockReturnValueOnce('anthropic-seo-model')
        
        // Code models
        .mockReturnValueOnce('local-code-model')
        .mockReturnValueOnce('lmstudio-code-model')
        .mockReturnValueOnce('ollama-code-model')
        .mockReturnValueOnce('openai-code-model')
        .mockReturnValueOnce('anthropic-code-model')
        
        // Decision models
        .mockReturnValueOnce('local-decision-model')
        .mockReturnValueOnce('lmstudio-decision-model')
        .mockReturnValueOnce('ollama-decision-model')
        .mockReturnValueOnce('openai-decision-model')
        .mockReturnValueOnce('anthropic-decision-model');

      // Mock environment settings
      const mockEnvironment = {
        useLocalModels: true,
        useLMStudio: true,
        useOllama: true,
        useOpenAI: true,
        useAnthropic: true
      };

      // Create a mock implementation for getAvailableModels
      mockModelSelector.getAvailableModels = jest.fn().mockImplementation(() => {
        const modelTypes = ['seo', 'code', 'decision'];
        const models = {};
        
        for (const type of modelTypes) {
          models[type] = {};
          
          if (mockEnvironment.useLocalModels) {
            models[type]['local'] = mockModelSelector.getModel(type, 'local');
          }
          
          if (mockEnvironment.useLMStudio) {
            models[type]['lmstudio'] = mockModelSelector.getModel(type, 'lmstudio');
          }
          
          if (mockEnvironment.useOllama) {
            models[type]['ollama'] = mockModelSelector.getModel(type, 'ollama');
          }
          
          if (mockEnvironment.useOpenAI) {
            models[type]['openai'] = mockModelSelector.getModel(type, 'openai');
          }
          
          if (mockEnvironment.useAnthropic) {
            models[type]['anthropic'] = mockModelSelector.getModel(type, 'anthropic');
          }
        }
        
        return { 
          models,
          modelDetails: {},
          environmentConfig: mockEnvironment
        };
      });

      const result = controller.getModels();

      expect(result).toEqual({
        models: {
          seo: {
            local: 'local-seo-model',
            lmstudio: 'lmstudio-seo-model',
            ollama: 'ollama-seo-model',
            openai: 'openai-seo-model',
            anthropic: 'anthropic-seo-model'
          },
          code: {
            local: 'local-code-model',
            lmstudio: 'lmstudio-code-model',
            ollama: 'ollama-code-model',
            openai: 'openai-code-model',
            anthropic: 'anthropic-code-model'
          },
          decision: {
            local: 'local-decision-model',
            lmstudio: 'lmstudio-decision-model',
            ollama: 'ollama-decision-model',
            openai: 'openai-decision-model',
            anthropic: 'anthropic-decision-model'
          }
        },
        modelDetails: {},
        environmentConfig: mockEnvironment
      });
    });
  });
});
