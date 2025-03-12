import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProviderRegistry } from './providers/ProviderRegistry';
import { BaseProvider } from './providers/BaseProvider';
import { ProviderHealthMonitor } from './ProviderHealthMonitor';
import { ProviderSelectionStrategy, SelectionStrategy } from './utils/ProviderSelectionStrategy';
import { ErrorClassifier } from './utils/ErrorClassifier';
import { CompletionResult } from './providers/BaseProvider';

/**
 * AI-vastauksen rajapinta
 */
export interface AIResponse {
    success: boolean;
    text?: string;
    result?: string;
    error?: string;
    errorType?: string;
    provider: string;
    model: string;
    usedFallback?: boolean;
    fromCache?: boolean;
    processingTime?: number;
    wasFailover?: boolean;
    wasRetry?: boolean;
    message?: string;
    timestamp?: number;
}

/**
 * Virheluokka AI-palveluille
 */
export class AIServiceError extends Error {
    constructor(
        message: string,
        public readonly errorType: string,
        public readonly provider: string,
        public readonly model: string
    ) {
        super(message);
        this.name = 'AIServiceError';
    }
}

/**
 * Luokka, joka vastaa AI-pyyntöjen käsittelystä
 */
@Injectable()
export class AIGateway {
    private readonly logger = new Logger(AIGateway.name);
    
    // Välimuisti
    private readonly cache: Map<string, AIResponse> = new Map();
    private readonly CACHE_MAX_SIZE = 1000;
    private readonly CACHE_TTL_MS = 3600 * 1000; // 1 tunti
    
    // Uudelleenyritysasetukset
    private readonly MAX_RETRIES = 3;
    private readonly RETRY_DELAY_MS = 500;
    
    // Mallit eri tehtävätyypeille
    private readonly modelsByTaskType: Record<string, Record<string, string>> = {
        'text-generation': {
            'openai': 'gpt-4',
            'anthropic': 'claude-3-opus-20240229',
            'ollama': 'llama3',
            'lmstudio': 'openchat',
            'local': 'gpt4all'
        },
        'code-generation': {
            'openai': 'gpt-4',
            'anthropic': 'claude-3-opus-20240229',
            'ollama': 'codellama',
            'lmstudio': 'openchat',
            'local': 'gpt4all'
        },
        'decision-making': {
            'openai': 'gpt-4',
            'anthropic': 'claude-3-opus-20240229',
            'ollama': 'llama3',
            'lmstudio': 'openchat',
            'local': 'gpt4all'
        },
        'default': {
            'openai': 'gpt-3.5-turbo',
            'anthropic': 'claude-3-haiku-20240307',
            'ollama': 'llama3',
            'lmstudio': 'openchat',
            'local': 'gpt4all'
        }
    };
    
    constructor(
        private readonly providerRegistry: ProviderRegistry,
        private readonly configService: ConfigService,
        private readonly healthMonitor: ProviderHealthMonitor,
        private readonly selectionStrategy: ProviderSelectionStrategy,
        private readonly errorClassifier: ErrorClassifier
    ) {}
    
    /**
     * Käsittelee AI-pyynnön
     * @param taskType Tehtävän tyyppi
     * @param input Käyttäjän syöte
     * @param modelName Mallin nimi
     * @returns AI-vastaus
     */
    public async processAIRequest(
        taskType: string,
        input: string,
        modelName?: string
    ): Promise<AIResponse> {
        try {
            // Tarkistetaan välimuistista
            const cachedResult = this.getCachedResult(taskType, input);
            if (cachedResult) {
                this.logger.log(`Löydettiin välimuistista tulos pyynnölle "${input.substring(0, 30)}..."`);
                return {
                    ...cachedResult,
                    fromCache: true
                };
            }
            
            // Valitaan palveluntarjoaja
            const providerName = this.getInitialProvider(taskType);
            
            if (!providerName) {
                this.logger.error('Yhtään palveluntarjoajaa ei ole käytettävissä');
                return {
                    success: false,
                    error: 'Yhtään palveluntarjoajaa ei ole käytettävissä',
                    errorType: ErrorClassifier.ERROR_TYPES.PROVIDER_UNAVAILABLE,
                    provider: 'none',
                    model: 'none'
                };
            }
            
            // Haetaan palveluntarjoaja
            const provider = this.providerRegistry.getProvider(providerName);
            
            if (!provider) {
                this.logger.error(`Palveluntarjoajaa ${providerName} ei löydy`);
                return {
                    success: false,
                    error: `Palveluntarjoajaa ${providerName} ei löydy`,
                    errorType: ErrorClassifier.ERROR_TYPES.PROVIDER_UNAVAILABLE,
                    provider: 'none',
                    model: 'none'
                };
            }
            
            // Haetaan mallin nimi
            const model = modelName || this.getModelNameForProvider(providerName, taskType);
            
            if (!model) {
                this.logger.error(`Mallia ei löydy palveluntarjoajalle ${providerName} ja tehtävätyypille ${taskType}`);
                return {
                    success: false,
                    error: `Mallia ei löydy palveluntarjoajalle ${providerName} ja tehtävätyypille ${taskType}`,
                    errorType: ErrorClassifier.ERROR_TYPES.MODEL_UNAVAILABLE,
                    provider: providerName,
                    model: 'none'
                };
            }
            
            // Käsitellään pyyntö
            const startTime = Date.now();
            const result = await provider.generateCompletion({
                prompt: input,
                modelName: model
            });
            const processingTime = Date.now() - startTime;
            
            // Päivitetään palveluntarjoajan terveystiedot
            this.healthMonitor.updateProviderHealth(providerName, true, processingTime);
            
            // Tallennetaan tulos välimuistiin
            this.cacheResult(taskType, input, {
                success: true,
                text: result.text,
                provider: providerName,
                model,
                processingTime
            });
            
            return {
                success: true,
                text: result.text,
                provider: providerName,
                model,
                processingTime
            };
            
        } catch (error) {
            // Käsitellään virhe
            this.logger.error(`Virhe AI-pyynnön käsittelyssä: ${error.message}`);
            
            // Luokitellaan virhe
            const errorType = this.errorClassifier.classifyError(error.message);
            
            // Päivitetään palveluntarjoajan terveystiedot, jos virhe liittyy tiettyyn palveluntarjoajaan
            if (error instanceof AIServiceError) {
                this.healthMonitor.updateProviderHealth(error.provider, false, 0, errorType);
            }
            
            return {
                success: false,
                error: error.message,
                errorType,
                provider: error instanceof AIServiceError ? error.provider : 'unknown',
                model: error instanceof AIServiceError ? error.model : 'unknown'
            };
        }
    }
    
    /**
     * Käsittelee AI-pyynnön fallback-mekanismilla
     * @param taskType Tehtävän tyyppi
     * @param input Käyttäjän syöte
     * @returns AI-vastaus
     */
    public async processAIRequestWithFallback(
        taskType: string,
        input: string
    ): Promise<AIResponse> {
        try {
            // Tarkistetaan välimuistista
            const cachedResult = this.getCachedResult(taskType, input);
            if (cachedResult) {
                this.logger.log(`Löydettiin välimuistista tulos pyynnölle "${input.substring(0, 30)}..."`);
                return {
                    ...cachedResult,
                    fromCache: true
                };
            }
            
            // Valitaan ensisijainen palveluntarjoaja
            const initialProviderName = this.getInitialProvider(taskType);
            
            if (!initialProviderName) {
                this.logger.error('Yhtään palveluntarjoajaa ei ole käytettävissä');
                return {
                    success: false,
                    error: 'Yhtään palveluntarjoajaa ei ole käytettävissä',
                    errorType: ErrorClassifier.ERROR_TYPES.PROVIDER_UNAVAILABLE,
                    provider: 'none',
                    model: 'none'
                };
            }
            
            // Yritetään käyttää ensisijaista palveluntarjoajaa
            try {
                // Haetaan mallin nimi
                const modelName = this.getModelNameForProvider(initialProviderName, taskType);
                
                if (!modelName) {
                    this.logger.error(`Mallia ei löydy palveluntarjoajalle ${initialProviderName} ja tehtävätyypille ${taskType}`);
                    throw new AIServiceError(
                        `Mallia ei löydy palveluntarjoajalle ${initialProviderName} ja tehtävätyypille ${taskType}`,
                        ErrorClassifier.ERROR_TYPES.MODEL_UNAVAILABLE,
                        initialProviderName,
                        'none'
                    );
                }
                
                // Käsitellään pyyntö
                const startTime = Date.now();
                const result = await this.processAIRequest(taskType, input, modelName);
                const processingTime = Date.now() - startTime;
                
                if (result.success) {
                    return {
                        ...result,
                        processingTime
                    };
                }
                
                // Jos pyyntö epäonnistui, yritetään fallback-mekanismia
                this.logger.warn(`Palveluntarjoaja ${initialProviderName} epäonnistui, yritetään fallback-mekanismia`);
                
                // Tarkistetaan, kannattaako yrittää uudelleen
                if (!this.errorClassifier.isRetryable(result.errorType)) {
                    this.logger.warn(`Virhetyyppi ${result.errorType} ei ole uudelleenyritettävä, palautetaan virhe`);
                    return result;
                }
                
                // Yritetään fallback-mekanismia
                return await this.handleFallback(taskType, input, initialProviderName);
                
            } catch (error) {
                // Käsitellään virhe
                this.logger.warn(`Virhe palveluntarjoajalla ${initialProviderName}: ${error.message}`);
                
                // Yritetään fallback-mekanismia
                return await this.handleFallback(taskType, input, initialProviderName);
            }
            
        } catch (error) {
            // Käsitellään odottamattomat virheet
            this.logger.error(`Odottamaton virhe: ${error.message}`);
            
            return {
                success: false,
                error: `Odottamaton virhe: ${error.message}`,
                errorType: ErrorClassifier.ERROR_TYPES.UNKNOWN,
                provider: 'none',
                model: 'none'
            };
        }
    }
    
    /**
     * Käsittelee fallback-mekanismin
     * @param taskType Tehtävän tyyppi
     * @param input Käyttäjän syöte
     * @param excludeProvider Poissuljettu palveluntarjoaja
     * @returns AI-vastaus
     */
    private async handleFallback(
        taskType: string,
        input: string,
        excludeProvider: string
    ): Promise<AIResponse> {
        // Yritetään uudelleen eri palveluntarjoajilla
        for (let retryCount = 0; retryCount < this.MAX_RETRIES; retryCount++) {
            // Odotetaan ennen uudelleenyritystä
            if (retryCount > 0) {
                await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY_MS));
            }
            
            this.logger.log(`Yritetään fallback-mekanismia, yritys ${retryCount + 1}/${this.MAX_RETRIES}`);
            
            // Valitaan seuraava palveluntarjoaja
            const providerName = this.selectionStrategy.selectNextProvider(
                taskType,
                excludeProvider,
                'unknown',
                retryCount
            );
            
            if (!providerName) {
                this.logger.error(`Ei löydy vaihtoehtoisia palveluntarjoajia uudelleenyritykselle ${retryCount + 1}`);
                continue;
            }
            
            this.logger.log(`Valittu vaihtoehtoinen palveluntarjoaja: ${providerName}`);
            
            try {
                // Haetaan mallin nimi
                const modelName = this.getModelNameForProvider(providerName, taskType);
                
                if (!modelName) {
                    this.logger.warn(`Mallia ei löydy palveluntarjoajalle ${providerName} ja tehtävätyypille ${taskType}`);
                    continue;
                }
                
                // Käsitellään pyyntö
                const startTime = Date.now();
                const result = await this.processAIRequest(taskType, input, modelName);
                const processingTime = Date.now() - startTime;
                
                if (result.success) {
                    return {
                        ...result,
                        processingTime,
                        wasFailover: true
                    };
                }
                
                // Jos pyyntö epäonnistui, yritetään seuraavaa palveluntarjoajaa
                this.logger.warn(`Palveluntarjoaja ${providerName} epäonnistui, yritetään seuraavaa`);
                
            } catch (error) {
                // Käsitellään virhe
                this.logger.warn(`Virhe palveluntarjoajalla ${providerName}: ${error.message}`);
            }
        }
        
        // Jos kaikki yritykset epäonnistuivat, palautetaan virhe
        this.logger.error(`Kaikki ${this.MAX_RETRIES} uudelleenyritystä epäonnistuivat`);
        
        return {
            success: false,
            error: `Kaikki AI-palvelut epäonnistuivat tehtävätyypille ${taskType}`,
            errorType: ErrorClassifier.ERROR_TYPES.ALL_PROVIDERS_FAILED,
            provider: 'none',
            model: 'none',
            message: `Kaikki AI-palvelut epäonnistuivat tehtävätyypille ${taskType}`,
            wasFailover: true
        };
    }
    
    /**
     * Käsittelee useita AI-pyyntöjä rinnakkain
     * @param taskType Tehtävän tyyppi
     * @param inputs Käyttäjän syötteet
     * @returns AI-vastaukset
     */
    public async processBatchRequests(
        taskType: string,
        inputs: string[]
    ): Promise<AIResponse[]> {
        const results: AIResponse[] = [];
        
        for (const input of inputs) {
            try {
                const result = await this.processAIRequest(taskType, input);
                results.push(result);
            } catch (error) {
                results.push({
                    success: false,
                    error: error.message,
                    errorType: ErrorClassifier.ERROR_TYPES.UNKNOWN,
                    provider: 'unknown',
                    model: 'unknown'
                });
            }
        }
        
        return results;
    }
    
    /**
     * Palauttaa välimuistista tuloksen
     * @param taskType Tehtävän tyyppi
     * @param input Käyttäjän syöte
     * @returns AI-vastaus
     */
    public getCachedResult(taskType: string, input: string): AIResponse | null {
        const cacheKey = this.getCacheKey(taskType, input);
        const cachedResult = this.cache.get(cacheKey);
        
        if (cachedResult) {
            // Tarkistetaan, onko tulos vanhentunut
            const now = Date.now();
            const timestamp = cachedResult.timestamp;
            
            if (timestamp && now - timestamp > this.CACHE_TTL_MS) {
                // Poistetaan vanhentunut tulos
                this.cache.delete(cacheKey);
                return null;
            }
            
            return cachedResult;
        }
        
        return null;
    }
    
    /**
     * Tallentaa tuloksen välimuistiin
     * @param taskType Tehtävän tyyppi
     * @param input Käyttäjän syöte
     * @param result AI-vastaus
     */
    public cacheResult(taskType: string, input: string, result: AIResponse): void {
        // Tarkistetaan, onko välimuisti täynnä
        if (this.cache.size >= this.CACHE_MAX_SIZE) {
            // Poistetaan vanhin tulos
            let oldestKey: string = null;
            let oldestTimestamp = Infinity;
            
            for (const [key, value] of this.cache.entries()) {
                const timestamp = value.timestamp || 0;
                
                if (timestamp < oldestTimestamp) {
                    oldestTimestamp = timestamp;
                    oldestKey = key;
                }
            }
            
            if (oldestKey) {
                this.cache.delete(oldestKey);
            }
        }
        
        // Tallennetaan tulos välimuistiin
        const cacheKey = this.getCacheKey(taskType, input);
        
        this.cache.set(cacheKey, {
            ...result,
            timestamp: Date.now()
        });
    }
    
    /**
     * Palauttaa välimuistin avaimen
     * @param taskType Tehtävän tyyppi
     * @param input Käyttäjän syöte
     * @returns Välimuistin avain
     */
    private getCacheKey(taskType: string, input: string): string {
        return `${taskType}:${input}`;
    }
    
    /**
     * Palauttaa mallin nimen palveluntarjoajalle
     * @param providerName Palveluntarjoajan nimi
     * @param taskType Tehtävän tyyppi
     * @returns Mallin nimi
     */
    public getModelNameForProvider(providerName: string, taskType: string): string {
        const models = this.modelsByTaskType[taskType] || this.modelsByTaskType['default'];
        return models[providerName];
    }
    
    /**
     * Palauttaa ensisijaisen palveluntarjoajan
     * @param taskType Tehtävän tyyppi
     * @returns Palveluntarjoajan nimi
     */
    private getInitialProvider(taskType: string): string {
        return this.selectionStrategy.selectBestProvider(taskType);
    }
    
    /**
     * Palauttaa kaikki käytettävissä olevat palveluntarjoajat
     * @returns Palveluntarjoajien nimet
     */
    public getAvailableProviders(): string[] {
        return Array.from(this.providerRegistry.getAllProviders().keys());
    }
    
    /**
     * Palauttaa kaikki käytettävissä olevat mallit
     * @returns Mallien nimet
     */
    public getAvailableModels(): Record<string, string[]> {
        const result: Record<string, string[]> = {};
        
        for (const providerName of this.getAvailableProviders()) {
            result[providerName] = [];
            
            for (const taskType in this.modelsByTaskType) {
                const models = this.modelsByTaskType[taskType];
                const model = models[providerName];
                
                if (model && !result[providerName].includes(model)) {
                    result[providerName].push(model);
                }
            }
        }
        
        return result;
    }
}
