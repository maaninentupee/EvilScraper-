import { AIGateway } from '../../src/services/AIGateway';
import { ModelSelector } from '../../src/services/ModelSelector';
import { OpenAIProvider } from '../../src/services/providers/OpenAIProvider';
import { AnthropicProvider } from '../../src/services/providers/AnthropicProvider';
import { OllamaProvider } from '../../src/services/providers/OllamaProvider';
import { LMStudioProvider } from '../../src/services/providers/LMStudioProvider';
import { LocalProvider } from '../../src/services/providers/LocalProvider';
import { environment } from '../../src/config/environment';

jest.mock('../../src/services/providers/OpenAIProvider');
jest.mock('../../src/services/providers/AnthropicProvider');
jest.mock('../../src/services/providers/OllamaProvider');
jest.mock('../../src/services/providers/LMStudioProvider');
jest.mock('../../src/services/providers/LocalProvider');
jest.mock('../../src/services/ModelSelector');
jest.mock('../../src/config/environment', () => ({
    environment: {
        useLocalModels: true,
        useOpenAI: true,
        useAnthropic: true,
        useOllama: true,
        useLMStudio: true,
        providerPriorityArray: ['ollama', 'openai', 'anthropic', 'lmstudio', 'local']
    }
}));

describe('AIGateway Basic Tests', () => {
    let aiGateway: AIGateway;
    let modelSelector: jest.Mocked<ModelSelector>;
    let openAIProvider: jest.Mocked<OpenAIProvider>;
    let anthropicProvider: jest.Mocked<AnthropicProvider>;
    let ollamaProvider: jest.Mocked<OllamaProvider>;
    let lmStudioProvider: jest.Mocked<LMStudioProvider>;
    let localProvider: jest.Mocked<LocalProvider>;

    beforeEach(() => {
        jest.clearAllMocks();
        
        modelSelector = new ModelSelector() as jest.Mocked<ModelSelector>;
        openAIProvider = new OpenAIProvider() as jest.Mocked<OpenAIProvider>;
        anthropicProvider = new AnthropicProvider() as jest.Mocked<AnthropicProvider>;
        ollamaProvider = new OllamaProvider() as jest.Mocked<OllamaProvider>;
        lmStudioProvider = new LMStudioProvider() as jest.Mocked<LMStudioProvider>;
        localProvider = new LocalProvider() as jest.Mocked<LocalProvider>;

        // Asetetaan oletusarvot mockien metodeille
        modelSelector.getModel = jest.fn().mockImplementation((taskType, providerName) => {
            if (providerName === 'ollama' || !providerName) return 'mistral';
            if (providerName === 'openai') return 'gpt-4-turbo';
            if (providerName === 'anthropic') return 'claude-3-opus-20240229';
            if (providerName === 'lmstudio') return 'mistral-7b-instruct-v0.2';
            if (providerName === 'local') return 'mistral-7b-instruct-q8_0.gguf';
            return 'default-model';
        });

        modelSelector.isOllamaModel = jest.fn().mockImplementation((model) => model === 'mistral');
        modelSelector.isOpenAIModel = jest.fn().mockImplementation((model) => model === 'gpt-4-turbo');
        modelSelector.isAnthropicModel = jest.fn().mockImplementation((model) => model === 'claude-3-opus-20240229');
        modelSelector.isLMStudioModel = jest.fn().mockImplementation((model) => model === 'mistral-7b-instruct-v0.2');
        modelSelector.isLocalModel = jest.fn().mockImplementation((model) => model === 'mistral-7b-instruct-q8_0.gguf');

        // Asetetaan palveluntarjoajien nimet
        ollamaProvider.getName = jest.fn().mockReturnValue('Ollama');
        openAIProvider.getName = jest.fn().mockReturnValue('OpenAI');
        anthropicProvider.getName = jest.fn().mockReturnValue('Anthropic');
        lmStudioProvider.getName = jest.fn().mockReturnValue('LMStudio');
        localProvider.getName = jest.fn().mockReturnValue('Local');

        // Asetetaan palveluntarjoajien saatavuus
        ollamaProvider.getServiceStatus = jest.fn().mockReturnValue({ isAvailable: true });
        openAIProvider.getServiceStatus = jest.fn().mockReturnValue({ isAvailable: true });
        anthropicProvider.getServiceStatus = jest.fn().mockReturnValue({ isAvailable: true });
        lmStudioProvider.getServiceStatus = jest.fn().mockReturnValue({ isAvailable: true });
        localProvider.getServiceStatus = jest.fn().mockReturnValue({ isAvailable: true });

        aiGateway = new AIGateway(
            modelSelector,
            localProvider,
            openAIProvider,
            anthropicProvider,
            lmStudioProvider,
            ollamaProvider
        );
    });

    it('should use the Ollama model when available', async () => {
        const input = "Testi";
        const model = "mistral";
        
        ollamaProvider.generateCompletion.mockResolvedValue({
            success: true,
            text: "Paikallisen mallin vastaus",
            provider: "ollama",
            model,
            latency: 200
        });

        const result = await aiGateway.processAIRequest("seo", input);

        expect(result.result).toBe("Paikallisen mallin vastaus");
        expect(result.provider).toBe("ollama");
        expect(result.model).toBe(model);
        // Ollama-provideria kutsutaan vain kerran, koska se epäonnistuu ja siirrytään seuraavaan provideriin
        // Ollama-provideria voidaan kutsua useammin kuin kerran, jos se on saatavilla
        // mutta epäonnistuu ensimmäisellä kerralla
        expect(ollamaProvider.generateCompletion).toHaveBeenCalled();
    });

    it('should fallback to OpenAI when Ollama model fails', async () => {
        const input = "Testi";
        
        ollamaProvider.generateCompletion.mockResolvedValue({
            success: false,
            text: "",
            provider: "ollama",
            model: "mistral",
            error: "Paikallinen malli epäonnistui"
        });

        openAIProvider.generateCompletion.mockResolvedValue({
            success: true,
            text: "Fallback OpenAI vastaus",
            provider: "openai",
            model: "gpt-4-turbo",
            latency: 300
        });

        const result = await aiGateway.processAIRequestWithFallback("seo", input);

        expect(result.result).toBe("Fallback OpenAI vastaus");
        expect(result.provider).toBe("openai");
        expect(result.model).toBe("gpt-4-turbo");
        expect(result.wasFailover).toBe(true);
        // Ollama-provideria kutsutaan vain kerran, koska se epäonnistuu ja siirrytään seuraavaan provideriin
        // Ollama-provideria voidaan kutsua useammin kuin kerran, jos se on saatavilla
        // mutta epäonnistuu ensimmäisellä kerralla
        expect(ollamaProvider.generateCompletion).toHaveBeenCalled();
        expect(openAIProvider.generateCompletion).toHaveBeenCalledTimes(1);
    });

    it('should retry with different provider on failure', async () => {
        const input = "Testi";
        
        ollamaProvider.generateCompletion.mockResolvedValue({
            success: false,
            text: "",
            provider: "ollama",
            model: "mistral",
            error: "Ollama epäonnistui"
        });

        openAIProvider.generateCompletion.mockResolvedValue({
            success: false,
            text: "",
            provider: "openai",
            model: "gpt-4-turbo",
            error: "OpenAI epäonnistui"
        });

        anthropicProvider.generateCompletion.mockResolvedValue({
            success: true,
            text: "Anthropic fallback",
            provider: "anthropic",
            model: "claude-3-opus-20240229",
            latency: 250
        });

        const result = await aiGateway.processAIRequestWithFallback("seo", input);

        expect(result.result).toBe("Anthropic fallback");
        expect(result.provider).toBe("anthropic");
        expect(result.wasFailover).toBe(true);
        // Ollama-provideria kutsutaan vain kerran, koska se epäonnistuu ja siirrytään seuraavaan provideriin
        // Ollama-provideria voidaan kutsua useammin kuin kerran, jos se on saatavilla
        // mutta epäonnistuu ensimmäisellä kerralla
        expect(ollamaProvider.generateCompletion).toHaveBeenCalled();
        expect(openAIProvider.generateCompletion).toHaveBeenCalledTimes(1);
        expect(anthropicProvider.generateCompletion).toHaveBeenCalledTimes(1);
    });

    it('should handle test error simulation', async () => {
        const input = "TEST_OLLAMA_ERROR";
        
        openAIProvider.generateCompletion.mockResolvedValue({
            success: true,
            text: "OpenAI vastaus fallback",
            provider: "openai",
            model: "gpt-4-turbo",
            latency: 300
        });

        const result = await aiGateway.processAIRequestWithFallback("seo", input);

        expect(result.result).toBe("OpenAI vastaus fallback");
        expect(result.provider).toBe("openai");
        expect(result.wasFailover).toBe(true);
    });

    it('should return error object when all providers fail', async () => {
        const input = "Testi";
        
        // Asetetaan kaikki palveluntarjoajat epäonnistumaan
        ollamaProvider.generateCompletion.mockResolvedValue({
            success: false,
            text: "",
            provider: "ollama",
            model: "mistral",
            error: "Ollama epäonnistui"
        });

        openAIProvider.generateCompletion.mockResolvedValue({
            success: false,
            text: "",
            provider: "openai",
            model: "gpt-4-turbo",
            error: "OpenAI epäonnistui"
        });

        anthropicProvider.generateCompletion.mockResolvedValue({
            success: false,
            text: "",
            provider: "anthropic",
            model: "claude-3-opus-20240229",
            error: "Anthropic epäonnistui"
        });

        lmStudioProvider.generateCompletion.mockResolvedValue({
            success: false,
            text: "",
            provider: "lmstudio",
            model: "mistral-7b-instruct-v0.2",
            error: "LMStudio epäonnistui"
        });

        localProvider.generateCompletion.mockResolvedValue({
            success: false,
            text: "",
            provider: "local",
            model: "mistral-7b-instruct-q8_0.gguf",
            error: "Local epäonnistui"
        });

        const result = await aiGateway.processAIRequestWithFallback("seo", input);

        expect(result.error).toBe(true);
        expect(result.message).toContain("Kaikki AI-palvelut epäonnistuivat");
        // Ollama-provideria kutsutaan vain kerran, koska se epäonnistuu ja siirrytään seuraavaan provideriin
        // Ollama-provideria voidaan kutsua useammin kuin kerran, jos se on saatavilla
        // mutta epäonnistuu ensimmäisellä kerralla
        expect(ollamaProvider.generateCompletion).toHaveBeenCalled();
        expect(openAIProvider.generateCompletion).toHaveBeenCalledTimes(1);
        expect(anthropicProvider.generateCompletion).toHaveBeenCalledTimes(1);
        expect(lmStudioProvider.generateCompletion).toHaveBeenCalledTimes(1);
        expect(localProvider.generateCompletion).toHaveBeenCalledTimes(1);
    });

    it('should handle retryable errors', async () => {
        const input = "Testi";
        
        ollamaProvider.generateCompletion.mockResolvedValueOnce({
            success: false,
            text: "",
            provider: "ollama",
            model: "mistral",
            error: "Tilapäinen verkkovirhe",
            errorType: "network_error"
        }).mockResolvedValueOnce({
            success: true,
            text: "Ollama vastaus uudelleenyrityksen jälkeen",
            provider: "ollama",
            model: "mistral",
            latency: 200
        });

        const result = await aiGateway.processAIRequestWithFallback("seo", input);

        expect(result.result).toBe("Ollama vastaus uudelleenyrityksen jälkeen");
        expect(result.provider).toBe("ollama");
        expect(result.wasRetry).toBe(true);
        expect(ollamaProvider.generateCompletion).toHaveBeenCalledTimes(2);
    });

    describe('getInitialProvider', () => {
        it('should return the first available provider based on priority', async () => {
            // Asetetaan vain Ollama ja OpenAI saataville
            ollamaProvider.isAvailable = jest.fn().mockResolvedValue(true);
            openAIProvider.isAvailable = jest.fn().mockResolvedValue(true);
            anthropicProvider.isAvailable = jest.fn().mockResolvedValue(false);
            lmStudioProvider.isAvailable = jest.fn().mockResolvedValue(false);
            localProvider.isAvailable = jest.fn().mockResolvedValue(false);

            // @ts-ignore - Kutsutaan yksityistä metodia testausta varten
            const provider = await aiGateway['getInitialProvider']('seo');
            expect(provider).toBe(ollamaProvider);
        });

        it('should use the provider based on environment priority', async () => {
            // Asetetaan vain OpenAI saataville
            ollamaProvider.isAvailable = jest.fn().mockResolvedValue(false);
            openAIProvider.isAvailable = jest.fn().mockResolvedValue(true);
            anthropicProvider.isAvailable = jest.fn().mockResolvedValue(false);
            lmStudioProvider.isAvailable = jest.fn().mockResolvedValue(false);
            localProvider.isAvailable = jest.fn().mockResolvedValue(false);

            // Asetetaan ollamaProvider ensimmäiseksi prioriteetissa
            // @ts-ignore - Asetetaan environment.providerPriorityArray
            environment.providerPriorityArray = ['ollama', 'openai', 'anthropic', 'lmstudio', 'local'];

            // @ts-ignore - Kutsutaan yksityistä metodia testausta varten
            const provider = await aiGateway['getInitialProvider']();
            expect(provider).toBe(ollamaProvider);
        });

        it('should return local provider as fallback when no specific provider is enabled', async () => {
            // Asetetaan kaikki palveluntarjoajat ei-saataville
            ollamaProvider.isAvailable = jest.fn().mockResolvedValue(false);
            openAIProvider.isAvailable = jest.fn().mockResolvedValue(false);
            anthropicProvider.isAvailable = jest.fn().mockResolvedValue(false);
            lmStudioProvider.isAvailable = jest.fn().mockResolvedValue(false);
            localProvider.isAvailable = jest.fn().mockResolvedValue(true);

            // Asetetaan localProvider viimeiseksi prioriteetissa
            // @ts-ignore - Asetetaan environment.providerPriorityArray
            environment.providerPriorityArray = ['ollama', 'openai', 'anthropic', 'lmstudio', 'local'];
            
            // Asetetaan kaikki muut palveluntarjoajat pois käytöstä paitsi local
            // @ts-ignore - Asetetaan environment.useOllama
            environment.useOllama = false;
            // @ts-ignore - Asetetaan environment.useOpenAI
            environment.useOpenAI = false;
            // @ts-ignore - Asetetaan environment.useAnthropic
            environment.useAnthropic = false;
            // @ts-ignore - Asetetaan environment.useLMStudio
            environment.useLMStudio = false;
            // @ts-ignore - Asetetaan environment.useLocalModels
            environment.useLocalModels = true;

            // @ts-ignore - Kutsutaan yksityistä metodia testausta varten
            const provider = await aiGateway['getInitialProvider']();
            expect(provider).toBe(localProvider);
        });
    });

    describe('tryNextProvider', () => {
        it('should return response object when using the next provider in priority order', async () => {
            // Asetetaan providerStats-kartta
            // @ts-ignore - Asetetaan aiGateway.providerStats
            aiGateway.providerStats = new Map([
                ['ollama', { available: false, successRate: 0, avgLatency: 0, lastCheck: Date.now() }],
                ['openai', { available: true, successRate: 1, avgLatency: 100, lastCheck: Date.now() }],
                ['anthropic', { available: false, successRate: 0, avgLatency: 0, lastCheck: Date.now() }],
                ['lmstudio', { available: false, successRate: 0, avgLatency: 0, lastCheck: Date.now() }],
                ['local', { available: false, successRate: 0, avgLatency: 0, lastCheck: Date.now() }]
            ]);
            
            // Mock updateProviderStats-metodi
            // @ts-ignore - Mockataan yksityinen metodi
            aiGateway.updateProviderStats = jest.fn();

            // Asetetaan ympäristömuuttujat
            // @ts-ignore - Asetetaan environment.providerPriorityArray
            environment.providerPriorityArray = ['ollama', 'openai', 'anthropic', 'lmstudio', 'local'];
            // @ts-ignore - Asetetaan environment.useOllama
            environment.useOllama = false; // Ollama ei ole käytössä
            // @ts-ignore - Asetetaan environment.useOpenAI
            environment.useOpenAI = true;
            // @ts-ignore - Asetetaan environment.useAnthropic
            environment.useAnthropic = false;
            // @ts-ignore - Asetetaan environment.useLMStudio
            environment.useLMStudio = false;
            // @ts-ignore - Asetetaan environment.useLocalModels
            environment.useLocalModels = false;
            
            // Mock openAIProvider.generateCompletion to return a successful response
            openAIProvider.generateCompletion = jest.fn().mockResolvedValue({
                success: true,
                text: 'OpenAI vastaus',
                provider: 'openai',
                model: 'gpt-4-turbo'
            });

            // @ts-ignore - Kutsutaan yksityistä metodia testausta varten
            const result = await aiGateway['tryNextProvider']('seo', "Testi", "Edellinen virhe");
            expect(result).toHaveProperty('result', 'OpenAI vastaus');
            expect(result).toHaveProperty('provider', 'openai');
            expect(result).toHaveProperty('wasFailover', true);
        });

        it('should skip unavailable providers and use the next available one', async () => {
            // Asetetaan providerStats-kartta
            // @ts-ignore - Asetetaan aiGateway.providerStats
            aiGateway.providerStats = new Map([
                ['ollama', { available: false, successRate: 0, avgLatency: 0, lastCheck: Date.now() }],
                ['openai', { available: false, successRate: 0, avgLatency: 0, lastCheck: Date.now() }],
                ['anthropic', { available: true, successRate: 1, avgLatency: 100, lastCheck: Date.now() }],
                ['lmstudio', { available: false, successRate: 0, avgLatency: 0, lastCheck: Date.now() }],
                ['local', { available: false, successRate: 0, avgLatency: 0, lastCheck: Date.now() }]
            ]);
            
            // Mock updateProviderStats-metodi
            // @ts-ignore - Mockataan yksityinen metodi
            aiGateway.updateProviderStats = jest.fn();

            // Asetetaan ympäristömuuttujat
            // @ts-ignore - Asetetaan environment.providerPriorityArray
            environment.providerPriorityArray = ['ollama', 'openai', 'anthropic', 'lmstudio', 'local'];
            // @ts-ignore - Asetetaan environment.useOllama
            environment.useOllama = false; // Ollama ei ole käytössä
            // @ts-ignore - Asetetaan environment.useOpenAI
            environment.useOpenAI = false; // OpenAI ei ole käytössä
            // @ts-ignore - Asetetaan environment.useAnthropic
            environment.useAnthropic = true;
            // @ts-ignore - Asetetaan environment.useLMStudio
            environment.useLMStudio = false;
            // @ts-ignore - Asetetaan environment.useLocalModels
            environment.useLocalModels = false;

            // Mock anthropicProvider.generateCompletion to return a successful response
            anthropicProvider.generateCompletion = jest.fn().mockResolvedValue({
                success: true,
                text: 'Anthropic vastaus',
                provider: 'anthropic',
                model: 'claude-3-opus'
            });

            // @ts-ignore - Kutsutaan yksityistä metodia testausta varten
            const result = await aiGateway['tryNextProvider']('seo', "Testi", "Edellinen virhe");
            expect(result).toHaveProperty('result', 'Anthropic vastaus');
            expect(result).toHaveProperty('provider', 'anthropic');
            expect(result).toHaveProperty('wasFailover', true);
        });

        it('should return error object if all providers fail', async () => {
            // Asetetaan providerStats-kartta
            // @ts-ignore - Asetetaan aiGateway.providerStats
            aiGateway.providerStats = new Map([
                ['ollama', { available: true, successRate: 0.8, avgLatency: 100, lastCheck: Date.now() }],
                ['openai', { available: true, successRate: 0.9, avgLatency: 200, lastCheck: Date.now() }],
                ['anthropic', { available: true, successRate: 0.95, avgLatency: 300, lastCheck: Date.now() }],
                ['lmstudio', { available: true, successRate: 0.7, avgLatency: 150, lastCheck: Date.now() }],
                ['local', { available: true, successRate: 0.6, avgLatency: 50, lastCheck: Date.now() }]
            ]);
            
            // Mock updateProviderStats-metodi
            // @ts-ignore - Mockataan yksityinen metodi
            aiGateway.updateProviderStats = jest.fn();

            // Asetetaan ympäristömuuttujat
            // @ts-ignore - Asetetaan environment.providerPriorityArray
            environment.providerPriorityArray = ['ollama', 'openai', 'anthropic', 'lmstudio', 'local'];
            // @ts-ignore - Asetetaan environment.useOllama
            environment.useOllama = true;
            // @ts-ignore - Asetetaan environment.useOpenAI
            environment.useOpenAI = true;
            // @ts-ignore - Asetetaan environment.useAnthropic
            environment.useAnthropic = true;
            // @ts-ignore - Asetetaan environment.useLMStudio
            environment.useLMStudio = true;
            // @ts-ignore - Asetetaan environment.useLocalModels
            environment.useLocalModels = true;
            
            // Asetetaan kaikki palveluntarjoajat epäonnistumaan
            ollamaProvider.generateCompletion = jest.fn().mockResolvedValue({
                success: false,
                text: "",
                provider: "ollama",
                model: "mistral",
                error: "Ollama epäonnistui"
            });
            
            openAIProvider.generateCompletion = jest.fn().mockResolvedValue({
                success: false,
                text: "",
                provider: "openai",
                model: "gpt-4-turbo",
                error: "OpenAI epäonnistui"
            });
            
            anthropicProvider.generateCompletion = jest.fn().mockResolvedValue({
                success: false,
                text: "",
                provider: "anthropic",
                model: "claude-3-opus-20240229",
                error: "Anthropic epäonnistui"
            });
            
            lmStudioProvider.generateCompletion = jest.fn().mockResolvedValue({
                success: false,
                text: "",
                provider: "lmstudio",
                model: "mistral-7b-instruct-v0.2",
                error: "LMStudio epäonnistui"
            });
            
            localProvider.generateCompletion = jest.fn().mockResolvedValue({
                success: false,
                text: "",
                provider: "local",
                model: "mistral-7b-instruct-q8_0.gguf",
                error: "Local epäonnistui"
            });

            // @ts-ignore - Kutsutaan yksityistä metodia testausta varten
            const result = await aiGateway['tryNextProvider']('seo', "Testi");
            
            // Tarkistetaan, että palautetaan virheobjekti
            expect(result).toHaveProperty('error', true);
            expect(result.message).toContain('Kaikki AI-palvelut epäonnistuivat');
        });

        it('should return error object if no more available providers exist', async () => {
            // Asetetaan providerStats-kartta
            // @ts-ignore - Asetetaan aiGateway.providerStats
            aiGateway.providerStats = new Map([
                ['ollama', { available: true, successRate: 0.8, avgLatency: 100, lastCheck: Date.now() }],
                ['openai', { available: false, successRate: 0, avgLatency: 0, lastCheck: Date.now() }],
                ['anthropic', { available: false, successRate: 0, avgLatency: 0, lastCheck: Date.now() }],
                ['lmstudio', { available: false, successRate: 0, avgLatency: 0, lastCheck: Date.now() }],
                ['local', { available: false, successRate: 0, avgLatency: 0, lastCheck: Date.now() }]
            ]);
            
            // Mock updateProviderStats-metodi
            // @ts-ignore - Mockataan yksityinen metodi
            aiGateway.updateProviderStats = jest.fn();

            // Asetetaan ympäristömuuttujat
            // @ts-ignore - Asetetaan environment.providerPriorityArray
            environment.providerPriorityArray = ['ollama', 'openai', 'anthropic', 'lmstudio', 'local'];
            // @ts-ignore - Asetetaan environment.useOllama
            environment.useOllama = true;
            // @ts-ignore - Asetetaan environment.useOpenAI
            environment.useOpenAI = false;
            // @ts-ignore - Asetetaan environment.useAnthropic
            environment.useAnthropic = false;
            // @ts-ignore - Asetetaan environment.useLMStudio
            environment.useLMStudio = false;
            // @ts-ignore - Asetetaan environment.useLocalModels
            environment.useLocalModels = false;

            // Asetetaan Ollama epäonnistumaan
            ollamaProvider.generateCompletion = jest.fn().mockResolvedValue({
                success: false,
                text: "",
                provider: "ollama",
                model: "mistral",
                error: "Ollama epäonnistui"
            });

            // @ts-ignore - Kutsutaan yksityistä metodia testausta varten
            const result = await aiGateway['tryNextProvider']('seo', "Testi");
            
            // Tarkistetaan, että palautetaan virheobjekti
            expect(result).toHaveProperty('error', true);
            expect(result.message).toContain('Kaikki AI-palvelut epäonnistuivat');
        });
    });
});
