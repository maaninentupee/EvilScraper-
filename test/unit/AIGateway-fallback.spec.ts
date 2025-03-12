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

describe('AIGateway - Fallback-mekanismi', () => {
    let aiGateway: AIGateway;
    let mockModelSelector: jest.Mocked<ModelSelector>;
    let mockLocalProvider: jest.Mocked<LocalProvider>;
    let mockOpenAIProvider: jest.Mocked<OpenAIProvider>;
    let mockAnthropicProvider: jest.Mocked<AnthropicProvider>;
    let mockLMStudioProvider: jest.Mocked<LMStudioProvider>;
    let mockOllamaProvider: jest.Mocked<OllamaProvider>;

    beforeEach(() => {
        // Luodaan mock-toteutukset kaikille palveluntarjoajille
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

        // Määritellään default-paluuarvot mockeille
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

        aiGateway = new AIGateway(
            mockModelSelector,
            mockLocalProvider,
            mockOpenAIProvider,
            mockAnthropicProvider,
            mockLMStudioProvider,
            mockOllamaProvider
        );
    });

    it('should use fallback when the primary provider fails', async () => {
        // Nollataan kaikki mockit ennen testin alkua
        jest.clearAllMocks();
        
        // Määritetään, että ensisijainen palveluntarjoaja (Local) epäonnistuu
        mockModelSelector.getModel.mockReturnValue('mistral-7b-instruct-q8_0.gguf');
        mockModelSelector.isLocalModel.mockReturnValue(true);

        // Local provider epäonnistuu
        mockLocalProvider.generateCompletion.mockResolvedValueOnce({
            success: false,
            text: '', // Tyhjä teksti virhetilanteessa
            provider: 'local',
            model: 'mistral-7b-instruct-q8_0.gguf',
            error: 'Local provider error'
        });

        // Määritetään, että Local provider palauttaa oikean vastauksen tryNextProvider-metodissa
        mockLocalProvider.generateCompletion.mockResolvedValueOnce({
            success: false,
            text: '', // Tyhjä teksti virhetilanteessa
            provider: 'local',
            model: 'mistral-7b-instruct-q8_0.gguf',
            error: 'Local provider error'
        });

        // OpenAI provider onnistuu
        mockOpenAIProvider.generateCompletion.mockResolvedValueOnce({
            success: true,
            text: 'OpenAI response',
            provider: 'openai',
            model: 'gpt-4-turbo'
        });

        // Kutsutaan fallback-mekanismia käyttävää metodia
        const result = await aiGateway.processAIRequestWithFallback('seo', 'Test input');

        // Varmistetaan, että tulos on odotettu
        expect(result).toEqual({
            result: 'OpenAI response',
            model: expect.any(String),
            latency: expect.any(Number),
            provider: 'openai',
            wasFailover: true
        });

        // Varmistetaan, että molempia providereita kutsuttiin
        expect(mockLocalProvider.generateCompletion).toHaveBeenCalled();
        expect(mockOpenAIProvider.generateCompletion).toHaveBeenCalled();
    });

    it('should try multiple fallbacks until finding a working provider', async () => {
        // Nollataan kaikki mockit ennen testin alkua
        jest.clearAllMocks();
        
        // Määritetään, että ensisijainen palveluntarjoaja (Local) epäonnistuu
        mockModelSelector.getModel.mockReturnValue('mistral-7b-instruct-q8_0.gguf');
        mockModelSelector.isLocalModel.mockReturnValue(true);

        // Local provider epäonnistuu
        mockLocalProvider.generateCompletion.mockResolvedValueOnce({
            success: false,
            text: '', // Tyhjä teksti virhetilanteessa
            provider: 'local',
            model: 'mistral-7b-instruct-q8_0.gguf',
            error: 'Local provider error'
        });

        // Määritetään, että Local provider palauttaa oikean vastauksen tryNextProvider-metodissa
        mockLocalProvider.generateCompletion.mockResolvedValueOnce({
            success: false,
            text: '', // Tyhjä teksti virhetilanteessa
            provider: 'local',
            model: 'mistral-7b-instruct-q8_0.gguf',
            error: 'Local provider error'
        });

        // OpenAI provider epäonnistuu
        mockOpenAIProvider.generateCompletion.mockResolvedValueOnce({
            success: false,
            text: '', // Tyhjä teksti virhetilanteessa
            provider: 'openai',
            model: 'gpt-4-turbo',
            error: 'OpenAI provider error'
        });

        // Anthropic provider onnistuu
        mockAnthropicProvider.generateCompletion.mockResolvedValueOnce({
            success: true,
            text: 'Anthropic response',
            provider: 'anthropic',
            model: 'claude-3-opus-20240229'
        });

        // Kutsutaan fallback-mekanismia käyttävää metodia
        const result = await aiGateway.processAIRequestWithFallback('seo', 'Test input');

        // Varmistetaan, että tulos on odotettu
        expect(result).toEqual({
            result: 'Anthropic response',
            model: expect.any(String),
            latency: expect.any(Number),
            provider: 'anthropic',
            wasFailover: true
        });

        // Varmistetaan, että kaikkia kolmea provideria kutsuttiin
        expect(mockLocalProvider.generateCompletion).toHaveBeenCalled();
        expect(mockOpenAIProvider.generateCompletion).toHaveBeenCalled();
        expect(mockAnthropicProvider.generateCompletion).toHaveBeenCalled();
    });

    it('should return error object when all providers fail', async () => {
        // Määritetään, että kaikki palveluntarjoajat epäonnistuvat
        mockModelSelector.getModel.mockReturnValue('gpt-4-turbo');
        
        // Reset all mocks to ensure clean state
        jest.clearAllMocks();
        
        // Local provider epäonnistuu aina
        mockLocalProvider.generateCompletion.mockImplementation(() => {
            return Promise.resolve({
                success: false,
                text: '', // Tyhjä teksti virhetilanteessa
                provider: 'local',
                model: 'mistral-7b-instruct-q8_0.gguf',
                error: 'Local provider error'
            });
        });

        // OpenAI provider epäonnistuu aina
        mockOpenAIProvider.generateCompletion.mockImplementation(() => {
            return Promise.resolve({
                success: false,
                text: '', // Tyhjä teksti virhetilanteessa
                provider: 'openai',
                model: 'gpt-4-turbo',
                error: 'OpenAI provider error'
            });
        });

        // Anthropic provider epäonnistuu aina
        mockAnthropicProvider.generateCompletion.mockImplementation(() => {
            return Promise.resolve({
                success: false,
                text: '', // Tyhjä teksti virhetilanteessa
                provider: 'anthropic',
                model: 'claude-3-opus-20240229',
                error: 'Anthropic provider error'
            });
        });

        // LMStudio provider epäonnistuu aina
        mockLMStudioProvider.generateCompletion.mockImplementation(() => {
            return Promise.resolve({
                success: false,
                text: '', // Tyhjä teksti virhetilanteessa
                provider: 'lmstudio',
                model: 'mistral-7b-instruct-v0.2',
                error: 'LM Studio provider error'
            });
        });

        // Ollama provider epäonnistuu aina
        mockOllamaProvider.generateCompletion.mockImplementation(() => {
            return Promise.resolve({
                success: false,
                text: '', // Tyhjä teksti virhetilanteessa
                provider: 'ollama',
                model: 'mistral',
                error: 'Ollama provider error'
            });
        });

        // Kutsutaan fallback-mekanismia käyttävää metodia
        const result = await aiGateway.processAIRequestWithFallback('seo', 'Test input');

        // Varmistetaan, että tulos on virhe-objekti
        expect(result).toHaveProperty('error', true);
        expect(result).toHaveProperty('message');
        expect(result.message).toContain('Kaikki AI-palvelut epäonnistuivat');
    });

    it('should skip unavailable providers during fallback', async () => {
        // Nollataan kaikki mockit ennen testin alkua
        jest.clearAllMocks();
        
        // Määritetään, että ensisijainen palveluntarjoaja (Local) epäonnistuu
        mockModelSelector.getModel.mockReturnValue('mistral-7b-instruct-q8_0.gguf');
        mockModelSelector.isLocalModel.mockReturnValue(true);

        // Asetetaan OpenAI provider ei-saatavilla tilaan ennen testin alkua
        // Tämä pitää tehdä ennen kuin AIGateway-luokka alustaa providerStats-mappia
        // Asetetaan suoraan AIGateway-luokan providerStats-mappiin
        aiGateway['providerStats'] = new Map([
            ['local', { successCount: 0, errorCount: 0, averageLatency: 0, lastUsed: null, lastError: null, available: true }],
            ['openai', { successCount: 2, errorCount: 3, averageLatency: 150, lastUsed: new Date(), lastError: new Date(), available: false }],
            ['anthropic', { successCount: 0, errorCount: 0, averageLatency: 0, lastUsed: null, lastError: null, available: true }],
            ['lmstudio', { successCount: 0, errorCount: 0, averageLatency: 0, lastUsed: null, lastError: null, available: true }],
            ['ollama', { successCount: 0, errorCount: 0, averageLatency: 0, lastUsed: null, lastError: null, available: true }]
        ]);

        // Local provider epäonnistuu
        mockLocalProvider.generateCompletion.mockResolvedValueOnce({
            success: false,
            text: '', // Tyhjä teksti virhetilanteessa
            provider: 'local',
            model: 'mistral-7b-instruct-q8_0.gguf',
            error: 'Local provider error'
        });
        
        // Local provider epäonnistuu tryNextProvider-metodissa
        mockLocalProvider.generateCompletion.mockResolvedValueOnce({
            success: false,
            text: '', // Tyhjä teksti virhetilanteessa
            provider: 'local',
            model: 'mistral-7b-instruct-q8_0.gguf',
            error: 'Local provider error'
        });

        // OpenAI provider ei ole saatavilla - tämä on jo asetettu providerStats-mappiin
        // Varmistetaan vielä, että getServiceStatus palauttaa oikean arvon
        mockOpenAIProvider.getServiceStatus.mockReturnValue({ 
            isAvailable: false,
            lastError: 'Service unavailable',
            lastErrorTime: new Date(),
            consecutiveFailures: 3,
            totalRequests: 5,
            successfulRequests: 2
        });

        // Anthropic provider onnistuu
        mockAnthropicProvider.generateCompletion.mockResolvedValueOnce({
            success: true,
            text: 'Anthropic response',
            provider: 'anthropic',
            model: 'claude-3-opus-20240229'
        });

        // Kutsutaan fallback-mekanismia käyttävää metodia
        const result = await aiGateway.processAIRequestWithFallback('seo', 'Test input');

        // Varmistetaan, että tulos on odotettu
        expect(result).toEqual({
            result: 'Anthropic response',
            model: expect.any(String),
            latency: expect.any(Number),
            provider: 'anthropic',
            wasFailover: true
        });

        // Varmistetaan, että Local provideria kutsuttiin, mutta OpenAI provideria ei
        expect(mockLocalProvider.generateCompletion).toHaveBeenCalled();
        expect(mockOpenAIProvider.generateCompletion).not.toHaveBeenCalled();
        expect(mockAnthropicProvider.generateCompletion).toHaveBeenCalled();
    });

    it('should retry with the same provider for retryable errors', async () => {
        // Nollataan kaikki mockit ennen testin alkua
        jest.clearAllMocks();
        
        // Määritetään, että ensisijainen palveluntarjoaja (Local) epäonnistuu verkkovirheeseen
        mockModelSelector.getModel.mockReturnValue('mistral-7b-instruct-q8_0.gguf');
        mockModelSelector.isLocalModel.mockReturnValue(true);

        // Local provider epäonnistuu verkkovirheeseen ensimmäisellä yrityksellä
        mockLocalProvider.generateCompletion.mockResolvedValueOnce({
            success: false,
            text: '', // Tyhjä teksti virhetilanteessa
            provider: 'local',
            model: 'mistral-7b-instruct-q8_0.gguf',
            error: 'Network error',
            errorType: 'network_error'
        });

        // Local provider onnistuu toisella yrityksellä
        mockLocalProvider.generateCompletion.mockResolvedValueOnce({
            success: true,
            text: 'Local response after retry',
            provider: 'local',
            model: 'mistral-7b-instruct-q8_0.gguf'
        });
        
        // Määritetään, että Local provider ei tule kutsutuksi kolmatta kertaa
        // Tämä on varmuuden vuoksi, jos tryNextProvider-metodi kutsutaan

        // Kutsutaan fallback-mekanismia käyttävää metodia
        const result = await aiGateway.processAIRequestWithFallback('seo', 'Test input');

        // Varmistetaan, että tulos on odotettu
        expect(result).toEqual({
            result: 'Local response after retry',
            model: expect.any(String),
            wasRetry: true,
            provider: 'local'
        });

        // Varmistetaan, että Local provideria kutsuttiin kahdesti
        expect(mockLocalProvider.generateCompletion).toHaveBeenCalledTimes(2);
        // Varmistetaan, että muita providereita ei kutsuttu
        expect(mockOpenAIProvider.generateCompletion).not.toHaveBeenCalled();
    });

    it('should handle test error simulation correctly', async () => {
        // Nollataan kaikki mockit ennen testin alkua
        jest.clearAllMocks();
        
        // Määritetään, että simuloidaan Local provider -virhettä
        const testInput = 'TEST_LOCAL_ERROR';
        mockModelSelector.getModel.mockReturnValue('mistral-7b-instruct-q8_0.gguf');

        // OpenAI provider onnistuu
        mockOpenAIProvider.generateCompletion.mockResolvedValueOnce({
            success: true,
            text: 'OpenAI response',
            provider: 'openai',
            model: 'gpt-4-turbo'
        });
        
        // Local provider ei tule kutsutuksi, koska se ohitetaan simuloidun virheen takia

        // Kutsutaan fallback-mekanismia käyttävää metodia
        const result = await aiGateway.processAIRequestWithFallback('seo', testInput);

        // Varmistetaan, että tulos on odotettu
        expect(result).toEqual({
            result: 'OpenAI response',
            model: expect.any(String),
            latency: expect.any(Number),
            provider: 'openai',
            wasFailover: true
        });

        // Varmistetaan, että Local provideria ei kutsuttu (simuloitu virhe ohitti sen)
        expect(mockLocalProvider.generateCompletion).not.toHaveBeenCalled();
        expect(mockOpenAIProvider.generateCompletion).toHaveBeenCalled();
    });
    
    it('should fallback to Anthropic if OpenAI fails', async () => {
        // Nollataan kaikki mockit ennen testin alkua
        jest.clearAllMocks();
        
        // Määritetään provider-prioriteetti
        (environment.providerPriorityArray as string[]) = ['openai', 'anthropic', 'local', 'lmstudio', 'ollama'];
        
        // Määritetään getInitialProvider-metodin palautusarvo
        const getInitialProviderSpy = jest.spyOn(aiGateway as any, 'getInitialProvider');
        getInitialProviderSpy.mockReturnValue(mockOpenAIProvider);
        
        // Määritetään getProviderName-metodin palautusarvo
        const getProviderNameSpy = jest.spyOn(aiGateway as any, 'getProviderName');
        getProviderNameSpy.mockReturnValue('openai');
        
        // Määritetään, että mallin nimi on gpt-4-turbo
        mockModelSelector.getModel.mockReturnValue('gpt-4-turbo');
        
        // Määritetään, että OpenAI epäonnistuu
        mockOpenAIProvider.generateCompletion.mockResolvedValueOnce({
            success: false,
            text: '', // Tyhjä teksti virhetilanteessa
            error: 'OpenAI failure',
            provider: 'openai',
            model: 'gpt-4-turbo'
        });
        
        // Määritetään tryNextProvider-metodin toiminta
        const tryNextProviderSpy = jest.spyOn(aiGateway as any, 'tryNextProvider');
        tryNextProviderSpy.mockImplementation(async () => {
            // Simuloidaan siirtyminen Anthropic-provideriin
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
        
        // Varmistetaan, että OpenAI provideria kutsuttiin kerran
        expect(mockOpenAIProvider.generateCompletion).toHaveBeenCalledTimes(1);
        
        // Varmistetaan, että tryNextProvider-metodia kutsuttiin
        expect(tryNextProviderSpy).toHaveBeenCalledWith('seo', 'Test input', 'OpenAI epäonnistui: OpenAI failure');
        
        // Palautetaan alkuperäiset metodit
        getInitialProviderSpy.mockRestore();
        getProviderNameSpy.mockRestore();
        tryNextProviderSpy.mockRestore();
    });
});
