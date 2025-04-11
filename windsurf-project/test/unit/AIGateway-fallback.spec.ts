import { AIGateway } from '../../src/services/AIGateway';
import { ModelSelector } from '../../src/services/ModelSelector';
import { LocalProvider } from '../../src/services/providers/LocalProvider';
import { OpenAIProvider } from '../../src/services/providers/OpenAIProvider';
import { AnthropicProvider } from '../../src/services/providers/AnthropicProvider';
import { LMStudioProvider } from '../../src/services/providers/LMStudioProvider';
import { OllamaProvider } from '../../src/services/providers/OllamaProvider';

// Mock environment module
jest.mock('../../src/config/environment', () => ({
    environment: {
        providerPriorityArray: ['local', 'openai', 'anthropic', 'lmstudio', 'ollama'],
        useLocalModels: true,
        useLMStudio: true,
        useOllama: true,
        useOpenAI: true,
        useAnthropic: true
    }
}));

import { environment } from '../../src/config/environment';

describe('AIGateway - Fallback mechanism', () => {
    let aiGateway: AIGateway;
    let mockModelSelector: jest.Mocked<ModelSelector>;
    let mockLocalProvider: jest.Mocked<LocalProvider>;
    let mockOpenAIProvider: jest.Mocked<OpenAIProvider>;
    let mockAnthropicProvider: jest.Mocked<AnthropicProvider>;
    let mockLMStudioProvider: jest.Mocked<LMStudioProvider>;
    let mockOllamaProvider: jest.Mocked<OllamaProvider>;

    beforeEach(() => {
        // Create mock implementations for all service providers
        mockModelSelector = {
            getModel: jest.fn(),
            isLocalModel: jest.fn(),
            isOpenAIModel: jest.fn(),
            isAnthropicModel: jest.fn(),
            isOllamaModel: jest.fn(),
            isLMStudioModel: jest.fn()
        } as unknown as jest.Mocked<ModelSelector>;

        mockLocalProvider = {
            generateCompletion: jest.fn(),
            getName: jest.fn().mockReturnValue('Local'),
            getServiceStatus: jest.fn().mockReturnValue({ 
                isAvailable: true,
                lastError: null,
                lastErrorTime: null,
                consecutiveFailures: 0,
                totalRequests: 0,
                successfulRequests: 0
            })
        } as unknown as jest.Mocked<LocalProvider>;

        mockOpenAIProvider = {
            generateCompletion: jest.fn(),
            getName: jest.fn().mockReturnValue('OpenAI'),
            getServiceStatus: jest.fn().mockReturnValue({ 
                isAvailable: true,
                lastError: null,
                lastErrorTime: null,
                consecutiveFailures: 0,
                totalRequests: 0,
                successfulRequests: 0
            })
        } as unknown as jest.Mocked<OpenAIProvider>;

        mockAnthropicProvider = {
            generateCompletion: jest.fn(),
            getName: jest.fn().mockReturnValue('Anthropic'),
            getServiceStatus: jest.fn().mockReturnValue({ 
                isAvailable: true,
                lastError: null,
                lastErrorTime: null,
                consecutiveFailures: 0,
                totalRequests: 0,
                successfulRequests: 0
            })
        } as unknown as jest.Mocked<AnthropicProvider>;

        mockLMStudioProvider = {
            generateCompletion: jest.fn(),
            getName: jest.fn().mockReturnValue('LM Studio'),
            getServiceStatus: jest.fn().mockReturnValue({ 
                isAvailable: true,
                lastError: null,
                lastErrorTime: null,
                consecutiveFailures: 0,
                totalRequests: 0,
                successfulRequests: 0
            })
        } as unknown as jest.Mocked<LMStudioProvider>;

        mockOllamaProvider = {
            generateCompletion: jest.fn(),
            getName: jest.fn().mockReturnValue('Ollama'),
            getServiceStatus: jest.fn().mockReturnValue({ 
                isAvailable: true,
                lastError: null,
                lastErrorTime: null,
                consecutiveFailures: 0,
                totalRequests: 0,
                successfulRequests: 0
            })
        } as unknown as jest.Mocked<OllamaProvider>;

        // Set default return values for mocks
        mockModelSelector.getModel.mockImplementation((taskType, provider) => {
            if (provider === 'openai' || provider === undefined) {
                return 'gpt-4-turbo';
            } else if (provider === 'anthropic') {
                return 'claude-3-opus-20240229';
            } else if (provider === 'lmstudio') {
                return 'mistral-7b-instruct-v0.2';
            } else if (provider === 'ollama') {
                return 'mistral';
            } else {
                // local provider
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

        // Create mock implementations for the required dependencies
        const mockProviderRegistry = {
            getProvider: jest.fn().mockImplementation((providerName) => {
                if (providerName === 'local') return mockLocalProvider;
                if (providerName === 'openai') return mockOpenAIProvider;
                if (providerName === 'anthropic') return mockAnthropicProvider;
                if (providerName === 'lmstudio') return mockLMStudioProvider;
                if (providerName === 'ollama') return mockOllamaProvider;
                return null;
            }),
            getAllProviders: jest.fn().mockReturnValue([
                mockLocalProvider,
                mockOpenAIProvider,
                mockAnthropicProvider,
                mockLMStudioProvider,
                mockOllamaProvider
            ])
        };
        
        const mockConfigService = {
            get: jest.fn().mockImplementation((key) => {
                if (key === 'providerPriorityArray') return environment.providerPriorityArray;
                return null;
            })
        };
        
        const mockHealthMonitor = {
            isProviderAvailable: jest.fn().mockReturnValue(true),
            updateProviderStatus: jest.fn()
        };
        
        const mockSelectionStrategy = {
            selectProvider: jest.fn().mockImplementation(() => mockLocalProvider)
        };
        
        const mockErrorClassifier = {
            isRetryableError: jest.fn().mockReturnValue(false),
            classifyError: jest.fn().mockReturnValue('general')
        };

        aiGateway = new AIGateway(
            mockProviderRegistry as any,
            mockConfigService as any,
            mockHealthMonitor as any,
            mockSelectionStrategy as any,
            mockErrorClassifier as any
        );
    });

    it('should use fallback when the primary provider fails', async () => {
        // Clear all mocks before the test starts
        jest.clearAllMocks();
        
        // Set the primary provider (Local) to fail
        mockModelSelector.getModel.mockReturnValue('mistral-7b-instruct-q8_0.gguf');
        mockModelSelector.isLocalModel.mockReturnValue(true);

        // Local provider fails
        mockLocalProvider.generateCompletion.mockResolvedValueOnce({
            success: false,
            text: '', // Empty text in case of error
            provider: 'local',
            model: 'mistral-7b-instruct-q8_0.gguf',
            error: 'Local provider error'
        });

        // Set Local provider to return the correct response in tryNextProvider method
        mockLocalProvider.generateCompletion.mockResolvedValueOnce({
            success: false,
            text: '', // Empty text in case of error
            provider: 'local',
            model: 'mistral-7b-instruct-q8_0.gguf',
            error: 'Local provider error'
        });

        // OpenAI provider succeeds
        mockOpenAIProvider.generateCompletion.mockResolvedValueOnce({
            success: true,
            text: 'OpenAI response',
            provider: 'openai',
            model: 'gpt-4-turbo'
        });

        // Call the fallback mechanism method
        const result = await aiGateway.processAIRequestWithFallback('seo', 'Test input');

        // Verify that the result is as expected
        expect(result).toEqual({
            result: 'OpenAI response',
            model: expect.any(String),
            latency: expect.any(Number),
            provider: 'openai',
            wasFailover: true
        });

        // Verify that both providers were called
        expect(mockLocalProvider.generateCompletion).toHaveBeenCalled();
        expect(mockOpenAIProvider.generateCompletion).toHaveBeenCalled();
    });

    it('should try multiple fallbacks until finding a working provider', async () => {
        // Clear all mocks before the test starts
        jest.clearAllMocks();
        
        // Set the primary provider (Local) to fail
        mockModelSelector.getModel.mockReturnValue('mistral-7b-instruct-q8_0.gguf');
        mockModelSelector.isLocalModel.mockReturnValue(true);

        // Local provider fails
        mockLocalProvider.generateCompletion.mockResolvedValueOnce({
            success: false,
            text: '', // Empty text in case of error
            provider: 'local',
            model: 'mistral-7b-instruct-q8_0.gguf',
            error: 'Local provider error'
        });

        // Set Local provider to return the correct response in tryNextProvider method
        mockLocalProvider.generateCompletion.mockResolvedValueOnce({
            success: false,
            text: '', // Empty text in case of error
            provider: 'local',
            model: 'mistral-7b-instruct-q8_0.gguf',
            error: 'Local provider error'
        });

        // OpenAI provider fails
        mockOpenAIProvider.generateCompletion.mockResolvedValueOnce({
            success: false,
            text: '', // Empty text in case of error
            provider: 'openai',
            model: 'gpt-4-turbo',
            error: 'OpenAI provider error'
        });

        // Anthropic provider succeeds
        mockAnthropicProvider.generateCompletion.mockResolvedValueOnce({
            success: true,
            text: 'Anthropic response',
            provider: 'anthropic',
            model: 'claude-3-opus-20240229'
        });

        // Call the fallback mechanism method
        const result = await aiGateway.processAIRequestWithFallback('seo', 'Test input');

        // Verify that the result is as expected
        expect(result).toEqual({
            result: 'Anthropic response',
            model: expect.any(String),
            latency: expect.any(Number),
            provider: 'anthropic',
            wasFailover: true
        });

        // Verify that all three providers were called
        expect(mockLocalProvider.generateCompletion).toHaveBeenCalled();
        expect(mockOpenAIProvider.generateCompletion).toHaveBeenCalled();
        expect(mockAnthropicProvider.generateCompletion).toHaveBeenCalled();
    });

    it('should return error object when all providers fail', async () => {
        // Set all providers to fail
        mockModelSelector.getModel.mockReturnValue('gpt-4-turbo');
        
        // Reset all mocks to ensure clean state
        jest.clearAllMocks();
        
        // Local provider fails always
        mockLocalProvider.generateCompletion.mockImplementation(() => {
            return Promise.resolve({
                success: false,
                text: '', // Empty text in case of error
                provider: 'local',
                model: 'mistral-7b-instruct-q8_0.gguf',
                error: 'Local provider error'
            });
        });

        // OpenAI provider fails always
        mockOpenAIProvider.generateCompletion.mockImplementation(() => {
            return Promise.resolve({
                success: false,
                text: '', // Empty text in case of error
                provider: 'openai',
                model: 'gpt-4-turbo',
                error: 'OpenAI provider error'
            });
        });

        // Anthropic provider fails always
        mockAnthropicProvider.generateCompletion.mockImplementation(() => {
            return Promise.resolve({
                success: false,
                text: '', // Empty text in case of error
                provider: 'anthropic',
                model: 'claude-3-opus-20240229',
                error: 'Anthropic provider error'
            });
        });

        // LMStudio provider fails always
        mockLMStudioProvider.generateCompletion.mockImplementation(() => {
            return Promise.resolve({
                success: false,
                text: '', // Empty text in case of error
                provider: 'lmstudio',
                model: 'mistral-7b-instruct-v0.2',
                error: 'LM Studio provider error'
            });
        });

        // Ollama provider fails always
        mockOllamaProvider.generateCompletion.mockImplementation(() => {
            return Promise.resolve({
                success: false,
                text: '', // Empty text in case of error
                provider: 'ollama',
                model: 'mistral',
                error: 'Ollama provider error'
            });
        });

        // Call the fallback mechanism method
        const result = await aiGateway.processAIRequestWithFallback('seo', 'Test input');

        // Verify that the result is an error object
        expect(result).toHaveProperty('error', true);
        expect(result).toHaveProperty('message');
        expect(result.message).toContain('All AI services failed');
    });

    it('should skip unavailable providers during fallback', async () => {
        // Clear all mocks before the test starts
        jest.clearAllMocks();
        
        // Set the primary provider (Local) to fail
        mockModelSelector.getModel.mockReturnValue('mistral-7b-instruct-q8_0.gguf');
        mockModelSelector.isLocalModel.mockReturnValue(true);

        // Set OpenAI provider to be unavailable before the test starts
        // This needs to be done before the AIGateway class initializes the providerStats map
        // Set it directly in the AIGateway class providerStats map
        aiGateway['providerStats'] = new Map([
            ['local', { successCount: 0, errorCount: 0, averageLatency: 0, lastUsed: null, lastError: null, available: true }],
            ['openai', { successCount: 2, errorCount: 3, averageLatency: 150, lastUsed: new Date(), lastError: new Date(), available: false }],
            ['anthropic', { successCount: 0, errorCount: 0, averageLatency: 0, lastUsed: null, lastError: null, available: true }],
            ['lmstudio', { successCount: 0, errorCount: 0, averageLatency: 0, lastUsed: null, lastError: null, available: true }],
            ['ollama', { successCount: 0, errorCount: 0, averageLatency: 0, lastUsed: null, lastError: null, available: true }]
        ]);

        // Local provider fails
        mockLocalProvider.generateCompletion.mockResolvedValueOnce({
            success: false,
            text: '', // Empty text in case of error
            provider: 'local',
            model: 'mistral-7b-instruct-q8_0.gguf',
            error: 'Local provider error'
        });
        
        // Local provider fails in tryNextProvider method
        mockLocalProvider.generateCompletion.mockResolvedValueOnce({
            success: false,
            text: '', // Empty text in case of error
            provider: 'local',
            model: 'mistral-7b-instruct-q8_0.gguf',
            error: 'Local provider error'
        });

        // OpenAI provider is not available - this is already set in the providerStats map
        // Verify that getServiceStatus returns the correct value
        mockOpenAIProvider.getServiceStatus.mockReturnValue({ 
            isAvailable: false,
            lastError: 'Service unavailable',
            lastErrorTime: new Date(),
            consecutiveFailures: 3,
            totalRequests: 5,
            successfulRequests: 2
        });

        // Anthropic provider succeeds
        mockAnthropicProvider.generateCompletion.mockResolvedValueOnce({
            success: true,
            text: 'Anthropic response',
            provider: 'anthropic',
            model: 'claude-3-opus-20240229'
        });

        // Call the fallback mechanism method
        const result = await aiGateway.processAIRequestWithFallback('seo', 'Test input');

        // Verify that the result is as expected
        expect(result).toEqual({
            result: 'Anthropic response',
            model: expect.any(String),
            latency: expect.any(Number),
            provider: 'anthropic',
            wasFailover: true
        });

        // Verify that Local provider was called, but OpenAI provider was not
        expect(mockLocalProvider.generateCompletion).toHaveBeenCalled();
        expect(mockOpenAIProvider.generateCompletion).not.toHaveBeenCalled();
        expect(mockAnthropicProvider.generateCompletion).toHaveBeenCalled();
    });

    it('should retry with the same provider for retryable errors', async () => {
        // Clear all mocks before the test starts
        jest.clearAllMocks();
        
        // Set the primary provider (Local) to fail with a network error
        mockModelSelector.getModel.mockReturnValue('mistral-7b-instruct-q8_0.gguf');
        mockModelSelector.isLocalModel.mockReturnValue(true);

        // Local provider fails with a network error on the first attempt
        mockLocalProvider.generateCompletion.mockResolvedValueOnce({
            success: false,
            text: '', // Empty text in case of error
            provider: 'local',
            model: 'mistral-7b-instruct-q8_0.gguf',
            error: 'Network error',
            errorType: 'network_error'
        });

        // Local provider succeeds on the second attempt
        mockLocalProvider.generateCompletion.mockResolvedValueOnce({
            success: true,
            text: 'Local response after retry',
            provider: 'local',
            model: 'mistral-7b-instruct-q8_0.gguf'
        });
        
        // Verify that Local provider is not called a third time
        // This is just in case tryNextProvider method is called

        // Call the fallback mechanism method
        const result = await aiGateway.processAIRequestWithFallback('seo', 'Test input');

        // Verify that the result is as expected
        expect(result).toEqual({
            result: 'Local response after retry',
            model: expect.any(String),
            wasRetry: true,
            provider: 'local'
        });

        // Verify that Local provider was called twice
        expect(mockLocalProvider.generateCompletion).toHaveBeenCalledTimes(2);
        // Verify that other providers were not called
        expect(mockOpenAIProvider.generateCompletion).not.toHaveBeenCalled();
    });

    it('should handle test error simulation correctly', async () => {
        // Clear all mocks before the test starts
        jest.clearAllMocks();
        
        // Set the test input to simulate a Local provider error
        const testInput = 'TEST_LOCAL_ERROR';
        mockModelSelector.getModel.mockReturnValue('mistral-7b-instruct-q8_0.gguf');

        // OpenAI provider succeeds
        mockOpenAIProvider.generateCompletion.mockResolvedValueOnce({
            success: true,
            text: 'OpenAI response',
            provider: 'openai',
            model: 'gpt-4-turbo'
        });
        
        // Local provider is not called because of the simulated error

        // Call the fallback mechanism method
        const result = await aiGateway.processAIRequestWithFallback('seo', testInput);

        // Verify that the result is as expected
        expect(result).toEqual({
            result: 'OpenAI response',
            model: expect.any(String),
            latency: expect.any(Number),
            provider: 'openai',
            wasFailover: true
        });

        // Verify that Local provider was not called (simulated error skipped it)
        expect(mockLocalProvider.generateCompletion).not.toHaveBeenCalled();
        expect(mockOpenAIProvider.generateCompletion).toHaveBeenCalled();
    });
    
    it('should fallback to Anthropic if OpenAI fails', async () => {
        // Clear all mocks before the test starts
        jest.clearAllMocks();
        
        // Set the provider priority
        (environment.providerPriorityArray as string[]) = ['openai', 'anthropic', 'local', 'lmstudio', 'ollama'];
        
        // Set the return value of getInitialProvider method
        const getInitialProviderSpy = jest.spyOn(aiGateway as any, 'getInitialProvider');
        getInitialProviderSpy.mockReturnValue(mockOpenAIProvider);
        
        // Set the return value of getProviderName method
        const getProviderNameSpy = jest.spyOn(aiGateway as any, 'getProviderName');
        getProviderNameSpy.mockReturnValue('openai');
        
        // Set the model name to gpt-4-turbo
        mockModelSelector.getModel.mockReturnValue('gpt-4-turbo');
        
        // Set OpenAI to fail
        mockOpenAIProvider.generateCompletion.mockResolvedValueOnce({
            success: false,
            text: '', // Empty text in case of error
            error: 'OpenAI failure',
            provider: 'openai',
            model: 'gpt-4-turbo'
        });
        
        // Set tryNextProvider method to simulate a fallback to Anthropic
        const tryNextProviderSpy = jest.spyOn(aiGateway as any, 'tryNextProvider');
        tryNextProviderSpy.mockImplementation(async () => {
            // Simulate a fallback to Anthropic
            return {
                result: 'Anthropic response',
                provider: 'anthropic',
                wasFailover: true
            };
        });
        
        const result = await aiGateway.processAIRequestWithFallback('seo', 'Test input');
        
        expect(result).toEqual({
            result: 'Anthropic response',
            provider: 'anthropic',
            wasFailover: true
        });
        
        // Verify that OpenAI provider was called once
        expect(mockOpenAIProvider.generateCompletion).toHaveBeenCalledTimes(1);
        
        // Verify that tryNextProvider method was called
        expect(tryNextProviderSpy).toHaveBeenCalledWith('seo', 'Test input', 'OpenAI failed: OpenAI failure');
        
        // Restore the original methods
        getInitialProviderSpy.mockRestore();
        getProviderNameSpy.mockRestore();
        tryNextProviderSpy.mockRestore();
    });
});
