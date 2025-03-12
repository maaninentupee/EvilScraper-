import { Injectable, Logger } from '@nestjs/common';

/**
 * Palveluntarjoajan terveystiedot
 */
export interface ProviderHealth {
    name: string;
    available: boolean;
    successRate: number;
    errorRate: number;
    averageLatency: number;
    recentRequests: number;
    recentErrors: number;
    lastUsed: Date | null;
    lastError: Date | null;
}

/**
 * Luokka, joka seuraa palveluntarjoajien terveyttä
 */
@Injectable()
export class ProviderHealthMonitor {
    private readonly logger = new Logger(ProviderHealthMonitor.name);
    
    // Palveluntarjoajien terveystiedot
    private providerHealth: Map<string, ProviderHealth> = new Map();
    
    // Terveystietojen päivitysasetukset
    private readonly HEALTH_WINDOW_SIZE = 100; // Viimeisimpien pyyntöjen määrä, jota seurataan
    private readonly MIN_REQUESTS_FOR_HEALTH = 5; // Vähimmäismäärä pyyntöjä, jotta terveystiedot ovat luotettavia
    
    /**
     * Alustaa palveluntarjoajan terveystiedot
     * @param name Palveluntarjoajan nimi
     */
    public initializeProviderHealth(name: string): void {
        if (!this.providerHealth.has(name)) {
            this.providerHealth.set(name, {
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
            
            this.logger.log(`Palveluntarjoajan ${name} terveystiedot alustettu`);
        }
    }
    
    /**
     * Päivittää palveluntarjoajan terveystiedot pyynnön tuloksen perusteella
     * @param name Palveluntarjoajan nimi
     * @param success Onnistuiko pyyntö
     * @param latency Vasteaika millisekunteina
     * @param errorType Virhetyyppi, jos pyyntö epäonnistui
     */
    public updateProviderHealth(
        name: string, 
        success: boolean, 
        latency?: number,
        errorType?: string
    ): void {
        // Varmistetaan, että palveluntarjoajan terveystiedot on alustettu
        if (!this.providerHealth.has(name)) {
            this.initializeProviderHealth(name);
        }
        
        const health = this.providerHealth.get(name);
        
        // Päivitetään viimeisimmät pyynnöt ja virheet
        const totalRequests = health.recentRequests + 1;
        const totalErrors = health.recentErrors + (success ? 0 : 1);
        
        // Rajoitetaan seurattavien pyyntöjen määrää
        if (totalRequests > this.HEALTH_WINDOW_SIZE) {
            // Jos ylitetään seurattavien pyyntöjen määrä, skaalataan arvot
            const scaleFactor = this.HEALTH_WINDOW_SIZE / totalRequests;
            health.recentRequests = Math.floor(totalRequests * scaleFactor);
            health.recentErrors = Math.floor(totalErrors * scaleFactor);
        } else {
            health.recentRequests = totalRequests;
            health.recentErrors = totalErrors;
        }
        
        // Päivitetään onnistumis- ja virheprosentit
        if (health.recentRequests >= this.MIN_REQUESTS_FOR_HEALTH) {
            health.successRate = (health.recentRequests - health.recentErrors) / health.recentRequests;
            health.errorRate = health.recentErrors / health.recentRequests;
        }
        
        // Päivitetään keskimääräinen vasteaika
        if (success && latency) {
            if (health.averageLatency === 0) {
                health.averageLatency = latency;
            } else {
                // Painotettu keskiarvo, joka antaa enemmän painoa uusimmille mittauksille
                health.averageLatency = health.averageLatency * 0.7 + latency * 0.3;
            }
        }
        
        // Päivitetään viimeisimmät käyttö- ja virheajat
        if (success) {
            health.lastUsed = new Date();
        } else {
            health.lastError = new Date();
            
            // Lokitetaan virhetyyppi
            if (errorType) {
                this.logger.warn(`Palveluntarjoaja ${name} kohtasi virheen: ${errorType}`);
            }
        }
        
        // Päivitetään saatavuus
        // Jos virheprosentti on liian korkea, merkitään palveluntarjoaja ei-saatavilla olevaksi
        if (health.recentRequests >= this.MIN_REQUESTS_FOR_HEALTH && health.errorRate > 0.8) {
            health.available = false;
            this.logger.warn(`Palveluntarjoaja ${name} merkitty ei-saatavilla olevaksi korkean virheprosentin takia (${(health.errorRate * 100).toFixed(1)}%)`);
        } else {
            health.available = true;
        }
        
        // Päivitetään tiedot takaisin karttaan
        this.providerHealth.set(name, health);
    }
    
    /**
     * Palauttaa palveluntarjoajan terveystiedot
     * @param name Palveluntarjoajan nimi
     * @returns Palveluntarjoajan terveystiedot
     */
    public getProviderHealth(name: string): ProviderHealth | undefined {
        return this.providerHealth.get(name);
    }
    
    /**
     * Palauttaa kaikkien palveluntarjoajien terveystiedot
     * @returns Kartta palveluntarjoajien terveystiedoista
     */
    public getAllProviderHealth(): Map<string, ProviderHealth> {
        return this.providerHealth;
    }
    
    /**
     * Nollaa kaikkien palveluntarjoajien terveystiedot
     */
    public resetStats(): void {
        // Käydään läpi kaikki palveluntarjoajat ja nollataan tilastot
        for (const [name, health] of this.providerHealth.entries()) {
            this.providerHealth.set(name, {
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
        
        this.logger.log('Palveluntarjoajien terveystiedot nollattu');
    }
    
    /**
     * Palauttaa palveluntarjoajat järjestettynä pisteytyksen mukaan
     * @param scoreFunction Funktio, joka laskee pisteet palveluntarjoajalle
     * @returns Järjestetty lista palveluntarjoajista
     */
    public getProvidersByScore(scoreFunction: (health: ProviderHealth) => number): ProviderHealth[] {
        const providers: ProviderHealth[] = [];
        
        // Kerätään kaikki palveluntarjoajat
        for (const health of this.providerHealth.values()) {
            providers.push(health);
        }
        
        // Järjestetään palveluntarjoajat pisteytyksen mukaan
        return providers.sort((a, b) => {
            const scoreA = scoreFunction(a);
            const scoreB = scoreFunction(b);
            return scoreB - scoreA; // Suuremmat pisteet ensin
        });
    }
}
