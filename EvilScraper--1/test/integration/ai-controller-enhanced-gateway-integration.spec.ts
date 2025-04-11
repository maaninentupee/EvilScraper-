import { Test, TestingModule } from '@nestjs/testing';
import { AIControllerEnhanced } from '../../src/controllers/AIControllerEnhanced';
import { AIGatewayEnhancer } from '../../src/services/AIGatewayEnhancer';
import { SelectionStrategy } from '../../src/services/utils/ProviderSelectionStrategy';

/**
 * AIControllerEnhanced Gateway Integration Tests
 * 
 * These tests verify that the controller correctly calls AIGatewayEnhancer methods
 * in different scenarios and handles responses appropriately.
 */
describe('AIControllerEnhanced Gateway Integration Tests', () => {
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

    it('should handle fallback scenarios correctly with wasFailover flag', async () => {
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
        providerName: 'openai'
      }, '127.0.0.1');

      // Verify response includes fallback information
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
        error: 'Service unavailable',
        errorType: 'service_unavailable',
        provider: 'openai',
        model: 'gpt-4-turbo'
      });

      // Call the controller method
      const response = await aiController.processWithSmartFallback({
        input: 'Test input'
      }, '127.0.0.1');

      // Verify error response structure
      expect(response).toEqual({
        success: false,
        error: 'Service unavailable',
        errorType: 'service_unavailable',
        provider: 'openai',
        model: 'gpt-4-turbo'
      });
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
        'text-generation',
        ['Input 1', 'Input 2'],
        expect.objectContaining({
          strategy: SelectionStrategy.COST_OPTIMIZED,
          providerName: 'anthropic',
          cacheResults: false,
          testMode: false
        })
      );

      // Verify response structure
      expect(response).toHaveLength(2);
      expect(response[0]).toEqual({
        success: true,
        result: 'Batch response 1',
        provider: 'openai',
        model: 'gpt-4-turbo',
        latency: expect.any(Number)
      });
    });

    it('should handle fallback in batch processing', async () => {
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
  });
});
