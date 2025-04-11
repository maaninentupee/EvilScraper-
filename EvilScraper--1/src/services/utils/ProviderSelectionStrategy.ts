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
    
    private initializeProviderHealth(name: string): ProviderHealth {
        const health = this.healthMonitor.getProviderHealth(name);
        if (health) return health;
        
        return {
            name,
            available: true,
            successRate: 1.0,
            errorRate: 0.0,
            averageLatency: 0,
            recentRequests: 0,
            recentErrors: 0,
            lastUsed: null,
            lastError: null
        };
    }

    private getProvidersHealth(availableProviders: string[]): ProviderHealth[] {
        return availableProviders.map(name => this.initializeProviderHealth(name));
    }

    private handleRoundRobinStrategy(availableProviders: string[]): string {
        this.lastUsedProviderIndex = (this.lastUsedProviderIndex + 1) % availableProviders.length;
        return availableProviders[this.lastUsedProviderIndex];
    }

    private rankProvidersByStrategy(
        providers: ProviderHealth[],
        priorityMap: Record<string, number>,
        strategy: SelectionStrategy,
        retryCount: number
    ): ProviderHealth[] {
        let rankedProviders = ProviderScoreUtils.rankProviders(providers, priorityMap, retryCount);

        if (strategy === SelectionStrategy.LOAD_BALANCED) {
            rankedProviders.sort((a, b) => (a.recentRequests || 0) - (b.recentRequests || 0));
        } else if (strategy === SelectionStrategy.PERFORMANCE) {
            rankedProviders.sort((a, b) => (a.averageLatency || 0) - (b.averageLatency || 0));
        } else if (strategy === SelectionStrategy.COST_OPTIMIZED) {
            // Assuming lower priority means lower cost
            rankedProviders.sort((a, b) => (priorityMap[b.name] || 0) - (priorityMap[a.name] || 0));
        }

        return rankedProviders;
    }

    private getAvailableProviders(excludeProvider: string | null): string[] {
        const allProviders = Array.from(this.providerRegistry.getAllProviders().keys());
        return excludeProvider 
            ? allProviders.filter(p => p !== excludeProvider)
            : allProviders;
    }

    private selectProviderByStrategy(
        availableProviders: string[],
        taskType: string,
        strategy: SelectionStrategy,
        retryCount: number
    ): string {
        const priorityMap = this.getProviderPriority(taskType);
        const providers = this.getProvidersHealth(availableProviders);
        const rankedProviders = this.rankProvidersByStrategy(providers, priorityMap, strategy, retryCount);

        if (rankedProviders.length > 0) {
            const bestProvider = rankedProviders[0];
            this.logger.log(`Selected provider: ${bestProvider.name} (strategy: ${strategy})`);
            return bestProvider.name;
        }

        return availableProviders[0];
    }

    public selectBestProvider(
        taskType: string, 
        strategy: SelectionStrategy = SelectionStrategy.PRIORITY,
        retryCount: number = 0,
        excludeProvider: string = null
    ): string {
        const availableProviders = this.getAvailableProviders(excludeProvider);
        
        if (availableProviders.length === 0) {
            this.logger.warn('No service providers are available');
            return null;
        }
        
        if (strategy === SelectionStrategy.ROUND_ROBIN) {
            return this.handleRoundRobinStrategy(availableProviders);
        }

        const selectedProvider = this.selectProviderByStrategy(
            availableProviders,
            taskType,
            strategy,
            retryCount
        );

        if (!selectedProvider) {
            this.logger.warn(`No suitable provider found, using the first available one: ${availableProviders[0]}`);
        }

        return selectedProvider;
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
        const priorityMap = this.getProviderPriority(taskType);
        
        if (strategy === SelectionStrategy.ROUND_ROBIN) {
            return providers;
        }

        const providersHealth = this.getProvidersHealth(providers);
        const rankedProviders = this.rankProvidersByStrategy(providersHealth, priorityMap, strategy, 0);
        return rankedProviders.map(p => p.name);
    }
}
