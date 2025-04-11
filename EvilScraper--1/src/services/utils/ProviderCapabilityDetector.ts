import { Injectable, Logger } from '@nestjs/common';
import { BaseProvider } from '../providers/BaseProvider';
import { AnthropicProvider } from '../providers/AnthropicProvider';
import { OpenAIProvider } from '../providers/OpenAIProvider';

/**
 * Service provider capabilities
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
 * Class that detects service provider capabilities
 */
@Injectable()
export class ProviderCapabilityDetector {
    private readonly logger = new Logger(ProviderCapabilityDetector.name);
    
    // Service provider capabilities
    private readonly providerCapabilities: Map<string, ProviderCapabilities> = new Map();
    
    constructor() {}
    
    /**
     * Detects service provider capabilities
     * @param provider Service provider
     * @returns Service provider capabilities
     */
    public detectCapabilities(provider: BaseProvider): ProviderCapabilities {
        const name = this.getProviderName(provider);
        
        // If capabilities have already been detected, return them
        if (this.providerCapabilities.has(name)) {
            return this.providerCapabilities.get(name);
        }
        
        // Detect capabilities based on provider type
        let capabilities: ProviderCapabilities;
        
        if (provider instanceof AnthropicProvider) {
            capabilities = {
                name,
                supportsBatch: true,
                supportsStreaming: true,
                supportsSystemPrompt: true,
                maxContextLength: 100000,
                maxBatchSize: 20,
                recommendedBatchSize: 10
            };
        } else if (provider instanceof OpenAIProvider) {
            capabilities = {
                name,
                supportsBatch: true,
                supportsStreaming: true,
                supportsSystemPrompt: true,
                maxContextLength: 16000,
                maxBatchSize: 50,
                recommendedBatchSize: 20
            };
        } else {
            // Default capabilities for other providers
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
        
        // Store capabilities for future use
        this.providerCapabilities.set(name, capabilities);
        this.logger.debug(`Detected capabilities for provider ${name}: ${JSON.stringify(capabilities)}`);
        
        return capabilities;
    }
    
    /**
     * Gets the name of the service provider
     * @param provider Service provider
     * @returns Service provider name
     */
    private getProviderName(provider: BaseProvider): string {
        try {
            return provider.getName();
        } catch (error) {
            this.logger.error(`Failed to get provider name: ${error.message}`);
            return 'unknown';
        }
    }
    
    /**
     * Checks if the provider supports batch processing
     * @param provider Service provider
     * @returns True if the provider supports batch processing
     */
    public supportsBatch(provider: BaseProvider): boolean {
        const capabilities = this.detectCapabilities(provider);
        return capabilities.supportsBatch;
    }
    
    /**
     * Checks if the provider supports streaming
     * @param provider Service provider
     * @returns True if the provider supports streaming
     */
    public supportsStreaming(provider: BaseProvider): boolean {
        const capabilities = this.detectCapabilities(provider);
        return capabilities.supportsStreaming;
    }
    
    /**
     * Gets the maximum batch size for the provider
     * @param provider Service provider
     * @returns Maximum batch size
     */
    public getMaxBatchSize(provider: BaseProvider): number {
        const capabilities = this.detectCapabilities(provider);
        return capabilities.maxBatchSize;
    }
    
    /**
     * Gets the recommended batch size for the provider
     * @param provider Service provider
     * @returns Recommended batch size
     */
    public getRecommendedBatchSize(provider: BaseProvider): number {
        const capabilities = this.detectCapabilities(provider);
        return capabilities.recommendedBatchSize;
    }
    
    /**
     * Gets the maximum context length for the provider
     * @param provider Service provider
     * @returns Maximum context length
     */
    public getMaxContextLength(provider: BaseProvider): number {
        const capabilities = this.detectCapabilities(provider);
        return capabilities.maxContextLength;
    }
    
    /**
     * Gets the service provider capabilities by name
     * @param name Service provider name
     * @returns Service provider capabilities or undefined if not found
     */
    public getCapabilitiesByName(name: string): ProviderCapabilities | undefined {
        return this.providerCapabilities.get(name);
    }
    
    /**
     * Gets all service providers that support batch processing
     * @returns List of service provider names
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
}
