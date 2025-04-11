import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { AIGateway } from '../../src/services/AIGateway';
import { AIService } from '../../src/services/AIService';
import { LocalProvider } from '../../src/services/providers/LocalProvider';
import { OpenAIProvider } from '../../src/services/providers/OpenAIProvider';
import { AnthropicProvider } from '../../src/services/providers/AnthropicProvider';
import { OllamaProvider } from '../../src/services/providers/OllamaProvider';
import { LMStudioProvider } from '../../src/services/providers/LMStudioProvider';
import { CompletionResult } from '../../src/services/providers/BaseProvider';
import { environment } from '../../src/config/environment';
import { ModelSelector } from '../../src/services/ModelSelector';

// Mock environment configuration
jest.mock('../../src/config/environment', () => ({
  environment: {
    useLocalModels: true,
    useLMStudio: true,
    useOllama: true,
    useOpenAI: true,
    useAnthropic: true,
    providerPriorityArray: ['ollama', 'openai', 'anthropic', 'lmstudio', 'local'],
    providerPriority: {
      ollama: 1,
      openai: 2,
      anthropic: 3,
      lmstudio: 4,
      local: 5
    }
  }
}));

describe('AI Service - Integration Tests', () => {
  let app: INestApplication;
  let aiGateway: AIGateway;
  let aiService: AIService;
  let modelSelector: ModelSelector;
  let localProvider: LocalProvider;
  let openaiProvider: OpenAIProvider;
  let anthropicProvider: AnthropicProvider;
  let ollamaProvider: OllamaProvider;
  let lmstudioProvider: LMStudioProvider;
  
  // Save original environment variables
  const originalEnv = { ...process.env };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    aiGateway = moduleRef.get<AIGateway>(AIGateway);
    aiService = moduleRef.get<AIService>(AIService);
    modelSelector = moduleRef.get<ModelSelector>(ModelSelector);
    localProvider = moduleRef.get<LocalProvider>(LocalProvider);
    openaiProvider = moduleRef.get<OpenAIProvider>(OpenAIProvider);
    anthropicProvider = moduleRef.get<AnthropicProvider>(AnthropicProvider);
    ollamaProvider = moduleRef.get<OllamaProvider>(OllamaProvider);
    lmstudioProvider = moduleRef.get<LMStudioProvider>(LMStudioProvider);
  });

  afterAll(async () => {
    // Restore original environment variables
    process.env = { ...originalEnv };
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    
    // Restore original environment variables before each test
    process.env = { ...originalEnv };
  });

  describe('AI service compatibility', () => {
    it('should process AI request using Ollama', async () => {
      // Mock Ollama to succeed
      const ollamaSpy = jest.spyOn(ollamaProvider, 'generateCompletion').mockResolvedValue({
        text: 'Ollama response',
        provider: 'ollama',
        model: 'mistral',
        success: true
      } as CompletionResult);
      
      jest.spyOn(ollamaProvider, 'isAvailable').mockResolvedValue(true);
      
      const response = await aiGateway.processAIRequest('seo', 'Analyze this page');
      
      expect(response.text).toBeDefined();
      expect(response.provider).toBe('ollama');
      expect(ollamaSpy).toHaveBeenCalled();
    });

    it('should failover to OpenAI if Ollama fails', async () => {
      // Mock Ollama to fail
      const ollamaSpy = jest.spyOn(ollamaProvider, 'generateCompletion').mockRejectedValue(new Error('Ollama error'));
      jest.spyOn(ollamaProvider, 'isAvailable').mockResolvedValue(true);
      
      // Mock OpenAI to succeed
      const openaiSpy = jest.spyOn(openaiProvider, 'generateCompletion').mockResolvedValue({
        text: 'OpenAI response',
        provider: 'openai',
        model: 'gpt-4-turbo',
        success: true
      } as CompletionResult);
      jest.spyOn(openaiProvider, 'isAvailable').mockResolvedValue(true);
      
      const response = await aiGateway.processAIRequestWithFallback('seo', 'Analyze this page');
      
      expect(response.text).toBeDefined();
      expect(response.provider).toBe('openai');
      expect(ollamaSpy).toHaveBeenCalled();
      expect(openaiSpy).toHaveBeenCalled();
    });

    it('should failover to Anthropic if Ollama and OpenAI fail', async () => {
      // Mock Ollama to fail
      jest.spyOn(ollamaProvider, 'generateCompletion').mockRejectedValue(new Error('Ollama error'));
      jest.spyOn(ollamaProvider, 'isAvailable').mockResolvedValue(true);
      
      // Mock OpenAI to fail
      jest.spyOn(openaiProvider, 'generateCompletion').mockRejectedValue(new Error('OpenAI error'));
      jest.spyOn(openaiProvider, 'isAvailable').mockResolvedValue(true);
      
      // Mock Anthropic to succeed
      const anthropicSpy = jest.spyOn(anthropicProvider, 'generateCompletion').mockResolvedValue({
        text: 'Anthropic response',
        provider: 'anthropic',
        model: 'claude-3-opus',
        success: true
      } as CompletionResult);
      jest.spyOn(anthropicProvider, 'isAvailable').mockResolvedValue(true);
      
      const response = await aiGateway.processAIRequestWithFallback('seo', 'Analyze this page');
      
      expect(response.text).toBeDefined();
      expect(response.provider).toBe('anthropic');
      expect(anthropicSpy).toHaveBeenCalled();
    });

    it('should failover to LM Studio if Ollama, OpenAI and Anthropic fail', async () => {
      // Mock Ollama to fail
      jest.spyOn(ollamaProvider, 'generateCompletion').mockRejectedValue(new Error('Ollama error'));
      jest.spyOn(ollamaProvider, 'isAvailable').mockResolvedValue(true);
      
      // Mock OpenAI to fail
      jest.spyOn(openaiProvider, 'generateCompletion').mockRejectedValue(new Error('OpenAI error'));
      jest.spyOn(openaiProvider, 'isAvailable').mockResolvedValue(true);
      
      // Mock Anthropic to fail
      jest.spyOn(anthropicProvider, 'generateCompletion').mockRejectedValue(new Error('Anthropic error'));
      jest.spyOn(anthropicProvider, 'isAvailable').mockResolvedValue(true);
      
      // Mock LM Studio to succeed
      const lmstudioSpy = jest.spyOn(lmstudioProvider, 'generateCompletion').mockResolvedValue({
        text: 'LM Studio response',
        provider: 'lmstudio',
        model: 'mistral-7b-instruct-v0.2',
        success: true
      } as CompletionResult);
      jest.spyOn(lmstudioProvider, 'isAvailable').mockResolvedValue(true);
      
      const response = await aiGateway.processAIRequestWithFallback('seo', 'Analyze this page');
      
      expect(response.text).toBeDefined();
      expect(response.provider).toBe('lmstudio');
      expect(lmstudioSpy).toHaveBeenCalled();
    });
  });

  describe('API key management', () => {
    it('should handle missing OpenAI API key gracefully', async () => {
      // Remove OpenAI API key
      delete process.env.OPENAI_API_KEY;
      
      // Mock Ollama to fail
      jest.spyOn(ollamaProvider, 'generateCompletion').mockRejectedValue(new Error('Ollama error'));
      jest.spyOn(ollamaProvider, 'isAvailable').mockResolvedValue(true);
      
      // Mock OpenAI to fail with API key error
      jest.spyOn(openaiProvider, 'isAvailable').mockResolvedValue(false);
      
      // Mock Anthropic to succeed
      const anthropicSpy = jest.spyOn(anthropicProvider, 'generateCompletion').mockResolvedValue({
        text: 'Anthropic response',
        provider: 'anthropic',
        model: 'claude-3-opus',
        success: true
      } as CompletionResult);
      jest.spyOn(anthropicProvider, 'isAvailable').mockResolvedValue(true);
      
      const response = await aiGateway.processAIRequestWithFallback('seo', 'Analyze this page');
      
      // Ensure that OpenAI was skipped and Anthropic was used
      expect(response.provider).toBe('anthropic');
      expect(anthropicSpy).toHaveBeenCalled();
    });

    it('should handle missing Anthropic API key gracefully', async () => {
      // Remove Anthropic API key
      delete process.env.ANTHROPIC_API_KEY;
      
      // Mock Ollama to fail
      jest.spyOn(ollamaProvider, 'generateCompletion').mockRejectedValue(new Error('Ollama error'));
      jest.spyOn(ollamaProvider, 'isAvailable').mockResolvedValue(true);
      
      // Mock OpenAI to fail
      jest.spyOn(openaiProvider, 'generateCompletion').mockRejectedValue(new Error('OpenAI error'));
      jest.spyOn(openaiProvider, 'isAvailable').mockResolvedValue(true);
      
      // Mock Anthropic to fail with API key error
      jest.spyOn(anthropicProvider, 'isAvailable').mockResolvedValue(false);
      jest.spyOn(anthropicProvider, 'generateCompletion').mockRejectedValue(new Error('Anthropic API key missing'));
      
      // Mock LM Studio to succeed
      const lmstudioSpy = jest.spyOn(lmstudioProvider, 'generateCompletion').mockResolvedValue({
        text: 'LM Studio response',
        provider: 'lmstudio',
        model: 'mistral-7b-instruct-v0.2',
        success: true
      } as CompletionResult);
      jest.spyOn(lmstudioProvider, 'isAvailable').mockResolvedValue(true);
      
      const response = await aiGateway.processAIRequestWithFallback('seo', 'Analyze this page');
      
      // Ensure that Anthropic was skipped and LM Studio was used
      expect(response.provider).toBe('lmstudio');
      expect(lmstudioSpy).toHaveBeenCalled();
    });

    it('should fail gracefully when API key is missing', async () => {
      // Set empty OpenAI API key
      const originalKey = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = '';
      
      // Mock OpenAI model selector to return OpenAI model
      jest.spyOn(modelSelector, 'getModel').mockReturnValue('gpt-4-turbo');
      jest.spyOn(modelSelector, 'isOpenAIModel').mockReturnValue(true);
      
      // Mock OpenAI provider to throw API key error
      jest.spyOn(openaiProvider, 'generateCompletion').mockRejectedValue(new Error('OpenAI API key missing or invalid'));
      jest.spyOn(openaiProvider, 'isAvailable').mockResolvedValue(true);
      
      // Test that error is thrown correctly
      await expect(aiGateway.processAIRequest('seo', 'Analyze this page', 'gpt-4-turbo'))
        .rejects.toThrow(/API key missing/);
      
      // Restore original API key
      process.env.OPENAI_API_KEY = originalKey;
    });
    
    it('should fallback when provider is unavailable due to missing API key', async () => {
      // Set empty OpenAI API key and ensure isAvailable returns false
      const originalKey = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = '';
      jest.spyOn(openaiProvider, 'isAvailable').mockResolvedValue(false);
      
      // Mock Ollama to fail
      jest.spyOn(ollamaProvider, 'generateCompletion').mockRejectedValue(new Error('Ollama error'));
      jest.spyOn(ollamaProvider, 'isAvailable').mockResolvedValue(true);
      
      // Mock Anthropic to succeed
      const anthropicSpy = jest.spyOn(anthropicProvider, 'generateCompletion').mockResolvedValue({
        text: 'Anthropic response in fallback situation',
        provider: 'anthropic',
        model: 'claude-3-opus',
        success: true
      } as CompletionResult);
      jest.spyOn(anthropicProvider, 'isAvailable').mockResolvedValue(true);
      
      const response = await aiGateway.processAIRequestWithFallback('seo', 'Analyze this page');
      
      // Ensure that Anthropic was used instead of OpenAI
      expect(response.provider).toBe('anthropic');
      expect(anthropicSpy).toHaveBeenCalled();
      
      // Restore original API key
      process.env.OPENAI_API_KEY = originalKey;
    });
  });

  describe('Testing different task types', () => {
    it('should handle SEO analysis task correctly', async () => {
      // Mock AIGateway to return a specific response
      const aiGatewaySpy = jest.spyOn(aiGateway, 'processAIRequest').mockResolvedValue({
        text: 'SEO analysis: The page title is good, but meta description is missing.',
        provider: 'ollama',
        model: 'mistral',
        success: true,
        wasFailover: false
      });
      
      const response = await aiService.analyzeSEO({
        title: 'Test page',
        description: 'This is a test page',
        content: 'Page content here'
      });
      
      expect(response.text).toContain('SEO analysis');
      expect(aiGatewaySpy).toHaveBeenCalled();
    });

    it('should handle code generation task correctly', async () => {
      // Mock AIGateway to return a specific response
      const aiGatewaySpy = jest.spyOn(aiGateway, 'processAIRequest').mockResolvedValue({
        text: 'function fibonacci(n) {\n  if (n <= 1) return n;\n  return fibonacci(n-1) + fibonacci(n-2);\n}',
        provider: 'ollama',
        model: 'codellama-13b-instruct',
        success: true,
        wasFailover: false
      });
      
      const response = await aiService.generateCode({
        description: 'Create a fibonacci function',
        language: 'javascript'
      });
      
      expect(response.text).toContain('function fibonacci');
      expect(aiGatewaySpy).toHaveBeenCalled();
    });

    it('should handle decision making task correctly', async () => {
      // Mock AIGateway to return a specific response
      const aiGatewaySpy = jest.spyOn(aiGateway, 'processAIRequest').mockResolvedValue({
        text: 'User wants to know the weather. Respond to the weather-related query.',
        provider: 'ollama',
        model: 'wizardlm-7b',
        success: true,
        wasFailover: false
      });
      
      const response = await aiService.makeDecision({
        situation: 'What is the weather today?',
        options: ['Respond with weather information', 'Ask for clarification']
      });
      
      expect(response.text).toContain('weather');
      expect(aiGatewaySpy).toHaveBeenCalled();
    });
  });

  describe('Error handling in real situations', () => {
    it('should handle timeout errors gracefully', async () => {
      // Mock Ollama to fail with timeout
      jest.spyOn(ollamaProvider, 'generateCompletion').mockRejectedValue({
        message: 'timeout of 30000ms exceeded',
        isAxiosError: true,
        code: 'ECONNABORTED'
      });
      jest.spyOn(ollamaProvider, 'isAvailable').mockResolvedValue(true);
      
      // Mock OpenAI to succeed
      const openaiSpy = jest.spyOn(openaiProvider, 'generateCompletion').mockResolvedValue({
        text: 'OpenAI response',
        provider: 'openai',
        model: 'gpt-4-turbo',
        success: true
      } as CompletionResult);
      jest.spyOn(openaiProvider, 'isAvailable').mockResolvedValue(true);
      
      const response = await aiGateway.processAIRequestWithFallback('seo', 'Analyze this page');
      
      expect(response.provider).toBe('openai');
      expect(openaiSpy).toHaveBeenCalled();
    });

    it('should handle network errors gracefully', async () => {
      // Mock Ollama to fail with network error
      jest.spyOn(ollamaProvider, 'generateCompletion').mockRejectedValue({
        message: 'Network Error',
        isAxiosError: true,
        code: 'ECONNREFUSED'
      });
      jest.spyOn(ollamaProvider, 'isAvailable').mockResolvedValue(true);
      
      // Mock OpenAI to succeed
      const openaiSpy = jest.spyOn(openaiProvider, 'generateCompletion').mockResolvedValue({
        text: 'OpenAI response',
        provider: 'openai',
        model: 'gpt-4-turbo',
        success: true
      } as CompletionResult);
      jest.spyOn(openaiProvider, 'isAvailable').mockResolvedValue(true);
      
      const response = await aiGateway.processAIRequestWithFallback('seo', 'Analyze this page');
      
      expect(response.provider).toBe('openai');
      expect(openaiSpy).toHaveBeenCalled();
    });

    it('should handle server errors gracefully', async () => {
      // Mock Ollama to fail with server error
      jest.spyOn(ollamaProvider, 'generateCompletion').mockRejectedValue({
        message: 'Request failed with status code 500',
        isAxiosError: true,
        response: {
          status: 500,
          data: { error: 'Internal Server Error' }
        }
      });
      jest.spyOn(ollamaProvider, 'isAvailable').mockResolvedValue(true);
      
      // Mock OpenAI to succeed
      const openaiSpy = jest.spyOn(openaiProvider, 'generateCompletion').mockResolvedValue({
        text: 'OpenAI response',
        provider: 'openai',
        model: 'gpt-4-turbo',
        success: true
      } as CompletionResult);
      jest.spyOn(openaiProvider, 'isAvailable').mockResolvedValue(true);
      
      const response = await aiGateway.processAIRequestWithFallback('seo', 'Analyze this page');
      
      expect(response.provider).toBe('openai');
      expect(openaiSpy).toHaveBeenCalled();
    });

    it('should retry request on temporary failures', async () => {
      // Mock OpenAI to fail first with rate limit and then succeed
      const openaiSpy = jest.spyOn(openaiProvider, 'generateCompletion')
        .mockResolvedValueOnce({
          text: '',
          provider: 'openai',
          model: 'gpt-4-turbo',
          success: false,
          error: 'Rate limit exceeded',
          errorType: 'rate_limit' // This is important because AIGateway checks this
        } as CompletionResult)
        .mockResolvedValueOnce({
          text: 'Retry success',
          provider: 'openai',
          model: 'gpt-4-turbo',
          success: true
        } as CompletionResult);
      jest.spyOn(openaiProvider, 'isAvailable').mockResolvedValue(true);
      
      // Set OpenAI as the primary service provider
      jest.spyOn(aiGateway as any, 'getInitialProvider').mockReturnValue(openaiProvider);
      jest.spyOn(aiGateway as any, 'getProviderName').mockReturnValue('openai');
      
      const response = await aiGateway.processAIRequestWithFallback('seo', 'Analyze this page');
      
      expect(response.text).toBe('Retry success');
      expect(response.provider).toBe('openai');
      expect(response.wasRetry).toBe(true); // Ensure this was a retry
      expect(openaiSpy).toHaveBeenCalledTimes(2); // Ensure it was called twice
    });
  });
});
