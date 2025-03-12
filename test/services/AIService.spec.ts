import { Test, TestingModule } from '@nestjs/testing';
import { AIService } from '../../src/services/AIService';
import { ModelSelector } from '../../src/services/ModelSelector';
import { AIGateway } from '../../src/services/AIGateway';
import { MockLogger } from '../test-utils';

jest.mock('../../src/services/ModelSelector');
jest.mock('../../src/services/AIGateway');

describe('AIService - Paikalliset ja fallback-mallit', () => {
    let aiService: AIService;
    let mockModelSelector: jest.Mocked<ModelSelector>;
    let mockAIGateway: jest.Mocked<AIGateway>;
    let mockLogger: MockLogger;

    beforeEach(async () => {
        mockLogger = new MockLogger();
        mockModelSelector = new ModelSelector() as jest.Mocked<ModelSelector>;
        mockAIGateway = new AIGateway(mockModelSelector) as jest.Mocked<AIGateway>;
        
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

    test('Käyttää ensisijaisesti paikallista LM Studio -mallia', async () => {
        // Mockataan getModel palauttamaan LM Studio -mallin
        mockModelSelector.getModel = jest.fn().mockReturnValue('LMStudio-Model-1');
        
        // Mockataan getModelInfo palauttamaan mallin tiedot
        mockModelSelector.getModelInfo = jest.fn().mockReturnValue({
            name: 'LMStudio-Model-1',
            provider: 'lmstudio',
            model: 'LMStudio-Model-1',
            capabilities: ['text-generation'],
            contextLength: 8192
        });

        // Mockataan AI-vastaus
        mockAIGateway.processAIRequest = jest.fn().mockResolvedValue({
            result: 'SEO analyysi tässä',
            model: 'LMStudio-Model-1'
        });

        // Suoritetaan SEO-analyysi
        const result = await aiService.analyzeSEO({ title: 'Test' });

        // Tarkistetaan, että käytettiin LM Studio -mallia
        expect(mockAIGateway.processAIRequest).toHaveBeenCalledWith(
            'seo',
            expect.any(String),
            'LMStudio-Model-1'
        );
        
        // Tarkistetaan, että tulos on odotettu
        expect(result).toEqual({
            result: 'SEO analyysi tässä',
            model: 'LMStudio-Model-1'
        });
    });

    test('Siirtyy OLLAMA:an, jos LM Studio epäonnistuu', async () => {
        // Mockataan getModel palauttamaan ensin LM Studio -mallin ja sitten Ollama-mallin
        mockModelSelector.getModel = jest.fn()
            .mockReturnValueOnce('LMStudio-Model-1')
            .mockReturnValueOnce('Ollama-Model-1');
        
        // Mockataan getModelInfo palauttamaan mallin tiedot
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

        // Mockataan AI-vastaukset: LM Studio epäonnistuu, Ollama onnistuu
        mockAIGateway.processAIRequest = jest.fn()
            .mockRejectedValueOnce(new Error('LM Studio Error'))
            .mockResolvedValueOnce({
                result: 'SEO analyysi Ollama-mallista',
                model: 'Ollama-Model-1'
            });

        // Suoritetaan SEO-analyysi
        const result = await aiService.analyzeSEO({ title: 'Test' });

        // Tarkistetaan, että kutsuttiin molempia malleja
        expect(mockAIGateway.processAIRequest).toHaveBeenCalledTimes(2);
        
        // Tarkistetaan, että ensin yritettiin LM Studiota
        expect(mockAIGateway.processAIRequest).toHaveBeenNthCalledWith(
            1,
            'seo',
            expect.any(String),
            'LMStudio-Model-1'
        );
        
        // Tarkistetaan, että sitten käytettiin Ollamaa
        expect(mockAIGateway.processAIRequest).toHaveBeenNthCalledWith(
            2,
            'seo',
            expect.any(String),
            'Ollama-Model-1'
        );
        
        // Tarkistetaan, että tulos on Ollama-mallista
        expect(result).toEqual({
            result: 'SEO analyysi Ollama-mallista',
            model: 'Ollama-Model-1'
        });
    });

    test('Siirtyy OpenAI:hin, jos LM Studio ja OLLAMA epäonnistuvat', async () => {
        // Mockataan getModel palauttamaan eri malleja järjestyksessä
        mockModelSelector.getModel = jest.fn()
            .mockReturnValueOnce('LMStudio-Model-1')
            .mockReturnValueOnce('Ollama-Model-1')
            .mockReturnValueOnce('gpt-4-turbo');
        
        // Mockataan getModelInfo palauttamaan mallin tiedot
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

        // Mockataan AI-vastaukset: LM Studio ja Ollama epäonnistuvat, OpenAI onnistuu
        mockAIGateway.processAIRequest = jest.fn()
            .mockRejectedValueOnce(new Error('LM Studio Error'))
            .mockRejectedValueOnce(new Error('OLLAMA Error'))
            .mockResolvedValueOnce({
                result: 'SEO analyysi OpenAI-mallista',
                model: 'gpt-4-turbo'
            });

        // Suoritetaan SEO-analyysi
        const result = await aiService.analyzeSEO({ title: 'Test' });

        // Tarkistetaan, että kutsuttiin kaikkia kolmea mallia
        expect(mockAIGateway.processAIRequest).toHaveBeenCalledTimes(3);
        
        // Tarkistetaan, että viimeiseksi käytettiin OpenAI:ta
        expect(mockAIGateway.processAIRequest).toHaveBeenNthCalledWith(
            3,
            'seo',
            expect.any(String),
            'gpt-4-turbo'
        );
        
        // Tarkistetaan, että tulos on OpenAI-mallista
        expect(result).toEqual({
            result: 'SEO analyysi OpenAI-mallista',
            model: 'gpt-4-turbo'
        });
    });

    test('Heittää virheen, jos kaikki mallit epäonnistuvat', async () => {
        // Mockataan getModel palauttamaan eri malleja järjestyksessä kaikille eri palveluntarjoajille
        mockModelSelector.getModel = jest.fn()
            .mockReturnValueOnce('LMStudio-Model-1')
            .mockReturnValueOnce('Ollama-Model-1')
            .mockReturnValueOnce('gpt-4-turbo')
            .mockReturnValueOnce('claude-3-opus')
            .mockReturnValueOnce('gemini-pro');
        
        // Mockataan getModelInfo palauttamaan mallin tiedot
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

        // Mockataan AI-vastaukset: kaikki mallit epäonnistuvat
        mockAIGateway.processAIRequest = jest.fn()
            .mockRejectedValueOnce(new Error('LM Studio Error'))
            .mockRejectedValueOnce(new Error('OLLAMA Error'))
            .mockRejectedValueOnce(new Error('OpenAI Error'))
            .mockRejectedValueOnce(new Error('Anthropic Error'))
            .mockRejectedValueOnce(new Error('Google Error'));

        // Suoritetaan SEO-analyysi ja odotetaan virhettä
        await expect(aiService.analyzeSEO({ title: 'Test' }))
            .rejects
            .toThrow('Kaikki mallit epäonnistuivat');

        // Tarkistetaan, että kutsuttiin kaikkia viittä mallia
        expect(mockAIGateway.processAIRequest).toHaveBeenCalledTimes(5);
        
        // Tarkistetaan, että virheloki sisältää kaikkien mallien virheet
        expect(mockLogger.logs.error.length).toBe(5);
    });

    test('Ohittaa mallit, joille getModelInfo palauttaa null', async () => {
        // Mockataan getModel palauttamaan eri malleja järjestyksessä
        mockModelSelector.getModel = jest.fn()
            .mockReturnValueOnce('LMStudio-Model-1')
            .mockReturnValueOnce('Ollama-Model-1');
        
        // Mockataan getModelInfo palauttamaan null ensimmäiselle mallille ja tiedot toiselle
        mockModelSelector.getModelInfo = jest.fn()
            .mockReturnValueOnce(null)
            .mockReturnValueOnce({
                name: 'Ollama-Model-1',
                provider: 'ollama',
                model: 'Ollama-Model-1',
                capabilities: ['text-generation'],
                contextLength: 8192
            });

        // Mockataan AI-vastaus onnistumaan Ollama-mallilla
        mockAIGateway.processAIRequest = jest.fn()
            .mockResolvedValueOnce({
                result: 'SEO analyysi Ollama-mallista',
                model: 'Ollama-Model-1'
            });

        // Suoritetaan SEO-analyysi
        const result = await aiService.analyzeSEO({ title: 'Test' });

        // Tarkistetaan, että kutsuttiin vain Ollama-mallia (ei LM Studiota, koska getModelInfo palautti null)
        expect(mockAIGateway.processAIRequest).toHaveBeenCalledTimes(1);
        
        // Tarkistetaan, että käytettiin Ollamaa
        expect(mockAIGateway.processAIRequest).toHaveBeenCalledWith(
            'seo',
            expect.any(String),
            'Ollama-Model-1'
        );
        
        // Tarkistetaan, että tulos on Ollama-mallista
        expect(result).toEqual({
            result: 'SEO analyysi Ollama-mallista',
            model: 'Ollama-Model-1'
        });
    });

    test('generateCode käyttää oikeaa promptia', async () => {
        // Mockataan getModel ja getModelInfo
        mockModelSelector.getModel = jest.fn().mockReturnValue('test-model');
        mockModelSelector.getModelInfo = jest.fn().mockReturnValue({
            name: 'test-model',
            provider: 'test-provider',
            model: 'test-model',
            capabilities: ['text-generation'],
            contextLength: 8192
        });

        // Mockataan AI-vastaus
        mockAIGateway.processAIRequest = jest.fn().mockResolvedValue({
            result: 'Generated code here',
            model: 'test-model'
        });

        // Suoritetaan generateCode oikeilla parametreilla
        await aiService.generateCode({
            language: 'typescript',
            description: 'Generate a React component'
        });

        // Tarkistetaan, että processAIRequest kutsuttiin oikealla task-parametrilla
        expect(mockAIGateway.processAIRequest).toHaveBeenCalledWith(
            'code',
            expect.any(String),
            'test-model'
        );

        // Tarkistetaan, että promptissa on annettu kieli ja kuvaus
        const promptArg = mockAIGateway.processAIRequest.mock.calls[0][1];
        expect(promptArg).toContain('typescript');
        expect(promptArg).toContain('Generate a React component');
    });
    
    test('generateCode käsittelee valinnaiset requirements-parametrit', async () => {
        // Mockataan getModel ja getModelInfo
        mockModelSelector.getModel = jest.fn().mockReturnValue('test-model');
        mockModelSelector.getModelInfo = jest.fn().mockReturnValue({
            name: 'test-model',
            provider: 'test-provider',
            model: 'test-model',
            capabilities: ['text-generation'],
            contextLength: 8192
        });

        // Mockataan AI-vastaus
        mockAIGateway.processAIRequest = jest.fn().mockResolvedValue({
            result: 'Generated code with requirements',
            model: 'test-model'
        });

        // Suoritetaan generateCode vaatimuksilla
        await aiService.generateCode({
            language: 'typescript',
            description: 'Generate a React component',
            requirements: ['Must use hooks', 'Must be responsive']
        });

        // Tarkistetaan, että promptissa on annetut vaatimukset
        const promptArg = mockAIGateway.processAIRequest.mock.calls[0][1];
        expect(promptArg).toContain('Must use hooks');
        expect(promptArg).toContain('Must be responsive');
    });

    test('makeDecision käyttää oikeaa promptia', async () => {
        // Mockataan getModel ja getModelInfo
        mockModelSelector.getModel = jest.fn().mockReturnValue('test-model');
        mockModelSelector.getModelInfo = jest.fn().mockReturnValue({
            name: 'test-model',
            provider: 'test-provider',
            model: 'test-model',
            capabilities: ['text-generation'],
            contextLength: 8192
        });

        // Mockataan AI-vastaus
        mockAIGateway.processAIRequest = jest.fn().mockResolvedValue({
            result: '{"decision": "yes", "reason": "test reason"}',
            model: 'test-model'
        });

        // Suoritetaan makeDecision oikeilla parametreilla
        await aiService.makeDecision({
            situation: 'Should I do this?',
            options: ['Yes', 'No', 'Maybe']
        });

        // Tarkistetaan, että processAIRequest kutsuttiin oikealla task-parametrilla
        expect(mockAIGateway.processAIRequest).toHaveBeenCalledWith(
            'decision',
            expect.any(String),
            'test-model'
        );

        // Tarkistetaan, että promptissa on annettu tilanne ja vaihtoehdot
        const promptArg = mockAIGateway.processAIRequest.mock.calls[0][1];
        expect(promptArg).toContain('Should I do this?');
        expect(promptArg).toContain('Yes');
        expect(promptArg).toContain('No');
        expect(promptArg).toContain('Maybe');
    });

    test('analyzeSEO käsittelee sekä pakolliset että valinnaiset parametrit', async () => {
        // Mockataan getModel ja getModelInfo
        mockModelSelector.getModel = jest.fn().mockReturnValue('test-model');
        mockModelSelector.getModelInfo = jest.fn().mockReturnValue({
            name: 'test-model',
            provider: 'test-provider',
            model: 'test-model',
            capabilities: ['text-generation'],
            contextLength: 8192
        });

        // Mockataan AI-vastaus
        mockAIGateway.processAIRequest = jest.fn().mockResolvedValue({
            result: 'SEO analysis result',
            model: 'test-model'
        });

        // Testataan vain pakollisella title-parametrilla
        await aiService.analyzeSEO({ title: 'Test Title' });
        let promptArg = mockAIGateway.processAIRequest.mock.calls[0][1];
        expect(promptArg).toContain('Test Title');
        expect(promptArg).not.toContain('Test Description');
        expect(promptArg).not.toContain('Test Content');

        // Nollataan mockit
        jest.clearAllMocks();
        mockAIGateway.processAIRequest = jest.fn().mockResolvedValue({
            result: 'SEO analysis result with all params',
            model: 'test-model'
        });

        // Testataan kaikilla parametreilla
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

    // Testataan virheellisiä syötteitä ja virhetilanteita
    test('analyzeSEO heittää virheen, jos title puuttuu', async () => {
        await expect(aiService.analyzeSEO({ description: 'Test Description' } as any))
            .rejects
            .toThrow();
    });
    
    test('processWithFallback käsittelee virheet oikein ja yrittää seuraavaa mallia', async () => {
        // Nollataan mockLogger
        mockLogger.clear();
        
        // Mockataan getModel palauttamaan eri malleja järjestyksessä
        mockModelSelector.getModel = jest.fn()
            .mockReturnValueOnce('model-1')
            .mockReturnValueOnce('model-2');
        
        // Mockataan getModelInfo palauttamaan mallin tiedot
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

        // Ensimmäinen kutsu epäonnistuu, toinen onnistuu
        mockAIGateway.processAIRequest = jest.fn()
            .mockRejectedValueOnce(new Error('Specific error message'))
            .mockResolvedValueOnce({
                result: 'Success from fallback model',
                model: 'model-2'
            });

        // Suoritetaan analysointi
        const result = await aiService.analyzeSEO({ title: 'Test Title' });

        // Tarkistetaan, että kutsuttiin molempia malleja
        expect(mockAIGateway.processAIRequest).toHaveBeenCalledTimes(2);
        
        // Tarkistetaan, että virhelokiin on tullut viesti
        expect(mockLogger.logs.error.length).toBeGreaterThan(0);
        
        // Tarkistetaan, että tulos on toisesta mallista
        expect(result).toEqual({
            result: 'Success from fallback model',
            model: 'model-2'
        });
    });
    
    test('processWithFallback käsittelee virheet oikein, kun kaikki mallit epäonnistuvat', async () => {
        // Nollataan mockLogger
        mockLogger.clear();
        
        // Mockataan getModel palauttamaan eri malleja järjestyksessä
        mockModelSelector.getModel = jest.fn()
            .mockReturnValue('test-model');
        
        // Mockataan getModelInfo palauttamaan mallin tiedot
        mockModelSelector.getModelInfo = jest.fn()
            .mockReturnValue({
                name: 'test-model',
                provider: 'test-provider',
                model: 'test-model',
                capabilities: ['text-generation'],
                contextLength: 8192
            });

        // Kaikki kutsut epäonnistuvat
        mockAIGateway.processAIRequest = jest.fn()
            .mockRejectedValue(new Error('Specific error message'));

        // Suoritetaan analysointi ja odotetaan virhettä
        await expect(aiService.analyzeSEO({ title: 'Test Title' }))
            .rejects
            .toThrow('Kaikki mallit epäonnistuivat');

        // Tarkistetaan, että virhelokiin on tullut viesti
        expect(mockLogger.logs.error.length).toBeGreaterThan(0);
    });
    
    test('processWithFallback käsittelee virheet oikein, kun mallitietoja ei löydy', async () => {
        // Mockataan getModel palauttamaan mallin nimen
        mockModelSelector.getModel = jest.fn()
            .mockReturnValue('test-model');
        
        // Mockataan getModelInfo palauttamaan null (mallia ei löydy)
        mockModelSelector.getModelInfo = jest.fn()
            .mockReturnValue(null);

        // Suoritetaan analysointi ja odotetaan virhettä
        await expect(aiService.analyzeSEO({ title: 'Test Title' }))
            .rejects
            .toThrow('Kaikki mallit epäonnistuivat');

        // Tarkistetaan, että varoitus kirjattiin lokiin
        expect(mockLogger.logs.warn.some(msg => 
            msg.includes('Ei löydetty mallia tehtävätyypille seo')
        )).toBeTruthy();
    });
    
    test('processWithFallback käsittelee virheet oikein, kun getModel palauttaa null', async () => {
        // Mockataan getModel palauttamaan null
        mockModelSelector.getModel = jest.fn()
            .mockReturnValue(null);

        // Suoritetaan analysointi ja odotetaan virhettä
        await expect(aiService.analyzeSEO({ title: 'Test Title' }))
            .rejects
            .toThrow('Kaikki mallit epäonnistuivat');

        // Tarkistetaan, että varoitus kirjattiin lokiin
        expect(mockLogger.logs.warn.some(msg => 
            msg.includes('Ei löydetty mallia tehtävätyypille seo')
        )).toBeTruthy();
    });
});
