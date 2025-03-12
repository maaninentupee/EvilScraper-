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
  
  // Tallenna alkuperäiset ympäristömuuttujat
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
    // Palauta alkuperäiset ympäristömuuttujat
    process.env = { ...originalEnv };
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    
    // Palauta alkuperäiset ympäristömuuttujat ennen jokaista testiä
    process.env = { ...originalEnv };
  });

  describe('AI-palveluiden yhteensopivuus', () => {
    it('should process AI request using Ollama', async () => {
      // Mock Ollama to succeed
      const ollamaSpy = jest.spyOn(ollamaProvider, 'generateCompletion').mockResolvedValue({
        text: 'Ollama vastaus',
        provider: 'ollama',
        model: 'mistral',
        success: true
      } as CompletionResult);
      
      jest.spyOn(ollamaProvider, 'isAvailable').mockResolvedValue(true);
      
      const response = await aiGateway.processAIRequest('seo', 'Analyze this page');
      
      expect(response.result).toBeDefined();
      expect(response.provider).toBe('ollama');
      expect(ollamaSpy).toHaveBeenCalled();
    });

    it('should failover to OpenAI if Ollama fails', async () => {
      // Mock Ollama to fail
      const ollamaSpy = jest.spyOn(ollamaProvider, 'generateCompletion').mockRejectedValue(new Error('Ollama error'));
      jest.spyOn(ollamaProvider, 'isAvailable').mockResolvedValue(true);
      
      // Mock OpenAI to succeed
      const openaiSpy = jest.spyOn(openaiProvider, 'generateCompletion').mockResolvedValue({
        text: 'OpenAI vastaus',
        provider: 'openai',
        model: 'gpt-4-turbo',
        success: true
      } as CompletionResult);
      jest.spyOn(openaiProvider, 'isAvailable').mockResolvedValue(true);
      
      const response = await aiGateway.processAIRequestWithFallback('seo', 'Analyze this page');
      
      expect(response.result).toBeDefined();
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
        text: 'Anthropic vastaus',
        provider: 'anthropic',
        model: 'claude-3-opus',
        success: true
      } as CompletionResult);
      jest.spyOn(anthropicProvider, 'isAvailable').mockResolvedValue(true);
      
      const response = await aiGateway.processAIRequestWithFallback('seo', 'Analyze this page');
      
      expect(response.result).toBeDefined();
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
        text: 'LM Studio vastaus',
        provider: 'lmstudio',
        model: 'mistral-7b-instruct-v0.2',
        success: true
      } as CompletionResult);
      jest.spyOn(lmstudioProvider, 'isAvailable').mockResolvedValue(true);
      
      const response = await aiGateway.processAIRequestWithFallback('seo', 'Analyze this page');
      
      expect(response.result).toBeDefined();
      expect(response.provider).toBe('lmstudio');
      expect(lmstudioSpy).toHaveBeenCalled();
    });
  });

  describe('API-avainten hallinta', () => {
    it('should handle missing OpenAI API key gracefully', async () => {
      // Poista OpenAI API-avain
      delete process.env.OPENAI_API_KEY;
      
      // Mock Ollama to fail
      jest.spyOn(ollamaProvider, 'generateCompletion').mockRejectedValue(new Error('Ollama error'));
      jest.spyOn(ollamaProvider, 'isAvailable').mockResolvedValue(true);
      
      // Mock OpenAI to fail with API key error
      jest.spyOn(openaiProvider, 'isAvailable').mockResolvedValue(false);
      
      // Mock Anthropic to succeed
      const anthropicSpy = jest.spyOn(anthropicProvider, 'generateCompletion').mockResolvedValue({
        text: 'Anthropic vastaus',
        provider: 'anthropic',
        model: 'claude-3-opus',
        success: true
      } as CompletionResult);
      jest.spyOn(anthropicProvider, 'isAvailable').mockResolvedValue(true);
      
      const response = await aiGateway.processAIRequestWithFallback('seo', 'Analyze this page');
      
      // Varmista, että OpenAI ohitettiin ja käytettiin Anthropicia
      expect(response.provider).toBe('anthropic');
      expect(anthropicSpy).toHaveBeenCalled();
    });

    it('should handle missing Anthropic API key gracefully', async () => {
      // Poista Anthropic API-avain
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
        text: 'LM Studio vastaus',
        provider: 'lmstudio',
        model: 'mistral-7b-instruct-v0.2',
        success: true
      } as CompletionResult);
      jest.spyOn(lmstudioProvider, 'isAvailable').mockResolvedValue(true);
      
      const response = await aiGateway.processAIRequestWithFallback('seo', 'Analyze this page');
      
      // Varmista, että Anthropic ohitettiin ja käytettiin LM Studiota
      expect(response.provider).toBe('lmstudio');
      expect(lmstudioSpy).toHaveBeenCalled();
    });

    it('should fail gracefully when API key is missing', async () => {
      // Aseta tyhjä OpenAI API-avain
      const originalKey = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = '';
      
      // Mockaa OpenAI model selector palauttamaan OpenAI-malli
      jest.spyOn(modelSelector, 'getModel').mockReturnValue('gpt-4-turbo');
      jest.spyOn(modelSelector, 'isOpenAIModel').mockReturnValue(true);
      
      // Mockaa OpenAI provider heittämään API key -virhe
      jest.spyOn(openaiProvider, 'generateCompletion').mockRejectedValue(new Error('OpenAI API key missing or invalid'));
      jest.spyOn(openaiProvider, 'isAvailable').mockResolvedValue(true);
      
      // Testaa että virhe heitetään oikein
      await expect(aiGateway.processAIRequest('seo', 'Analyze this page', 'gpt-4-turbo'))
        .rejects.toThrow(/API key missing/);
      
      // Palauta alkuperäinen API-avain
      process.env.OPENAI_API_KEY = originalKey;
    });
    
    it('should fallback when provider is unavailable due to missing API key', async () => {
      // Aseta tyhjä OpenAI API-avain ja varmista että isAvailable palauttaa false
      const originalKey = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = '';
      jest.spyOn(openaiProvider, 'isAvailable').mockResolvedValue(false);
      
      // Mockaa Ollama epäonnistumaan
      jest.spyOn(ollamaProvider, 'generateCompletion').mockRejectedValue(new Error('Ollama error'));
      jest.spyOn(ollamaProvider, 'isAvailable').mockResolvedValue(true);
      
      // Mockaa Anthropic onnistumaan
      const anthropicSpy = jest.spyOn(anthropicProvider, 'generateCompletion').mockResolvedValue({
        text: 'Anthropic vastaus fallback-tilanteessa',
        provider: 'anthropic',
        model: 'claude-3-opus',
        success: true
      } as CompletionResult);
      jest.spyOn(anthropicProvider, 'isAvailable').mockResolvedValue(true);
      
      const response = await aiGateway.processAIRequestWithFallback('seo', 'Analyze this page');
      
      // Varmista että käytettiin Anthropicia OpenAI:n sijaan
      expect(response.provider).toBe('anthropic');
      expect(anthropicSpy).toHaveBeenCalled();
      
      // Palauta alkuperäinen API-avain
      process.env.OPENAI_API_KEY = originalKey;
    });
  });

  describe('Eri tehtävätyyppien testaus', () => {
    it('should handle SEO analysis task correctly', async () => {
      // Mock AIGateway to return a specific response
      const aiGatewaySpy = jest.spyOn(aiGateway, 'processAIRequest').mockResolvedValue({
        result: 'SEO analyysi: Sivun otsikko on hyvä, mutta meta-kuvaus puuttuu.',
        provider: 'ollama',
        model: 'mistral',
        latency: 150,
        wasFailover: false
      });
      
      const response = await aiService.analyzeSEO({
        title: 'Testisivu',
        description: 'Tämä on testisivu',
        content: 'Sivun sisältö tässä'
      });
      
      expect(response.result).toContain('SEO analyysi');
      expect(aiGatewaySpy).toHaveBeenCalled();
    });

    it('should handle code generation task correctly', async () => {
      // Mock AIGateway to return a specific response
      const aiGatewaySpy = jest.spyOn(aiGateway, 'processAIRequest').mockResolvedValue({
        result: 'function fibonacci(n) {\n  if (n <= 1) return n;\n  return fibonacci(n-1) + fibonacci(n-2);\n}',
        provider: 'ollama',
        model: 'codellama-13b-instruct',
        latency: 150,
        wasFailover: false
      });
      
      const response = await aiService.generateCode({
        description: 'Luo fibonacci-funktio',
        language: 'javascript'
      });
      
      expect(response.result).toContain('function fibonacci');
      expect(aiGatewaySpy).toHaveBeenCalled();
    });

    it('should handle decision making task correctly', async () => {
      // Mock AIGateway to return a specific response
      const aiGatewaySpy = jest.spyOn(aiGateway, 'processAIRequest').mockResolvedValue({
        result: 'Käyttäjä haluaa tietää säätilan. Vastaa säätietoihin liittyvään kyselyyn.',
        provider: 'ollama',
        model: 'wizardlm-7b',
        latency: 150,
        wasFailover: false
      });
      
      const response = await aiService.makeDecision({
        situation: 'Millainen sää on tänään?',
        options: ['Vastaa säätietoihin', 'Kysy tarkennusta']
      });
      
      expect(response.result).toContain('säätietoihin');
      expect(aiGatewaySpy).toHaveBeenCalled();
    });
  });

  describe('Virheenkäsittely todellisissa tilanteissa', () => {
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
        text: 'OpenAI vastaus',
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
        text: 'OpenAI vastaus',
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
        text: 'OpenAI vastaus',
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
          errorType: 'rate_limit' // Tämä on tärkeä, koska AIGateway tarkistaa tämän
        } as CompletionResult)
        .mockResolvedValueOnce({
          text: 'Retry success',
          provider: 'openai',
          model: 'gpt-4-turbo',
          success: true
        } as CompletionResult);
      jest.spyOn(openaiProvider, 'isAvailable').mockResolvedValue(true);
      
      // Asetetaan OpenAI ensisijaiseksi palveluntarjoajaksi
      jest.spyOn(aiGateway as any, 'getInitialProvider').mockReturnValue(openaiProvider);
      jest.spyOn(aiGateway as any, 'getProviderName').mockReturnValue('openai');
      
      const response = await aiGateway.processAIRequestWithFallback('seo', 'Analyze this page');
      
      expect(response.result).toBe('Retry success');
      expect(response.provider).toBe('openai');
      expect(response.wasRetry).toBe(true); // Varmista että kyseessä oli uudelleenyritys
      expect(openaiSpy).toHaveBeenCalledTimes(2); // Varmista että kutsuttiin kahdesti
    });
  });
});
