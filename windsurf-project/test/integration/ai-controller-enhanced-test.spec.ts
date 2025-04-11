import { Test, TestingModule } from '@nestjs/testing';
import { AIControllerEnhanced } from '../../src/controllers/AIControllerEnhanced';
import { AIGatewayEnhancer } from '../../src/services/AIGatewayEnhancer';
import { SelectionStrategy } from '../../src/services/utils/ProviderSelectionStrategy';
import { HttpException } from '@nestjs/common';

/**
 * AIControllerEnhanced Integration Tests
 * 
 * These tests verify that the controller correctly calls AIGatewayEnhancer
 * in different scenarios and handles responses appropriately.
 */
describe('AIControllerEnhanced Integration Tests', () => {
  let aiController: AIControllerEnhanced;
  let aiGatewayEnhancer: AIGatewayEnhancer;

  beforeEach(async () => {
    // Create a mock AIGatewayEnhancer
    const mockAIGatewayEnhancer = {
      processWithSmartFallback: jest.fn(),
      processBatchWithSmartFallback: jest.fn()
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AIControllerEnhanced],
      providers: [
        {
          provide: AIGatewayEnhancer,
          useValue: mockAIGatewayEnhancer
        }
      ]
    }).compile();

    aiController = module.get<AIControllerEnhanced>(AIControllerEnhanced);
    aiGatewayEnhancer = module.get<AIGatewayEnhancer>(AIGatewayEnhancer);

    // Silence console output during tests
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processWithSmartFallback', () => {
    it('should call AIGatewayEnhancer.processWithSmartFallback with correct parameters', async () => {
      // Mock successful response
      jest.spyOn(aiGatewayEnhancer, 'processWithSmartFallback').mockResolvedValue({
        success: true,
        result: 'Test response',
        provider: 'openai',
        model: 'gpt-4-turbo',
        latency: 1234
      });

      // Call the controller method
      const response = await aiController.processWithSmartFallback({
        input: 'Test input',
        taskType: 'text-generation',
        strategy: 'performance',
        providerName: 'openai',
        cacheResults: true
      }, '127.0.0.1');

      // Verify AIGatewayEnhancer was called with correct parameters
      expect(aiGatewayEnhancer.processWithSmartFallback).toHaveBeenCalledWith(
        'text-generation',
        'Test input',
        expect.objectContaining({
          strategy: SelectionStrategy.PERFORMANCE,
          providerName: 'openai',
          cacheResults: true,
          testMode: false
        })
      );

      // Verify response structure
      expect(response).toEqual({
        success: true,
        result: 'Test response',
        provider: 'openai',
        model: 'gpt-4-turbo',
        latency: expect.any(Number)
      });
    });

    it('should handle fallback scenarios correctly', async () => {
      // Mock response with fallback
      jest.spyOn(aiGatewayEnhancer, 'processWithSmartFallback').mockResolvedValue({
        success: true,
        result: 'Fallback response',
        provider: 'anthropic',
        model: 'claude-3-opus',
        wasFailover: true,
        latency: 2345
      });

      // Call the controller method
      const response = await aiController.processWithSmartFallback({
        input: 'Test input',
        taskType: 'text-generation',
        strategy: 'reliability',
        providerName: 'openai'
      }, '127.0.0.1');

      // Verify response structure
      expect(response).toEqual({
        success: true,
        result: 'Fallback response',
        provider: 'anthropic',
        model: 'claude-3-opus',
        wasFailover: true,
        latency: expect.any(Number)
      });
    });

    it('should handle error scenarios correctly', async () => {
      // Mock error response
      jest.spyOn(aiGatewayEnhancer, 'processWithSmartFallback').mockResolvedValue({
        success: false,
        error: 'All providers failed',
        errorType: 'provider_error',
        provider: 'none',
        model: 'none'
      });

      // Call the controller method and expect it to throw
      await expect(aiController.processWithSmartFallback({
        input: 'Test input',
        taskType: 'text-generation'
      }, '127.0.0.1')).rejects.toThrow(HttpException);
    });

    it('should throw HttpException when input is empty', async () => {
      // Call with empty input
      await expect(aiController.processWithSmartFallback({
        input: '',
        taskType: 'text-generation'
      }, '127.0.0.1')).rejects.toThrow(HttpException);

      // Verify AIGatewayEnhancer was not called
      expect(aiGatewayEnhancer.processWithSmartFallback).not.toHaveBeenCalled();
    });

    it('should throw HttpException when taskType is empty', async () => {
      // Call with empty taskType
      await expect(aiController.processWithSmartFallback({
        input: 'Test input',
        taskType: ''
      }, '127.0.0.1')).rejects.toThrow(HttpException);

      // Verify AIGatewayEnhancer was not called
      expect(aiGatewayEnhancer.processWithSmartFallback).not.toHaveBeenCalled();
    });

    it('should handle exceptions from AIGatewayEnhancer', async () => {
      // Mock exception
      jest.spyOn(aiGatewayEnhancer, 'processWithSmartFallback').mockRejectedValue(
        new Error('Internal service error')
      );

      await expect(
        aiController.processWithSmartFallback({
          input: 'Test input'
        }, '127.0.0.1')
      ).rejects.toThrow(HttpException);
    });
  });

  describe('processBatchWithSmartFallback', () => {
    it('should call AIGatewayEnhancer.processBatchWithSmartFallback with correct parameters', async () => {
      // Mock successful batch response
      jest.spyOn(aiGatewayEnhancer, 'processBatchWithSmartFallback').mockResolvedValue([
        {
          success: true,
          result: 'Batch response 1',
          provider: 'openai',
          model: 'gpt-4-turbo',
          latency: 1234
        },
        {
          success: true,
          result: 'Batch response 2',
          provider: 'openai',
          model: 'gpt-4-turbo',
          latency: 1345
        }
      ]);

      // Call the controller method
      const response = await aiController.processBatchWithSmartFallback({
        inputs: ['Input 1', 'Input 2'],
        taskType: 'text-generation',
        strategy: 'cost',
        providerName: 'anthropic',
        cacheResults: false
      }, '127.0.0.1');

      // Verify AIGatewayEnhancer was called with correct parameters
      expect(aiGatewayEnhancer.processBatchWithSmartFallback).toHaveBeenCalledWith(
        ['Input 1', 'Input 2'],
        'text-generation',
        expect.objectContaining({
          strategy: SelectionStrategy.COST_OPTIMIZED,
          providerName: 'anthropic',
          cacheResults: false,
          testMode: false
        })
      );

      expect(response).toHaveLength(2);
      expect(response[0]).toEqual({
        success: true,
        result: 'Batch response 1',
        provider: 'openai',
        model: 'gpt-4-turbo',
        latency: expect.any(Number)
      });
      expect(response[1]).toEqual({
        success: true,
        result: 'Batch response 2',
        provider: 'openai',
        model: 'gpt-4-turbo',
        latency: expect.any(Number)
      });
    });

    it('should handle batch requests with fallback correctly', async () => {
      // Mock batch response with fallback
      jest.spyOn(aiGatewayEnhancer, 'processBatchWithSmartFallback').mockResolvedValue([
        {
          success: true,
          result: 'Batch response with fallback',
          provider: 'anthropic',
          model: 'claude-3-opus',
          wasFailover: true,
          latency: 2345
        }
      ]);

      // Call the controller method
      const response = await aiController.processBatchWithSmartFallback({
        inputs: ['Test input'],
        taskType: 'text-generation',
        providerName: 'openai'
      }, '127.0.0.1');

      // Verify response includes fallback information
      expect(response).toHaveLength(1);
      expect(response[0]).toEqual({
        success: true,
        result: 'Batch response with fallback',
        provider: 'anthropic',
        model: 'claude-3-opus',
        wasFailover: true,
        latency: expect.any(Number)
      });
    });

    it('should handle error scenarios in batch requests', async () => {
      // Mock error response in batch
      jest.spyOn(aiGatewayEnhancer, 'processBatchWithSmartFallback').mockResolvedValue([
        {
          success: false,
          error: 'Invalid input',
          errorType: 'invalid_request',
          provider: 'openai',
          model: 'gpt-4-turbo'
        }
      ]);

      // Call the controller method
      const response = await aiController.processBatchWithSmartFallback({
        inputs: ['Invalid input']
      }, '127.0.0.1');

      // Verify error response structure
      expect(response).toHaveLength(1);
      expect(response[0]).toEqual({
        success: false,
        error: 'Invalid input',
        errorType: 'invalid_request',
        provider: 'openai',
        model: 'gpt-4-turbo'
      });
    });

    it('should throw HttpException when inputs array is empty', async () => {
      // Call with empty inputs array
      await expect(aiController.processBatchWithSmartFallback({
        inputs: [],
        taskType: 'text-generation'
      }, '127.0.0.1')).rejects.toThrow(HttpException);

      // Verify AIGatewayEnhancer was not called
      expect(aiGatewayEnhancer.processBatchWithSmartFallback).not.toHaveBeenCalled();
    });

    it('should throw HttpException when taskType is empty', async () => {
      // Call with empty taskType
      await expect(aiController.processBatchWithSmartFallback({
        inputs: ['Input 1'],
        taskType: ''
      }, '127.0.0.1')).rejects.toThrow(HttpException);

      // Verify AIGatewayEnhancer was not called
      expect(aiGatewayEnhancer.processBatchWithSmartFallback).not.toHaveBeenCalled();
    });

    it('should handle exceptions from AIGatewayEnhancer in batch processing', async () => {
      // Mock exception
      jest.spyOn(aiGatewayEnhancer, 'processBatchWithSmartFallback').mockRejectedValue(
        new Error('Batch processing error')
      );

      await expect(
        aiController.processBatchWithSmartFallback({
          inputs: ['Test input']
        }, '127.0.0.1')
      ).rejects.toThrow(HttpException);
    });
  });
});
