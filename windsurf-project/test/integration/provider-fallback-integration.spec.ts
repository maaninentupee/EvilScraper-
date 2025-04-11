import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { AIGateway } from '../../src/services/AIGateway';
import { LocalProvider } from '../../src/services/providers/LocalProvider';
import { OpenAIProvider } from '../../src/services/providers/OpenAIProvider';
import { AnthropicProvider } from '../../src/services/providers/AnthropicProvider';
import { OllamaProvider } from '../../src/services/providers/OllamaProvider';
import { LMStudioProvider } from '../../src/services/providers/LMStudioProvider';
import { CompletionResult } from '../../src/services/providers/BaseProvider';
import { environment } from '../../src/config/environment';

// Mock environment configuration
jest.mock('../../src/config/environment', () => ({
  environment: {
    useLocalModels: true,
    useLMStudio: true,
    useOllama: true,
    useOpenAI: true,
    useAnthropic: true,
    providerPriorityArray: ['local', 'lmstudio', 'ollama', 'openai', 'anthropic'],
    providerPriority: {
      local: 1,
      lmstudio: 2,
      ollama: 3,
      openai: 4,
      anthropic: 5
    }
  }
}));

describe('Provider Fallback Integration Tests', () => {
  let app: INestApplication;
  let aiGateway: AIGateway;
  let localProvider: LocalProvider;
  let openaiProvider: OpenAIProvider;
  let anthropicProvider: AnthropicProvider;
  let ollamaProvider: OllamaProvider;
  let lmstudioProvider: LMStudioProvider;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    aiGateway = moduleRef.get<AIGateway>(AIGateway);
    localProvider = moduleRef.get<LocalProvider>(LocalProvider);
    openaiProvider = moduleRef.get<OpenAIProvider>(OpenAIProvider);
    anthropicProvider = moduleRef.get<AnthropicProvider>(AnthropicProvider);
    ollamaProvider = moduleRef.get<OllamaProvider>(OllamaProvider);
    lmstudioProvider = moduleRef.get<LMStudioProvider>(LMStudioProvider);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  describe('Fallback Mechanism Tests', () => {
    it('should try OpenAI when LocalProvider fails', async () => {
      // Mock LocalProvider to fail
      const localSpy = jest.spyOn(localProvider, 'generateCompletion').mockRejectedValue(new Error('Local provider error'));
      
      // Mock OpenAI to succeed
      const openaiSpy = jest.spyOn(openaiProvider, 'generateCompletion').mockResolvedValue({
        text: 'OpenAI response',
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        success: true
      } as CompletionResult);
      
      // Mock other providers to ensure they're not called
      const anthropicSpy = jest.spyOn(anthropicProvider, 'generateCompletion');
      const ollamaSpy = jest.spyOn(ollamaProvider, 'generateCompletion');
      const lmstudioSpy = jest.spyOn(lmstudioProvider, 'generateCompletion');
      
      // Call the method with fallback
      const result = await aiGateway.processAIRequestWithFallback('code', 'Generate a function to calculate fibonacci');
      
      // Verify LocalProvider was called
      expect(localSpy).toHaveBeenCalled();
      
      // Verify OpenAI was called as fallback
      expect(openaiSpy).toHaveBeenCalled();
      
      // Verify result contains OpenAI's response
      expect(result.result).toBe('OpenAI response');
      expect(result.provider).toBe('openai');
      
      // Verify other providers weren't called
      expect(anthropicSpy).not.toHaveBeenCalled();
    });

    it('should try Anthropic when both LocalProvider and OpenAI fail', async () => {
      // Mock LocalProvider to fail
      const localSpy = jest.spyOn(localProvider, 'generateCompletion').mockRejectedValue(new Error('Local provider error'));
      
      // Mock OpenAI to fail
      const openaiSpy = jest.spyOn(openaiProvider, 'generateCompletion').mockRejectedValue(new Error('OpenAI error'));
      
      // Mock Anthropic to succeed
      const anthropicSpy = jest.spyOn(anthropicProvider, 'generateCompletion').mockResolvedValue({
        text: 'Anthropic response',
        provider: 'anthropic',
        model: 'claude-3-opus',
        success: true
      } as CompletionResult);
      
      // Call the method with fallback
      const result = await aiGateway.processAIRequestWithFallback('code', 'Generate a function to calculate fibonacci');
      
      // Verify LocalProvider was called
      expect(localSpy).toHaveBeenCalled();
      
      // Verify OpenAI was called as first fallback
      expect(openaiSpy).toHaveBeenCalled();
      
      // Verify Anthropic was called as second fallback
      expect(anthropicSpy).toHaveBeenCalled();
      
      // Verify result contains Anthropic's response
      expect(result.result).toBe('Anthropic response');
      expect(result.provider).toBe('anthropic');
    });

    it('should return error object when all providers fail', async () => {
      // Mock all providers to fail
      jest.spyOn(localProvider, 'generateCompletion').mockRejectedValue(new Error('Local provider error'));
      jest.spyOn(openaiProvider, 'generateCompletion').mockRejectedValue(new Error('OpenAI error'));
      jest.spyOn(anthropicProvider, 'generateCompletion').mockRejectedValue(new Error('Anthropic error'));
      jest.spyOn(ollamaProvider, 'generateCompletion').mockRejectedValue(new Error('Ollama error'));
      jest.spyOn(lmstudioProvider, 'generateCompletion').mockRejectedValue(new Error('LMStudio error'));
      
      // Call the method with fallback
      const result = await aiGateway.processAIRequestWithFallback('code', 'Generate a function to calculate fibonacci');
      
      // Verify result is an error object
      expect(result).toHaveProperty('error', true);
      expect(result.message).toContain('All AI services failed');
    });

    it('should use test input to simulate specific provider failures', async () => {
      // Set up spies for all providers
      const localSpy = jest.spyOn(localProvider, 'generateCompletion');
      const openaiSpy = jest.spyOn(openaiProvider, 'generateCompletion').mockResolvedValue({
        text: 'OpenAI response',
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        success: true
      } as CompletionResult);
      
      // Call with test input that simulates local provider failure
      const result = await aiGateway.processAIRequestWithFallback('code', 'TEST_LOCAL_ERROR Generate a function');
      
      // Verify OpenAI was used as fallback
      expect(openaiSpy).toHaveBeenCalled();
      expect(result.result).toBe('OpenAI response');
      expect(result.provider).toBe('openai');
    });

    it('should simulate all providers failing with TEST_ALL_ERROR', async () => {
      // Call with test input that simulates all providers failing
      const result = await aiGateway.processAIRequestWithFallback('code', 'TEST_ALL_ERROR Generate a function');
      
      // Verify result is an error object
      expect(result).toHaveProperty('error', true);
      expect(result.message).toBe('All AI services failed (simulated error from test input).');
    });
  });

  describe('Provider Selection Tests', () => {
    it('should select the correct provider based on model name', async () => {
      // Mock all providers to succeed
      const localSpy = jest.spyOn(localProvider, 'generateCompletion').mockResolvedValue({
        text: 'Local response',
        provider: 'local',
        model: 'mistral-7b-instruct-q8_0.gguf',
        success: true
      } as CompletionResult);
      
      const openaiSpy = jest.spyOn(openaiProvider, 'generateCompletion').mockResolvedValue({
        text: 'OpenAI response',
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        success: true
      } as CompletionResult);
      
      const anthropicSpy = jest.spyOn(anthropicProvider, 'generateCompletion').mockResolvedValue({
        text: 'Anthropic response',
        provider: 'anthropic',
        model: 'claude-3-opus',
        success: true
      } as CompletionResult);
      
      // Call with specific model names
      await aiGateway.processAIRequest('code', 'Generate a function', 'mistral-7b-instruct-q8_0.gguf');
      await aiGateway.processAIRequest('code', 'Generate a function', 'gpt-3.5-turbo');
      await aiGateway.processAIRequest('code', 'Generate a function', 'claude-3-opus');
      
      // Verify each provider was called with the correct model
      expect(localSpy).toHaveBeenCalledWith(expect.objectContaining({
        modelName: 'mistral-7b-instruct-q8_0.gguf'
      }));
      
      expect(openaiSpy).toHaveBeenCalledWith(expect.objectContaining({
        modelName: 'gpt-3.5-turbo'
      }));
      
      expect(anthropicSpy).toHaveBeenCalledWith(expect.objectContaining({
        modelName: 'claude-3-opus'
      }));
    });
  });
});
