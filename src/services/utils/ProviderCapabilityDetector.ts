import { Injectable, Logger } from '@nestjs/common';
import { BaseProvider } from '../providers/BaseProvider';
import { AnthropicProvider } from '../providers/AnthropicProvider';
import { OpenAIProvider } from '../providers/OpenAIProvider';

/**
 * Palveluntarjoajan ominaisuudet
 */
export interface ProviderCapabilities {
    name: string;
    supportsBatch: boolean;
    supportsStreaming: boolean;
    supportsSystemPrompt: boolean;
    maxContextLength: number;
    maxBatchSize: number;
    recommendedBatchSize: number;
}

/**
 * Luokka, joka tunnistaa palveluntarjoajien ominaisuudet
 */
@Injectable()
export class ProviderCapabilityDetector {
    private readonly logger = new Logger(ProviderCapabilityDetector.name);
    
    // Palveluntarjoajien ominaisuudet
    private providerCapabilities: Map<string, ProviderCapabilities> = new Map();
    
    constructor() {}
    
    /**
     * Tunnistaa palveluntarjoajan ominaisuudet
     * @param provider Palveluntarjoaja
     * @returns Palveluntarjoajan ominaisuudet
     */
    public detectCapabilities(provider: BaseProvider): ProviderCapabilities {
        const name = this.getProviderName(provider);
        
        // Jos ominaisuudet on jo tunnistettu, palautetaan ne
        if (this.providerCapabilities.has(name)) {
            return this.providerCapabilities.get(name);
        }
        
        // Tunnistetaan ominaisuudet palveluntarjoajan tyypin perusteella
        let capabilities: ProviderCapabilities;
        
        if (provider instanceof AnthropicProvider) {
            capabilities = {
                name,
                supportsBatch: true,
                supportsStreaming: true,
                supportsSystemPrompt: true,
                maxContextLength: 100000,
                maxBatchSize: 20,
                recommendedBatchSize: 5
            };
        } else if (provider instanceof OpenAIProvider) {
            capabilities = {
                name,
                supportsBatch: false,  // OpenAI ei tue batch-käsittelyä suoraan
                supportsStreaming: true,
                supportsSystemPrompt: true,
                maxContextLength: 16000,
                maxBatchSize: 1,
                recommendedBatchSize: 1
            };
        } else {
            // Oletusominaisuudet muille palveluntarjoajille
            capabilities = {
                name,
                supportsBatch: false,
                supportsStreaming: false,
                supportsSystemPrompt: false,
                maxContextLength: 4000,
                maxBatchSize: 1,
                recommendedBatchSize: 1
            };
        }
        
        // Tallennetaan ominaisuudet
        this.providerCapabilities.set(name, capabilities);
        
        this.logger.log(`Palveluntarjoajan ${name} ominaisuudet tunnistettu: ` +
            `batch: ${capabilities.supportsBatch}, ` +
            `streaming: ${capabilities.supportsStreaming}, ` +
            `system prompt: ${capabilities.supportsSystemPrompt}`);
        
        return capabilities;
    }
    
    /**
     * Palauttaa palveluntarjoajan nimen
     * @param provider Palveluntarjoaja
     * @returns Palveluntarjoajan nimi
     */
    private getProviderName(provider: BaseProvider): string {
        if (provider instanceof AnthropicProvider) {
            return 'anthropic';
        } else if (provider instanceof OpenAIProvider) {
            return 'openai';
        } else {
            // Yritetään tunnistaa nimi luokan nimen perusteella
            const className = provider.constructor.name;
            
            if (className.includes('Provider')) {
                return className.replace('Provider', '').toLowerCase();
            }
            
            return 'unknown';
        }
    }
    
    /**
     * Palauttaa palveluntarjoajan ominaisuudet nimen perusteella
     * @param name Palveluntarjoajan nimi
     * @returns Palveluntarjoajan ominaisuudet tai undefined jos ei löydy
     */
    public getCapabilitiesByName(name: string): ProviderCapabilities | undefined {
        return this.providerCapabilities.get(name);
    }
    
    /**
     * Palauttaa kaikki palveluntarjoajat, jotka tukevat batch-käsittelyä
     * @returns Lista palveluntarjoajien nimistä
     */
    public getBatchSupportingProviders(): string[] {
        const result: string[] = [];
        
        for (const [name, capabilities] of this.providerCapabilities.entries()) {
            if (capabilities.supportsBatch) {
                result.push(name);
            }
        }
        
        return result;
    }
    
    /**
     * Tarkistaa, tukeeko palveluntarjoaja batch-käsittelyä
     * @param name Palveluntarjoajan nimi
     * @returns true, jos palveluntarjoaja tukee batch-käsittelyä
     */
    public supportsBatch(name: string): boolean {
        const capabilities = this.providerCapabilities.get(name);
        return capabilities ? capabilities.supportsBatch : false;
    }
    
    /**
     * Palauttaa suositellun batch-koon palveluntarjoajalle
     * @param name Palveluntarjoajan nimi
     * @returns Suositeltu batch-koko
     */
    public getRecommendedBatchSize(name: string): number {
        const capabilities = this.providerCapabilities.get(name);
        return capabilities ? capabilities.recommendedBatchSize : 1;
    }
}
