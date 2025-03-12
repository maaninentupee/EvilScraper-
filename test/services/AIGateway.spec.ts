import { Test, TestingModule } from '@nestjs/testing';
import { AIGateway } from '../../src/services/AIGateway';
import { ModelSelector } from '../../src/services/ModelSelector';
import { MockLogger, mockOpenAIResponse, mockAnthropicResponse, mockApiErrors, mockProviderResults } from '../test-utils';
import { environment } from '../../src/config/environment';
import { LocalProvider } from '../../src/services/providers/LocalProvider';
import { OpenAIProvider } from '../../src/services/providers/OpenAIProvider';
import { AnthropicProvider } from '../../src/services/providers/AnthropicProvider';
import { LMStudioProvider } from '../../src/services/providers/LMStudioProvider';
import { OllamaProvider } from '../../src/services/providers/OllamaProvider';
import { CompletionResult } from '../../src/services/providers/BaseProvider';

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

describe('AIGateway', () => {
  let service: AIGateway;
  let mockModelSelector: jest.Mocked<Partial<ModelSelector>>;
  let mockLocalProvider: jest.Mocked<Partial<LocalProvider>>;
  let mockOpenAIProvider: jest.Mocked<Partial<OpenAIProvider>>;
  let mockAnthropicProvider: jest.Mocked<Partial<AnthropicProvider>>;
  let mockLMStudioProvider: jest.Mocked<Partial<LMStudioProvider>>;
  let mockOllamaProvider: jest.Mocked<Partial<OllamaProvider>>;
  let mockLogger: MockLogger;

  beforeEach(async () => {
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
    
    mockLocalProvider = {
      generateCompletion: jest.fn(),
      isAvailable: jest.fn(),
      getName: jest.fn().mockReturnValue('local')
    } as jest.Mocked<Partial<LocalProvider>>;
    
    mockOpenAIProvider = {
      generateCompletion: jest.fn(),
      isAvailable: jest.fn(),
      getName: jest.fn().mockReturnValue('openai')
    } as jest.Mocked<Partial<OpenAIProvider>>;
    
    mockAnthropicProvider = {
      generateCompletion: jest.fn(),
      isAvailable: jest.fn(),
      getName: jest.fn().mockReturnValue('anthropic')
    } as jest.Mocked<Partial<AnthropicProvider>>;
    
    mockLMStudioProvider = {
      generateCompletion: jest.fn(),
      isAvailable: jest.fn(),
      getName: jest.fn().mockReturnValue('lmstudio')
    } as jest.Mocked<Partial<LMStudioProvider>>;
    
    mockOllamaProvider = {
      generateCompletion: jest.fn(),
      isAvailable: jest.fn(),
      getName: jest.fn().mockReturnValue('ollama')
    } as jest.Mocked<Partial<OllamaProvider>>;
    
    // Määritellään default-paluuarvot mockeille
    mockModelSelector.getModel.mockImplementation((taskType, provider) => {
      if (provider === 'openai') {
        if (taskType === 'seo') return 'gpt-4-turbo';
        if (taskType === 'code') return 'gpt-4-turbo';
        if (taskType === 'decision') return 'gpt-4-turbo';
        return 'gpt-4-turbo';
      } else if (provider === 'anthropic') {
        return 'claude-3-opus-20240229';
      } else if (provider === 'lmstudio') {
        return 'mistral-7b-instruct-v0.2';
      } else if (provider === 'ollama') {
        return 'mistral';
      } else {
        // local provider tai oletuspalveluntarjoaja
        if (taskType === 'seo') return 'mistral-7b-instruct-q8_0.gguf';
        if (taskType === 'code') return 'codellama-7b-q8_0.gguf';
        if (taskType === 'decision') return 'falcon-7b-q4_0.gguf';
        return 'mistral-7b-instruct-q8_0.gguf';
      }
    });
    
    mockModelSelector.getProviderForModel.mockImplementation((model) => {
      if (model === 'gpt-4-turbo') return 'openai';
      if (model === 'claude-3-opus-20240229') return 'anthropic';
      if (model.includes('mistral-7b-instruct-v0.2')) return 'lmstudio';
      if (model === 'mistral') return 'ollama';
      return 'local';
    });
    
    mockModelSelector.isModelCapableOf.mockReturnValue(true);

    mockLogger = new MockLogger();
    
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIGateway,
        {
          provide: ModelSelector,
          useValue: mockModelSelector
        },
        {
          provide: LocalProvider,
          useValue: mockLocalProvider
        },
        {
          provide: OpenAIProvider,
          useValue: mockOpenAIProvider
        },
        {
          provide: AnthropicProvider,
          useValue: mockAnthropicProvider
        },
        {
          provide: LMStudioProvider,
          useValue: mockLMStudioProvider
        },
        {
          provide: OllamaProvider,
          useValue: mockOllamaProvider
        }
      ],
    }).compile();

    service = module.get<AIGateway>(AIGateway);
    // @ts-ignore - Override the logger to our mock
    service['logger'] = mockLogger;
  });

  afterEach(() => {
    mockLogger.clear();
    jest.clearAllMocks();
  });

  describe('processAIRequest', () => {
    it('should process request with local provider successfully', async () => {
      // Arrange
      const taskType = 'seo';
      const input = 'Testisyöte';
      const modelName = 'mistral-7b-instruct-q8_0.gguf';
      
      mockModelSelector.getModel.mockReturnValue(modelName);
      mockModelSelector.isLocalModel.mockReturnValue(true);
      mockModelSelector.isLMStudioModel.mockReturnValue(false);
      mockModelSelector.isOllamaModel.mockReturnValue(false);
      mockModelSelector.isOpenAIModel.mockReturnValue(false);
      mockModelSelector.isAnthropicModel.mockReturnValue(false);
      
      // Paikallinen malli palauttaa onnistuneen vastauksen
      mockLocalProvider.generateCompletion.mockResolvedValueOnce(mockProviderResults.successLocal());
      
      // Act
      const result = await service.processAIRequest(taskType, input);
      
      // Assert
      expect(result).toMatchObject({
        result: 'Paikallisen mallin vastaus',
        model: modelName
      });
      expect(result).toHaveProperty('latency');
      expect(result).toHaveProperty('provider', 'local');
      expect(mockModelSelector.getModel).toHaveBeenCalledWith(taskType, undefined);
      expect(mockLocalProvider.generateCompletion).toHaveBeenCalledWith({
        prompt: input,
        modelName: 'mistral-7b-instruct-q8_0.gguf',
        maxTokens: 1000,
        temperature: 0.7
      });
    });

    it('should fallback to LM Studio when local provider fails', async () => {
      // Arrange
      const taskType = 'seo';
      const input = 'Testisyöte';
      const modelName = 'mistral-7b-instruct-q8_0.gguf';
      const lmStudioModel = 'mistral-7b-instruct-v0.2';
      
      mockModelSelector.getModel
        .mockReturnValueOnce(modelName)  // First call returns local model
        .mockReturnValueOnce(lmStudioModel);  // Second call returns LM Studio model
      
      mockModelSelector.isLocalModel
        .mockReturnValueOnce(true)  // First check for local model
        .mockReturnValueOnce(false);  // Subsequent checks
        
      mockModelSelector.isLMStudioModel
        .mockReturnValueOnce(false)  // First check (not LM Studio)
        .mockReturnValueOnce(true);  // Second check (is LM Studio)
        
      mockModelSelector.isOllamaModel.mockReturnValue(false);
      mockModelSelector.isOpenAIModel.mockReturnValue(false);
      mockModelSelector.isAnthropicModel.mockReturnValue(false);
      
      // Paikallinen malli epäonnistuu
      mockLocalProvider.generateCompletion.mockResolvedValueOnce(
        mockProviderResults.failedResult('local', 'mistral-7b-instruct-q8_0.gguf')
      );
      
      // LM Studio onnistuu fallback-kutsuna
      mockLMStudioProvider.generateCompletion.mockResolvedValueOnce(mockProviderResults.successLMStudio());
      
      // Act & Assert
      try {
        const result = await service.processAIRequest(taskType, input);
        fail('Pitäisi heittää virhe');
      } catch (error) {
        expect(error.message).toContain('local epäonnistui');
        expect(mockLocalProvider.generateCompletion).toHaveBeenCalled();
        // LM Studio ei pitäisi kutsuttavan koska processAIRequest heittää virheen
        // epäonnistumisen jälkeen eikä yritä käyttää fallbackia
        expect(mockLMStudioProvider.generateCompletion).not.toHaveBeenCalled();
      }
    });

    it('should fallback to Ollama when both local and LM Studio providers fail', async () => {
      // Arrange
      const taskType = 'seo';
      const input = 'Testisyöte';
      const localModel = 'mistral-7b-instruct-q8_0.gguf';
      const lmStudioModel = 'mistral-7b-instruct-v0.2';
      const ollamaModel = 'mistral';
      
      mockModelSelector.getModel
        .mockReturnValueOnce(localModel)
        .mockReturnValueOnce(lmStudioModel)
        .mockReturnValueOnce(ollamaModel);
      
      mockModelSelector.isLocalModel
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false);
        
      mockModelSelector.isLMStudioModel
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false);
        
      mockModelSelector.isOllamaModel
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);
        
      mockModelSelector.isOpenAIModel.mockReturnValue(false);
      mockModelSelector.isAnthropicModel.mockReturnValue(false);
      
      // Paikallinen malli epäonnistuu
      mockLocalProvider.generateCompletion.mockResolvedValueOnce(
        mockProviderResults.failedResult('local', 'mistral-7b-instruct-q8_0.gguf', 'Paikallinen mallin virhe')
      );
      
      // LM Studio epäonnistuu
      mockLMStudioProvider.generateCompletion.mockResolvedValueOnce(
        mockProviderResults.failedResult('lmstudio', 'mistral-7b-instruct-v0.2')
      );
      
      // Ollama onnistuu
      mockOllamaProvider.generateCompletion.mockResolvedValueOnce(mockProviderResults.successOllama());
      
      // Act & Assert
      try {
        await service.processAIRequest(taskType, input);
        fail('Pitäisi heittää virhe');
      } catch (error) {
        expect(error.message).toContain('local epäonnistui');
        expect(mockLocalProvider.generateCompletion).toHaveBeenCalled();
        // LM Studio ja Ollama ei pitäisi kutsuttavan
        expect(mockLMStudioProvider.generateCompletion).not.toHaveBeenCalled();
        expect(mockOllamaProvider.generateCompletion).not.toHaveBeenCalled();
      }
    });

    it('should fallback to OpenAI when local providers fail', async () => {
      // Arrange
      const taskType = 'seo';
      const input = 'Testisyöte';
      const localModel = 'mistral-7b-instruct-q8_0.gguf';
      const lmStudioModel = 'mistral-7b-instruct-v0.2';
      const ollamaModel = 'mistral';
      const openaiModel = 'gpt-4-turbo';
      
      mockModelSelector.getModel
        .mockReturnValueOnce(localModel)
        .mockReturnValueOnce(lmStudioModel)
        .mockReturnValueOnce(ollamaModel)
        .mockReturnValueOnce(openaiModel);
      
      mockModelSelector.isLocalModel.mockReturnValue(true);
      mockModelSelector.isLMStudioModel
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false);
        
      mockModelSelector.isOllamaModel
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false);
        
      mockModelSelector.isOpenAIModel
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);
        
      mockModelSelector.isAnthropicModel.mockReturnValue(false);
      
      // Paikallinen malli epäonnistuu
      mockLocalProvider.generateCompletion.mockResolvedValueOnce(
        mockProviderResults.failedResult('local', 'mistral-7b-instruct-q8_0.gguf', 'Paikallinen mallin virhe')
      );
      
      // LM Studio epäonnistuu
      mockLMStudioProvider.generateCompletion.mockResolvedValueOnce(
        mockProviderResults.failedResult('lmstudio', 'mistral-7b-instruct-v0.2')
      );
      
      // Ollama epäonnistuu
      mockOllamaProvider.generateCompletion.mockResolvedValueOnce(
        mockProviderResults.failedResult('ollama', 'mistral')
      );
      
      // OpenAI onnistuu
      mockOpenAIProvider.generateCompletion.mockResolvedValueOnce(mockProviderResults.successOpenAI());
      
      // Act & Assert
      try {
        await service.processAIRequest(taskType, input);
        fail('Pitäisi heittää virhe');
      } catch (error) {
        expect(error.message).toContain('local epäonnistui');
        expect(mockLocalProvider.generateCompletion).toHaveBeenCalled();
        // Muita palveluntarjoajia ei pitäisi kutsuttavan
        expect(mockLMStudioProvider.generateCompletion).not.toHaveBeenCalled();
        expect(mockOllamaProvider.generateCompletion).not.toHaveBeenCalled();
        expect(mockOpenAIProvider.generateCompletion).not.toHaveBeenCalled();
      }
    });

    it('should return error when all providers fail', async () => {
      // Arrange
      const taskType = 'seo';
      const input = 'TEST_ALL_ERROR Testisyöte';
      const localModel = 'mistral-7b-instruct-q8_0.gguf';
      
      mockModelSelector.getModel.mockReturnValue(localModel);
      mockModelSelector.isLocalModel.mockReturnValue(true);
      mockModelSelector.isLMStudioModel.mockReturnValue(false);
      mockModelSelector.isOllamaModel.mockReturnValue(false);
      mockModelSelector.isOpenAIModel.mockReturnValue(false);
      mockModelSelector.isAnthropicModel.mockReturnValue(false);
      
      // Kaikki mallit epäonnistuvat
      mockLocalProvider.generateCompletion.mockResolvedValueOnce(
        mockProviderResults.failedResult('local', 'mistral-7b-instruct-q8_0.gguf')
      );
      mockLMStudioProvider.generateCompletion.mockResolvedValueOnce(
        mockProviderResults.failedResult('lmstudio', 'mistral-7b-instruct-v0.2')
      );
      mockOllamaProvider.generateCompletion.mockResolvedValueOnce(
        mockProviderResults.failedResult('ollama', 'mistral')
      );
      mockOpenAIProvider.generateCompletion.mockResolvedValueOnce(
        mockProviderResults.failedResult('openai', 'gpt-4-turbo')
      );
      mockAnthropicProvider.generateCompletion.mockResolvedValueOnce(
        mockProviderResults.failedResult('anthropic', 'claude-3-opus-20240229')
      );
      
      // Act
      try {
        await service.processAIRequest(taskType, input);
        fail('Pitäisi heittää virhe');
      } catch (error) {
        expect(error.message).toContain('Kaikki AI-palvelut epäonnistuivat');
      }
    });

    it('should handle TEST_LOCAL_ERROR test input', async () => {
      // Arrange
      const taskType = 'seo';
      const input = 'TEST_LOCAL_ERROR Testisyöte';
      const modelName = 'mistral-7b-instruct-q8_0.gguf';
      
      mockModelSelector.getModel.mockReturnValue(modelName);
      mockModelSelector.isLocalModel.mockReturnValue(true);
      mockModelSelector.isLMStudioModel.mockReturnValue(false);
      mockModelSelector.isOllamaModel.mockReturnValue(false);
      mockModelSelector.isOpenAIModel.mockReturnValue(false);
      mockModelSelector.isAnthropicModel.mockReturnValue(false);
      
      // LM Studio onnistuu fallback-kutsuna
      mockLMStudioProvider.generateCompletion.mockResolvedValueOnce(mockProviderResults.successLMStudio());
      
      // Act & Assert
      try {
        await service.processAIRequest(taskType, input);
        // Jos kutsutaan tähän asti, testi epäonnistuu
        fail('Pitäisi heittää virhe');
      } catch (error) {
        // Varmista, että virheviesti on oikeanlainen
        expect(error.message).toContain('simuloitu virhe testisyötteestä');
      }
    });

    it('should handle TEST_LMSTUDIO_ERROR test input', async () => {
      // Arrange
      const taskType = 'seo';
      const input = 'TEST_LMSTUDIO_ERROR Testisyöte';
      const modelName = 'mistral-7b-instruct-q8_0.gguf';
      
      mockModelSelector.getModel.mockReturnValue(modelName);
      mockModelSelector.isLocalModel.mockReturnValue(true);
      mockModelSelector.isLMStudioModel.mockReturnValue(false);
      mockModelSelector.isOllamaModel.mockReturnValue(false);
      mockModelSelector.isOpenAIModel.mockReturnValue(false);
      mockModelSelector.isAnthropicModel.mockReturnValue(false);
      
      // Paikallinen malli epäonnistuu
      mockLocalProvider.generateCompletion.mockResolvedValueOnce(
        mockProviderResults.failedResult('local', 'mistral-7b-instruct-q8_0.gguf')
      );
      
      // Act & Assert
      try {
        await service.processAIRequest(taskType, input);
        // Jos kutsutaan tähän asti, testi epäonnistuu
        fail('Pitäisi heittää virhe');
      } catch (error) {
        // Varmista, että virheviesti on oikeanlainen
        expect(error.message).toContain('local epäonnistui');
      }
    });

    it('should handle TEST_ALL_ERROR test input', async () => {
      // Arrange
      const taskType = 'seo';
      const input = 'TEST_ALL_ERROR Testisyöte';
      const localModel = 'mistral-7b-instruct-q8_0.gguf';
      
      mockModelSelector.getModel.mockReturnValue(localModel);
      mockModelSelector.isLocalModel.mockReturnValue(true);
      mockModelSelector.isLMStudioModel.mockReturnValue(false);
      mockModelSelector.isOllamaModel.mockReturnValue(false);
      mockModelSelector.isOpenAIModel.mockReturnValue(false);
      mockModelSelector.isAnthropicModel.mockReturnValue(false);
      
      // Act
      try {
        await service.processAIRequest(taskType, input);
        // Jos kutsutaan tähän asti, testi epäonnistuu
        fail('Pitäisi heittää virhe');
      } catch (error) {
        // Varmista, että virheviesti on oikeanlainen
        expect(error.message).toContain('Kaikki AI-palvelut epäonnistuivat');
      }
    });
  });

  describe('processAIRequestWithFallback', () => {
    it('should process request with initial provider successfully', async () => {
      // Arrange
      const taskType = 'seo';
      const input = 'Testisyöte';
      const localModel = 'mistral-7b-instruct-q8_0.gguf';

      mockModelSelector.getModel.mockReturnValue(localModel);
      mockModelSelector.isLocalModel.mockReturnValue(true);
      mockModelSelector.isLMStudioModel.mockReturnValue(false);
      mockModelSelector.isOllamaModel.mockReturnValue(false);
      mockModelSelector.isOpenAIModel.mockReturnValue(false);
      mockModelSelector.isAnthropicModel.mockReturnValue(false);

      mockLocalProvider.generateCompletion.mockResolvedValueOnce(mockProviderResults.successLocal());
      
      // Act
      const result = await service.processAIRequestWithFallback(taskType, input);
      
      // Assert
      expect(result.result).toBe('Paikallisen mallin vastaus');
      expect(mockModelSelector.getModel).toHaveBeenCalledWith(taskType, undefined);
      expect(mockLocalProvider.generateCompletion).toHaveBeenCalled();
      expect(mockLMStudioProvider.generateCompletion).not.toHaveBeenCalled();
      expect(mockOllamaProvider.generateCompletion).not.toHaveBeenCalled();
      expect(mockOpenAIProvider.generateCompletion).not.toHaveBeenCalled();
      expect(mockAnthropicProvider.generateCompletion).not.toHaveBeenCalled();
    });

    it('should fallback to LM Studio when local provider fails', async () => {
      // Arrange
      const taskType = 'seo';
      const input = 'Testisyöte';
      const localModel = 'mistral-7b-instruct-q8_0.gguf';
      const lmstudioModel = 'mistral-7b-instruct-v0.2';

      mockModelSelector.getModel
        .mockReturnValueOnce(localModel)
        .mockReturnValueOnce(lmstudioModel);
      
      mockModelSelector.isLocalModel.mockReturnValue(true);
      mockModelSelector.isLMStudioModel
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);
      
      mockModelSelector.isOllamaModel.mockReturnValue(false);
      mockModelSelector.isOpenAIModel.mockReturnValue(false);
      mockModelSelector.isAnthropicModel.mockReturnValue(false);

      // Local provider fails
      mockLocalProvider.generateCompletion.mockResolvedValueOnce(
        mockProviderResults.failedResult('local', localModel)
      );
      
      // LM Studio succeeds
      mockLMStudioProvider.generateCompletion.mockResolvedValueOnce(
        mockProviderResults.successLMStudio()
      );
      
      // Act
      const result = await service.processAIRequestWithFallback(taskType, input);
      
      // Assert
      expect(result.result).toBe('LM Studio vastaus');
      expect(mockModelSelector.getModel).toHaveBeenCalledWith(taskType, undefined);
      expect(mockModelSelector.getModel).toHaveBeenCalledWith(taskType, 'lmstudio');
      expect(mockLocalProvider.generateCompletion).toHaveBeenCalled();
      expect(mockLMStudioProvider.generateCompletion).toHaveBeenCalled();
      expect(mockOllamaProvider.generateCompletion).not.toHaveBeenCalled();
      expect(mockOpenAIProvider.generateCompletion).not.toHaveBeenCalled();
      expect(mockAnthropicProvider.generateCompletion).not.toHaveBeenCalled();
    });

    it('should fallback to Ollama when both local and LM Studio providers fail', async () => {
      // Arrange
      const taskType = 'seo';
      const input = 'Testisyöte';
      const localModel = 'mistral-7b-instruct-q8_0.gguf';
      const lmstudioModel = 'mistral-7b-instruct-v0.2';
      const ollamaModel = 'mistral';

      mockModelSelector.getModel
        .mockReturnValueOnce(localModel)
        .mockReturnValueOnce(lmstudioModel)
        .mockReturnValueOnce(ollamaModel);
      
      mockModelSelector.isLocalModel.mockReturnValue(true);
      mockModelSelector.isLMStudioModel
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false);
      
      mockModelSelector.isOllamaModel
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);
      
      mockModelSelector.isOpenAIModel.mockReturnValue(false);
      mockModelSelector.isAnthropicModel.mockReturnValue(false);

      // Local provider fails
      mockLocalProvider.generateCompletion.mockResolvedValueOnce(
        mockProviderResults.failedResult('local', localModel)
      );
      
      // LM Studio fails
      mockLMStudioProvider.generateCompletion.mockResolvedValueOnce(
        mockProviderResults.failedResult('lmstudio', lmstudioModel)
      );
      
      // Ollama succeeds
      mockOllamaProvider.generateCompletion.mockResolvedValueOnce(
        mockProviderResults.successOllama()
      );
      
      // Act
      const result = await service.processAIRequestWithFallback(taskType, input);
      
      // Assert
      expect(result.result).toBe('Ollama vastaus');
      expect(mockLocalProvider.generateCompletion).toHaveBeenCalled();
      expect(mockLMStudioProvider.generateCompletion).toHaveBeenCalled();
      expect(mockOllamaProvider.generateCompletion).toHaveBeenCalled();
      expect(mockOpenAIProvider.generateCompletion).not.toHaveBeenCalled();
      expect(mockAnthropicProvider.generateCompletion).not.toHaveBeenCalled();
    });

    it('should fallback to OpenAI when local providers fail', async () => {
      // Arrange
      const taskType = 'seo';
      const input = 'Testisyöte';
      const localModel = 'mistral-7b-instruct-q8_0.gguf';
      const lmstudioModel = 'mistral-7b-instruct-v0.2';
      const ollamaModel = 'mistral';
      const openaiModel = 'gpt-4-turbo';

      mockModelSelector.getModel
        .mockReturnValueOnce(localModel)
        .mockReturnValueOnce(lmstudioModel)
        .mockReturnValueOnce(ollamaModel)
        .mockReturnValueOnce(openaiModel);
      
      mockModelSelector.isLocalModel.mockReturnValue(true);
      mockModelSelector.isLMStudioModel
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false);
        
      mockModelSelector.isOllamaModel
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false);
        
      mockModelSelector.isOpenAIModel
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);
        
      mockModelSelector.isAnthropicModel.mockReturnValue(false);

      // Local provider fails
      mockLocalProvider.generateCompletion.mockResolvedValueOnce(
        mockProviderResults.failedResult('local', localModel)
      );
      
      // LM Studio fails
      mockLMStudioProvider.generateCompletion.mockResolvedValueOnce(
        mockProviderResults.failedResult('lmstudio', lmstudioModel)
      );
      
      // Ollama fails
      mockOllamaProvider.generateCompletion.mockResolvedValueOnce(
        mockProviderResults.failedResult('ollama', ollamaModel)
      );
      
      // OpenAI succeeds
      mockOpenAIProvider.generateCompletion.mockResolvedValueOnce(
        mockProviderResults.successOpenAI()
      );
      
      // Act
      const result = await service.processAIRequestWithFallback(taskType, input);
      
      // Assert
      expect(result.result).toBe('OpenAI vastaus');
      expect(mockLocalProvider.generateCompletion).toHaveBeenCalled();
      expect(mockLMStudioProvider.generateCompletion).toHaveBeenCalled();
      expect(mockOllamaProvider.generateCompletion).toHaveBeenCalled();
      expect(mockOpenAIProvider.generateCompletion).toHaveBeenCalled();
      expect(mockAnthropicProvider.generateCompletion).not.toHaveBeenCalled();
    });

    it('should fallback to Anthropic when all other providers fail', async () => {
      // Arrange
      const taskType = 'seo';
      const input = 'Testisyöte';
      const localModel = 'mistral-7b-instruct-q8_0.gguf';
      const lmstudioModel = 'mistral-7b-instruct-v0.2';
      const ollamaModel = 'mistral';
      const openaiModel = 'gpt-4-turbo';
      const anthropicModel = 'claude-3-opus-20240229';

      mockModelSelector.getModel
        .mockReturnValueOnce(localModel)
        .mockReturnValueOnce(lmstudioModel)
        .mockReturnValueOnce(ollamaModel)
        .mockReturnValueOnce(openaiModel)
        .mockReturnValueOnce(anthropicModel);
      
      mockModelSelector.isLocalModel.mockReturnValue(true);
      mockModelSelector.isLMStudioModel
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false);
      
      mockModelSelector.isOllamaModel
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false);
      
      mockModelSelector.isOpenAIModel
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false);
      
      mockModelSelector.isAnthropicModel
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);

      // Local provider fails
      mockLocalProvider.generateCompletion.mockResolvedValueOnce(
        mockProviderResults.failedResult('local', localModel)
      );
      
      // LM Studio fails
      mockLMStudioProvider.generateCompletion.mockResolvedValueOnce(
        mockProviderResults.failedResult('lmstudio', lmstudioModel)
      );
      
      // Ollama fails
      mockOllamaProvider.generateCompletion.mockResolvedValueOnce(
        mockProviderResults.failedResult('ollama', ollamaModel)
      );
      
      // OpenAI fails
      mockOpenAIProvider.generateCompletion.mockResolvedValueOnce(
        mockProviderResults.failedResult('openai', openaiModel)
      );
      
      // Anthropic succeeds
      mockAnthropicProvider.generateCompletion.mockResolvedValueOnce(
        mockProviderResults.successAnthropic()
      );
      
      // Act
      const result = await service.processAIRequestWithFallback(taskType, input);
      
      // Assert
      expect(result.result).toBe('Anthropic vastaus');
      expect(mockLocalProvider.generateCompletion).toHaveBeenCalled();
      expect(mockLMStudioProvider.generateCompletion).toHaveBeenCalled();
      expect(mockOllamaProvider.generateCompletion).toHaveBeenCalled();
      expect(mockOpenAIProvider.generateCompletion).toHaveBeenCalled();
      expect(mockAnthropicProvider.generateCompletion).toHaveBeenCalled();
    });

    it('should return error when all providers fail in processAIRequestWithFallback', async () => {
      // Arrange
      const taskType = 'seo';
      const input = 'Testisyöte';
      const localModel = 'mistral-7b-instruct-q8_0.gguf';
      const lmstudioModel = 'mistral-7b-instruct-v0.2';
      const ollamaModel = 'mistral';
      const openaiModel = 'gpt-4-turbo';
      const anthropicModel = 'claude-3-opus-20240229';

      mockModelSelector.getModel
        .mockReturnValueOnce(localModel)
        .mockReturnValueOnce(lmstudioModel)
        .mockReturnValueOnce(ollamaModel)
        .mockReturnValueOnce(openaiModel)
        .mockReturnValueOnce(anthropicModel);
      
      mockModelSelector.isLocalModel.mockReturnValue(true);
      mockModelSelector.isLMStudioModel
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);
      
      mockModelSelector.isOllamaModel
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);
      
      mockModelSelector.isOpenAIModel
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);
      
      mockModelSelector.isAnthropicModel
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);

      // All providers fail
      mockLocalProvider.generateCompletion.mockResolvedValueOnce(
        mockProviderResults.failedResult('local', localModel)
      );
      
      mockLMStudioProvider.generateCompletion.mockResolvedValueOnce(
        mockProviderResults.failedResult('lmstudio', lmstudioModel)
      );
      
      mockOllamaProvider.generateCompletion.mockResolvedValueOnce(
        mockProviderResults.failedResult('ollama', ollamaModel)
      );
      
      mockOpenAIProvider.generateCompletion.mockResolvedValueOnce(
        mockProviderResults.failedResult('openai', openaiModel)
      );
      
      mockAnthropicProvider.generateCompletion.mockResolvedValueOnce(
        mockProviderResults.failedResult('anthropic', anthropicModel)
      );
      
      // Act
      const result = await service.processAIRequestWithFallback(taskType, input);
      
      // Assert
      expect(result).toHaveProperty('error', true);
      expect(result.message).toContain('Kaikki AI-palvelut epäonnistuivat');
      expect(result).toHaveProperty('details');
      expect(mockLocalProvider.generateCompletion).toHaveBeenCalled();
      expect(mockLMStudioProvider.generateCompletion).toHaveBeenCalled();
      expect(mockOllamaProvider.generateCompletion).toHaveBeenCalled();
      expect(mockOpenAIProvider.generateCompletion).toHaveBeenCalled();
      expect(mockAnthropicProvider.generateCompletion).toHaveBeenCalled();
    });

    it('should handle simulated LOCAL_ERROR in processAIRequestWithFallback', async () => {
      // Arrange
      const taskType = 'seo';
      const input = 'TEST_LOCAL_ERROR Testisyöte';
      const lmstudioModel = 'mistral-7b-instruct-v0.2';

      mockModelSelector.getModel.mockReturnValueOnce(lmstudioModel);
      mockModelSelector.isLMStudioModel.mockReturnValue(true);
      mockModelSelector.isLocalModel.mockReturnValue(false);
      mockModelSelector.isOllamaModel.mockReturnValue(false);
      mockModelSelector.isOpenAIModel.mockReturnValue(false);
      mockModelSelector.isAnthropicModel.mockReturnValue(false);
      
      // LM Studio succeeds after local error simulation
      mockLMStudioProvider.generateCompletion.mockResolvedValueOnce(
        mockProviderResults.successLMStudio()
      );
      
      // Act
      const result = await service.processAIRequestWithFallback(taskType, input);
      
      // Assert
      expect(result.result).toBe('LM Studio vastaus');
      expect(mockLocalProvider.generateCompletion).not.toHaveBeenCalled();
      expect(mockLMStudioProvider.generateCompletion).toHaveBeenCalled();
      expect(mockOllamaProvider.generateCompletion).not.toHaveBeenCalled();
      expect(mockOpenAIProvider.generateCompletion).not.toHaveBeenCalled();
      expect(mockAnthropicProvider.generateCompletion).not.toHaveBeenCalled();
    });

    it('should handle simulated ALL_ERROR in processAIRequestWithFallback', async () => {
      // Arrange
      const taskType = 'seo';
      const input = 'TEST_ALL_ERROR Testisyöte';
      
      // Act
      const result = await service.processAIRequestWithFallback(taskType, input);
      
      // Assert
      expect(result).toHaveProperty('error', true);
      expect(result).toHaveProperty('message', 'Kaikki AI-palvelut epäonnistuivat (simuloitu virhe testisyötteestä).');
      expect(result).toHaveProperty('details');
      expect(mockLocalProvider.generateCompletion).not.toHaveBeenCalled();
      expect(mockLMStudioProvider.generateCompletion).not.toHaveBeenCalled();
      expect(mockOllamaProvider.generateCompletion).not.toHaveBeenCalled();
      expect(mockOpenAIProvider.generateCompletion).not.toHaveBeenCalled();
      expect(mockAnthropicProvider.generateCompletion).not.toHaveBeenCalled();
    });
  });

  describe('getInitialProvider (through processAIRequestWithFallback)', () => {
    beforeEach(() => {
      // Varmistetaan, että kaikki testit alkavat puhtaalta pöydältä
      environment.useLocalModels = true;
      environment.useLMStudio = true;
      environment.useOllama = true;
      environment.useOpenAI = true;
      environment.useAnthropic = true;
      environment.providerPriorityArray = ['local', 'lmstudio', 'ollama', 'openai', 'anthropic'];
    });

    it('should use LMStudio as initial provider when local is disabled', async () => {
      // Arrange
      const taskType = 'seo';
      const input = 'Testisyöte';
      const lmstudioModel = 'mistral-7b-instruct-v0.2';
      
      // Poistetaan local käytöstä
      environment.useLocalModels = false;
      environment.providerPriorityArray = ['local', 'lmstudio', 'ollama', 'openai', 'anthropic'];
      
      mockModelSelector.getModel.mockReturnValue(lmstudioModel);
      mockModelSelector.isLocalModel.mockReturnValue(false);
      mockModelSelector.isLMStudioModel.mockReturnValue(true);
      mockModelSelector.isOllamaModel.mockReturnValue(false);
      mockModelSelector.isOpenAIModel.mockReturnValue(false);
      mockModelSelector.isAnthropicModel.mockReturnValue(false);
      
      // LM Studio onnistuu
      mockLMStudioProvider.generateCompletion.mockResolvedValueOnce(
        mockProviderResults.successLMStudio()
      );
      
      // Act
      const result = await service.processAIRequestWithFallback(taskType, input);
      
      // Assert
      expect(result.result).toBe('LM Studio vastaus');
      expect(mockLocalProvider.generateCompletion).not.toHaveBeenCalled();
      expect(mockLMStudioProvider.generateCompletion).toHaveBeenCalled();
    });

    it('should use Ollama as initial provider when local and LMStudio are disabled', async () => {
      // Arrange
      const taskType = 'seo';
      const input = 'Testisyöte';
      const ollamaModel = 'mistral';
      
      // Poistetaan local ja LMStudio käytöstä
      environment.useLocalModels = false;
      environment.useLMStudio = false;
      environment.providerPriorityArray = ['local', 'lmstudio', 'ollama', 'openai', 'anthropic'];
      
      mockModelSelector.getModel.mockReturnValue(ollamaModel);
      mockModelSelector.isLocalModel.mockReturnValue(false);
      mockModelSelector.isLMStudioModel.mockReturnValue(false);
      mockModelSelector.isOllamaModel.mockReturnValue(true);
      mockModelSelector.isOpenAIModel.mockReturnValue(false);
      mockModelSelector.isAnthropicModel.mockReturnValue(false);
      
      // Ollama onnistuu
      mockOllamaProvider.generateCompletion.mockResolvedValueOnce(
        mockProviderResults.successOllama()
      );
      
      // Act
      const result = await service.processAIRequestWithFallback(taskType, input);
      
      // Assert
      expect(result.result).toBe('Ollama vastaus');
      expect(mockLocalProvider.generateCompletion).not.toHaveBeenCalled();
      expect(mockLMStudioProvider.generateCompletion).not.toHaveBeenCalled();
      expect(mockOllamaProvider.generateCompletion).toHaveBeenCalled();
    });

    it('should use OpenAI as initial provider when local, LMStudio and Ollama are disabled', async () => {
      // Arrange
      const taskType = 'seo';
      const input = 'Testisyöte';
      const openaiModel = 'gpt-4-turbo';
      
      // Poistetaan local, LMStudio ja Ollama käytöstä
      environment.useLocalModels = false;
      environment.useLMStudio = false;
      environment.useOllama = false;
      environment.providerPriorityArray = ['local', 'lmstudio', 'ollama', 'openai', 'anthropic'];
      
      mockModelSelector.getModel.mockReturnValue(openaiModel);
      mockModelSelector.isLocalModel.mockReturnValue(false);
      mockModelSelector.isLMStudioModel.mockReturnValue(false);
      mockModelSelector.isOllamaModel.mockReturnValue(false);
      mockModelSelector.isOpenAIModel.mockReturnValue(true);
      mockModelSelector.isAnthropicModel.mockReturnValue(false);
      
      // OpenAI onnistuu
      mockOpenAIProvider.generateCompletion.mockResolvedValueOnce(
        mockProviderResults.successOpenAI()
      );
      
      // Act
      const result = await service.processAIRequestWithFallback(taskType, input);
      
      // Assert
      expect(result.result).toBe('OpenAI vastaus');
      expect(mockLocalProvider.generateCompletion).not.toHaveBeenCalled();
      expect(mockLMStudioProvider.generateCompletion).not.toHaveBeenCalled();
      expect(mockOllamaProvider.generateCompletion).not.toHaveBeenCalled();
      expect(mockOpenAIProvider.generateCompletion).toHaveBeenCalled();
    });

    it('should use Anthropic as initial provider when all others are disabled', async () => {
      // Arrange
      const taskType = 'seo';
      const input = 'Testisyöte';
      const anthropicModel = 'claude-3-opus-20240229';
      
      // Poistetaan muut käytöstä
      environment.useLocalModels = false;
      environment.useLMStudio = false;
      environment.useOllama = false;
      environment.useOpenAI = false;
      environment.providerPriorityArray = ['local', 'lmstudio', 'ollama', 'openai', 'anthropic'];
      
      mockModelSelector.getModel.mockReturnValue(anthropicModel);
      mockModelSelector.isLocalModel.mockReturnValue(false);
      mockModelSelector.isLMStudioModel.mockReturnValue(false);
      mockModelSelector.isOllamaModel.mockReturnValue(false);
      mockModelSelector.isOpenAIModel.mockReturnValue(false);
      mockModelSelector.isAnthropicModel.mockReturnValue(true);
      
      // Anthropic onnistuu
      mockAnthropicProvider.generateCompletion.mockResolvedValueOnce(
        mockProviderResults.successAnthropic()
      );
      
      // Act
      const result = await service.processAIRequestWithFallback(taskType, input);
      
      // Assert
      expect(result.result).toBe('Anthropic vastaus');
      expect(mockLocalProvider.generateCompletion).not.toHaveBeenCalled();
      expect(mockLMStudioProvider.generateCompletion).not.toHaveBeenCalled();
      expect(mockOllamaProvider.generateCompletion).not.toHaveBeenCalled();
      expect(mockOpenAIProvider.generateCompletion).not.toHaveBeenCalled();
      expect(mockAnthropicProvider.generateCompletion).toHaveBeenCalled();
    });

    it('should follow custom provider priority order', async () => {
      // Arrange
      const taskType = 'seo';
      const input = 'Testisyöte';
      const anthropicModel = 'claude-3-opus-20240229';
      
      // Muutetaan prioriteettijärjestystä - Anthropic ensin
      environment.providerPriorityArray = ['anthropic', 'openai', 'ollama', 'lmstudio', 'local'];
      
      mockModelSelector.getModel.mockReturnValue(anthropicModel);
      mockModelSelector.isLocalModel.mockReturnValue(false);
      mockModelSelector.isLMStudioModel.mockReturnValue(false);
      mockModelSelector.isOllamaModel.mockReturnValue(false);
      mockModelSelector.isOpenAIModel.mockReturnValue(false);
      mockModelSelector.isAnthropicModel.mockReturnValue(true);
      
      // Anthropic onnistuu
      mockAnthropicProvider.generateCompletion.mockResolvedValueOnce(
        mockProviderResults.successAnthropic()
      );
      
      // Act
      const result = await service.processAIRequestWithFallback(taskType, input);
      
      // Assert
      expect(result.result).toBe('Anthropic vastaus');
      expect(mockLocalProvider.generateCompletion).not.toHaveBeenCalled();
      expect(mockLMStudioProvider.generateCompletion).not.toHaveBeenCalled();
      expect(mockOllamaProvider.generateCompletion).not.toHaveBeenCalled();
      expect(mockOpenAIProvider.generateCompletion).not.toHaveBeenCalled();
      expect(mockAnthropicProvider.generateCompletion).toHaveBeenCalled();
    });

    it('should use the default provider (local) when no priority providers are available', async () => {
      // Arrange
      const taskType = 'seo';
      const input = 'Testisyöte';
      const localModel = 'mistral-7b-instruct-q8_0.gguf';

      // Tyhjä prioriteettilista
      environment.providerPriorityArray = [];
      
      mockModelSelector.getModel.mockReturnValue(localModel);
      mockModelSelector.isLocalModel.mockReturnValue(true);
      mockModelSelector.isLMStudioModel.mockReturnValue(false);
      mockModelSelector.isOllamaModel.mockReturnValue(false);
      mockModelSelector.isOpenAIModel.mockReturnValue(false);
      mockModelSelector.isAnthropicModel.mockReturnValue(false);
      
      // Local onnistuu
      mockLocalProvider.generateCompletion.mockResolvedValueOnce(
        mockProviderResults.successLocal()
      );
      
      // Act
      const result = await service.processAIRequestWithFallback(taskType, input);
      
      // Assert
      expect(result.result).toBe('Paikallisen mallin vastaus');
      expect(mockLocalProvider.generateCompletion).toHaveBeenCalled();
      expect(mockLMStudioProvider.generateCompletion).not.toHaveBeenCalled();
      expect(mockOllamaProvider.generateCompletion).not.toHaveBeenCalled();
      expect(mockOpenAIProvider.generateCompletion).not.toHaveBeenCalled();
      expect(mockAnthropicProvider.generateCompletion).not.toHaveBeenCalled();
    });
  });

  describe('tryNextProvider error handling edge cases', () => {
    beforeEach(() => {
      environment.useLocalModels = true;
      environment.useLMStudio = true;
      environment.useOllama = true;
      environment.useOpenAI = true;
      environment.useAnthropic = true;
      environment.providerPriorityArray = ['local', 'lmstudio', 'ollama', 'openai', 'anthropic'];
    });

    it('should handle LMStudio provider errors correctly', async () => {
      // Arrange
      const taskType = 'translation';
      const input = 'TEST_ERROR:lmstudio';
      
      // Testi käsittelee erityisesti virheitä, jotka simuloidaan LMStudio-palveluntarjoajalle
      mockModelSelector.getModel.mockReturnValue('mistral-7b-instruct-v0.2');
      mockModelSelector.isLocalModel.mockReturnValue(false);
      mockModelSelector.isLMStudioModel.mockReturnValue(true);
      
      // Local epäonnistuu ensin (kuten fallback-logiikassa on tarkoitus)
      mockLocalProvider.generateCompletion.mockRejectedValueOnce(new Error('Paikallinen malli epäonnistui'));
      
      // LMStudio epäonnistuu
      mockLMStudioProvider.generateCompletion.mockRejectedValueOnce(new Error('LMStudio virhe'));
      
      // Ollama onnistuu
      mockOllamaProvider.generateCompletion.mockResolvedValueOnce(
        mockProviderResults.successOllama()
      );
      
      // Act
      const result = await service.processAIRequestWithFallback(taskType, input);
      
      // Assert
      expect(result.result).toBe('Ollama vastaus');
      expect(mockLocalProvider.generateCompletion).toHaveBeenCalled();
      expect(mockLMStudioProvider.generateCompletion).toHaveBeenCalled();
      expect(mockOllamaProvider.generateCompletion).toHaveBeenCalled();
      expect(mockOpenAIProvider.generateCompletion).not.toHaveBeenCalled();
      expect(mockAnthropicProvider.generateCompletion).not.toHaveBeenCalled();
    });

    it('should handle Ollama provider errors correctly', async () => {
      // Arrange
      const taskType = 'translation';
      const input = 'TEST_ERROR:ollama';
      
      // Testi käsittelee erityisesti virheitä, jotka simuloidaan Ollama-palveluntarjoajalle
      mockModelSelector.getModel.mockReturnValue('mistral');
      mockModelSelector.isLocalModel.mockReturnValue(false);
      mockModelSelector.isLMStudioModel.mockReturnValue(false);
      mockModelSelector.isOllamaModel.mockReturnValue(true);
      
      // Local ja LMStudio epäonnistuvat ensin
      mockLocalProvider.generateCompletion.mockRejectedValueOnce(new Error('Paikallinen malli epäonnistui'));
      mockLMStudioProvider.generateCompletion.mockRejectedValueOnce(new Error('LMStudio epäonnistui'));
      
      // Ollama epäonnistuu virheen simuloinnin takia
      mockOllamaProvider.generateCompletion.mockRejectedValueOnce(new Error('Ollama virhe'));
      
      // OpenAI onnistuu
      mockOpenAIProvider.generateCompletion.mockResolvedValueOnce(
        mockProviderResults.successOpenAI()
      );
      
      // Act
      const result = await service.processAIRequestWithFallback(taskType, input);
      
      // Assert
      expect(result.result).toBe('OpenAI vastaus');
      expect(mockLocalProvider.generateCompletion).toHaveBeenCalled();
      expect(mockLMStudioProvider.generateCompletion).toHaveBeenCalled();
      expect(mockOllamaProvider.generateCompletion).toHaveBeenCalled();
      expect(mockOpenAIProvider.generateCompletion).toHaveBeenCalled();
      expect(mockAnthropicProvider.generateCompletion).not.toHaveBeenCalled();
    });

    it('should handle OpenAI provider errors correctly', async () => {
      // Arrange
      const taskType = 'translation';
      const input = 'TEST_ERROR:openai';
      
      // Testi käsittelee erityisesti virheitä, jotka simuloidaan OpenAI-palveluntarjoajalle
      mockModelSelector.getModel.mockReturnValue('gpt-4-turbo');
      mockModelSelector.isLocalModel.mockReturnValue(false);
      mockModelSelector.isLMStudioModel.mockReturnValue(false);
      mockModelSelector.isOllamaModel.mockReturnValue(false);
      mockModelSelector.isOpenAIModel.mockReturnValue(true);
      
      // Kaikki aiemmat palveluntarjoajat epäonnistuvat
      mockLocalProvider.generateCompletion.mockRejectedValueOnce(new Error('Paikallinen malli epäonnistui'));
      mockLMStudioProvider.generateCompletion.mockRejectedValueOnce(new Error('LMStudio epäonnistui'));
      mockOllamaProvider.generateCompletion.mockRejectedValueOnce(new Error('Ollama epäonnistui'));
      
      // OpenAI epäonnistuu virheen simuloinnin takia
      mockOpenAIProvider.generateCompletion.mockRejectedValueOnce(new Error('OpenAI virhe'));
      
      // Anthropic onnistuu
      mockAnthropicProvider.generateCompletion.mockResolvedValueOnce(
        mockProviderResults.successAnthropic()
      );
      
      // Act
      const result = await service.processAIRequestWithFallback(taskType, input);
      
      // Assert
      expect(result.result).toBe('Anthropic vastaus');
      expect(mockLocalProvider.generateCompletion).toHaveBeenCalled();
      expect(mockLMStudioProvider.generateCompletion).toHaveBeenCalled();
      expect(mockOllamaProvider.generateCompletion).toHaveBeenCalled();
      expect(mockOpenAIProvider.generateCompletion).toHaveBeenCalled();
      expect(mockAnthropicProvider.generateCompletion).toHaveBeenCalled();
    });

    it('should handle Anthropic provider errors correctly and then return error object when all providers fail', async () => {
      // Arrange
      const taskType = 'translation';
      const input = 'TEST_ERROR:anthropic';
      
      // Testi käsittelee erityisesti virheitä, jotka simuloidaan Anthropic-palveluntarjoajalle
      mockModelSelector.getModel.mockReturnValue('claude-3-opus-20240229');
      mockModelSelector.isLocalModel.mockReturnValue(false);
      mockModelSelector.isLMStudioModel.mockReturnValue(false);
      mockModelSelector.isOllamaModel.mockReturnValue(false);
      mockModelSelector.isOpenAIModel.mockReturnValue(false);
      mockModelSelector.isAnthropicModel.mockReturnValue(true);
      
      // Kaikki palveluntarjoajat epäonnistuvat
      mockLocalProvider.generateCompletion.mockRejectedValueOnce(new Error('Paikallinen malli epäonnistui'));
      mockLMStudioProvider.generateCompletion.mockRejectedValueOnce(new Error('LMStudio epäonnistui'));
      mockOllamaProvider.generateCompletion.mockRejectedValueOnce(new Error('Ollama epäonnistui'));
      mockOpenAIProvider.generateCompletion.mockRejectedValueOnce(new Error('OpenAI epäonnistui'));
      mockAnthropicProvider.generateCompletion.mockRejectedValueOnce(new Error('Anthropic virhe'));
      
      // Act & Assert
      const result = await service.processAIRequestWithFallback(taskType, input);
      
      // Assert
      expect(result).toHaveProperty('error', true);
      expect(result.message).toContain('Kaikki AI-palvelut epäonnistuivat');
      expect(result).toHaveProperty('details');
      expect(mockLocalProvider.generateCompletion).toHaveBeenCalled();
      expect(mockLMStudioProvider.generateCompletion).toHaveBeenCalled();
      expect(mockOllamaProvider.generateCompletion).toHaveBeenCalled();
      expect(mockOpenAIProvider.generateCompletion).toHaveBeenCalled();
      expect(mockAnthropicProvider.generateCompletion).toHaveBeenCalled();
    });

    it('should handle disabled and undefined providers correctly during fallback and return error object', async () => {
      // Arrange
      const taskType = 'translation';
      const input = 'TEST_ERROR:undefined_providers';
      
      // Poistetaan kaikki palveluntarjoajat paitsi OpenAI
      environment.useLocalModels = false;
      environment.useLMStudio = false;
      environment.useOllama = false;
      environment.useAnthropic = false;
      
      // Aseta OpenAI käytettäväksi
      environment.useOpenAI = true;
      
      // Lisäksi asetetaan jotkut providerit undefined-arvoisiksi
      service = new AIGateway(
        mockModelSelector as any,
        undefined, // localProvider
        mockOpenAIProvider as any,
        undefined, // anthropicProvider
        undefined, // lmstudioProvider
        undefined  // ollamaProvider
      );
      
      // OpenAI epäonnistuu
      mockOpenAIProvider.generateCompletion.mockRejectedValueOnce(new Error('OpenAI virhe'));
      
      // Act
      const result = await service.processAIRequestWithFallback(taskType, input);
      
      // Assert
      expect(result).toHaveProperty('error', true);
      expect(result.message).toContain('Kaikki AI-palvelut epäonnistuivat');
      expect(result).toHaveProperty('details');
      expect(mockLocalProvider.generateCompletion).not.toHaveBeenCalled();
      expect(mockLMStudioProvider.generateCompletion).not.toHaveBeenCalled();
      expect(mockOllamaProvider.generateCompletion).not.toHaveBeenCalled();
      expect(mockOpenAIProvider.generateCompletion).toHaveBeenCalled();
      expect(mockAnthropicProvider.generateCompletion).not.toHaveBeenCalled();
    });
  });
});
