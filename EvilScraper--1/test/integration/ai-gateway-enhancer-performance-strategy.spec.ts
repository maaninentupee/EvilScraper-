import { Test, TestingModule } from '@nestjs/testing';
import { AIGatewayEnhancer } from '../../src/services/AIGatewayEnhancer';
import { AIGateway } from '../../src/services/AIGateway';
import { ProviderSelectionStrategy } from '../../src/services/utils/ProviderSelectionStrategy';
import { ProviderHealthMonitor } from '../../src/services/ProviderHealthMonitor';
import { ErrorClassifier } from '../../src/services/utils/ErrorClassifier';
import { ConfigService } from '@nestjs/config';

/**
 * AIGatewayEnhancer Performance Strategy Test
 * 
 * This test verifies that the fallback mechanism works correctly with performance strategy.
 * It tests the scenario where one of the inputs in a batch fails and is processed by a fallback provider.
 */
describe('AIGatewayEnhancer Performance Strategy Test', () => {
  let aiGatewayEnhancer: AIGatewayEnhancer;
  let aiGateway: AIGateway;

  beforeEach(async () => {
    // Create mock AIGateway
    const mockAIGateway = {
      processAIRequest: jest.fn().mockImplementation(async (taskType, input, model) => {
        // Performance strategy test
        if (input === 'prompt 1' && model === 'gpt-4') {
          return {
            success: true,
            result: 'Response 1',
            provider: 'openai',
            model: 'gpt-4',
            latency: 150
          };
        }
        else if (input === 'prompt 2' && model === 'gpt-4') {
          // Throw an actual Error object instead of returning an error response
          const error = new Error('Network error');
          error.name = 'NetworkError';
          throw error;
        }
        else if (input === 'prompt 2' && model === 'claude-3') {
          return {
            success: true,
            result: 'Fallback response for prompt 2',
            provider: 'anthropic',
            model: 'claude-3',
            latency: 200
          };
        }
        else if (input === 'prompt 3' && model === 'gpt-4') {
          return {
            success: true,
            result: 'Response 3',
            provider: 'openai',
            model: 'gpt-4',
            latency: 120
          };
        }
        
        throw new Error('Unexpected input or model: ' + input + ', ' + model);
      }),
      getModelNameForProvider: jest.fn().mockImplementation((provider, taskType) => {
        if (provider === 'openai') return 'gpt-4';
        if (provider === 'anthropic') return 'claude-3';
        return null;
      }),
      getCachedResult: jest.fn().mockReturnValue(null),
      getAvailableProviders: jest.fn().mockReturnValue(['openai', 'anthropic']),
      getAvailableModels: jest.fn().mockReturnValue({
        openai: ['gpt-4'],
        anthropic: ['claude-3']
      })
    };

    // Create mock ProviderSelectionStrategy
    const mockSelectionStrategy = {
      getProviderForTask: jest.fn().mockReturnValue('openai'),
      getOrderedProviders: jest.fn().mockReturnValue([
        { getName: () => 'openai' },
        { getName: () => 'anthropic' }
      ]),
      selectBestProvider: jest.fn().mockReturnValue('openai'),
      selectNextProvider: jest.fn().mockImplementation((taskType, excludeProvider, strategy) => {
        if (excludeProvider === 'openai') return 'anthropic';
        return null;
      }),
      getAlternativeProviders: jest.fn().mockImplementation((taskType, excludeProvider, strategy) => {
        if (excludeProvider === 'openai') return ['anthropic'];
        if (excludeProvider === 'anthropic') return ['openai'];
        return [];
      }),
      getProvidersForTask: jest.fn().mockImplementation((taskType) => {
        return ['openai', 'anthropic'];
      }),
      getProviderForModel: jest.fn().mockImplementation((model) => {
        if (model === 'gpt-4') return 'openai';
        if (model === 'claude-3') return 'anthropic';
        return null;
      })
    };

    // Create mock ErrorClassifier
    const mockErrorClassifier = {
      classifyError: jest.fn().mockImplementation((error) => {
        if (error && error.name === 'NetworkError') {
          return 'network_error';
        }
        return 'unknown_error';
      }),
      isRetryableError: jest.fn().mockImplementation((errorType) => {
        return errorType === 'network_error';
      }),
      isRetryable: jest.fn().mockImplementation((error) => {
        if (error && error.name === 'NetworkError') {
          return true;
        }
        return false;
      })
    };

    // Create mock ConfigService
    const mockConfigService = {
      get: jest.fn().mockImplementation((key) => {
        if (key === 'AI_REQUEST_TIMEOUT') return 10000;
        if (key === 'AI_MAX_RETRIES') return 3;
        if (key === 'AI_RETRY_DELAY') return 500;
        return null;
      })
    };

    // Create mock HealthMonitor
    const mockHealthMonitor = {
      getProviderHealth: jest.fn().mockReturnValue({
        isAvailable: true,
        responseTime: 200,
        successRate: 0.95,
        available: true,
        averageLatency: 200
      }),
      updateProviderHealth: jest.fn(),
      getAllProviderHealth: jest.fn().mockReturnValue(new Map([
        ['openai', { isAvailable: true, responseTime: 200, successRate: 0.95, available: true, averageLatency: 200 }],
        ['anthropic', { isAvailable: true, responseTime: 300, successRate: 0.9, available: true, averageLatency: 300 }]
      ])),
      getProvidersByScore: jest.fn().mockReturnValue([
        { provider: 'openai', score: 95 },
        { provider: 'anthropic', score: 90 }
      ])
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIGatewayEnhancer,
        { provide: AIGateway, useValue: mockAIGateway },
        { provide: ProviderSelectionStrategy, useValue: mockSelectionStrategy },
        { provide: ProviderHealthMonitor, useValue: mockHealthMonitor },
        { provide: ErrorClassifier, useValue: mockErrorClassifier },
        { provide: ConfigService, useValue: mockConfigService }
      ]
    }).compile();

    aiGatewayEnhancer = module.get<AIGatewayEnhancer>(AIGatewayEnhancer);

    // Mock the processWithFallback method to handle our test cases
    aiGatewayEnhancer.processWithFallback = jest.fn().mockImplementation(async (taskType, input, options) => {
      if (input === 'prompt 1') {
        return {
          success: true,
          result: 'Response 1',
          provider: 'openai',
          model: 'gpt-4',
          latency: 150
        };
      } 
      else if (input === 'prompt 2') {
        if (options.providerName === 'openai') {
          // Simulate a failure with OpenAI
          throw new Error('Network error');
        } else {
          // Fallback to Anthropic
          return {
            success: true,
            result: 'Fallback response for prompt 2',
            provider: 'anthropic',
            model: 'claude-3',
            latency: 200,
            wasFailover: true
          };
        }
      }
      else if (input === 'prompt 3') {
        return {
          success: true,
          result: 'Response 3',
          provider: 'openai',
          model: 'gpt-4',
          latency: 120
        };
      }
      
      throw new Error('Unexpected input: ' + input);
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should fallback only for failed inputs in performance strategy', async () => {
    // Act
    const results = await aiGatewayEnhancer.processBatchWithStrategy(
      ['prompt 1', 'prompt 2', 'prompt 3'],
      'text-generation',
      'performance',
      {}
    );

    // Assert
    expect(results).toHaveLength(3);

    // First prompt: OpenAI successful
    expect(results[0]).toMatchObject({
      success: true,
      result: 'Response 1',
      provider: 'openai',
      model: 'gpt-4'
    });
    expect(results[0].wasFailover).toBeUndefined();

    // Second prompt: OpenAI failed, Anthropic successful
    expect(results[1]).toMatchObject({
      success: true,
      result: 'Fallback response for prompt 2',
      provider: 'anthropic',
      model: 'claude-3',
      wasFailover: true
    });

    // Third prompt: OpenAI successful
    expect(results[2]).toMatchObject({
      success: true,
      result: 'Response 3',
      provider: 'openai',
      model: 'gpt-4'
    });
    expect(results[2].wasFailover).toBeUndefined();

    // Verify that processWithFallback was called correctly
    expect(aiGatewayEnhancer.processWithFallback).toHaveBeenCalledTimes(4);
  });
});
