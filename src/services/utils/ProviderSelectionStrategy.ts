import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProviderRegistry } from '../providers/ProviderRegistry';
import { ProviderHealth, ProviderHealthMonitor } from '../ProviderHealthMonitor';
import { ProviderScoreUtils } from './ProviderScoreUtils';

/**
 * Palveluntarjoajan valintastrategia
 */
export enum SelectionStrategy {
    COST_OPTIMIZED = 'COST_OPTIMIZED',
    PRIORITY = 'PRIORITY',
    PERFORMANCE = 'PERFORMANCE',
    LOAD_BALANCED = 'LOAD_BALANCED',
    ROUND_ROBIN = 'ROUND_ROBIN',
    FALLBACK = 'FALLBACK'
}

/**
 * Luokka, joka vastaa palveluntarjoajien valinnasta eri strategioiden mukaan
 */
@Injectable()
export class ProviderSelectionStrategy {
    private readonly logger = new Logger(ProviderSelectionStrategy.name);
    
    // Palveluntarjoajien prioriteetit eri tehtävätyypeille
    private readonly providerPriorities: Record<string, Record<string, number>> = {
        'text-generation': {
            'anthropic': 90,
            'openai': 80,
            'ollama': 70,
            'lmstudio': 60,
            'local': 50
        },
        'code-generation': {
            'openai': 90,
            'anthropic': 80,
            'ollama': 70,
            'lmstudio': 60,
            'local': 50
        },
        'decision-making': {
            'openai': 90,
            'anthropic': 85,
            'ollama': 70,
            'lmstudio': 60,
            'local': 50
        },
        'default': {
            'openai': 80,
            'anthropic': 80,
            'ollama': 70,
            'lmstudio': 60,
            'local': 50
        }
    };
    
    // Viimeksi käytetty palveluntarjoaja round-robin-strategiaa varten
    private lastUsedProviderIndex: number = -1;
    
    constructor(
        private readonly providerRegistry: ProviderRegistry,
        private readonly configService: ConfigService,
        private readonly healthMonitor: ProviderHealthMonitor
    ) {}
    
    /**
     * Palauttaa palveluntarjoajien prioriteetit tehtävätyypin perusteella
     * @param taskType Tehtävätyyppi
     * @returns Prioriteettikartta
     */
    public getProviderPriority(taskType: string): Record<string, number> {
        return this.providerPriorities[taskType] || this.providerPriorities['default'];
    }
    
    /**
     * Valitsee parhaan palveluntarjoajan tehtävätyypin ja strategian perusteella
     * @param taskType Tehtävätyyppi
     * @param strategy Valintastrategia
     * @param retryCount Uudelleenyrityskertojen määrä
     * @returns Palveluntarjoajan nimi
     */
    public selectBestProvider(
        taskType: string, 
        strategy: SelectionStrategy = SelectionStrategy.PRIORITY,
        retryCount: number = 0,
        excludeProvider: string = null
    ): string {
        // Haetaan käytettävissä olevat palveluntarjoajat
        const allProviders = Array.from(this.providerRegistry.getAllProviders().keys());
        const availableProviders = excludeProvider 
            ? allProviders.filter(p => p !== excludeProvider)
            : allProviders;
        
        if (availableProviders.length === 0) {
            this.logger.warn('Yhtään palveluntarjoajaa ei ole käytettävissä');
            return null;
        }
        
        // Haetaan prioriteettikartta tehtävätyypin perusteella
        const priorityMap = this.getProviderPriority(taskType);
        
        // Järjestetään palveluntarjoajat strategian mukaan
        let rankedProviders: ProviderHealth[] = [];
        
        switch (strategy) {
            case SelectionStrategy.COST_OPTIMIZED:
                // Käytetään kustannusoptimointia
                // Kerätään palveluntarjoajat ja niiden terveystiedot
                const providers: ProviderHealth[] = [];
                
                for (const name of availableProviders) {
                    const health = this.healthMonitor.getProviderHealth(name);
                    
                    if (health) {
                        providers.push(health);
                    } else {
                        // Jos terveystietoja ei ole, luodaan oletusarvot
                        providers.push({
                            name,
                            available: true,
                            successRate: 1.0,
                            errorRate: 0.0,
                            averageLatency: 0,
                            recentRequests: 0,
                            recentErrors: 0,
                            lastUsed: null,
                            lastError: null
                        });
                    }
                }
                
                // Järjestetään palveluntarjoajat kustannusten mukaan
                rankedProviders = ProviderScoreUtils.rankProviders(
                    providers,
                    priorityMap,
                    retryCount
                );
                break;
                
            case SelectionStrategy.PERFORMANCE:
                // Käytetään suorituskykyä
                // Haetaan palveluntarjoajat ja järjestetään ne suorituskyvyn mukaan
                const performanceProviders: ProviderHealth[] = [];
                
                for (const name of availableProviders) {
                    const health = this.healthMonitor.getProviderHealth(name);
                    
                    if (health) {
                        performanceProviders.push(health);
                    } else {
                        // Jos terveystietoja ei ole, luodaan oletusarvot
                        performanceProviders.push({
                            name,
                            available: true,
                            successRate: 1.0,
                            errorRate: 0.0,
                            averageLatency: 0,
                            recentRequests: 0,
                            recentErrors: 0,
                            lastUsed: null,
                            lastError: null
                        });
                    }
                }
                
                // Järjestetään palveluntarjoajat suorituskyvyn mukaan
                rankedProviders = ProviderScoreUtils.rankProviders(
                    performanceProviders,
                    priorityMap,
                    retryCount
                );
                break;
                
            case SelectionStrategy.LOAD_BALANCED:
                // Painotetaan vähiten käytettyjä palveluntarjoajia
                // Haetaan palveluntarjoajat ja järjestetään ne kuormituksen mukaan
                const loadBalancedProviders: ProviderHealth[] = [];
                
                for (const name of availableProviders) {
                    const health = this.healthMonitor.getProviderHealth(name);
                    
                    if (health) {
                        loadBalancedProviders.push(health);
                    } else {
                        // Jos terveystietoja ei ole, luodaan oletusarvot
                        loadBalancedProviders.push({
                            name,
                            available: true,
                            successRate: 1.0,
                            errorRate: 0.0,
                            averageLatency: 0,
                            recentRequests: 0,
                            recentErrors: 0,
                            lastUsed: null,
                            lastError: null
                        });
                    }
                }
                
                // Järjestetään palveluntarjoajat kuormituksen mukaan
                rankedProviders = ProviderScoreUtils.rankProviders(
                    loadBalancedProviders,
                    priorityMap,
                    retryCount
                );
                
                // Järjestetään uudelleen viimeaikaisten pyyntöjen mukaan
                rankedProviders.sort((a, b) => {
                    const requestsA = a.recentRequests || 0;
                    const requestsB = b.recentRequests || 0;
                    return requestsA - requestsB; // Vähemmän pyyntöjä ensin
                });
                break;
                
            case SelectionStrategy.ROUND_ROBIN:
                // Käytetään round-robin-strategiaa
                this.lastUsedProviderIndex = (this.lastUsedProviderIndex + 1) % availableProviders.length;
                return availableProviders[this.lastUsedProviderIndex];
                
            case SelectionStrategy.FALLBACK:
                // Fallback-strategia valitsee seuraavan parhaan palveluntarjoajan
                if (excludeProvider) {
                    this.logger.log(`Käytetään fallback-strategiaa, poissuljetaan: ${excludeProvider}`);
                }
                
                // Käytetään samaa logiikkaa kuin prioriteettistrategiassa
                const fallbackProviders: ProviderHealth[] = [];
                
                for (const name of availableProviders) {
                    const health = this.healthMonitor.getProviderHealth(name);
                    
                    if (health) {
                        fallbackProviders.push(health);
                    } else {
                        // Jos terveystietoja ei ole, luodaan oletusarvot
                        fallbackProviders.push({
                            name,
                            available: true,
                            successRate: 1.0,
                            errorRate: 0.0,
                            averageLatency: 0,
                            recentRequests: 0,
                            recentErrors: 0,
                            lastUsed: null,
                            lastError: null
                        });
                    }
                }
                
                // Järjestetään palveluntarjoajat prioriteetin mukaan
                rankedProviders = ProviderScoreUtils.rankProviders(
                    fallbackProviders,
                    priorityMap,
                    retryCount
                );
                break;
                
            case SelectionStrategy.PRIORITY:
            default:
                // Käytetään prioriteettia
                // Haetaan palveluntarjoajat ja järjestetään ne prioriteetin mukaan
                const priorityProviders: ProviderHealth[] = [];
                
                for (const name of availableProviders) {
                    const health = this.healthMonitor.getProviderHealth(name);
                    
                    if (health) {
                        priorityProviders.push(health);
                    } else {
                        // Jos terveystietoja ei ole, luodaan oletusarvot
                        priorityProviders.push({
                            name,
                            available: true,
                            successRate: 1.0,
                            errorRate: 0.0,
                            averageLatency: 0,
                            recentRequests: 0,
                            recentErrors: 0,
                            lastUsed: null,
                            lastError: null
                        });
                    }
                }
                
                // Järjestetään palveluntarjoajat prioriteetin mukaan
                rankedProviders = ProviderScoreUtils.rankProviders(
                    priorityProviders,
                    priorityMap,
                    retryCount
                );
                break;
        }
        
        // Valitaan paras palveluntarjoaja
        if (rankedProviders.length > 0) {
            const bestProvider = rankedProviders[0];
            this.logger.log(`Valittu palveluntarjoaja: ${bestProvider.name} (strategia: ${strategy})`);
            return bestProvider.name;
        }
        
        // Jos yhtään palveluntarjoajaa ei löydy, palautetaan ensimmäinen saatavilla oleva
        this.logger.warn(`Yhtään sopivaa palveluntarjoajaa ei löytynyt, käytetään ensimmäistä saatavilla olevaa: ${availableProviders[0]}`);
        return availableProviders[0];
    }
    
    /**
     * Valitsee parhaan palveluntarjoajan eräkäsittelyä varten
     * @param taskType Tehtävätyyppi
     * @returns Palveluntarjoajan nimi
     */
    public selectBestBatchProvider(taskType: string): string {
        // Eräkäsittelyssä käytetään aina PERFORMANCE-strategiaa
        return this.selectBestProvider(taskType, SelectionStrategy.PERFORMANCE);
    }
    
    /**
     * Valitsee seuraavan palveluntarjoajan fallback-tilanteessa
     * @param taskType Tehtävätyyppi
     * @param currentProvider Nykyinen palveluntarjoaja
     * @param errorType Virhetyyppi
     * @param retryCount Uudelleenyrityskertojen määrä
     * @returns Seuraava palveluntarjoaja
     */
    public selectNextProvider(
        taskType: string,
        currentProvider: string,
        errorType: string,
        retryCount: number = 0
    ): string {
        // Käytetään FALLBACK-strategiaa ja poissuljetaan nykyinen palveluntarjoaja
        return this.selectBestProvider(
            taskType,
            SelectionStrategy.FALLBACK,
            retryCount,
            currentProvider
        );
    }
}
