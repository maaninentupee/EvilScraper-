import { Test, TestingModule } from '@nestjs/testing';
import { AIService } from '../../src/services/AIService';
import { ModelSelector } from '../../src/services/ModelSelector';
import { AIGateway } from '../../src/services/AIGateway';
import { MockLogger } from '../test-utils';
import { ProviderRegistry } from '../../src/services/providers/ProviderRegistry';
import { ConfigService } from '@nestjs/config';
import { ProviderHealthMonitor } from '../../src/services/ProviderHealthMonitor';
import { ProviderSelectionStrategy } from '../../src/services/utils/ProviderSelectionStrategy';
import { ErrorClassifier } from '../../src/services/utils/ErrorClassifier';

jest.mock('../../src/services/ModelSelector');
jest.mock('../../src/services/AIGateway');

describe('AIService - Local and fallback models', () => {
    let aiService: AIService;
    let mockModelSelector: jest.Mocked<ModelSelector>;
    let mockAIGateway: jest.Mocked<AIGateway>;
    let mockLogger: MockLogger;
    let mockProviderRegistry: jest.Mocked<ProviderRegistry>;
    let mockConfigService: jest.Mocked<ConfigService>;
    let mockHealthMonitor: jest.Mocked<ProviderHealthMonitor>;
    let mockSelectionStrategy: jest.Mocked<ProviderSelectionStrategy>;
    let mockErrorClassifier: jest.Mocked<ErrorClassifier>;

    beforeEach(async () => {
        mockLogger = new MockLogger();
        mockModelSelector = new ModelSelector() as jest.Mocked<ModelSelector>;
        mockProviderRegistry = {} as jest.Mocked<ProviderRegistry>;
        mockConfigService = {} as jest.Mocked<ConfigService>;
        mockHealthMonitor = {} as jest.Mocked<ProviderHealthMonitor>;
        mockSelectionStrategy = {} as jest.Mocked<ProviderSelectionStrategy>;
        mockErrorClassifier = {} as jest.Mocked<ErrorClassifier>;
        
        mockAIGateway = new AIGateway(
            mockProviderRegistry,
            mockConfigService,
            mockHealthMonitor,
            mockSelectionStrategy,
            mockErrorClassifier
        ) as jest.Mocked<AIGateway>;
        
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AIService,
                {
                    provide: ModelSelector,
                    useValue: mockModelSelector
                },
                {
                    provide: AIGateway,
                    useValue: mockAIGateway
                }
            ],
        }).compile();

        aiService = module.get<AIService>(AIService);
        // @ts-ignore - Override the logger to our mock
        aiService['logger'] = mockLogger;
    });

    afterEach(() => {
        mockLogger.clear();
        jest.clearAllMocks();
    });

    test('Uses local LM Studio model first', async () => {
        // Mock getModel to return LM Studio model
        mockModelSelector.getModel = jest.fn().mockReturnValue('LMStudio-Model-1');
        
        // Mock getModelInfo to return model info
        mockModelSelector.getModelInfo = jest.fn().mockReturnValue({
            name: 'LMStudio-Model-1',
            provider: 'lmstudio',
            model: 'LMStudio-Model-1',
            capabilities: ['text-generation'],
            contextLength: 8192
        });

        // Mock AI response
        mockAIGateway.processAIRequest = jest.fn().mockResolvedValue({
            text: 'SEO analysis here',
            model: 'LMStudio-Model-1'
        });

        // Run SEO analysis
        const result = await aiService.analyzeSEO({ title: 'Test' });

        // Check that LM Studio model was used
        expect(mockAIGateway.processAIRequest).toHaveBeenCalledWith(
            'seo',
            expect.any(String),
            'LMStudio-Model-1'
        );
        
        // Check that the result is as expected
        expect(result).toEqual({
            text: 'SEO analysis here',
            model: 'LMStudio-Model-1'
        });
    });

    test('Falls back to OLLAMA if LM Studio fails', async () => {
        // Mock getModel to return LM Studio model first and then Ollama model
        mockModelSelector.getModel = jest.fn()
            .mockReturnValueOnce('LMStudio-Model-1')
            .mockReturnValueOnce('Ollama-Model-1');
        
        // Mock getModelInfo to return model info
        mockModelSelector.getModelInfo = jest.fn()
            .mockReturnValueOnce({
                name: 'LMStudio-Model-1',
                provider: 'lmstudio',
                model: 'LMStudio-Model-1',
                capabilities: ['text-generation'],
                contextLength: 8192
            })
            .mockReturnValueOnce({
                name: 'Ollama-Model-1',
                provider: 'ollama',
                model: 'Ollama-Model-1',
                capabilities: ['text-generation'],
                contextLength: 8192
            });

        // Mock AI responses: LM Studio fails, Ollama succeeds
        mockAIGateway.processAIRequest = jest.fn()
            .mockRejectedValueOnce(new Error('LM Studio Error'))
            .mockResolvedValueOnce({
                text: 'SEO analysis from Ollama model',
                model: 'Ollama-Model-1'
            });

        // Run SEO analysis
        const result = await aiService.analyzeSEO({ title: 'Test' });

        // Check that both models were called
        expect(mockAIGateway.processAIRequest).toHaveBeenCalledTimes(2);
        
        // Check that LM Studio was tried first
        expect(mockAIGateway.processAIRequest).toHaveBeenNthCalledWith(
            1,
            'seo',
            expect.any(String),
            'LMStudio-Model-1'
        );
        
        // Check that Ollama was used
        expect(mockAIGateway.processAIRequest).toHaveBeenNthCalledWith(
            2,
            'seo',
            expect.any(String),
            'Ollama-Model-1'
        );
        
        // Check that the result is from Ollama model
        expect(result).toEqual({
            text: 'SEO analysis from Ollama model',
            model: 'Ollama-Model-1'
        });
    });

    test('Falls back to OpenAI if LM Studio and OLLAMA fail', async () => {
        // Mock getModel to return different models in sequence
        mockModelSelector.getModel = jest.fn()
            .mockReturnValueOnce('LMStudio-Model-1')
            .mockReturnValueOnce('Ollama-Model-1')
            .mockReturnValueOnce('gpt-4-turbo');
        
        // Mock getModelInfo to return model info
        mockModelSelector.getModelInfo = jest.fn()
            .mockReturnValueOnce({
                name: 'LMStudio-Model-1',
                provider: 'lmstudio',
                model: 'LMStudio-Model-1',
                capabilities: ['text-generation'],
                contextLength: 8192
            })
            .mockReturnValueOnce({
                name: 'Ollama-Model-1',
                provider: 'ollama',
                model: 'Ollama-Model-1',
                capabilities: ['text-generation'],
                contextLength: 8192
            })
            .mockReturnValueOnce({
                name: 'gpt-4-turbo',
                provider: 'openai',
                model: 'gpt-4-turbo',
                capabilities: ['text-generation'],
                contextLength: 128000
            });

        // Mock AI responses: LM Studio and Ollama fail, OpenAI succeeds
        mockAIGateway.processAIRequest = jest.fn()
            .mockRejectedValueOnce(new Error('LM Studio Error'))
            .mockRejectedValueOnce(new Error('OLLAMA Error'))
            .mockResolvedValueOnce({
                text: 'SEO analysis from OpenAI model',
                model: 'gpt-4-turbo'
            });

        // Run SEO analysis
        const result = await aiService.analyzeSEO({ title: 'Test' });

        // Check that all three models were called
        expect(mockAIGateway.processAIRequest).toHaveBeenCalledTimes(3);
        
        // Check that OpenAI was used last
        expect(mockAIGateway.processAIRequest).toHaveBeenNthCalledWith(
            3,
            'seo',
            expect.any(String),
            'gpt-4-turbo'
        );
        
        // Check that the result is from OpenAI model
        expect(result).toEqual({
            text: 'SEO analysis from OpenAI model',
            model: 'gpt-4-turbo'
        });
    });

    test('Throws an error if all models fail', async () => {
        // Mock getModel to return different models in sequence for all providers
        mockModelSelector.getModel = jest.fn()
            .mockReturnValueOnce('LMStudio-Model-1')
            .mockReturnValueOnce('Ollama-Model-1')
            .mockReturnValueOnce('gpt-4-turbo')
            .mockReturnValueOnce('claude-3-opus')
            .mockReturnValueOnce('gemini-pro');
        
        // Mock getModelInfo to return model info
        mockModelSelector.getModelInfo = jest.fn()
            .mockReturnValueOnce({
                name: 'LMStudio-Model-1',
                provider: 'lmstudio',
                model: 'LMStudio-Model-1',
                capabilities: ['text-generation'],
                contextLength: 8192
            })
            .mockReturnValueOnce({
                name: 'Ollama-Model-1',
                provider: 'ollama',
                model: 'Ollama-Model-1',
                capabilities: ['text-generation'],
                contextLength: 8192
            })
            .mockReturnValueOnce({
                name: 'gpt-4-turbo',
                provider: 'openai',
                model: 'gpt-4-turbo',
                capabilities: ['text-generation'],
                contextLength: 128000
            })
            .mockReturnValueOnce({
                name: 'claude-3-opus',
                provider: 'anthropic',
                model: 'claude-3-opus',
                capabilities: ['text-generation'],
                contextLength: 200000
            })
            .mockReturnValueOnce({
                name: 'gemini-pro',
                provider: 'google',
                model: 'gemini-pro',
                capabilities: ['text-generation'],
                contextLength: 32000
            });

        // Mock AI responses: all models fail
        mockAIGateway.processAIRequest = jest.fn()
            .mockRejectedValueOnce(new Error('LM Studio Error'))
            .mockRejectedValueOnce(new Error('OLLAMA Error'))
            .mockRejectedValueOnce(new Error('OpenAI Error'))
            .mockRejectedValueOnce(new Error('Anthropic Error'))
            .mockRejectedValueOnce(new Error('Google Error'));

        // Run SEO analysis and expect an error
        await expect(aiService.analyzeSEO({ title: 'Test' }))
            .rejects
            .toThrow('All models failed');

        // Check that all five models were called
        expect(mockAIGateway.processAIRequest).toHaveBeenCalledTimes(5);
        
        // Check that the error log contains errors from all models
        expect(mockLogger.logs.error.length).toBe(5);
    });

    test('Skips models for which getModelInfo returns null', async () => {
        // Mock getModel to return different models in sequence
        mockModelSelector.getModel = jest.fn()
            .mockReturnValueOnce('LMStudio-Model-1')
            .mockReturnValueOnce('Ollama-Model-1');
        
        // Mock getModelInfo to return null for the first model and info for the second
        mockModelSelector.getModelInfo = jest.fn()
            .mockReturnValueOnce(null)
            .mockReturnValueOnce({
                name: 'Ollama-Model-1',
                provider: 'ollama',
                model: 'Ollama-Model-1',
                capabilities: ['text-generation'],
                contextLength: 8192
            });

        // Mock AI response to succeed with Ollama model
        mockAIGateway.processAIRequest = jest.fn()
            .mockResolvedValueOnce({
                text: 'SEO analysis from Ollama model',
                model: 'Ollama-Model-1'
            });

        // Run SEO analysis
        const result = await aiService.analyzeSEO({ title: 'Test' });

        // Check that only Ollama model was called (not LM Studio, since getModelInfo returned null)
        expect(mockAIGateway.processAIRequest).toHaveBeenCalledTimes(1);
        
        // Check that Ollama model was used
        expect(mockAIGateway.processAIRequest).toHaveBeenCalledWith(
            'seo',
            expect.any(String),
            'Ollama-Model-1'
        );
        
        // Check that the result is from Ollama model
        expect(result).toEqual({
            text: 'SEO analysis from Ollama model',
            model: 'Ollama-Model-1'
        });
    });

    test('generateCode uses the correct prompt', async () => {
        // Mock getModel and getModelInfo
        mockModelSelector.getModel = jest.fn().mockReturnValue('test-model');
        mockModelSelector.getModelInfo = jest.fn().mockReturnValue({
            name: 'test-model',
            provider: 'test-provider',
            model: 'test-model',
            capabilities: ['text-generation'],
            contextLength: 8192
        });

        // Mock AI response
        mockAIGateway.processAIRequest = jest.fn().mockResolvedValue({
            text: 'Generated code here',
            model: 'test-model'
        });

        // Run generateCode with correct parameters
        await aiService.generateCode({
            language: 'typescript',
            description: 'Generate a React component'
        });

        // Check that processAIRequest was called with the correct task parameter
        expect(mockAIGateway.processAIRequest).toHaveBeenCalledWith(
            'code',
            expect.any(String),
            'test-model'
        );

        // Check that the prompt contains the language and description
        const promptArg = mockAIGateway.processAIRequest.mock.calls[0][1];
        expect(promptArg).toContain('typescript');
        expect(promptArg).toContain('Generate a React component');
    });
    
    test('generateCode handles optional requirements parameters', async () => {
        // Mock getModel and getModelInfo
        mockModelSelector.getModel = jest.fn().mockReturnValue('test-model');
        mockModelSelector.getModelInfo = jest.fn().mockReturnValue({
            name: 'test-model',
            provider: 'test-provider',
            model: 'test-model',
            capabilities: ['text-generation'],
            contextLength: 8192
        });

        // Mock AI response
        mockAIGateway.processAIRequest = jest.fn().mockResolvedValue({
            text: 'Generated code with requirements',
            model: 'test-model'
        });

        // Run generateCode with requirements
        await aiService.generateCode({
            language: 'typescript',
            description: 'Generate a React component',
            requirements: ['Must use hooks', 'Must be responsive']
        });

        // Check that the prompt contains the requirements
        const promptArg = mockAIGateway.processAIRequest.mock.calls[0][1];
        expect(promptArg).toContain('Must use hooks');
        expect(promptArg).toContain('Must be responsive');
    });

    test('makeDecision uses the correct prompt', async () => {
        // Mock getModel and getModelInfo
        mockModelSelector.getModel = jest.fn().mockReturnValue('test-model');
        mockModelSelector.getModelInfo = jest.fn().mockReturnValue({
            name: 'test-model',
            provider: 'test-provider',
            model: 'test-model',
            capabilities: ['text-generation'],
            contextLength: 8192
        });

        // Mock AI response
        mockAIGateway.processAIRequest = jest.fn().mockResolvedValue({
            text: '{"decision": "yes", "reason": "test reason"}',
            model: 'test-model'
        });

        // Run makeDecision with correct parameters
        await aiService.makeDecision({
            situation: 'Should I do this?',
            options: ['Yes', 'No', 'Maybe']
        });

        // Check that processAIRequest was called with the correct task parameter
        expect(mockAIGateway.processAIRequest).toHaveBeenCalledWith(
            'decision',
            expect.any(String),
            'test-model'
        );

        // Check that the prompt contains the situation and options
        const promptArg = mockAIGateway.processAIRequest.mock.calls[0][1];
        expect(promptArg).toContain('Should I do this?');
        expect(promptArg).toContain('Yes');
        expect(promptArg).toContain('No');
        expect(promptArg).toContain('Maybe');
    });

    test('analyzeSEO handles both required and optional parameters', async () => {
        // Mock getModel and getModelInfo
        mockModelSelector.getModel = jest.fn().mockReturnValue('test-model');
        mockModelSelector.getModelInfo = jest.fn().mockReturnValue({
            name: 'test-model',
            provider: 'test-provider',
            model: 'test-model',
            capabilities: ['text-generation'],
            contextLength: 8192
        });

        // Mock AI response
        mockAIGateway.processAIRequest = jest.fn().mockResolvedValue({
            text: 'SEO analysis result',
            model: 'test-model'
        });

        // Test with only the required title parameter
        await aiService.analyzeSEO({ title: 'Test Title' });
        let promptArg = mockAIGateway.processAIRequest.mock.calls[0][1];
        expect(promptArg).toContain('Test Title');
        expect(promptArg).not.toContain('Test Description');
        expect(promptArg).not.toContain('Test Content');

        // Reset mocks
        jest.clearAllMocks();
        mockAIGateway.processAIRequest = jest.fn().mockResolvedValue({
            text: 'SEO analysis result with all params',
            model: 'test-model'
        });

        // Test with all parameters
        await aiService.analyzeSEO({ 
            title: 'Test Title', 
            description: 'Test Description', 
            content: 'Test Content' 
        });
        
        promptArg = mockAIGateway.processAIRequest.mock.calls[0][1];
        expect(promptArg).toContain('Test Title');
        expect(promptArg).toContain('Test Description');
        expect(promptArg).toContain('Test Content');
    });

    // Test error cases
    test('analyzeSEO throws an error if title is missing', async () => {
        await expect(aiService.analyzeSEO({ description: 'Test Description' } as any))
            .rejects
            .toThrow();
    });
    
    test('processWithFallback handles errors correctly and tries the next model', async () => {
        // Clear mockLogger
        mockLogger.clear();
        
        // Mock getModel to return different models in sequence
        mockModelSelector.getModel = jest.fn()
            .mockReturnValueOnce('model-1')
            .mockReturnValueOnce('model-2');
        
        // Mock getModelInfo to return model info
        mockModelSelector.getModelInfo = jest.fn()
            .mockReturnValueOnce({
                name: 'model-1',
                provider: 'provider-1',
                model: 'model-1',
                capabilities: ['text-generation'],
                contextLength: 8192
            })
            .mockReturnValueOnce({
                name: 'model-2',
                provider: 'provider-2',
                model: 'model-2',
                capabilities: ['text-generation'],
                contextLength: 8192
            });

        // First call fails, second call succeeds
        mockAIGateway.processAIRequestWithFallback = jest.fn()
            .mockResolvedValueOnce({
                success: false,
                error: 'Specific error message',
                errorType: 'provider_error',
                provider: 'provider-1',
                model: 'model-1'
            })
            .mockResolvedValueOnce({
                success: true,
                text: 'Success from fallback model',
                provider: 'provider-2',
                model: 'model-2'
            });

        // Run analysis
        const result = await aiService.analyzeSEO({ title: 'Test Title' });

        // Check that both models were called
        expect(mockAIGateway.processAIRequestWithFallback).toHaveBeenCalledTimes(2);
        
        // Check that the error log contains an error message
        expect(mockLogger.logs.error.length).toBeGreaterThan(0);
        
        // Check that the result is from the second model
        expect(result.success).toBe(true);
        expect(result.text).toBe('Success from fallback model');
        expect(result.model).toBe('model-2');
    });
    
    test('processWithFallback handles errors correctly when all models fail', async () => {
        // Clear mockLogger
        mockLogger.clear();
        
        // Mock getModel to return different models in sequence
        mockModelSelector.getModel = jest.fn()
            .mockReturnValue('test-model');
        
        // Mock getModelInfo to return model info
        mockModelSelector.getModelInfo = jest.fn()
            .mockReturnValue({
                name: 'test-model',
                provider: 'test-provider',
                model: 'test-model',
                capabilities: ['text-generation'],
                contextLength: 8192
            });

        // Mock processAIRequestWithFallback to return an error result
        mockAIGateway.processAIRequestWithFallback = jest.fn()
            .mockResolvedValue({
                success: false,
                error: 'All providers failed',
                errorType: 'provider_error',
                provider: 'none',
                model: 'none'
            });

        // Run analysis and expect an error result
        const result = await aiService.analyzeSEO({ title: 'Test Title' });

        // Check that the result indicates failure
        expect(result.success).toBe(false);
        expect(result.errorType).toBe('provider_error');
        
        // Check that the error log contains an error message
        expect(mockLogger.logs.error.length).toBeGreaterThan(0);
    });
    
    test('processWithFallback handles errors correctly when model info is not found', async () => {
        // Mock getModel to return a model name
        mockModelSelector.getModel = jest.fn()
            .mockReturnValue('test-model');
        
        // Mock getModelInfo to return null (model not found)
        mockModelSelector.getModelInfo = jest.fn()
            .mockReturnValue(null);

        // Mock processAIRequestWithFallback to return an error result
        mockAIGateway.processAIRequestWithFallback = jest.fn()
            .mockResolvedValue({
                success: false,
                error: 'Model not found',
                errorType: 'configuration_error',
                provider: 'none',
                model: 'none'
            });

        // Run analysis and expect an error result
        const result = await aiService.analyzeSEO({ title: 'Test Title' });

        // Check that the result indicates failure
        expect(result.success).toBe(false);
        expect(result.provider).toBe('none');
        expect(result.model).toBe('none');
    });
    
    test('processWithFallback handles errors correctly when getModel returns null', async () => {
        // Mock getModel to return null
        mockModelSelector.getModel = jest.fn()
            .mockReturnValue(null);

        // Mock processAIRequestWithFallback to return an error result
        mockAIGateway.processAIRequestWithFallback = jest.fn()
            .mockResolvedValue({
                success: false,
                error: 'No model available',
                errorType: 'configuration_error',
                provider: 'none',
                model: 'none'
            });

        // Run analysis and expect an error result
        const result = await aiService.analyzeSEO({ title: 'Test Title' });

        // Check that the result indicates failure
        expect(result.success).toBe(false);
        expect(result.errorType).toBe('configuration_error');
        expect(result.text).toBe('');
    });
});
