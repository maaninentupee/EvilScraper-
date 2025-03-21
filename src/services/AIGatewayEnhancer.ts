import { Injectable, Logger } from '@nestjs/common';
import { AIGateway, AIResponse } from './AIGateway';
import { ProviderSelectionStrategy, SelectionStrategy } from './utils/ProviderSelectionStrategy';
import { ProviderHealthMonitor, ProviderHealth } from './ProviderHealthMonitor';
import { ErrorClassifier } from './utils/ErrorClassifier';

/**
 * Options for the AIGatewayEnhancer class
 */
export interface EnhancedProcessingOptions {
    // Selection strategy
    strategy?: SelectionStrategy;
    
    // Preferred service provider
    preferredProvider?: string;
    
    // Whether to use cache
    cacheResults?: boolean;
    
    // Test mode
    testMode?: boolean;
    
    // Error type to simulate in test mode
    testError?: string;
}

/**
 * Enhanced AIGateway class that provides smart fallback mechanism
 * and other improvements for AI request processing
 */
@Injectable()
export class AIGatewayEnhancer {
    private readonly logger = new Logger(AIGatewayEnhancer.name);
    
    // Retry settings
    private readonly MAX_RETRIES = 3;
    private readonly RETRY_DELAY_MS = 500;
    
    constructor(
        private readonly aiGateway: AIGateway,
        private readonly selectionStrategy: ProviderSelectionStrategy,
        private readonly healthMonitor: ProviderHealthMonitor,
        private readonly errorClassifier: ErrorClassifier
    ) {}
    
    /**
     * Processes an AI request with smart fallback mechanism
     * @param taskType Task type
     * @param input User input
     * @param options Options
     * @returns AI response
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
            
            // Simulate errors in test mode
            if (testMode && testError) {
                this.logger.log(`Test mode: simulating error type ${testError}`);
                return this.simulateError(testError, taskType);
            }
            
            // Check cache if caching is enabled
            if (cacheResults) {
                const cachedResult = this.aiGateway.getCachedResult(taskType, input);
                if (cachedResult) {
                    this.logger.log(`Found result in cache for request "${input.substring(0, 30)}..."`);
                    return {
                        ...cachedResult,
                        fromCache: true
                    };
                }
            }
            
            // Select a service provider
            let providerName = preferredProvider;
            
            if (!providerName) {
                // Use the selection strategy to select the best provider
                providerName = this.selectionStrategy.selectBestProvider(taskType, strategy);
                
                if (!providerName) {
                    this.logger.error('No service providers are available');
                    return {
                        success: false,
                        error: 'No service providers are available',
                        errorType: ErrorClassifier.ERROR_TYPES.PROVIDER_UNAVAILABLE,
                        provider: 'none',
                        model: 'none'
                    };
                }
            }
            
            // Get the model name
            const modelName = this.aiGateway.getModelNameForProvider(providerName, taskType);
            
            if (!modelName) {
                this.logger.error(`No model found for provider ${providerName} and task type ${taskType}`);
                return {
                    success: false,
                    error: `No model found for provider ${providerName} and task type ${taskType}`,
                    errorType: ErrorClassifier.ERROR_TYPES.MODEL_UNAVAILABLE,
                    provider: providerName,
                    model: 'none'
                };
            }
            
            // Process the request
            const startTime = Date.now();
            const result = await this.aiGateway.processAIRequest(taskType, input, modelName);
            const processingTime = Date.now() - startTime;
            
            // If the request is successful, return the result
            if (result.success) {
                // Cache the result if caching is enabled
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
            
            // If the request fails, try the fallback mechanism
            this.logger.warn(`Provider ${providerName} failed, trying fallback mechanism`);
            
            // Check if the error is retryable
            if (!this.errorClassifier.isRetryable(result.errorType)) {
                this.logger.warn(`Error type ${result.errorType} is not retryable, returning error`);
                return result;
            }
            
            // Try the fallback mechanism
            return await this.handleFallback(taskType, input, providerName, options);
            
        } catch (error) {
            // Handle unexpected errors
            this.logger.error(`Unexpected error: ${error.message}`);
            
            return {
                success: false,
                error: `Unexpected error: ${error.message}`,
                errorType: ErrorClassifier.ERROR_TYPES.UNKNOWN,
                provider: 'none',
                model: 'none'
            };
        }
    }
    
    /**
     * Processes multiple AI requests in parallel with smart fallback mechanism
     * @param taskType Task type
     * @param inputs User inputs
     * @param options Options
     * @returns AI responses
     */
    public async processBatchWithSmartFallback(
        taskType: string,
        inputs: string[],
        options: EnhancedProcessingOptions = {}
    ): Promise<AIResponse[]> {
        const results: AIResponse[] = [];
        
        // Process each input in parallel
        const promises = inputs.map(async (input, index) => {
            try {
                const result = await this.processWithSmartFallback(taskType, input, options);
                return { index, result };
            } catch (error) {
                return {
                    index,
                    result: {
                        success: false,
                        error: `Error processing input ${index}: ${error.message}`,
                        errorType: ErrorClassifier.ERROR_TYPES.UNKNOWN,
                        provider: 'none',
                        model: 'none'
                    }
                };
            }
        });
        
        // Wait for all requests to complete
        const processedResults = await Promise.all(promises);
        
        // Sort the results in the original order
        processedResults.sort((a, b) => a.index - b.index);
        
        // Return the results
        return processedResults.map(item => item.result);
    }
    
    /**
     * Handles the fallback mechanism
     * @param taskType Task type
     * @param input User input
     * @param excludeProvider Excluded provider
     * @param options Options
     * @returns AI response
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
        
        // Try again with different providers
        for (let retryCount = 0; retryCount < this.MAX_RETRIES; retryCount++) {
            // Wait before retrying
            if (retryCount > 0) {
                await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY_MS));
            }
            
            this.logger.log(`Trying fallback mechanism, attempt ${retryCount + 1}/${this.MAX_RETRIES}`);
            
            // Select the next provider
            const providerName = this.selectionStrategy.selectNextProvider(
                taskType,
                excludeProvider,
                strategy
            );
            
            if (!providerName) {
                this.logger.error(`No alternative providers found for retry ${retryCount + 1}`);
                continue;
            }
            
            this.logger.log(`Selected alternative provider: ${providerName}`);
            
            try {
                // Get the model name
                const modelName = this.aiGateway.getModelNameForProvider(providerName, taskType);
                
                if (!modelName) {
                    this.logger.warn(`No model found for provider ${providerName} and task type ${taskType}`);
                    continue;
                }
                
                // Process the request
                const startTime = Date.now();
                const result = await this.aiGateway.processAIRequest(taskType, input, modelName);
                const processingTime = Date.now() - startTime;
                
                if (result.success) {
                    // Cache the result if caching is enabled
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
                
                // If the request fails, try the next provider
                this.logger.warn(`Provider ${providerName} failed, trying next provider`);
                
            } catch (error) {
                // Handle errors
                this.logger.warn(`Error on provider ${providerName}: ${error.message}`);
            }
        }
        
        // If all retries fail, return an error
        this.logger.error(`All ${this.MAX_RETRIES} retries failed`);
        
        return {
            success: false,
            error: `All AI services failed for task type ${taskType}`,
            errorType: ErrorClassifier.ERROR_TYPES.ALL_PROVIDERS_FAILED,
            provider: 'none',
            model: 'none',
            message: `All AI services failed for task type ${taskType}`,
            wasFailover: true
        };
    }
    
    /**
     * Simulates errors in test mode
     * @param errorType Error type
     * @param taskType Task type
     * @returns AI response
     */
    private simulateError(errorType: string, taskType: string): AIResponse {
        const errorMessage = ErrorClassifier.getUserFriendlyErrorMessage(errorType);
        
        return {
            success: false,
            error: `Simulated error: ${errorMessage}`,
            errorType,
            provider: 'test',
            model: 'test',
            message: `Simulated error for task type ${taskType}`
        };
    }
    
    /**
     * Returns all available service providers
     * @returns Service provider names
     */
    public getAvailableProviders(): string[] {
        return this.aiGateway.getAvailableProviders();
    }
    
    /**
     * Returns all available models
     * @returns Model names
     */
    public getAvailableModels(): Record<string, string[]> {
        return this.aiGateway.getAvailableModels();
    }
    
    /**
     * Returns the health information of service providers
     * @returns Service provider health information
     */
    public getProvidersHealth(): Record<string, ProviderHealth> {
        // Convert the Map object to a plain object
        const healthMap = this.healthMonitor.getAllProviderHealth();
        const result: Record<string, ProviderHealth> = {};
        
        for (const [name, health] of healthMap.entries()) {
            result[name] = health;
        }
        
        return result;
    }
    
    /**
     * Returns the service providers sorted by score
     * @param taskType Task type
     * @returns Service providers sorted by score
     */
    public getProvidersByScore(taskType: string): { provider: string; score: number }[] {
        // Define the scoring function based on task type
        const scoreFunction = (health: ProviderHealth): number => {
            // Base score based on availability
            let score = health.available ? 100 : 0;
            
            // Add score based on success rate
            score += health.successRate * 50;
            
            // Subtract score based on latency (max 20 points)
            const latencyPenalty = Math.min(20, health.averageLatency / 50);
            score -= latencyPenalty;
            
            return score;
        };
        
        // Get the service providers sorted by score
        const providers = this.healthMonitor.getProvidersByScore(scoreFunction);
        
        // Convert the providers to the desired format
        return providers.map(health => ({
            provider: health.name,
            score: scoreFunction(health)
        }));
    }
}
