import { Injectable, Logger } from '@nestjs/common';
import { AIGateway, AIResponse } from './AIGateway';
import { ProviderSelectionStrategy, SelectionStrategy } from './utils/ProviderSelectionStrategy';
import { ProviderHealthMonitor, ProviderHealth } from './ProviderHealthMonitor';
import { ErrorClassifier } from './utils/ErrorClassifier';

/**
 * Valinnat AIGatewayEnhancer-luokan käyttöön
 */
export interface EnhancedProcessingOptions {
    // Valintastrategia
    strategy?: SelectionStrategy;
    
    // Haluttu palveluntarjoaja
    preferredProvider?: string;
    
    // Käytetäänkö välimuistia
    cacheResults?: boolean;
    
    // Testitila
    testMode?: boolean;
    
    // Simuloitava virhetyyppi testitilassa
    testError?: string;
}

/**
 * Paranneltu AIGateway-luokka, joka tarjoaa älykkään fallback-mekanismin
 * ja muita parannuksia AI-pyyntöjen käsittelyyn
 */
@Injectable()
export class AIGatewayEnhancer {
    private readonly logger = new Logger(AIGatewayEnhancer.name);
    
    // Uudelleenyritysasetukset
    private readonly MAX_RETRIES = 3;
    private readonly RETRY_DELAY_MS = 500;
    
    constructor(
        private readonly aiGateway: AIGateway,
        private readonly selectionStrategy: ProviderSelectionStrategy,
        private readonly healthMonitor: ProviderHealthMonitor,
        private readonly errorClassifier: ErrorClassifier
    ) {}
    
    /**
     * Käsittelee AI-pyynnön älykkäällä fallback-mekanismilla
     * @param taskType Tehtävän tyyppi
     * @param input Käyttäjän syöte
     * @param options Valinnat
     * @returns AI-vastaus
     */
    public async processWithSmartFallback(
        taskType: string,
        input: string,
        options: EnhancedProcessingOptions = {}
    ): Promise<AIResponse> {
        try {
            const {
                strategy = SelectionStrategy.PRIORITY,
                preferredProvider,
                cacheResults = true,
                testMode = false,
                testError = null
            } = options;
            
            // Testitilassa simuloidaan virheitä
            if (testMode && testError) {
                this.logger.log(`Testitila: simuloidaan virhetyyppiä ${testError}`);
                return this.simulateError(testError, taskType);
            }
            
            // Tarkistetaan välimuistista, jos välimuistin käyttö on sallittu
            if (cacheResults) {
                const cachedResult = this.aiGateway.getCachedResult(taskType, input);
                if (cachedResult) {
                    this.logger.log(`Löydettiin välimuistista tulos pyynnölle "${input.substring(0, 30)}..."`);
                    return {
                        ...cachedResult,
                        fromCache: true
                    };
                }
            }
            
            // Valitaan palveluntarjoaja
            let providerName = preferredProvider;
            
            if (!providerName) {
                // Käytetään valintastrategiaa parhaan palveluntarjoajan valitsemiseen
                providerName = this.selectionStrategy.selectBestProvider(taskType, strategy);
                
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
            }
            
            // Haetaan mallin nimi
            const modelName = this.aiGateway.getModelNameForProvider(providerName, taskType);
            
            if (!modelName) {
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
            const result = await this.aiGateway.processAIRequest(taskType, input, modelName);
            const processingTime = Date.now() - startTime;
            
            // Jos pyyntö onnistui, palautetaan tulos
            if (result.success) {
                // Tallennetaan tulos välimuistiin, jos välimuistin käyttö on sallittu
                if (cacheResults) {
                    this.aiGateway.cacheResult(taskType, input, {
                        ...result,
                        processingTime
                    });
                }
                
                return {
                    ...result,
                    processingTime
                };
            }
            
            // Jos pyyntö epäonnistui, yritetään fallback-mekanismia
            this.logger.warn(`Palveluntarjoaja ${providerName} epäonnistui, yritetään fallback-mekanismia`);
            
            // Tarkistetaan, kannattaako yrittää uudelleen
            if (!this.errorClassifier.isRetryable(result.errorType)) {
                this.logger.warn(`Virhetyyppi ${result.errorType} ei ole uudelleenyritettävä, palautetaan virhe`);
                return result;
            }
            
            // Yritetään fallback-mekanismia
            return await this.handleFallback(taskType, input, providerName, options);
            
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
     * Käsittelee useita AI-pyyntöjä rinnakkain älykkäällä fallback-mekanismilla
     * @param taskType Tehtävän tyyppi
     * @param inputs Käyttäjän syötteet
     * @param options Valinnat
     * @returns AI-vastaukset
     */
    public async processBatchWithSmartFallback(
        taskType: string,
        inputs: string[],
        options: EnhancedProcessingOptions = {}
    ): Promise<AIResponse[]> {
        const results: AIResponse[] = [];
        
        // Käsitellään jokainen syöte rinnakkain
        const promises = inputs.map(async (input, index) => {
            try {
                const result = await this.processWithSmartFallback(taskType, input, options);
                return { index, result };
            } catch (error) {
                return {
                    index,
                    result: {
                        success: false,
                        error: `Virhe käsiteltäessä syötettä ${index}: ${error.message}`,
                        errorType: ErrorClassifier.ERROR_TYPES.UNKNOWN,
                        provider: 'none',
                        model: 'none'
                    }
                };
            }
        });
        
        // Odotetaan, että kaikki pyynnöt on käsitelty
        const processedResults = await Promise.all(promises);
        
        // Järjestetään tulokset alkuperäiseen järjestykseen
        processedResults.sort((a, b) => a.index - b.index);
        
        // Palautetaan tulokset
        return processedResults.map(item => item.result);
    }
    
    /**
     * Käsittelee fallback-mekanismin
     * @param taskType Tehtävän tyyppi
     * @param input Käyttäjän syöte
     * @param excludeProvider Poissuljettu palveluntarjoaja
     * @param options Valinnat
     * @returns AI-vastaus
     */
    private async handleFallback(
        taskType: string,
        input: string,
        excludeProvider: string,
        options: EnhancedProcessingOptions
    ): Promise<AIResponse> {
        const {
            strategy = SelectionStrategy.FALLBACK,
            cacheResults = true
        } = options;
        
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
                strategy
            );
            
            if (!providerName) {
                this.logger.error(`Ei löydy vaihtoehtoisia palveluntarjoajia uudelleenyritykselle ${retryCount + 1}`);
                continue;
            }
            
            this.logger.log(`Valittu vaihtoehtoinen palveluntarjoaja: ${providerName}`);
            
            try {
                // Haetaan mallin nimi
                const modelName = this.aiGateway.getModelNameForProvider(providerName, taskType);
                
                if (!modelName) {
                    this.logger.warn(`Mallia ei löydy palveluntarjoajalle ${providerName} ja tehtävätyypille ${taskType}`);
                    continue;
                }
                
                // Käsitellään pyyntö
                const startTime = Date.now();
                const result = await this.aiGateway.processAIRequest(taskType, input, modelName);
                const processingTime = Date.now() - startTime;
                
                if (result.success) {
                    // Tallennetaan tulos välimuistiin, jos välimuistin käyttö on sallittu
                    if (cacheResults) {
                        this.aiGateway.cacheResult(taskType, input, {
                            ...result,
                            processingTime,
                            wasFailover: true
                        });
                    }
                    
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
     * Simuloi virheitä testitilassa
     * @param errorType Virhetyyppi
     * @param taskType Tehtävän tyyppi
     * @returns AI-vastaus
     */
    private simulateError(errorType: string, taskType: string): AIResponse {
        const errorMessage = ErrorClassifier.getUserFriendlyErrorMessage(errorType);
        
        return {
            success: false,
            error: `Simuloitu virhe: ${errorMessage}`,
            errorType,
            provider: 'test',
            model: 'test',
            message: `Simuloitu virhe tehtävätyypille ${taskType}`
        };
    }
    
    /**
     * Palauttaa kaikki käytettävissä olevat palveluntarjoajat
     * @returns Palveluntarjoajien nimet
     */
    public getAvailableProviders(): string[] {
        return this.aiGateway.getAvailableProviders();
    }
    
    /**
     * Palauttaa kaikki käytettävissä olevat mallit
     * @returns Mallien nimet
     */
    public getAvailableModels(): Record<string, string[]> {
        return this.aiGateway.getAvailableModels();
    }
    
    /**
     * Palauttaa palveluntarjoajien terveystiedot
     * @returns Palveluntarjoajien terveystiedot
     */
    public getProvidersHealth(): Record<string, ProviderHealth> {
        // Muunnetaan Map-objekti tavalliseksi objektiksi
        const healthMap = this.healthMonitor.getAllProviderHealth();
        const result: Record<string, ProviderHealth> = {};
        
        for (const [name, health] of healthMap.entries()) {
            result[name] = health;
        }
        
        return result;
    }
    
    /**
     * Palauttaa palveluntarjoajat pisteytettynä
     * @param taskType Tehtävän tyyppi
     * @returns Palveluntarjoajat pisteytettynä
     */
    public getProvidersByScore(taskType: string): { provider: string; score: number }[] {
        // Määritellään pisteytys tehtävätyypin mukaan
        const scoreFunction = (health: ProviderHealth): number => {
            // Peruspisteet saatavuuden mukaan
            let score = health.available ? 100 : 0;
            
            // Lisäpisteet onnistumisprosentin mukaan
            score += health.successRate * 50;
            
            // Vähennetään pisteitä vasteajan mukaan (max 20 pistettä)
            const latencyPenalty = Math.min(20, health.averageLatency / 50);
            score -= latencyPenalty;
            
            return score;
        };
        
        // Haetaan palveluntarjoajat pisteytettynä
        const providers = this.healthMonitor.getProvidersByScore(scoreFunction);
        
        // Muunnetaan palveluntarjoajat haluttuun muotoon
        return providers.map(health => ({
            provider: health.name,
            score: scoreFunction(health)
        }));
    }
}
