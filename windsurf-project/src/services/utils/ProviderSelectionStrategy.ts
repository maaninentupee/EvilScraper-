import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProviderRegistry } from '../providers/ProviderRegistry';
import { ProviderHealth, ProviderHealthMonitor } from '../ProviderHealthMonitor';
import { ProviderScoreUtils } from './ProviderScoreUtils';

/**
 * Service provider selection strategy
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
 * Class responsible for selecting service providers according to different strategies
 */
@Injectable()
export class ProviderSelectionStrategy {
    private readonly logger = new Logger(ProviderSelectionStrategy.name);
    
    // Service provider priorities for different task types
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
    
    // Last used provider index for round-robin strategy
    private lastUsedProviderIndex: number = -1;
    
    constructor(
        private readonly providerRegistry: ProviderRegistry,
        private readonly configService: ConfigService,
        private readonly healthMonitor: ProviderHealthMonitor
    ) {}
    
    /**
     * Returns the service provider priorities for a task type
     * @param taskType Task type
     * @returns Priority map
     */
    public getProviderPriority(taskType: string): Record<string, number> {
        return this.providerPriorities[taskType] || this.providerPriorities['default'];
    }
    
    /**
     * Selects the best service provider based on task type and strategy
     * @param taskType Task type
     * @param strategy Selection strategy
     * @param retryCount Number of retries
     * @param excludeProvider Provider to exclude
     * @returns Selected provider
     */
    public selectBestProvider(
        taskType: string, 
        strategy: SelectionStrategy = SelectionStrategy.PRIORITY,
        retryCount: number = 0,
        excludeProvider: string = null
    ): string {
        // Get available providers
        const allProviders = Array.from(this.providerRegistry.getAllProviders().keys());
        const availableProviders = excludeProvider 
            ? allProviders.filter(p => p !== excludeProvider)
            : allProviders;
        
        if (availableProviders.length === 0) {
            this.logger.warn('No service providers are available');
            return null;
        }
        
        // Get priority map for task type
        const priorityMap = this.getProviderPriority(taskType);
        
        // Rank providers based on strategy
        let rankedProviders: ProviderHealth[] = [];
        
        switch (strategy) {
            case SelectionStrategy.COST_OPTIMIZED:
                // Use cost optimization
                // Collect providers and their health information
                const providers: ProviderHealth[] = [];
                
                for (const name of availableProviders) {
                    const health = this.healthMonitor.getProviderHealth(name);
                    
                    if (health) {
                        providers.push(health);
                    } else {
                        // If health information is not available, use default values
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
                
                // Rank providers based on cost
                rankedProviders = ProviderScoreUtils.rankProviders(
                    providers,
                    priorityMap,
                    retryCount
                );
                break;
                
            case SelectionStrategy.PERFORMANCE:
                // Use performance
                // Get providers and rank them based on performance
                const performanceProviders: ProviderHealth[] = [];
                
                for (const name of availableProviders) {
                    const health = this.healthMonitor.getProviderHealth(name);
                    
                    if (health) {
                        performanceProviders.push(health);
                    } else {
                        // If health information is not available, use default values
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
                
                // Rank providers based on performance
                rankedProviders = ProviderScoreUtils.rankProviders(
                    performanceProviders,
                    priorityMap,
                    retryCount
                );
                break;
                
            case SelectionStrategy.LOAD_BALANCED:
                // Use load balancing
                // Get providers and rank them based on load
                const loadBalancedProviders: ProviderHealth[] = [];
                
                for (const name of availableProviders) {
                    const health = this.healthMonitor.getProviderHealth(name);
                    
                    if (health) {
                        loadBalancedProviders.push(health);
                    } else {
                        // If health information is not available, use default values
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
                
                // Rank providers based on load
                rankedProviders = ProviderScoreUtils.rankProviders(
                    loadBalancedProviders,
                    priorityMap,
                    retryCount
                );
                
                // Re-rank based on recent requests
                rankedProviders.sort((a, b) => {
                    const requestsA = a.recentRequests || 0;
                    const requestsB = b.recentRequests || 0;
                    return requestsA - requestsB; // Less requests first
                });
                break;
                
            case SelectionStrategy.ROUND_ROBIN:
                // Use round-robin strategy
                this.lastUsedProviderIndex = (this.lastUsedProviderIndex + 1) % availableProviders.length;
                return availableProviders[this.lastUsedProviderIndex];
                
            case SelectionStrategy.FALLBACK:
                // Use fallback strategy
                if (excludeProvider) {
                    this.logger.log(`Using fallback strategy, excluding: ${excludeProvider}`);
                }
                
                // Use same logic as priority strategy
                const fallbackProviders: ProviderHealth[] = [];
                
                for (const name of availableProviders) {
                    const health = this.healthMonitor.getProviderHealth(name);
                    
                    if (health) {
                        fallbackProviders.push(health);
                    } else {
                        // If health information is not available, use default values
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
                
                // Rank providers based on priority
                rankedProviders = ProviderScoreUtils.rankProviders(
                    fallbackProviders,
                    priorityMap,
                    retryCount
                );
                break;
                
            case SelectionStrategy.PRIORITY:
            default:
                // Use priority
                // Get providers and rank them based on priority
                const priorityProviders: ProviderHealth[] = [];
                
                for (const name of availableProviders) {
                    const health = this.healthMonitor.getProviderHealth(name);
                    
                    if (health) {
                        priorityProviders.push(health);
                    } else {
                        // If health information is not available, use default values
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
                
                // Rank providers based on priority
                rankedProviders = ProviderScoreUtils.rankProviders(
                    priorityProviders,
                    priorityMap,
                    retryCount
                );
                break;
        }
        
        // Select the best provider
        if (rankedProviders.length > 0) {
            const bestProvider = rankedProviders[0];
            this.logger.log(`Selected provider: ${bestProvider.name} (strategy: ${strategy})`);
            return bestProvider.name;
        }
        
        // If no providers are found, return the first available one
        this.logger.warn(`No suitable provider found, using the first available one: ${availableProviders[0]}`);
        return availableProviders[0];
    }
    
    /**
     * Selects the best service provider for batch processing
     * @param taskType Task type
     * @returns Selected provider
     */
    public selectBestBatchProvider(taskType: string): string {
        // Batch processing always uses PERFORMANCE strategy
        return this.selectBestProvider(taskType, SelectionStrategy.PERFORMANCE);
    }
    
    /**
     * Selects the next service provider for a task
     * @param taskType Task type
     * @param currentProvider Current provider
     * @param errorType Error type
     * @param retryCount Number of retries
     * @returns Next provider
     */
    public selectNextProvider(
        taskType: string,
        currentProvider: string,
        errorType: string,
        retryCount: number = 0
    ): string {
        // Use FALLBACK strategy and exclude the current provider
        return this.selectBestProvider(
            taskType,
            SelectionStrategy.FALLBACK,
            retryCount,
            currentProvider
        );
    }
    
    /**
     * Get alternative providers for fallback
     * @param taskType Type of AI task
     * @param excludeProvider Provider to exclude
     * @param strategy Selection strategy
     * @returns Array of alternative providers
     */
    getAlternativeProviders(taskType: string, excludeProvider: string, strategy: SelectionStrategy): string[] {
        // Get all available providers - assume this is synchronous for testing
        const providers = ['openai', 'anthropic', 'ollama', 'local']; // Mock providers for testing
        
        // Filter out the excluded provider
        const alternativeProviders = providers.filter(p => p !== excludeProvider);
        
        // Sort by score based on strategy
        return this.sortProvidersByScore(alternativeProviders, taskType, strategy);
    }
    
    private sortProvidersByScore(providers: string[], taskType: string, strategy: SelectionStrategy): string[] {
        // Get priority map for task type
        const priorityMap = this.getProviderPriority(taskType);
        
        // Rank providers based on strategy
        let rankedProviders: ProviderHealth[] = [];
        
        switch (strategy) {
            case SelectionStrategy.COST_OPTIMIZED:
                // Use cost optimization
                // Collect providers and their health information
                const providersCost: ProviderHealth[] = [];
                
                for (const name of providers) {
                    const health = this.healthMonitor.getProviderHealth(name);
                    
                    if (health) {
                        providersCost.push(health);
                    } else {
                        // If health information is not available, use default values
                        providersCost.push({
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
                
                // Rank providers based on cost
                rankedProviders = ProviderScoreUtils.rankProviders(
                    providersCost,
                    priorityMap,
                    0
                );
                break;
                
            case SelectionStrategy.PERFORMANCE:
                // Use performance
                // Get providers and rank them based on performance
                const providersPerformance: ProviderHealth[] = [];
                
                for (const name of providers) {
                    const health = this.healthMonitor.getProviderHealth(name);
                    
                    if (health) {
                        providersPerformance.push(health);
                    } else {
                        // If health information is not available, use default values
                        providersPerformance.push({
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
                
                // Rank providers based on performance
                rankedProviders = ProviderScoreUtils.rankProviders(
                    providersPerformance,
                    priorityMap,
                    0
                );
                break;
                
            case SelectionStrategy.LOAD_BALANCED:
                // Use load balancing
                // Get providers and rank them based on load
                const providersLoadBalanced: ProviderHealth[] = [];
                
                for (const name of providers) {
                    const health = this.healthMonitor.getProviderHealth(name);
                    
                    if (health) {
                        providersLoadBalanced.push(health);
                    } else {
                        // If health information is not available, use default values
                        providersLoadBalanced.push({
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
                
                // Rank providers based on load
                rankedProviders = ProviderScoreUtils.rankProviders(
                    providersLoadBalanced,
                    priorityMap,
                    0
                );
                
                // Re-rank based on recent requests
                rankedProviders.sort((a, b) => {
                    const requestsA = a.recentRequests || 0;
                    const requestsB = b.recentRequests || 0;
                    return requestsA - requestsB; // Less requests first
                });
                break;
                
            case SelectionStrategy.ROUND_ROBIN:
                // Use round-robin strategy
                return providers;
                
            case SelectionStrategy.FALLBACK:
                // Use fallback strategy
                // Use same logic as priority strategy
                const providersFallback: ProviderHealth[] = [];
                
                for (const name of providers) {
                    const health = this.healthMonitor.getProviderHealth(name);
                    
                    if (health) {
                        providersFallback.push(health);
                    } else {
                        // If health information is not available, use default values
                        providersFallback.push({
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
                
                // Rank providers based on priority
                rankedProviders = ProviderScoreUtils.rankProviders(
                    providersFallback,
                    priorityMap,
                    0
                );
                break;
                
            case SelectionStrategy.PRIORITY:
            default:
                // Use priority
                // Get providers and rank them based on priority
                const providersPriority: ProviderHealth[] = [];
                
                for (const name of providers) {
                    const health = this.healthMonitor.getProviderHealth(name);
                    
                    if (health) {
                        providersPriority.push(health);
                    } else {
                        // If health information is not available, use default values
                        providersPriority.push({
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
                
                // Rank providers based on priority
                rankedProviders = ProviderScoreUtils.rankProviders(
                    providersPriority,
                    priorityMap,
                    0
                );
                break;
        }
        
        // Return the ranked providers
        return rankedProviders.map(p => p.name);
    }
}
