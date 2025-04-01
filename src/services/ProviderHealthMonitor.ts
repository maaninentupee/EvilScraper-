import { Injectable, Logger } from '@nestjs/common';

/**
 * Service provider health information
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
 * Class that monitors service provider health
 */
@Injectable()
export class ProviderHealthMonitor {
    private readonly logger = new Logger(ProviderHealthMonitor.name);
    
    // Service provider health information
    private readonly providerHealth: Map<string, ProviderHealth> = new Map();
    
    // Health information update settings
    private readonly HEALTH_WINDOW_SIZE = 100; // Number of most recent requests to track
    private readonly MIN_REQUESTS_FOR_HEALTH = 5; // Minimum number of requests for reliable health information
    
    /**
     * Initializes service provider health information
     * @param name Service provider name
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
            
            this.logger.log(`Service provider ${name} health information initialized`);
        }
    }
    
    /**
     * Updates service provider health information based on the request result
     * @param name Service provider name
     * @param success Whether the request was successful
     * @param latency Request processing time in milliseconds
     * @param errorType Error type if the request failed
     */
   public updateProviderHealth(
       name: string,
       success: boolean,
       latency?: number,
       errorType?: string
   ): void {
       if (!this.providerHealth.has(name)) {
           this.initializeProviderHealth(name);
       }
       const health = this.providerHealth.get(name);
       const totalRequests = health.recentRequests + 1;
       const totalErrors = health.recentErrors + (success ? 0 : 1);
       
       this.updateRecentCounts(health, totalRequests, totalErrors);
       this.updateRates(health);
       this.updateLatency(health, success, latency);
       
       if (success) {
           health.lastUsed = new Date();
       } else {
           health.lastError = new Date();
           if (errorType) {
               this.logger.warn(`Service provider ${name} encountered an error: ${errorType}`);
           }
       }
       
       this.updateAvailability(health, name);
   }
   
   private updateRecentCounts(health: ProviderHealth, totalRequests: number, totalErrors: number): void {
       if (totalRequests > this.HEALTH_WINDOW_SIZE) {
           const scaleFactor = this.HEALTH_WINDOW_SIZE / totalRequests;
           health.recentRequests = Math.floor(totalRequests * scaleFactor);
           health.recentErrors = Math.floor(totalErrors * scaleFactor);
       } else {
           health.recentRequests = totalRequests;
           health.recentErrors = totalErrors;
       }
   }
   
   private updateRates(health: ProviderHealth): void {
       if (health.recentRequests >= this.MIN_REQUESTS_FOR_HEALTH) {
           health.successRate = (health.recentRequests - health.recentErrors) / health.recentRequests;
           health.errorRate = health.recentErrors / health.recentRequests;
       }
   }
   
   private updateLatency(health: ProviderHealth, success: boolean, latency?: number): void {
       if (success && latency) {
           health.averageLatency = (health.averageLatency === 0)
               ? latency
               : (health.averageLatency * 0.7 + latency * 0.3);
       }
   }
   
   private updateAvailability(health: ProviderHealth, name: string): void {
       if (health.recentRequests >= this.MIN_REQUESTS_FOR_HEALTH && health.errorRate > 0.8) {
           health.available = false;
           this.logger.warn(`Service provider ${name} marked as unavailable due to high error rate (${(health.errorRate * 100).toFixed(1)}%)`);
       } else {
           health.available = true;
       }
   }
    
    /**
     * Gets service provider health information
     * @param name Service provider name
     * @returns Service provider health information
     */
    public getProviderHealth(name: string): ProviderHealth | undefined {
        return this.providerHealth.get(name);
    }
    
    /**
     * Gets all service provider health information
     * @returns Map of service provider health information
     */
    public getAllProviderHealth(): Map<string, ProviderHealth> {
        return this.providerHealth;
    }
    
    /**
     * Resets all service provider health information
     */
    public resetStats(): void {
        // Iterate over all service providers and reset their statistics
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
        
        this.logger.log('Service provider health information reset');
    }
    
    /**
     * Gets service providers sorted by score
     * @param scoreFunction Function to calculate the score
     * @returns Service providers sorted by score
     */
    public getProvidersByScore(scoreFunction: (health: ProviderHealth) => number): ProviderHealth[] {
        const providers: ProviderHealth[] = [];
        
        // Collect all service providers
        for (const health of this.providerHealth.values()) {
            providers.push(health);
        }
        
        // Sort service providers by score
        return providers.sort((a, b) => {
            const scoreA = scoreFunction(a);
            const scoreB = scoreFunction(b);
            return scoreB - scoreA; // Descending order
        });
    }
}
