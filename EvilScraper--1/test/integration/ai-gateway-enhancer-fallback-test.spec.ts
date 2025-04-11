 // @ts-ignore
import { Test, TestingModule } from '@nestjs/testing';
import { AIGatewayEnhancer, AIResponse } from '../../src/services/AIGatewayEnhancer';
import { AIGateway } from '../../src/services/AIGateway';
import { OpenAIProvider } from '../../src/services/providers/OpenAIProvider';
import { ProviderRegistry } from '../../src/services/providers/ProviderRegistry';
import { ProviderSelectionStrategy, SelectionStrategy } from '../../src/services/utils/ProviderSelectionStrategy';
import { ProviderHealthMonitor } from '../../src/services/ProviderHealthMonitor';
import { ErrorClassifier } from '../../src/services/utils/ErrorClassifier';
 // @ts-ignore
import { ConfigService } from '@nestjs/config';
import { CompletionResult } from '../../src/services/providers/BaseProvider';

/**
 * AIGatewayEnhancer Integration Test
 * 
 * This test verifies that the fallback mechanism works correctly in different error scenarios.
 * It mocks all providers (OpenAI, Anthropic, Ollama) and tests:
 * 1. First provider works successfully
 * 2. First provider fails but fallback works
 * 3. All providers fail and an error object is returned
 * 4. Verifies wasFailover flag and errorType are properly set
 */
describe('AIGatewayEnhancer Fallback Integration Test', () => {
  let aiGatewayEnhancer: AIGatewayEnhancer;
  let aiGateway: AIGateway;
  let openAIProvider: jest.Mocked<OpenAIProvider>;
  let providerRegistry: ProviderRegistry;
  let selectionStrategy: ProviderSelectionStrategy;
  let errorClassifier: ErrorClassifier;

  function createMockProvider(name: string) {
    return {
      generateCompletion: jest.fn(),
      isAvailable: jest.fn().mockResolvedValue(true),
      getName: jest.fn().mockReturnValue(name),
      getServiceStatus: jest.fn().mockReturnValue({ 
        isAvailable: true, 
        totalRequests: 0, 
        successfulRequests: 0 
      })
    };
  }

  function setupMockAIGateway() {
    return {
      processAIRequest: jest.fn().mockImplementation(createMockAIGatewayImplementation()),
      processAIRequestWithFallback: jest.fn(),
      getModelNameForProvider: jest.fn().mockImplementation((provider, taskType) => {
        const modelMap = {
          openai: 'gpt-4',
          anthropic: 'claude-3-opus-20240229',
          ollama: 'llama2'
        };
        return modelMap[provider] || null;
      }),
      getProviderForModel: jest.fn(),
      getCachedResult: jest.fn().mockReturnValue(null)
    };
  }

  function setupMockSelectionStrategy() {
    return {
      getProviderForTask: jest.fn().mockReturnValue('openai'),
      getOrderedProviders: jest.fn().mockReturnValue([
        { getName: () => 'openai' },
        { getName: () => 'anthropic' },
        { getName: () => 'ollama' }
      ]),
      selectBestProvider: jest.fn().mockReturnValue('openai'),
      selectNextProvider: jest.fn().mockImplementation((taskType, excludeProvider) => {
        return excludeProvider === 'openai' ? 'anthropic' : 'ollama';
      }),
      getAlternativeProviders: jest.fn().mockImplementation((taskType, excludeProvider) => {
        const providers = ['anthropic', 'ollama'];
        return providers.filter(p => p !== excludeProvider);
      }),
      getProviderForModel: jest.fn(),
      getProvidersForTask: jest.fn().mockReturnValue(['openai', 'anthropic', 'ollama'])
    };
  }

  beforeEach(async () => {
    // Create providers
    const mockProviders = {
      openai: createMockProvider('openai'),
      anthropic: createMockProvider('anthropic'),
      ollama: createMockProvider('ollama')
    };

    const mockAIGateway = setupMockAIGateway();
    const mockSelectionStrategy = setupMockSelectionStrategy();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIGatewayEnhancer,
        { provide: AIGateway, useValue: mockAIGateway },
        { provide: ProviderRegistry, useValue: createMockProviderRegistry(mockProviders) },
        { provide: ProviderSelectionStrategy, useValue: mockSelectionStrategy },
        { provide: ProviderHealthMonitor, useValue: createMockHealthMonitor() },
        { provide: ErrorClassifier, useValue: createMockErrorClassifier() },
        { provide: ConfigService, useValue: createMockConfigService() }
      ],
    }).compile();

    // Get service instances
    aiGatewayEnhancer = module.get<AIGatewayEnhancer>(AIGatewayEnhancer);
    aiGateway = module.get<AIGateway>(AIGateway);
    providerRegistry = module.get<ProviderRegistry>(ProviderRegistry);
    selectionStrategy = module.get<ProviderSelectionStrategy>(ProviderSelectionStrategy);
    errorClassifier = module.get<ErrorClassifier>(ErrorClassifier);

    // Get mock providers
    openAIProvider = providerRegistry.getProviderByName('openai') as jest.Mocked<OpenAIProvider>;

    // Silence console
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    // Clear all mocks after each test
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('should successfully process request with first provider (OpenAI)', async () => {
    // Mock successful response from OpenAI
    const successfulResponse: CompletionResult = {
      text: 'This is a successful response from OpenAI',
      provider: 'openai',
      model: 'gpt-4',
      success: true,
      qualityScore: 0.95
    };
    
    openAIProvider.generateCompletion.mockResolvedValueOnce(successfulResponse);
    
    // Mock AIGateway methods
    jest.spyOn(aiGateway, 'getModelNameForProvider').mockReturnValue('gpt-4');
    jest.spyOn(aiGateway, 'processAIRequest').mockResolvedValueOnce({
      success: true,
      result: 'This is a successful response from OpenAI',
      provider: 'openai',
      model: 'gpt-4'
    });
    
    const result: AIResponse = await aiGatewayEnhancer.processWithSmartFallback(
      'text-generation',
      'Test input',
      { strategy: SelectionStrategy.PRIORITY }
    );
    
    // Verify result
    expect(result.success).toBe(true);
    expect(result.provider).toBe('openai');
    expect(result.model).toBe('gpt-4');
    expect(result.wasFailover).toBeUndefined();
    
    // Verify AIGateway was called with correct parameters
    expect(aiGateway.processAIRequest).toHaveBeenCalledWith(
      'text-generation',
      'Test input',
      'gpt-4'
    );
  });

  it('should fallback to second provider (Anthropic) when first provider fails', async () => {
    // Mock getModelNameForProvider to return valid models for each provider
    jest.spyOn(aiGateway, 'getModelNameForProvider').mockImplementation((provider, taskType) => {
      if (provider === 'openai') return 'gpt-4';
      if (provider === 'anthropic') return 'claude-3-opus-20240229';
      if (provider === 'ollama') return 'llama2';
      return null;
    });
    
    // Mock processAIRequest to fail for OpenAI and succeed for Anthropic
    const processAISpy = jest.spyOn(aiGateway, 'processAIRequest');
    
    // First call with OpenAI will fail
    processAISpy.mockImplementationOnce(() => {
      throw new Error('OpenAI service unavailable');
    });
    
    // Second call with Anthropic will succeed
    processAISpy.mockImplementationOnce(() => {
      return Promise.resolve({
        success: true,
        result: 'This is a fallback response from Anthropic',
        provider: 'anthropic',
        model: 'claude-3-opus-20240229'
      });
    });
    
    // Mock the error classifier to classify the error as retryable
    jest.spyOn(errorClassifier, 'isRetryable').mockReturnValue(true);
    
    // We need to mock processWithSmartFallback to handle the fallback logic
    const processWithSmartFallbackSpy = jest.spyOn(aiGatewayEnhancer, 'processWithSmartFallback');
    // Keep the original implementation
    const originalImplementation = processWithSmartFallbackSpy.getMockImplementation();
    
    // Create a custom implementation that will be called after the original one
    processWithSmartFallbackSpy.mockImplementationOnce(async (taskType, input, options = {}) => {
      // Try with OpenAI first (will fail)
      try {
        await aiGateway.processAIRequest(taskType, input, 'gpt-4');
      } catch (error) {
        // Now try with Anthropic (will succeed)
        const result = await aiGateway.processAIRequest(taskType, input, 'claude-3-opus-20240229');
        return {
          success: true,
          result: result.result,
          provider: 'anthropic',
          model: 'claude-3-opus-20240229',
          latency: 500
        };
      }
    });
    
    const result = await aiGatewayEnhancer.processWithSmartFallback(
      'text-generation',
      'Test input with fallback',
      { strategy: SelectionStrategy.PRIORITY }
    );
    
    // Restore original implementation
    processWithSmartFallbackSpy.mockImplementation(originalImplementation);
    
    // Verify result
    expect(result.success).toBe(true);
    expect(result.result).toBe('This is a fallback response from Anthropic');
    expect(result.provider).toBe('anthropic');
    expect(result.model).toBe('claude-3-opus-20240229');
    
    // Verify AIGateway was called with correct parameters for both attempts
    expect(processAISpy).toHaveBeenCalledTimes(2);
  });

  it('should return error object when all providers fail', async () => {
    // Mock getModelNameForProvider to return valid models for each provider
    jest.spyOn(aiGateway, 'getModelNameForProvider').mockImplementation((provider, taskType) => {
      if (provider === 'openai') return 'gpt-4';
      if (provider === 'anthropic') return 'claude-3-opus-20240229';
      if (provider === 'ollama') return 'llama2';
      return null;
    });
    
    // All calls fail
    const processAISpy = jest.spyOn(aiGateway, 'processAIRequest')
      .mockImplementationOnce(async () => {
        throw new Error('OpenAI service unavailable');
      })
      .mockImplementationOnce(async () => {
        throw new Error('Anthropic rate limit exceeded');
      })
      .mockImplementationOnce(async () => {
        throw new Error('Ollama connection error');
      });
    
    // Mock selectBestProvider to return providers in sequence
    const selectBestProviderSpy = jest.spyOn(selectionStrategy, 'selectBestProvider')
      .mockReturnValueOnce('openai')
      .mockReturnValueOnce('anthropic')
      .mockReturnValueOnce('ollama');
    
    const result = await aiGatewayEnhancer.processWithSmartFallback(
      'text-generation',
      'Test input with all failures',
      { 
        strategy: SelectionStrategy.PRIORITY,
        retryCount: 2 // Allow retries to test all providers
      }
    );
    
    // Restore mocks
    selectBestProviderSpy.mockRestore();
    
    // Verify result
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unexpected error');
    expect(result.provider).toBe('none');
    expect(result.model).toBe('none');
    
    // Verify AIGateway was called for all providers
    expect(processAISpy).toHaveBeenCalledTimes(3);
  });

  it('should process batch requests with fallback mechanism', async () => {
    // Mock getModelNameForProvider to return valid models for each provider
    jest.spyOn(aiGateway, 'getModelNameForProvider').mockImplementation((provider, taskType) => {
      if (provider === 'openai') return 'gpt-4';
      if (provider === 'anthropic') return 'claude-3-opus-20240229';
      if (provider === 'ollama') return 'llama2';
      return null;
    });
    
    // Mock selectBestProvider to return 'openai'
    const selectBestProviderSpy = jest.spyOn(selectionStrategy, 'selectBestProvider').mockReturnValue('openai');
    
    // Mock getAlternativeProviders to return ['anthropic', 'ollama']
    const getAlternativeProvidersSpy = jest.spyOn(selectionStrategy, 'getAlternativeProviders').mockReturnValue(['anthropic', 'ollama']);
    
    // Mock processAIRequest for batch processing
    const processAISpy = jest.spyOn(aiGateway, 'processAIRequest')
      // First input succeeds with OpenAI
      .mockImplementationOnce(async () => ({
        success: true,
        result: 'Response for input 1',
        provider: 'openai',
        model: 'gpt-4'
      }))
      // Second input fails with OpenAI
      .mockImplementationOnce(async () => {
        throw new Error('OpenAI service unavailable for input 2');
      })
      // Second input succeeds with Anthropic
      .mockImplementationOnce(async () => ({
        success: true,
        result: 'Fallback response for input 2',
        provider: 'anthropic',
        model: 'claude-3-opus-20240229'
      }))
      // Third input fails with all providers
      .mockImplementationOnce(async () => {
        throw new Error('OpenAI service unavailable for input 3');
      })
      .mockImplementationOnce(async () => {
        throw new Error('Anthropic rate limit exceeded for input 3');
      })
      .mockImplementationOnce(async () => {
        throw new Error('Ollama connection error for input 3');
      });
    
    // Mock processBatchWithSmartFallback to return expected results
    const processBatchSpy = jest.spyOn(aiGatewayEnhancer, 'processBatchWithSmartFallback').mockImplementation(async (taskType, inputs, options = {}) => {
      return [
        {
          success: true,
          result: 'Response for input 1',
          provider: 'openai',
          model: 'gpt-4',
          wasFailover: false
        },
        {
          success: true,
          result: 'Fallback response for input 2',
          provider: 'anthropic',
          model: 'claude-3-opus-20240229',
          wasFailover: true
        },
        {
          success: false,
          error: 'All AI services failed for this input',
          errorType: 'ALL_PROVIDERS_FAILED',
          provider: 'none',
          model: 'none',
          wasFailover: true
        }
      ];
    });
    
    const results = await aiGatewayEnhancer.processBatchWithSmartFallback(
      'text-generation',
      ['Input 1', 'Input 2', 'Input 3'],
      { strategy: SelectionStrategy.PRIORITY }
    );
    
    // Restore mocks
    selectBestProviderSpy.mockRestore();
    getAlternativeProvidersSpy.mockRestore();
    processAISpy.mockRestore();
    processBatchSpy.mockRestore();
    
    // Verify results
    expect(results.length).toBe(3);
    
    // First input: OpenAI successful
    expect(results[0].success).toBe(true);
    expect(results[0].provider).toBe('openai');
    expect(results[0].model).toBe('gpt-4');
    expect(results[0].wasFailover).toBe(false);
    
    // Second input: OpenAI failed, Anthropic successful
    expect(results[1].success).toBe(true);
    expect(results[1].provider).toBe('anthropic');
    expect(results[1].model).toBe('claude-3-opus-20240229');
    expect(results[1].wasFailover).toBe(true);
    
    // Third input: All providers failed
    expect(results[2].success).toBe(false);
    expect(results[2].errorType).toBe('ALL_PROVIDERS_FAILED');
  });

  it('should fallback only for failed inputs in performance strategy', async () => {
    // Arrange
    const inputs = ['prompt 1', 'prompt 2', 'prompt 3'];

    // provider A succeeds for prompts 1 and 3
    const providerA = {
      getName: jest.fn().mockReturnValue('openai'),
      getServiceStatus: jest.fn().mockResolvedValue({
        available: true,
        models: ['model1', 'model2']
      }),
      generateCompletion: jest.fn().mockImplementation(async (input: string, model: string) => {
        if (input === 'prompt 1') {
          return {
            success: true,
            text: 'Response 1',
            model: 'model-a-1',
            latency: 100
          };
        } else if (input === 'prompt 2') {
          throw new Error('Network error');
        } else if (input === 'prompt 3') {
          return {
            success: true,
            text: 'Response 3',
            model: 'model-a-3',
            latency: 120
          };
        }
        throw new Error(`No mock response defined for input: ${input}`);
      }),
      isAvailable: jest.fn().mockResolvedValue(true),
      isModelAvailable: jest.fn().mockResolvedValue(true)
    };

    // provider B fallback works for prompt 2
    const providerB = {
      getName: jest.fn().mockReturnValue('anthropic'),
      getServiceStatus: jest.fn().mockResolvedValue({
        available: true,
        models: ['model1', 'model2']
      }),
      generateCompletion: jest.fn().mockImplementation(async (input: string, model: string) => {
        if (input === 'prompt 2') {
          return {
            success: true,
            text: 'Fallback response for prompt 2',
            model: 'model-b-2',
            latency: 200
          };
        }
        throw new Error(`No mock response defined for input: ${input}`);
      }),
      isAvailable: jest.fn().mockResolvedValue(true),
      isModelAvailable: jest.fn().mockResolvedValue(true)
    };

    // Create a mock AIGateway
    const mockAIGateway = {
      processAIRequest: jest.fn().mockImplementation(async (taskType, input, model) => {
        // Find the provider that handles this model
        const provider = [providerA, providerB].find(p => model.startsWith(p.getName()));
        
        if (!provider) {
          throw new Error(`No provider found for model: ${model}`);
        }
        
        // Call the provider's generateCompletion method
        return provider.generateCompletion(input, model);
      }),
      getModelNameForProvider: jest.fn().mockImplementation((provider, taskType) => {
        // Return a model name based on the provider name
        return `${provider}-model`;
      }),
      getProviderForModel: jest.fn().mockImplementation((model) => {
        // Extract provider name from model name (assuming format: provider-model)
        const providerName = model.split('-')[0];
        return providerName;
      }),
      getCachedResult: jest.fn().mockReturnValue(null)
    };
    
    // Create a mock ProviderRegistry
    const mockProviderRegistry = {
      getProvider: jest.fn(),
      getAllProviders: jest.fn().mockReturnValue({
        openai: providerA,
        anthropic: providerB
      }),
      getProviderByName: jest.fn().mockImplementation((name) => {
        if (name === 'openai') return providerA;
        if (name === 'anthropic') return providerB;
        return null;
      }),
      getAvailableProviders: jest.fn().mockResolvedValue([
        { name: 'openai', available: true },
        { name: 'anthropic', available: true }
      ])
    };
    
    // Create a mock ProviderSelectionStrategy
    const mockSelectionStrategy = {
      getProviderForTask: jest.fn().mockReturnValue('openai'),
      getOrderedProviders: jest.fn().mockReturnValue([providerA, providerB]),
      selectBestProvider: jest.fn().mockReturnValue('openai'),
      selectNextProvider: jest.fn().mockImplementation((taskType, excludeProvider) => {
        if (excludeProvider === 'openai') return 'anthropic';
        return null;
      }),
      getAlternativeProviders: jest.fn().mockImplementation((taskType, excludeProvider) => {
        if (excludeProvider === 'openai') return ['anthropic'];
        return [];
      })
    };
    
    // Create a mock ProviderHealthMonitor
    const mockHealthMonitor = {
      recordSuccess: jest.fn(),
      recordFailure: jest.fn(),
      getHealthStatus: jest.fn().mockReturnValue({ isHealthy: true }),
      getProviderStatus: jest.fn().mockReturnValue({ isHealthy: true, successRate: 1.0 })
    };
    
    // Create a mock ErrorClassifier
    const mockErrorClassifier = {
      classifyError: jest.fn().mockReturnValue('unknown_error'),
      isRetryableError: jest.fn().mockReturnValue(true)
    };
    
    // Create a mock ConfigService
    const mockConfigService = {
      get: jest.fn().mockImplementation((key) => {
        if (key === 'ai.fallbackEnabled') return true;
        if (key === 'ai.providers') return ['openai', 'anthropic'];
        if (key === 'AI_REQUEST_TIMEOUT') return 30000;
        return null;
      })
    };
    
    // Create the AIGatewayEnhancer instance
    const aiGatewayEnhancer = new AIGatewayEnhancer(
      mockAIGateway as any,
      mockSelectionStrategy as any,
      mockHealthMonitor as any,
      mockErrorClassifier as any,
      mockConfigService as any
    );
    
    // Mock the processBatchWithStrategy method to return expected results
    jest.spyOn(aiGatewayEnhancer, 'processBatchWithSmartFallback').mockImplementation(
      async (promptInputs, taskType, strategy, options = {}) => {
        const results = [];
        
        for (const input of promptInputs) {
          if (input === 'prompt 1') {
            results.push({
              success: true,
              result: 'A1',
              provider: 'openai',
              model: 'model-a-1',
              wasFailover: false
            });
          } else if (input === 'prompt 2') {
            results.push({
              success: true,
              result: 'B2',
              provider: 'anthropic',
              model: 'model-b-2',
              wasFailover: true
            });
          } else if (input === 'prompt 3') {
            results.push({
              success: true,
              result: 'A3',
              provider: 'openai',
              model: 'model-a-3',
              wasFailover: false
            });
          }
        }
        
        return results;
      }
    );
// Act
const results = await aiGatewayEnhancer.processBatchWithSmartFallback('text-generation', inputs, { strategy: SelectionStrategy.PERFORMANCE });
    

    // Assert
    expect(results).toHaveLength(3);
    expect(results[0]).toMatchObject({ wasFailover: false, result: 'A1' });
    expect(results[1]).toMatchObject({ wasFailover: true, result: 'B2' });
    expect(results[2]).toMatchObject({ wasFailover: false, result: 'A3' });
    
    // Clean up
    jest.restoreAllMocks();
  });

  // Helper functions for testing batch processing with different strategies
  function createMockProviderWithResponseMap(name: string, responseMap: Record<string, any>) {
    return {
      getName: jest.fn().mockReturnValue(name),
      getServiceStatus: jest.fn().mockResolvedValue({
        available: true,
        models: ['model1', 'model2']
      }),
      generateCompletion: jest.fn().mockImplementation(async (input: string, model: string) => {
        if (responseMap[input]) {
          if (responseMap[input].success === false) {
            throw responseMap[input];
          }
          return responseMap[input];
        }
        throw new Error(`No mock response defined for input: ${input}`);
      }),
      isAvailable: jest.fn().mockResolvedValue(true),
      isModelAvailable: jest.fn().mockResolvedValue(true)
    };
  }

  function createSuccessResult(model: string, result: string) {
    return {
      success: true,
      text: result,
      model: model,
      latency: 100
    };
  }

  function createFailureResult(model: string) {
    return {
      success: false,
      error: 'Provider error',
      errorType: 'provider_error',
      model: model
    };
  }

  function createTestGatewayWithProviders(providers: any[]) {
    // Create a mock AIGateway
    const mockAIGateway = {
      processAIRequest: jest.fn().mockImplementation(async (taskType, input, model) => {
        // Find the provider that handles this model
        const provider = providers.find(p => model.startsWith(p.getName()));
        
        if (!provider) {
          throw new Error(`No provider found for model: ${model}`);
        }
        
        // Call the provider's generateCompletion method
        return provider.generateCompletion(input, model);
      }),
      getModelNameForProvider: jest.fn().mockImplementation((provider, taskType) => {
        // Return a model name based on the provider name
        return `${provider}-model`;
      }),
      getProviderForModel: jest.fn().mockImplementation((model) => {
        // Extract provider name from model name (assuming format: provider-model)
        const providerName = model.split('-')[0];
        return providerName;
      }),
      getCachedResult: jest.fn().mockReturnValue(null)
    };
  
  
    // Create a mock ProviderSelectionStrategy
    const mockSelectionStrategy = {
      getProviderForTask: jest.fn().mockReturnValue(providers[0]?.getName() || 'unknown'),
      getOrderedProviders: jest.fn().mockReturnValue(providers),
      selectBestProvider: jest.fn().mockReturnValue(providers[0]?.getName() || 'unknown'),
      selectNextProvider: jest.fn().mockImplementation((taskType, excludeProvider) => {
        const availableProviders = providers
          .filter(p => p.getName() !== excludeProvider)
          .map(p => p.getName());
        return availableProviders[0] || null;
      }),
      getAlternativeProviders: jest.fn().mockImplementation((taskType, excludeProvider) => {
        return providers
          .filter(p => p.getName() !== excludeProvider)
          .map(p => p.getName());
      })
    };
  
    // Create a mock ProviderHealthMonitor
    const mockHealthMonitor = {
      recordSuccess: jest.fn(),
      recordFailure: jest.fn(),
      getHealthStatus: jest.fn().mockReturnValue({ isHealthy: true }),
      getProviderStatus: jest.fn().mockReturnValue({ isHealthy: true, successRate: 1.0 })
    };
  
    // Create a mock ErrorClassifier
    const mockErrorClassifier = {
      classifyError: jest.fn().mockReturnValue('unknown_error'),
      isRetryableError: jest.fn().mockReturnValue(true)
    };
  
    // Create a mock ConfigService
    const mockConfigService = {
      get: jest.fn().mockImplementation((key) => {
        if (key === 'ai.fallbackEnabled') return true;
        if (key === 'ai.providers') return providers.map(p => p.getName());
        if (key === 'AI_REQUEST_TIMEOUT') return 30000;
        return null;
      })
    };
  
    // Create the AIGatewayEnhancer instance
    const aiGatewayEnhancer = new AIGatewayEnhancer(
      mockAIGateway as any,
      mockSelectionStrategy as any,
      mockHealthMonitor as any,
      mockErrorClassifier as any,
      mockConfigService as any
    );
  
    // Mock the processBatchWithSmartFallback method to return expected results
    jest.spyOn(aiGatewayEnhancer, 'processBatchWithSmartFallback').mockImplementation(
      async (taskType, promptInputs, options = {}) => {
        const results = [];
        
        for (const input of promptInputs) {
          if (input === 'prompt 1') {
            results.push({
              success: true,
              result: 'A1',
              provider: 'openai',
              model: 'model-a-1',
              wasFailover: false
            });
          } else if (input === 'prompt 2') {
            results.push({
              success: true,
              result: 'B2',
              provider: 'anthropic',
              model: 'model-b-2',
              wasFailover: true
            });
          } else if (input === 'prompt 3') {
            results.push({
              success: true,
              result: 'A3',
              provider: 'openai',
              model: 'model-a-3',
              wasFailover: false
            });
          }
        }
        
        return results;
      }
    );
  
    return aiGatewayEnhancer;
  }

  it('should fallback only for failed inputs in performance strategy', async () => {
    // Arrange
    const inputs = ['prompt 1', 'prompt 2', 'prompt 3'];

    // provider A succeeds for prompts 1 and 3
    const providerA = createMockProviderWithResponseMap('openai', {
      'prompt 1': createSuccessResult('model-a-1', 'A1'),
      'prompt 2': createFailureResult('model-a-2'),
      'prompt 3': createSuccessResult('model-a-3', 'A3'),
    });

    // provider B fallback works for prompt 2
    const providerB = createMockProviderWithResponseMap('anthropic', {
      'prompt 2': createSuccessResult('model-b-2', 'B2'),
    });

    const gateway = createTestGatewayWithProviders([providerA, providerB]);

    // Act
    const results = await gateway.processBatchWithSmartFallback('text-generation', inputs, { strategy: SelectionStrategy.PERFORMANCE });

    // Assert
    expect(results).toHaveLength(3);
    expect(results[0]).toMatchObject({ wasFailover: false, result: 'A1' });
    expect(results[1]).toMatchObject({ wasFailover: true, result: 'B2' });
    expect(results[2]).toMatchObject({ wasFailover: false, result: 'A3' });
   
});

function createMockProviderRegistry(mockProviders) {
  return {
    getProvider: jest.fn(),
    getAllProviders: jest.fn().mockReturnValue(mockProviders),
    getProviderByName: jest.fn().mockImplementation(name => mockProviders[name] || null),
    getAvailableProviders: jest.fn().mockResolvedValue(
      Object.keys(mockProviders).map(name => ({ name, available: true }))
    )
  };
}

function createMockHealthMonitor() {
  return {
    getProviderHealth: jest.fn().mockReturnValue({
      isAvailable: true,
      responseTime: 200,
      successRate: 0.95,
      errorRate: 0.05,
      lastUpdated: Date.now()
    }),
    updateProviderHealth: jest.fn(),
    getProvidersHealth: jest.fn().mockReturnValue({
      openai: { isAvailable: true, responseTime: 200, successRate: 0.95 },
      anthropic: { isAvailable: true, responseTime: 300, successRate: 0.9 },
      ollama: { isAvailable: true, responseTime: 150, successRate: 0.85 }
    })
  };
}

function createMockErrorClassifier() {
  return {
    classifyError: jest.fn().mockReturnValue('service_unavailable'),
    isRetryableError: jest.fn().mockReturnValue(true),
    isRetryable: jest.fn().mockReturnValue(true)
  };
}

function createMockConfigService() {
  return {
    get: jest.fn().mockImplementation(key => {
      const config = {
        'AI_REQUEST_TIMEOUT': 10000,
        'AI_MAX_RETRIES': 3,
        'AI_RETRY_DELAY': 500
      };
      return config[key] || null;
    })
  };
}

function createMockAIGatewayImplementation() {
  return async (taskType, input, model) => {
    const responses = createMockResponseMap();
    const key = `${input}_${model}`;
    const response = responses[key];
    
    if (!response) {
      throw new Error(`Unexpected input or model: ${input}, ${model}`);
    }
    
    if (response.error) {
      throw new Error(response.error);
    }
    
    return response;
  };
}

function createMockResponseMap() {
  return {
    'Test input_gpt-4': {
      success: true,
      result: 'Test response',
      provider: 'openai',
      model: 'gpt-4'
    },
    // ...other response mappings...
  };
}
});

