import { AIGatewayEnhancer } from '../../src/services/AIGatewayEnhancer';
import { ErrorClassifier } from '../../src/services/utils/ErrorClassifier';
import { ConfigService } from '@nestjs/config';
import { ProviderSelectionStrategy, SelectionStrategy } from '../../src/services/utils/ProviderSelectionStrategy';
import { ProviderHealthMonitor } from '../../src/services/ProviderHealthMonitor';
import { Test, TestingModule } from '@nestjs/testing';

describe('AIGatewayEnhancer - Cost Strategy', () => {
  let gateway: AIGatewayEnhancer;
  let mockAIGateway: any;
  let mockSelectionStrategy: any;
  let mockErrorClassifier: any;
  let mockHealthMonitor: any;
  let mockConfigService: any;
  let moduleRef: TestingModule;
  let timeoutIds: NodeJS.Timeout[] = [];
  let originalProcessWithFallback: any;

  beforeAll(async () => {
    // Track timeouts to clean them up later
    const originalSetTimeout = global.setTimeout;
    global.setTimeout = function(callback, ms, ...args) {
      const id = originalSetTimeout(callback, ms, ...args);
      timeoutIds.push(id);
      return id;
    } as typeof global.setTimeout;

    // Clear all mocks
    jest.clearAllMocks();

    // Mock config service
    mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'AI_REQUEST_TIMEOUT') return 10000;
        return null;
      }),
    };

    // Create mock selection strategy
    mockSelectionStrategy = {
      selectBestProvider: jest.fn().mockImplementation((taskType, strategy) => {
        if (strategy === SelectionStrategy.COST_OPTIMIZED) {
          return 'ollama'; // Ollama is the cheapest
        } else {
          return 'openai'; // OpenAI is the fastest
        }
      }),
      getAlternativeProviders: jest.fn().mockImplementation((taskType, excludeProvider, strategy) => {
        const providers = ['ollama', 'lmstudio', 'openai'].filter(p => p !== excludeProvider);
        if (strategy === SelectionStrategy.COST_OPTIMIZED) {
          // Sort by cost (ollama cheapest, then lmstudio, then openai)
          return providers.sort((a, b) => {
            const costOrder = { 'ollama': 0, 'lmstudio': 1, 'openai': 2 };
            return costOrder[a] - costOrder[b];
          });
        }
        return providers;
      }),
      selectNextProvider: jest.fn().mockImplementation((taskType, excludeProvider, strategy) => {
        const alternatives = mockSelectionStrategy.getAlternativeProviders(taskType, excludeProvider, strategy);
        if (alternatives.length > 0) return alternatives[0];
        return null;
      })
    };

    // Create mock health monitor
    mockHealthMonitor = {
      getProviderHealth: jest.fn().mockImplementation((provider) => ({
        name: provider,
        available: true,
        successRate: 1.0,
        errorRate: 0.0,
        averageLatency: provider === 'openai' ? 300 : provider === 'lmstudio' ? 200 : 100,
        recentRequests: 0,
        recentErrors: 0,
        lastUsed: null,
        lastError: null
      }))
    };

    // Define error types for use in mocks
    const mockErrorTypes = {
      UNKNOWN: 'unknown',
      ALL_PROVIDERS_FAILED: 'all_providers_failed'
    };

    // Create mock error classifier
    mockErrorClassifier = {
      classifyError: jest.fn().mockReturnValue('provider_error'),
      ERROR_TYPES: mockErrorTypes,
      isRetryable: jest.fn().mockReturnValue(true)
    };

    // Create mock AIGateway
    mockAIGateway = {
      getProviderByName: jest.fn(),
      getAvailableProviders: jest.fn().mockReturnValue(['ollama', 'lmstudio', 'openai']),
      getModelNameForProvider: jest.fn().mockImplementation((provider, taskType) => {
        if (provider === 'openai') return 'gpt-4';
        if (provider === 'lmstudio') return 'mistral-7b-instruct-v0.2';
        return 'mistral';
      }),
      processAIRequest: jest.fn()
    };

    // Create a NestJS testing module
    moduleRef = await Test.createTestingModule({
      providers: [
        {
          provide: AIGatewayEnhancer,
          useFactory: () => new AIGatewayEnhancer(
            mockAIGateway,
            mockSelectionStrategy,
            mockHealthMonitor,
            mockErrorClassifier,
            mockConfigService,
          )
        }
      ],
    }).compile();

    gateway = moduleRef.get<AIGatewayEnhancer>(AIGatewayEnhancer);
    
    // Save the original method for restoration between tests
    originalProcessWithFallback = gateway.processWithFallback;
  });

  // Clean up any resources after all tests
  afterAll(async () => {
    // Restore original setTimeout
    jest.useRealTimers();
    
    // Clear all timeouts
    timeoutIds.forEach(id => clearTimeout(id));
    timeoutIds = [];
    
    // Clear all mocks
    jest.clearAllMocks();
    
    // Close the NestJS module
    await moduleRef.close();
  });

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Restore the original method before each test
    gateway.processWithFallback = originalProcessWithFallback;
  });

  it('should prefer cheaper providers in cost strategy', async () => {
    const inputs = ['Prompt A', 'Prompt B'];

    // Mock the processWithFallback method directly
    jest.spyOn(gateway, 'processWithFallback').mockImplementation((taskType, input, options) => {
      if (options.providerName === 'ollama') {
        return Promise.resolve({
          success: true,
          result: 'Response from Ollama',
          provider: 'ollama',
          model: 'mistral',
          latency: 100
        });
      } else {
        return Promise.reject(new Error('Should not call other providers'));
      }
    });

    const results = await gateway.processBatchWithStrategy(inputs, 'text-generation', 'cost');

    // Debug output
    console.log('Test 1 results:', JSON.stringify(results, null, 2));

    // Verify results
    expect(results).toHaveLength(2);
    results.forEach(res => {
      expect(res.success).toBe(true);
      expect(res.result).toBe('Response from Ollama');
      expect(res.provider).toBe('ollama');
      expect(res.wasFailover).toBeFalsy();
    });

    // Verify that processWithFallback was called with the correct provider
    expect(gateway.processWithFallback).toHaveBeenCalledTimes(2);
    expect(gateway.processWithFallback).toHaveBeenCalledWith(
      'text-generation',
      expect.anything(),
      expect.objectContaining({ providerName: 'ollama' })
    );
  });

  it('should fallback to next cheapest provider when cheaper provider fails', async () => {
    const inputs = ['Prompt A', 'Prompt B'];
    
    // Mock the processWithFallback method
    const processWithFallbackSpy = jest.spyOn(gateway, 'processWithFallback');
    
    // Set up the mock implementation
    processWithFallbackSpy.mockImplementation((taskType, input, options) => {
      // Primary provider (Ollama) fails
      if (options.providerName === 'ollama') {
        return Promise.reject(new Error('Ollama service error'));
      }
      
      // Fallback to LM Studio (next cheapest)
      if (!options.providerName && options.strategy === SelectionStrategy.COST_OPTIMIZED) {
        return Promise.resolve({
          success: true,
          result: 'Response from LM Studio',
          provider: 'lmstudio',
          model: 'mistral-7b-instruct-v0.2',
          latency: 200
        });
      }
      
      return Promise.reject(new Error('Unexpected call'));
    });

    const results = await gateway.processBatchWithStrategy(inputs, 'text-generation', 'cost');

    // Debug output
    console.log('Test 2 results:', JSON.stringify(results, null, 2));

    // Verify results
    expect(results).toHaveLength(2);
    results.forEach(res => {
      expect(res.success).toBe(true);
      expect(res.result).toBe('Response from LM Studio');
      expect(res.provider).toBe('lmstudio');
      expect(res.wasFailover).toBe(true);
    });
    
    // Verify the first call failed and the second succeeded
    expect(processWithFallbackSpy).toHaveBeenCalledTimes(4); // 2 initial calls that fail + 2 fallback calls
  });

  it('should fallback through all providers in cost order until success', async () => {
    const inputs = ['Prompt A'];
    
    // Mock the processWithFallback method
    const processWithFallbackSpy = jest.spyOn(gateway, 'processWithFallback');
    
    // Set up the mock implementation
    processWithFallbackSpy.mockImplementation((taskType, input, options) => {
      // Primary provider (Ollama) fails
      if (options.providerName === 'ollama') {
        return Promise.reject(new Error('Ollama service error'));
      }
      
      // Fallback to OpenAI (after trying others)
      if (!options.providerName && options.strategy === SelectionStrategy.COST_OPTIMIZED) {
        return Promise.resolve({
          success: true,
          result: 'Response from OpenAI',
          provider: 'openai',
          model: 'gpt-4',
          latency: 300
        });
      }
      
      return Promise.reject(new Error('Unexpected call'));
    });

    const results = await gateway.processBatchWithStrategy(inputs, 'text-generation', 'cost');

    // Debug output
    console.log('Test 3 results:', JSON.stringify(results, null, 2));

    // Verify results
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    expect(results[0].result).toBe('Response from OpenAI');
    expect(results[0].provider).toBe('openai');
    expect(results[0].wasFailover).toBe(true);
    
    // Verify the calls
    expect(processWithFallbackSpy).toHaveBeenCalledTimes(2); // 1 initial call that fails + 1 fallback call
  });

  it('should return error when all providers fail in cost strategy', async () => {
    const inputs = ['Prompt A'];
    
    // Mock the processWithFallback method
    const processWithFallbackSpy = jest.spyOn(gateway, 'processWithFallback');
    
    // Set up the mock implementation to fail for all providers
    processWithFallbackSpy.mockImplementation((taskType, input, options) => {
      // Primary provider (Ollama) fails
      if (options.providerName === 'ollama') {
        return Promise.reject(new Error('Ollama service error'));
      }
      
      // Fallback also fails
      if (!options.providerName) {
        return Promise.reject(new Error('All providers failed'));
      }
      
      return Promise.reject(new Error('Unexpected call'));
    });

    const results = await gateway.processBatchWithStrategy(inputs, 'text-generation', 'cost');

    // Debug output
    console.log('Test 4 results:', JSON.stringify(results, null, 2));

    // Verify results
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(results[0].error).toBeDefined();
    expect(results[0].wasFailover).toBe(true);
    
    // Verify the calls
    expect(processWithFallbackSpy).toHaveBeenCalledTimes(2); // 1 initial call that fails + 1 fallback call that also fails
  });
});
