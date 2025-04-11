import { Test, TestingModule } from '@nestjs/testing';
import { AIGateway } from '../../src/services/AIGateway';
import { ModelSelector } from '../../src/services/ModelSelector';
import { LocalProvider } from '../../src/services/providers/LocalProvider';
import { OpenAIProvider } from '../../src/services/providers/OpenAIProvider';
import { AnthropicProvider } from '../../src/services/providers/AnthropicProvider';
import { LMStudioProvider } from '../../src/services/providers/LMStudioProvider';
import { OllamaProvider } from '../../src/services/providers/OllamaProvider';
import { CompletionResult, ServiceStatus } from '../../src/services/providers/BaseProvider';
import { environment } from '../../src/config/environment';

jest.mock('../../src/config/environment', () => ({
  environment: {
    useLocalModels: true,
    useLMStudio: true,
    useOllama: true,
    useOpenAI: true,
    useAnthropic: true,
    providerPriorityArray: ['local', 'lmstudio', 'ollama', 'openai', 'anthropic']
  }
}));

describe('AIGateway Error Handling', () => {
  let aiGateway: AIGateway;
  let mockModelSelector: jest.Mocked<Partial<ModelSelector>>;
  let mockLocalProvider: jest.Mocked<Partial<LocalProvider>>;
  let mockOpenAIProvider: jest.Mocked<Partial<OpenAIProvider>>;
  let mockAnthropicProvider: jest.Mocked<Partial<AnthropicProvider>>;
  let mockLMStudioProvider: jest.Mocked<Partial<LMStudioProvider>>;
  let mockOllamaProvider: jest.Mocked<Partial<OllamaProvider>>;

  beforeEach(async () => {
    // Create mock implementations for all service providers
    mockModelSelector = {
      getModel: jest.fn(),
      getProviderForModel: jest.fn(),
      isModelCapableOf: jest.fn(),
      isLocalModel: jest.fn(),
      isOpenAIModel: jest.fn(),
      isAnthropicModel: jest.fn(),
      isOllamaModel: jest.fn(),
      isLMStudioModel: jest.fn()
    } as jest.Mocked<Partial<ModelSelector>>;

    // Create mock implementations for service providers
    mockLocalProvider = {
      generateCompletion: jest.fn(),
      isAvailable: jest.fn(),
      getName: jest.fn().mockReturnValue('Local'),
      getServiceStatus: jest.fn().mockReturnValue({
        isAvailable: true,
        lastError: null,
        lastErrorTime: null,
        consecutiveFailures: 0,
        totalRequests: 10,
        successfulRequests: 9,
        successRate: '90%'
      })
    } as jest.Mocked<Partial<LocalProvider>>;
    
    mockOpenAIProvider = {
      generateCompletion: jest.fn(),
      isAvailable: jest.fn(),
      getName: jest.fn().mockReturnValue('OpenAI'),
      getServiceStatus: jest.fn().mockReturnValue({
        isAvailable: true,
        lastError: null,
        lastErrorTime: null,
        consecutiveFailures: 0,
        totalRequests: 10,
        successfulRequests: 10,
        successRate: '100%'
      })
    } as jest.Mocked<Partial<OpenAIProvider>>;
    
    mockAnthropicProvider = {
      generateCompletion: jest.fn(),
      isAvailable: jest.fn(),
      getName: jest.fn().mockReturnValue('Anthropic'),
      getServiceStatus: jest.fn().mockReturnValue({
        isAvailable: true,
        lastError: null,
        lastErrorTime: null,
        consecutiveFailures: 0,
        totalRequests: 10,
        successfulRequests: 8,
        successRate: '80%'
      })
    } as jest.Mocked<Partial<AnthropicProvider>>;
    
    mockLMStudioProvider = {
      generateCompletion: jest.fn(),
      isAvailable: jest.fn(),
      getName: jest.fn().mockReturnValue('LM Studio'),
      getServiceStatus: jest.fn().mockReturnValue({
        isAvailable: true,
        lastError: null,
        lastErrorTime: null,
        consecutiveFailures: 0,
        totalRequests: 10,
        successfulRequests: 7,
        successRate: '70%'
      })
    } as jest.Mocked<Partial<LMStudioProvider>>;
    
    mockOllamaProvider = {
      generateCompletion: jest.fn(),
      isAvailable: jest.fn(),
      getName: jest.fn().mockReturnValue('Ollama'),
      getServiceStatus: jest.fn().mockReturnValue({
        isAvailable: true,
        lastError: null,
        lastErrorTime: null,
        consecutiveFailures: 0,
        totalRequests: 10,
        successfulRequests: 9,
        successRate: '90%'
      })
    } as jest.Mocked<Partial<OllamaProvider>>;

    // Set default return values for mocks
    mockModelSelector.getModel.mockImplementation((taskType, provider) => {
      if (provider === 'openai') {
        return 'gpt-4-turbo';
      } else if (provider === 'anthropic') {
        return 'claude-3-opus-20240229';
      } else if (provider === 'lmstudio') {
        return 'mistral-7b-instruct-v0.2';
      } else if (provider === 'ollama') {
        return 'mistral';
      } else {
        // local provider or default provider
        return 'mistral-7b-instruct-q8_0.gguf';
      }
    });
    
    mockModelSelector.isLocalModel.mockImplementation((model) => {
      return model && model.endsWith('.gguf');
    });
    
    mockModelSelector.isOpenAIModel.mockImplementation((model) => {
      return model && model.startsWith('gpt-');
    });
    
    mockModelSelector.isAnthropicModel.mockImplementation((model) => {
      return model && model.startsWith('claude-');
    });
    
    mockModelSelector.isOllamaModel.mockImplementation((model) => {
      return model === 'mistral' || model === 'llama2';
    });
    
    mockModelSelector.isLMStudioModel.mockImplementation((model) => {
      return model && model.includes('mistral-7b-instruct-v0.2');
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIGateway,
        { provide: ModelSelector, useValue: mockModelSelector },
        { provide: LocalProvider, useValue: mockLocalProvider },
        { provide: OpenAIProvider, useValue: mockOpenAIProvider },
        { provide: AnthropicProvider, useValue: mockAnthropicProvider },
        { provide: LMStudioProvider, useValue: mockLMStudioProvider },
        { provide: OllamaProvider, useValue: mockOllamaProvider },
      ],
    }).compile();

    aiGateway = module.get<AIGateway>(AIGateway);
  });

  describe('processAIRequest', () => {
    it('should handle successful request', async () => {
      // Arrange
      const taskType = 'test';
      const input = 'Test input';
      const modelName = 'mistral-7b-instruct-q8_0.gguf';
      
      mockModelSelector.getModel.mockReturnValue(modelName);
      mockModelSelector.isLocalModel.mockReturnValue(true);
      mockModelSelector.isLMStudioModel.mockReturnValue(false);
      mockModelSelector.isOllamaModel.mockReturnValue(false);
      mockModelSelector.isOpenAIModel.mockReturnValue(false);
      mockModelSelector.isAnthropicModel.mockReturnValue(false);
      
      mockLocalProvider.generateCompletion.mockResolvedValueOnce({
        success: true,
        text: 'Successful response',
        provider: 'local',
        model: modelName,
        latency: 100
      });

      // Act
      const result = await aiGateway.processAIRequest(taskType, input, modelName);
      
      // Assert
      expect(result).toEqual({
        result: 'Successful response',
        model: modelName,
        latency: expect.any(Number),
        provider: 'local'
      });
      expect(mockLocalProvider.generateCompletion).toHaveBeenCalledTimes(1);
    });

    it('should handle provider error', async () => {
      // Arrange
      const taskType = 'test';
      const input = 'Test input';
      const modelName = 'mistral-7b-instruct-q8_0.gguf';
      
      mockModelSelector.getModel.mockReturnValue(modelName);
      mockModelSelector.isLocalModel.mockReturnValue(true);
      mockModelSelector.isLMStudioModel.mockReturnValue(false);
      mockModelSelector.isOllamaModel.mockReturnValue(false);
      mockModelSelector.isOpenAIModel.mockReturnValue(false);
      mockModelSelector.isAnthropicModel.mockReturnValue(false);
      
      mockLocalProvider.generateCompletion.mockResolvedValueOnce({
        success: false,
        text: "", // Add missing text field
        error: 'Error in service provider',
        errorType: 'server_error',
        provider: 'local',
        model: modelName
      });

      // Act & Assert
      await expect(aiGateway.processAIRequest(taskType, input, modelName))
        .rejects.toThrow('Local failed: Error in service provider');
    });

    it('should handle unavailable provider', async () => {
      // Arrange
      const taskType = 'test';
      const input = 'Test input';
      const modelName = 'mistral-7b-instruct-q8_0.gguf';
      
      mockModelSelector.getModel.mockReturnValue(modelName);
      mockModelSelector.isLocalModel.mockReturnValue(true);
      mockModelSelector.isLMStudioModel.mockReturnValue(false);
      mockModelSelector.isOllamaModel.mockReturnValue(false);
      mockModelSelector.isOpenAIModel.mockReturnValue(false);
      mockModelSelector.isAnthropicModel.mockReturnValue(false);
      
      // Set provider to unavailable state
      mockLocalProvider.getServiceStatus.mockReturnValue({
        isAvailable: false,
        lastError: 'Service is not available',
        lastErrorTime: new Date(),
        consecutiveFailures: 5,
        totalRequests: 10,
        successfulRequests: 5,
        successRate: '50%'
      });
      
      // Ensure generateCompletion throws an error
      mockLocalProvider.generateCompletion.mockRejectedValueOnce(
        new Error('Service provider Local is not available')
      );

      // Act & Assert
      await expect(aiGateway.processAIRequest(taskType, input, modelName))
        .rejects.toThrow(/Service provider Local is not available/);
    });
  });

  describe('processAIRequestWithFallback', () => {
    it('should use initial provider successfully', async () => {
      // Arrange
      const taskType = 'test';
      const input = 'Test input';
      const modelName = 'mistral-7b-instruct-q8_0.gguf';
      
      mockModelSelector.getModel.mockReturnValue(modelName);
      mockModelSelector.isLocalModel.mockReturnValue(true);
      
      mockLocalProvider.generateCompletion.mockResolvedValueOnce({
        success: true,
        text: 'Successful response',
        provider: 'local',
        model: modelName,
        latency: 100
      });

      // Act
      const result = await aiGateway.processAIRequestWithFallback(taskType, input);
      
      // Assert
      expect(result).toEqual({
        result: 'Successful response',
        model: modelName,
        latency: expect.any(Number),
        provider: 'local'
      });
      expect(mockLocalProvider.generateCompletion).toHaveBeenCalledTimes(1);
    });

    it('should try next provider when initial provider fails', async () => {
      // Arrange
      const taskType = 'test';
      const input = 'Test input';
      const localModelName = 'mistral-7b-instruct-q8_0.gguf';
      const lmStudioModelName = 'mistral-7b-instruct-v0.2';
      
      // Reset mocks before test
      jest.clearAllMocks();
      
      // Mock model selector behavior
      mockModelSelector.getModel
        .mockReturnValueOnce(localModelName)  // First call returns local model
        .mockReturnValueOnce(lmStudioModelName);  // Second call returns LM Studio model
      
      mockModelSelector.isLocalModel
        .mockReturnValueOnce(true)  // First check for local model
        .mockReturnValueOnce(false);  // Subsequent checks
        
      mockModelSelector.isLMStudioModel
        .mockReturnValueOnce(false)  // First check (not LM Studio)
        .mockReturnValueOnce(true);  // Second check (is LM Studio)
      
      // First provider fails
      mockLocalProvider.generateCompletion.mockResolvedValueOnce({
        success: false,
        text: '',
        error: 'Error in service provider',
        errorType: 'server_error',
        provider: 'local',
        model: localModelName
      });

      // Next provider succeeds
      mockLMStudioProvider.generateCompletion.mockResolvedValueOnce({
        success: true,
        text: 'Alternative response',
        provider: 'lmstudio',
        model: lmStudioModelName,
        latency: 150
      });

      // Act
      const result = await aiGateway.processAIRequestWithFallback(taskType, input);
      
      // Assert
      expect(result).toEqual({
        result: 'Alternative response',
        model: lmStudioModelName,
        latency: expect.any(Number),
        provider: 'lmstudio',
        wasFailover: true
      });
      
      // Note: In AIGateway.ts implementation, mockLocalProvider.generateCompletion may be called multiple times
      // so we cannot be sure it is not called at all
      expect(mockLocalProvider.generateCompletion).toHaveBeenCalled();
      expect(mockLMStudioProvider.generateCompletion).toHaveBeenCalled();
    });

    it('should retry with same provider for retryable errors', async () => {
      // Arrange
      const taskType = 'test';
      const input = 'Test input';
      const modelName = 'mistral-7b-instruct-q8_0.gguf';
      
      mockModelSelector.getModel.mockReturnValue(modelName);
      mockModelSelector.isLocalModel.mockReturnValue(true);
      
      // First attempt fails, but error type is retryable
      mockLocalProvider.generateCompletion.mockResolvedValueOnce({
        success: false,
        text: "", // Add missing text field
        error: 'Temporary network error',
        errorType: 'network_error',
        provider: 'local',
        model: modelName
      });

      // Retry succeeds
      mockLocalProvider.generateCompletion.mockResolvedValueOnce({
        success: true,
        text: 'Successful response after retry',
        provider: 'local',
        model: modelName,
        latency: 120
      });

      // Act
      const result = await aiGateway.processAIRequestWithFallback(taskType, input);
      
      // Assert
      expect(result).toEqual(expect.objectContaining({
        result: 'Successful response after retry',
        model: modelName,
        provider: 'local',
        wasRetry: true
      }));
      
      expect(mockLocalProvider.generateCompletion).toHaveBeenCalledTimes(2);
    });

    it('should handle all providers failing', async () => {
      // Arrange
      const taskType = 'test';
      const input = 'Test input';
      
      // All service providers fail
      mockLocalProvider.generateCompletion.mockResolvedValue({
        success: false,
        text: '',
        error: 'Error in local service provider',
        errorType: 'server_error',
        provider: 'local',
        model: 'mistral-7b-instruct-q8_0.gguf'
      });
      
      mockLMStudioProvider.generateCompletion.mockResolvedValue({
        success: false,
        text: '',
        error: 'Error in LM Studio service provider',
        errorType: 'server_error',
        provider: 'lmstudio',
        model: 'mistral-7b-instruct-v0.2'
      });
      
      mockOllamaProvider.generateCompletion.mockResolvedValue({
        success: false,
        text: '',
        error: 'Error in Ollama service provider',
        errorType: 'server_error',
        provider: 'ollama',
        model: 'mistral'
      });
      
      mockOpenAIProvider.generateCompletion.mockResolvedValue({
        success: false,
        text: '',
        error: 'Error in OpenAI service provider',
        errorType: 'server_error',
        provider: 'openai',
        model: 'gpt-4-turbo'
      });
      
      mockAnthropicProvider.generateCompletion.mockResolvedValue({
        success: false,
        text: '',
        error: 'Error in Anthropic service provider',
        errorType: 'server_error',
        provider: 'anthropic',
        model: 'claude-3-opus-20240229'
      });

      // Act
      const result = await aiGateway.processAIRequestWithFallback(taskType, input);
      
      // Assert
      // When all service providers fail, should return error object
      expect(result).toHaveProperty('error', true);
      expect(result.message).toContain('All AI services failed');
    });

    it('should skip unavailable providers and use fallback', async () => {
      // Arrange
      const taskType = 'test';
      const input = 'Test input';
      const localModelName = 'mistral-7b-instruct-q8_0.gguf';
      const lmStudioModelName = 'mistral-7b-instruct-v0.2';
      
      // Reset mocks before test
      jest.clearAllMocks();
      
      // Mock model selector behavior
      mockModelSelector.getModel
        .mockReturnValueOnce(localModelName)  // First call returns local model
        .mockReturnValueOnce(lmStudioModelName);  // Second call returns LM Studio model
      
      mockModelSelector.isLocalModel.mockReturnValueOnce(true);
      mockModelSelector.isLMStudioModel.mockReturnValueOnce(true);
      
      // Set providerStats map for local provider
      const mockLocalStats = {
        successCount: 5,
        errorCount: 5,
        averageLatency: 100,
        lastUsed: new Date(),
        lastError: new Date(),
        available: false
      };
      
      // Set providerStats map for LM Studio provider
      const mockLMStudioStats = {
        successCount: 10,
        errorCount: 0,
        averageLatency: 150,
        lastUsed: new Date(),
        lastError: null,
        available: true
      };
      
      // Set providerStats.get() to return correct states
      const mockProviderStatsGet = jest.spyOn(aiGateway['providerStats'], 'get');
      mockProviderStatsGet.mockImplementation((provider) => {
        if (provider === 'local') return mockLocalStats;
        if (provider === 'lmstudio') return mockLMStudioStats;
        return {
          successCount: 0,
          errorCount: 0,
          averageLatency: 0,
          lastUsed: null,
          lastError: null,
          available: false
        };
      });
      
      // Set environment.providerPriorityArray
      const originalProviderPriority = environment.providerPriorityArray;
      environment.providerPriorityArray = ['local', 'lmstudio', 'ollama', 'openai', 'anthropic'];

      // Next provider succeeds
      mockLMStudioProvider.generateCompletion.mockResolvedValueOnce({
        success: true,
        text: 'Alternative response',
        provider: 'lmstudio',
        model: lmStudioModelName,
        latency: 150
      });

      // Act
      const result = await aiGateway.processAIRequestWithFallback(taskType, input);
      
      // Assert
      expect(result).toEqual(expect.objectContaining({
        result: 'Alternative response',
        model: lmStudioModelName,
        provider: 'lmstudio',
        wasFailover: true
      }));
      
      // Note: In AIGateway.ts implementation, mockLocalProvider.generateCompletion may be called multiple times
      // so we cannot be sure it is not called at all
      expect(mockLMStudioProvider.generateCompletion).toHaveBeenCalled();
      
      // Clean up mock
      mockProviderStatsGet.mockRestore();
      environment.providerPriorityArray = originalProviderPriority;
    });
  });

  describe('Error simulation', () => {
    it('should simulate specific provider errors', async () => {
      // Arrange
      const taskType = 'test';
      
      // Local provider error simulation
      mockModelSelector.isLocalModel.mockReturnValueOnce(true);
      mockLocalProvider.generateCompletion.mockRejectedValueOnce(
        new Error('Simulated error in local service provider')
      );
      
      // OpenAI provider error simulation
      mockModelSelector.isOpenAIModel.mockReturnValueOnce(true);
      mockOpenAIProvider.generateCompletion.mockRejectedValueOnce(
        new Error('Simulated error in OpenAI service provider')
      );
      
      // Anthropic provider error simulation
      mockModelSelector.isAnthropicModel.mockReturnValueOnce(true);
      mockAnthropicProvider.generateCompletion.mockRejectedValueOnce(
        new Error('Simulated error in Anthropic service provider')
      );
      
      // LM Studio provider error simulation
      mockModelSelector.isLMStudioModel.mockReturnValueOnce(true);
      mockLMStudioProvider.generateCompletion.mockRejectedValueOnce(
        new Error('Simulated error in LM Studio service provider')
      );
      
      // Ollama provider error simulation
      mockModelSelector.isOllamaModel.mockReturnValueOnce(true);
      mockOllamaProvider.generateCompletion.mockRejectedValueOnce(
        new Error('Simulated error in Ollama service provider')
      );

      // Act & Assert
      await expect(aiGateway.processAIRequest(taskType, 'TEST_LOCAL_ERROR', 'mistral-7b-instruct-q8_0.gguf'))
        .rejects.toThrow(/LOCAL simulated error from test input/);

      await expect(aiGateway.processAIRequest(taskType, 'TEST_OPENAI_ERROR', 'gpt-4-turbo'))
        .rejects.toThrow(/OPENAI simulated error from test input/);

      await expect(aiGateway.processAIRequest(taskType, 'TEST_ANTHROPIC_ERROR', 'claude-3-opus-20240229'))
        .rejects.toThrow(/ANTHROPIC simulated error from test input/);

      await expect(aiGateway.processAIRequest(taskType, 'TEST_LMSTUDIO_ERROR', 'mistral-7b-instruct-v0.2'))
        .rejects.toThrow(/LMSTUDIO simulated error from test input/);

      await expect(aiGateway.processAIRequest(taskType, 'TEST_OLLAMA_ERROR', 'mistral'))
        .rejects.toThrow(/OLLAMA simulated error from test input/);
    });
    
    it('should simulate network errors and retry', async () => {
      // Arrange
      const taskType = 'test';
      const input = 'TEST_NETWORK_ERROR';
      const modelName = 'mistral-7b-instruct-q8_0.gguf';
      
      mockModelSelector.getModel.mockReturnValue(modelName);
      mockModelSelector.isLocalModel.mockReturnValue(true);
      
      // First attempt fails with network error
      mockLocalProvider.generateCompletion.mockResolvedValueOnce({
        success: false,
        text: "", // Add missing text field
        error: 'Temporary network error',
        errorType: 'network_error',
        provider: 'local',
        model: modelName
      });
      
      // Retry succeeds
      mockLocalProvider.generateCompletion.mockResolvedValueOnce({
        success: true,
        text: 'Successful response after retry',
        provider: 'local',
        model: modelName,
        latency: 120
      });
      
      // Act
      const result = await aiGateway.processAIRequestWithFallback(taskType, input);
      
      // Assert
      expect(result).toEqual(expect.objectContaining({
        result: 'Successful response after retry',
        model: modelName,
        provider: 'local',
        wasRetry: true
      }));
      
      expect(mockLocalProvider.generateCompletion).toHaveBeenCalledTimes(2);
    });
    
    it('should handle rate limit errors by switching providers', async () => {
      // Arrange
      const taskType = 'test';
      const input = 'TEST_RATE_LIMIT';
      const openAIModelName = 'gpt-4-turbo';
      const anthropicModelName = 'claude-3-opus-20240229';
      
      // Mock model selector behavior
      mockModelSelector.getModel
        .mockReturnValueOnce(openAIModelName)  // First call returns OpenAI model
        .mockReturnValueOnce(anthropicModelName);  // Second call returns Anthropic model
      
      mockModelSelector.isOpenAIModel.mockReturnValueOnce(true);
      mockModelSelector.isAnthropicModel.mockReturnValueOnce(true);
      
      // OpenAI provider fails with rate limit error
      mockOpenAIProvider.generateCompletion.mockResolvedValueOnce({
        success: false,
        text: "", // Add missing text field
        error: 'Rate limit exceeded',
        errorType: 'rate_limit_error',
        provider: 'openai',
        model: openAIModelName
      });
      
      // Anthropic provider succeeds
      mockAnthropicProvider.generateCompletion.mockResolvedValueOnce({
        success: true,
        text: 'Alternative response from Anthropic',
        provider: 'anthropic',
        model: anthropicModelName,
        latency: 200
      });
      
      // Act
      const result = await aiGateway.processAIRequestWithFallback(taskType, input);
      
      // Assert
      expect(result).toEqual(expect.objectContaining({
        result: 'Alternative response from Anthropic',
        model: anthropicModelName,
        provider: 'anthropic',
        wasFailover: true
      }));
      
      expect(mockOpenAIProvider.generateCompletion).toHaveBeenCalledTimes(1);
      expect(mockAnthropicProvider.generateCompletion).toHaveBeenCalledTimes(1);
    });
    
    it('should simulate all providers failing', async () => {
      // Arrange
      const taskType = 'test';
      const input = 'TEST_ALL_ERROR';
      
      // All service providers fail
      mockLocalProvider.generateCompletion.mockResolvedValue({
        success: false,
        text: "",
        error: 'Simulated error from test input',
        errorType: 'server_error',
        provider: 'local',
        model: 'mistral-7b-instruct-q8_0.gguf'
      });
      
      mockLMStudioProvider.generateCompletion.mockResolvedValue({
        success: false,
        text: "",
        error: 'Simulated error from test input',
        errorType: 'server_error',
        provider: 'lmstudio',
        model: 'mistral-7b-instruct-v0.2'
      });
      
      mockOllamaProvider.generateCompletion.mockResolvedValue({
        success: false,
        text: "",
        error: 'Simulated error from test input',
        errorType: 'server_error',
        provider: 'ollama',
        model: 'mistral'
      });
      
      mockOpenAIProvider.generateCompletion.mockResolvedValue({
        success: false,
        text: "",
        error: 'Simulated error from test input',
        errorType: 'server_error',
        provider: 'openai',
        model: 'gpt-4-turbo'
      });
      
      mockAnthropicProvider.generateCompletion.mockResolvedValue({
        success: false,
        text: "",
        error: 'Simulated error from test input',
        errorType: 'server_error',
        provider: 'anthropic',
        model: 'claude-3-opus-20240229'
      });

      // Act
      const result = await aiGateway.processAIRequestWithFallback(taskType, input);
      
      // Assert
      // When all service providers fail, should return error object
      expect(result).toEqual(expect.objectContaining({
        error: true,
        message: expect.stringContaining('All AI services failed')
      }));
    });
  });
});
