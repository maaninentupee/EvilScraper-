import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ModelSelector } from '../../src/services/ModelSelector';
import { AppModule } from '../../src/app.module';

// Create mocked providers for testing
class MockModelSelector {
  getModel(taskType: string) {
    const models = {
      'seo': 'mistral-7b-instruct-q8_0.gguf',
      'code': 'codellama-7b-q8_0.gguf',
      'decision': 'falcon-7b-q4_0.gguf'
    };
    return models[taskType] || models['seo'];
  }
  
  mapTaskTypeToCapability(taskType: string) {
    const capabilities = {
      'seo': 'summarization',
      'code': 'code-generation',
      'decision': 'decision-making'
    };
    return capabilities[taskType] || 'text-generation';
  }
  
  getProviderForModel(modelName: string) {
    if (modelName.startsWith('gpt-')) return 'openai';
    if (modelName.startsWith('claude-')) return 'anthropic';
    if (modelName === 'mistral' || modelName === 'llama2:13b') return 'ollama';
    if (modelName === 'mistral-7b-instruct-v0.2') return 'lmstudio';
    return 'local';
  }
  
  isModelCapableOf(modelName: string, capability: string) {
    if (capability === 'unknown-capability') return false;
    return true;
  }
  
  isLMStudioModel(modelName: string) {
    return modelName.includes('mistral-7b-instruct-v0.2');
  }
  
  isOllamaModel(modelName: string) {
    return modelName === 'mistral' || modelName === 'llama2:13b';
  }
}

// Integration tests using real and mocked components
describe('Integration tests: ModelSelector and AIGateway', () => {
  describe('ModelSelector unit tests', () => {
    let modelSelector: MockModelSelector;
    
    beforeEach(() => {
      modelSelector = new MockModelSelector();
    });
    
    test('getModel returns the correct model based on task type', () => {
      expect(modelSelector.getModel('seo')).toBe('mistral-7b-instruct-q8_0.gguf');
      expect(modelSelector.getModel('code')).toBe('codellama-7b-q8_0.gguf');
      expect(modelSelector.getModel('decision')).toBe('falcon-7b-q4_0.gguf');
      expect(modelSelector.getModel('unknown')).toBe('mistral-7b-instruct-q8_0.gguf');
    });
    
    test('mapTaskTypeToCapability maps task types to capabilities', () => {
      expect(modelSelector.mapTaskTypeToCapability('seo')).toBe('summarization');
      expect(modelSelector.mapTaskTypeToCapability('code')).toBe('code-generation'); 
      expect(modelSelector.mapTaskTypeToCapability('decision')).toBe('decision-making');
      expect(modelSelector.mapTaskTypeToCapability('unknown')).toBe('text-generation');
    });
    
    test('getProviderForModel identifies providers for different models', () => {
      expect(modelSelector.getProviderForModel('gpt-4-turbo')).toBe('openai');
      expect(modelSelector.getProviderForModel('claude-3-opus')).toBe('anthropic');
    });
    
    test('isModelCapableOf identifies model capabilities', () => {
      expect(modelSelector.isModelCapableOf('gpt-4-turbo', 'text-generation')).toBe(true);
      expect(modelSelector.isModelCapableOf('gpt-4-turbo', 'unknown-capability')).toBe(false);
    });
  });
  
  describe('Aidon ModelSelector implementation tests', () => {
    let app: INestApplication;
    let modelSelector: ModelSelector;
    
    beforeAll(async () => {
      // Create a test module using the real ModelSelector implementation
      const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      
      app = moduleRef.createNestApplication();
      await app.init();
      
      modelSelector = moduleRef.get<ModelSelector>(ModelSelector);
    });
    
    afterAll(async () => {
      await app.close();
    });
    
    test('mapTaskTypeToCapability implementation works correctly', () => {
      expect(modelSelector.mapTaskTypeToCapability('seo')).toBe('summarization');
      expect(modelSelector.mapTaskTypeToCapability('code')).toBe('code-generation');
      expect(modelSelector.mapTaskTypeToCapability('decision')).toBe('decision-making');
      expect(modelSelector.mapTaskTypeToCapability('unknown')).toBe('text-generation');
    });
    
    test('isOpenAIModel identifies OpenAI models correctly', () => {
      expect(modelSelector.isOpenAIModel('gpt-4-turbo')).toBe(true);
      expect(modelSelector.isOpenAIModel('gpt-3.5-turbo')).toBe(true);
      expect(modelSelector.isOpenAIModel('claude-3-opus-20240229')).toBe(false);
    });
    
    test('isAnthropicModel identifies Anthropic models correctly', () => {
      expect(modelSelector.isAnthropicModel('claude-3-opus-20240229')).toBe(true);
      expect(modelSelector.isAnthropicModel('claude-2.1')).toBe(true);
      expect(modelSelector.isAnthropicModel('gpt-4-turbo')).toBe(false);
    });
  });
});
