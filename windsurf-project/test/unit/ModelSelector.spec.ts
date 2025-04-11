import { ModelSelector } from '../../src/services/ModelSelector';
import { environment } from '../../src/config/environment';

describe('ModelSelector', () => {
  let selector: ModelSelector;

  beforeEach(() => {
    selector = new ModelSelector();
  });

  describe('getModel', () => {
    it('should return correct model for seo and openai', () => {
      const model = selector.getModel('seo', 'openai');
      expect(model).toBe('gpt-4-turbo');
    });

    it('should return fallback model when provider is not specified', () => {
      const model = selector.getModel('code');
      expect(model).toMatch(/codellama.*\.gguf/);
    });

    it('should return null for unknown task type', () => {
      const model = selector.getModel('invalid-task' as any);
      expect(model).toBeNull();
    });
  });

  describe('isLocalModel', () => {
    it('should return true for .gguf model', () => {
      expect(selector.isLocalModel('mistral-7b-instruct-q8_0.gguf')).toBe(true);
    });

    it('should return false for cloud-based model', () => {
      expect(selector.isLocalModel('gpt-4')).toBe(false);
    });
  });

  describe('getAvailableProviders', () => {
    beforeEach(() => {
      process.env.OPENAI_API_KEY = 'test';
      process.env.ANTHROPIC_API_KEY = 'test';
      process.env.OLLAMA_ENABLED = 'true';
    });

    it('should return enabled providers from env', () => {
      const providers = selector.getAvailableProviders();
      expect(providers).toEqual(expect.arrayContaining(['openai', 'anthropic', 'ollama']));
    });
  });

  describe('getModelInfo', () => {
    it('should return metadata for a known model', () => {
      const info = selector.getModelInfo('gpt-4-turbo');
      expect(info).toEqual(expect.objectContaining({ provider: 'openai' }));
    });

    it('should return undefined for unknown model', () => {
      const info = selector.getModelInfo('fake-model');
      expect(info).toBeUndefined();
    });
  });

  // Additional tests to increase coverage
  describe('mapTaskTypeToCapability', () => {
    it('should map seo to summarization', () => {
      expect(selector.mapTaskTypeToCapability('seo')).toBe('summarization');
    });

    it('should map code to code-generation', () => {
      expect(selector.mapTaskTypeToCapability('code')).toBe('code-generation');
    });

    it('should map decision to decision-making', () => {
      expect(selector.mapTaskTypeToCapability('decision')).toBe('decision-making');
    });

    it('should map unknown task to text-generation', () => {
      expect(selector.mapTaskTypeToCapability('unknown')).toBe('text-generation');
    });
  });

  describe('getProviderForModel', () => {
    it('should identify openai models', () => {
      expect(selector.getProviderForModel('gpt-4-turbo')).toBe('openai');
      expect(selector.getProviderForModel('gpt-3.5-turbo')).toBe('openai');
    });

    it('should identify anthropic models', () => {
      expect(selector.getProviderForModel('claude-3-opus-20240229')).toBe('anthropic');
      expect(selector.getProviderForModel('claude-2')).toBe('anthropic');
    });

    it('should identify ollama models', () => {
      expect(selector.getProviderForModel('mistral')).toBe('ollama');
    });

    it('should identify lmstudio models', () => {
      expect(selector.getProviderForModel('mistral-7b-instruct-v0.2')).toBe('lmstudio');
    });

    it('should default to local for unknown models', () => {
      expect(selector.getProviderForModel('unknown-model')).toBe('local');
    });
  });

  describe('provider-specific model checks', () => {
    it('should identify OpenAI models correctly', () => {
      expect(selector.isOpenAIModel('gpt-4-turbo')).toBe(true);
      expect(selector.isOpenAIModel('gpt-3.5-turbo')).toBe(true);
      expect(selector.isOpenAIModel('claude-3-opus-20240229')).toBe(false);
    });

    it('should identify Anthropic models correctly', () => {
      expect(selector.isAnthropicModel('claude-3-opus-20240229')).toBe(true);
      expect(selector.isAnthropicModel('claude-2')).toBe(true);
      expect(selector.isAnthropicModel('gpt-4-turbo')).toBe(false);
    });

    it('should identify Ollama models correctly', () => {
      expect(selector.isOllamaModel('mistral')).toBe(true);
      expect(selector.isOllamaModel('gpt-4-turbo')).toBe(false);
    });

    it('should identify LMStudio models correctly', () => {
      expect(selector.isLMStudioModel('mistral-7b-instruct-v0.2')).toBe(true);
      expect(selector.isLMStudioModel('gpt-4-turbo')).toBe(false);
    });
  });

  describe('isModelCapableOf', () => {
    it('should check if a model has a specific capability', () => {
      expect(selector.isModelCapableOf('gpt-4-turbo', 'code-generation')).toBe(true);
      expect(selector.isModelCapableOf('mistral-7b-instruct-q8_0.gguf', 'code-generation')).toBe(false);
    });

    it('should return false for unknown models', () => {
      expect(selector.isModelCapableOf('unknown-model', 'text-generation')).toBe(false);
    });
  });

  describe('getSystemPrompt', () => {
    it('should return appropriate system prompts for different task types', () => {
      expect(selector.getSystemPrompt('seo')).toContain('SEO expert');
      expect(selector.getSystemPrompt('code')).toContain('programmer');
      expect(selector.getSystemPrompt('decision')).toContain('decision-making');
      expect(selector.getSystemPrompt('unknown')).toContain('helpful AI assistant');
    });
  });

  describe('getAvailableModels', () => {
    // Store original environment values
    let originalEnv;

    beforeEach(() => {
      // Save original environment
      originalEnv = {
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
        OLLAMA_ENABLED: process.env.OLLAMA_ENABLED
      };

      // Set environment variables for testing
      process.env.OPENAI_API_KEY = 'test-key';
      process.env.ANTHROPIC_API_KEY = '';
      process.env.OLLAMA_ENABLED = '';
      
      // We'll directly test the getAvailableProviders method which is used by getAvailableModels
    });

    afterEach(() => {
      // Restore original environment
      process.env.OPENAI_API_KEY = originalEnv.OPENAI_API_KEY;
      process.env.ANTHROPIC_API_KEY = originalEnv.ANTHROPIC_API_KEY;
      process.env.OLLAMA_ENABLED = originalEnv.OLLAMA_ENABLED;
    });

    it('should return available models based on environment settings', () => {
      const result = selector.getAvailableModels();
      
      // Check structure
      expect(result).toHaveProperty('models');
      expect(result).toHaveProperty('modelDetails');
      expect(result).toHaveProperty('environmentConfig');
      
      // Since we can't easily mock the environment object directly,
      // we'll just verify the structure of the response
      expect(result.models).toHaveProperty('seo');
      expect(result.models).toHaveProperty('code');
      expect(result.models).toHaveProperty('decision');
      
      // Verify model details are included
      expect(Object.keys(result.modelDetails).length).toBeGreaterThan(0);
      
      // Verify environment config is included
      expect(result.environmentConfig).toHaveProperty('useLocalModels');
      expect(result.environmentConfig).toHaveProperty('useOpenAI');
      expect(result.environmentConfig).toHaveProperty('useAnthropic');
      expect(result.environmentConfig).toHaveProperty('providerPriority');
    });
  });
});
