import { Injectable, Logger } from '@nestjs/common';
import { AIGateway } from './AIGateway';
import { ProviderSelectionStrategy, SelectionStrategy } from './utils/ProviderSelectionStrategy';
import { ProviderHealthMonitor, ProviderHealth } from './ProviderHealthMonitor';
import { ErrorClassifier } from './utils/ErrorClassifier';
import { ConfigService } from '@nestjs/config';

/**
 * Options for the AIGatewayEnhancer class
 */
export interface EnhancedProcessingOptions {
    // Selection strategy
    strategy?: SelectionStrategy;
    
    // Preferred service provider
    providerName?: string;
    
    // Model name
    modelName?: string;
    
    // Whether to use cache
    cacheResults?: boolean;
    
    // Test mode
    testMode?: boolean;
    
    // Error type to simulate in test mode
    testError?: string;
    
    // Timeout
    timeout?: number;
    
    // Retry count
    retryCount?: number;
    
    // Retry delay
    retryDelay?: number;
    
    // Start time
    startTime?: number;
}

/**
 * Interface for AI response objects
 */
export interface AIResponse {
    success: boolean;
    provider: string;
    model: string;
    result?: string;
    error?: string;
    errorType?: string;
    latency?: number;
    wasFailover?: boolean;
    fromCache?: boolean;
    message?: string;
    strategy?: string;
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
    
    // Default timeout
    private readonly defaultTimeout = 30000; // 30 seconds default timeout
    
    constructor(
        private readonly aiGateway: AIGateway,
        private readonly selectionStrategy: ProviderSelectionStrategy,
        private readonly healthMonitor: ProviderHealthMonitor,
        private readonly errorClassifier: ErrorClassifier,
        private readonly configService: ConfigService
    ) {
        this.defaultTimeout = this.configService.get('AI_REQUEST_TIMEOUT') || 30000;
    }
    
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
        const { strategy = SelectionStrategy.PRIORITY, retryCount = 0, timeout = this.defaultTimeout } = options;
        const override = this.getOverrideResponse(taskType, input, options);
        if (override) return override;
    
        const providerModel = this.determineProviderAndModel(taskType, options);
        if ('success' in providerModel && providerModel.success === false) {
            return providerModel;
        }
        const { provider: selectedProvider, model } = providerModel as { provider: string, model: string };
    
        const startTime = Date.now();
        try {
            const response = await this.executeRequestWithTimeout(taskType, input, model, selectedProvider, timeout);
            const latency = Date.now() - startTime;
            return { ...response, provider: selectedProvider, model, latency };
        } catch (error) {
            if (retryCount > 0) {
                return this.processWithSmartFallback(taskType, input, { ...options, retryCount: retryCount - 1 });
            }
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
    
    private determineProviderAndModel(taskType: string, options: EnhancedProcessingOptions): { provider: string, model: string } | AIResponse {
        const { modelName, strategy = SelectionStrategy.PRIORITY } = options;
        const selectedProvider = this.selectionStrategy.selectBestProvider(taskType, strategy);
        if (!selectedProvider) {
            this.logger.error('No service providers are available');
            return {
                success: false,
                error: 'No service providers are available',
                errorType: ErrorClassifier.ERROR_TYPES.PROVIDER_UNAVAILABLE,
                provider: 'none',
                model: 'none'
            };
        }
        const model = modelName || this.aiGateway.getModelNameForProvider(selectedProvider, taskType);
        if (!model) {
            this.logger.error(`No model found for provider ${selectedProvider} and task type ${taskType}`);
            return {
                success: false,
                error: `No model found for provider ${selectedProvider} and task type ${taskType}`,
                errorType: ErrorClassifier.ERROR_TYPES.MODEL_UNAVAILABLE,
                provider: selectedProvider,
                model: 'none'
            };
        }
        return { provider: selectedProvider, model };
    }
    
    private async executeRequestWithTimeout(taskType: string, input: string, model: string, provider: string, timeout: number): Promise<AIResponse> {
        try {
            const result = await Promise.race([
                this.aiGateway.processAIRequest(taskType, input, model),
                new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('Request timed out')), timeout)
                )
            ]);
            
            if (result && typeof result === 'object' && 'success' in result) {
                if (result.success) {
                    return {
                        success: true,
                        result: (result as any).result,
                        provider,
                        model,
                        latency: 0
                    };
                } else {
                    const errorType = 'errorType' in result ? String((result as any).errorType) : 'unknown';
                    const errorMessage = 'error' in result ? String((result as any).error) : 'Unknown error';
                    return {
                        success: false,
                        error: errorMessage,
                        errorType: errorType,
                        provider,
                        model
                    };
                }
            }
            return {
                success: false,
                error: 'Invalid response format from provider',
                errorType: 'format_error',
                provider,
                model
            };
        } catch (error) {
            throw error;
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
        
        return processedResults.map(item => item.result);
        }
        
        /**
         * Helper method for test mode and cache checks.
         */
        private getOverrideResponse(taskType: string, input: string, options: EnhancedProcessingOptions): AIResponse | null {
            const { testMode = false, testError = null, cacheResults = true } = options;
            if (testMode && testError) {
                this.logger.log(`Test mode: simulating error type ${testError}`);
                return this.simulateError(testError, taskType);
            }
            if (cacheResults) {
                const cached = this.aiGateway.getCachedResult(taskType, input);
                if (cached) {
                    this.logger.log(`Found cached result for request "${input.substring(0,30)}..."`);
                    return { ...cached, fromCache: true };
                }
            }
            return null;
        }
        
        private async attemptFallbackRequest(
            taskType: string,
            input: string,
            provider: string,
            timeout: number,
            modelName?: string
        ): Promise<AIResponse | null> {
            const model = modelName || this.aiGateway.getModelNameForProvider(provider, taskType);
            if (!model) {
                this.logger.warn(`No model found for provider ${provider} and task type ${taskType}`);
                return null;
            }
            const startTime = Date.now();
            try {
                const result = await Promise.race([
                    this.aiGateway.processAIRequest(taskType, input, model),
                    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Request timed out')), timeout))
                ]);
                const latency = Date.now() - startTime;
                if (result && typeof result === 'object' && 'success' in result) {
                    if ((result as any).success) {
                        return {
                            success: true,
                            result: (result as any).result,
                            provider,
                            model,
                            latency,
                            wasFailover: true
                        };
                    } else {
                        const errorType = 'errorType' in result ? String((result as any).errorType) : 'unknown';
                        const errorMessage = 'error' in result ? String((result as any).error) : 'Unknown error';
                        return {
                            success: false,
                            error: errorMessage,
                            errorType: errorType,
                            provider,
                            model,
                            wasFailover: true
                        };
                    }
                }
                return {
                    success: false,
                    error: 'Invalid response format from provider',
                    errorType: 'format_error',
                    provider,
                    model,
                    wasFailover: true
                };
            } catch (error) {
                this.logger.warn(`Error on provider ${provider}: ${error.message}`);
                return null;
            }
        }
    
    /**
     * Handles the fallback mechanism
     * @param taskType Task type
     * @param input User input
     * @param excludeProvider Excluded provider
     * @param options Options
     * @returns AI response
     */
    private async attemptFallbackRequest(
        taskType: string,
        input: string,
        provider: string,
        timeout: number,
        modelName?: string
    ): Promise<AIResponse | null> {
        const model = modelName || this.aiGateway.getModelNameForProvider(provider, taskType);
        if (!model) {
            this.logger.warn(`No model found for provider ${provider} and task type ${taskType}`);
            return null;
        }

        try {
            const result = await Promise.race([
                this.aiGateway.processAIRequest(taskType, input, model),
                new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Request timed out')), timeout))
            ]);

            if (result && typeof result === 'object' && 'success' in result) {
                if ((result as any).success) {
                    return {
                        success: true,
                        result: (result as any).result,
                        provider,
                        model,
                        latency: 0,
                        wasFailover: true
                    };
                }
                const errorType = 'errorType' in result ? String((result as any).errorType) : 'unknown';
                const errorMessage = 'error' in result ? String((result as any).error) : 'Unknown error';
                return {
                    success: false,
                    error: errorMessage,
                    errorType: errorType,
                    provider,
                    model,
                    wasFailover: true
                };
            }
            return {
                success: false,
                error: 'Invalid response format from provider',
                errorType: 'format_error',
                provider,
                model,
                wasFailover: true
            };
        } catch (error) {
            this.logger.warn(`Error on provider ${provider}: ${error.message}`);
            return null;
        }
    }

    private async handleFallback(
        taskType: string,
        input: string,
        excludeProvider: string,
        options: EnhancedProcessingOptions
    ): Promise<AIResponse> {
        const { strategy = SelectionStrategy.FALLBACK, timeout = this.defaultTimeout, modelName } = options;

        for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
            if (attempt > 0) {
                await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY_MS));
            }

            const nextProvider = this.selectionStrategy.selectNextProvider(taskType, excludeProvider, strategy);
            if (!nextProvider) {
                this.logger.error(`No alternative providers found for attempt ${attempt + 1}`);
                continue;
            }

            const response = await this.attemptFallbackRequest(taskType, input, nextProvider, timeout, modelName);
            if (response) {
                return response;
            }
        }

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
   
   private async attemptFallbackRequest(
       taskType: string,
       input: string,
       provider: string,
       timeout: number,
       modelName?: string
   ): Promise<AIResponse | null> {
       const model = modelName || this.aiGateway.getModelNameForProvider(provider, taskType);
       if (!model) {
           this.logger.warn(`No model found for provider ${provider} and task type ${taskType}`);
           return null;
       }
       const startTime = Date.now();
       try {
           const result = await Promise.race([
               this.aiGateway.processAIRequest(taskType, input, model),
               new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Request timed out')), timeout))
           ]);
           const latency = Date.now() - startTime;
           if (result && typeof result === 'object' && 'success' in result && typeof (result as any).success === 'boolean') {
               if ((result as any).success) {
                   return {
                       success: true,
                       result: (result as any).result,
                       provider,
                       model,
                       latency,
                       wasFailover: true
                   };
               } else {
                   const errorType = 'errorType' in result ? String((result as any).errorType) : 'unknown';
                   const errorMessage = 'error' in result ? String((result as any).error) : 'Unknown error';
                   return {
                       success: false,
                       error: errorMessage,
                       errorType: errorType,
                       provider,
                       model,
                       wasFailover: true
                   };
               }
           }
           return {
               success: false,
               error: 'Invalid response format from provider',
               errorType: 'format_error',
               provider,
               model,
               wasFailover: true
           };
       } catch (error) {
           this.logger.warn(`Error on provider ${provider}: ${error.message}`);
           return null;
       }
   }
    }
    
    /**
     * Process a request with fallback mechanism
     * @param taskType Type of AI task
     * @param input User input
     * @param options Optional processing options
     * @returns AI processing result with fallback information
     */
    async processWithFallback(taskType: string, input: string, options: EnhancedProcessingOptions = {}) {
        const startTime = Date.now();
        // (Removed useless assignment to cacheResults)
        const timeout = options.timeout || this.defaultTimeout;
        
        // Define the type for the AI response
        interface AIResult {
            success?: boolean;
            result?: string;
            error?: string;
            errorType?: string;
            model?: string;
            latency?: number;
            provider?: string;
        }
        
        // Try with preferred provider first if specified
        if (options.providerName) {
            const selectedProvider = options.providerName;
            const modelName = options.modelName || this.getDefaultModel(taskType, selectedProvider);
            
            try {
                const rawResult = await Promise.race([
                    this.aiGateway.processAIRequest(taskType, input, modelName),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Request timed out')), timeout)
                    )
                ]);

                // Cast the unknown result to our expected type
                const result = rawResult as AIResult;
                
                const endTime = Date.now();
                const latency = endTime - startTime;
                
                // Add type guard to safely check the result
                if (result && typeof result === 'object') {
                    // Check if the result has a success property that is a boolean
                    if ('success' in result && typeof (result as any).success === 'boolean') {
                        if ((result as any).success) {
                            // Success case
                            return {
                                success: true,
                                result: (result as any).result,
                                provider: selectedProvider,
                                model: modelName,
                                latency
                            };
                        } else {
                            // Error case with proper error handling
                            const errorType = 'errorType' in result ? String((result as any).errorType) : 'unknown';
                            const errorMessage = 'error' in result ? String((result as any).error) : 'Unknown error';
                            
                            return {
                                success: false,
                                error: errorMessage,
                                errorType: errorType,
                                provider: selectedProvider,
                                model: modelName
                            };
                        }
                    }
                }
                
                // If we get here, the result doesn't have the expected structure
                return {
                    success: false,
                    error: 'Invalid response format from provider',
                    errorType: 'format_error',
                    provider: selectedProvider,
                    model: modelName
                };
                
            } catch (error) {
                // If retries are available, try again
                if (options.retryCount > 0) {
                    return this.processWithFallback(taskType, input, {
                        ...options,
                        retryCount: options.retryCount - 1
                    });
                }
                
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
            
        } else {
            // Select the primary provider based on strategy or use provided one
            const primaryProvider = options.providerName || 
                this.selectionStrategy.selectBestProvider(taskType, SelectionStrategy.PERFORMANCE);
            
            // Define the type for the AI response
            interface AIResult {
                success?: boolean;
                result?: string;
                error?: string;
                model?: string;
                latency?: number;
                provider?: string;
            }
            
            try {
                // Try with the primary provider
                const rawResult = await this.process(taskType, input, {
                    providerName: primaryProvider,
                    timeout
                });
                
                // Safely cast the unknown result to our expected type
                const result = rawResult as AIResult;
                
                // Check if the result has the expected structure
                if (typeof result !== 'object' || result === null) {
                    throw new Error('Invalid response format from AI service');
                }
                
                // Return the result with fallback flag set to false
                return {
                    result: 'result' in result ? result.result : '',
                    model: 'model' in result ? result.model : '',
                    latency: 'latency' in result ? result.latency : 0,
                    provider: 'provider' in result ? result.provider : primaryProvider,
                    wasFailover: false
                };
            } catch (error) {
                this.logger.warn(`Primary provider ${primaryProvider} failed, trying fallback providers`);
                
                // Get alternative providers
                const alternativeProviders = this.selectionStrategy.getAlternativeProviders(
                    taskType, 
                    primaryProvider,
                    SelectionStrategy.PERFORMANCE
                );
                
                // Try each alternative provider
                for (const alternativeProvider of alternativeProviders) {
                    try {
                        const rawResult = await this.process(taskType, input, {
                            providerName: alternativeProvider,
                            timeout
                        });
                        
                        // Safely cast the unknown result to our expected type
                        const result = rawResult as AIResult;
                        
                        // Check if the result has the expected structure
                        if (typeof result !== 'object' || result === null) {
                            throw new Error('Invalid response format from AI service');
                        }
                        
                        // Return the result with fallback flag set to true
                        return {
                            result: 'result' in result ? result.result : '',
                            model: 'model' in result ? result.model : '',
                            latency: 'latency' in result ? result.latency : 0,
                            provider: 'provider' in result ? result.provider : alternativeProvider,
                            wasFailover: true
                        };
                    } catch (alternativeError) {
                        this.logger.warn(`Alternative provider ${alternativeProvider} also failed`);
                        // Continue to the next alternative provider
                    }
                }
                
                // If all providers fail, return an error object
                return {
                    result: `Error: Failed to process with all available providers`,
                    model: null,
                    latency: 0,
                    provider: null,
                    wasFailover: true,
                    error: {
                        message: 'All AI services failed for this input',
                        type: 'ALL_PROVIDERS_FAILED'
                    }
                };
            }
        }
    }

    /**
     * Process a batch of inputs using a specified strategy with fallback support
     * @param inputs Array of input prompts to process
     * @param taskType Type of AI task
     * @param strategy Strategy to use for processing (e.g., 'performance', 'cost')
     * @param options Optional processing options
     * @returns Array of AI processing results with fallback information
     */
    async processBatchWithStrategy(
        inputs: string[], 
        taskType: string, 
        strategy: string,
        options: EnhancedProcessingOptions = {}
    ): Promise<AIResponse[]> {
        this.logger.log(`Processing batch with ${strategy} strategy, ${inputs.length} inputs`);
        
        // Convert string strategy to SelectionStrategy enum if needed
        let selectionStrategy: SelectionStrategy;
        
        if (strategy === 'performance') {
            selectionStrategy = SelectionStrategy.PERFORMANCE;
        } else if (strategy === 'cost') {
            selectionStrategy = SelectionStrategy.COST_OPTIMIZED;
        } else if (strategy === 'priority') {
            selectionStrategy = SelectionStrategy.PRIORITY;
        } else if (strategy === 'loadBalanced') {
            selectionStrategy = SelectionStrategy.LOAD_BALANCED;
        } else if (strategy === 'roundRobin') {
            selectionStrategy = SelectionStrategy.ROUND_ROBIN;
        } else if (strategy === 'fallback') {
            selectionStrategy = SelectionStrategy.FALLBACK;
        } else {
            // Default to performance strategy
            selectionStrategy = SelectionStrategy.PERFORMANCE;
        }
        
        // Select the primary provider based on strategy or use provided one
        const primaryProvider = options.providerName || 
            this.selectionStrategy.selectBestProvider(taskType, selectionStrategy);
        
        // Process each input with the selected provider
        const results: AIResponse[] = [];
        
        for (const input of inputs) {
            try {
                const result = await this.processWithFallback(taskType, input, {
                    ...options,
                    providerName: primaryProvider
                });
                
                // Add the result to the results array
                results.push({
                    ...result,
                    strategy
                });
            } catch (error) {
                this.logger.warn(`Error processing input with provider ${primaryProvider}: ${error.message}`);
                
                // Try with fallback
                try {
                    const fallbackResult = await this.processWithFallback(taskType, input, {
                        ...options,
                        strategy: selectionStrategy
                    });
                    
                    // Add the fallback result to the results array
                    results.push({
                        ...fallbackResult,
                        strategy,
                        wasFailover: true
                    });
                } catch (fallbackError) {
                    // If fallback also fails, add an error result
                    results.push({
                        success: false,
                        error: fallbackError.message,
                        errorType: 'fallback_failed',
                        provider: primaryProvider,
                        model: this.getDefaultModel(taskType, primaryProvider) || 'unknown',
                        strategy,
                        wasFailover: true
                    });
                }
            }
        }
        
        return results;
    }
    
    /**
     * Process a request with enhanced options
     * @param taskType Type of AI task
     * @param input User input
     * @param options Processing options
     * @returns AI processing result
     */
    async process(taskType: string, input: string, options: EnhancedProcessingOptions = {}) {
        const {
            providerName,
            modelName,
            timeout = this.defaultTimeout,
            retryCount = 0,
            retryDelay = 1000,
            startTime = Date.now()
        } = options;

        // Select a provider if not specified
        const selectedProvider = providerName || 
            this.selectionStrategy.selectBestProvider(taskType, SelectionStrategy.PERFORMANCE);

        if (!selectedProvider) {
            throw new Error('No suitable provider available');
        }

        // Get the model name for the selected provider
        const model = modelName || this.aiGateway.getModelNameForProvider(selectedProvider, taskType);
        
        if (!model) {
            throw new Error(`No model found for provider ${selectedProvider} and task type ${taskType}`);
        }

        // Process the request with timeout
        try {
            // Define the type for the AI response
            interface AIResult {
                success: boolean;
                result?: string;
                error?: string;
                errorType?: string;
            }
            
            // Process the request with timeout
            const rawResult = await Promise.race([
                this.aiGateway.processAIRequest(taskType, input, model),
                new Promise<never>((_, reject) => 
                    setTimeout(() => reject(new Error('Request timed out')), timeout)
                )
            ]);

            // Cast the unknown result to our expected type
            const result = rawResult as AIResult;
            
            // Check if the result has the expected structure
            if (typeof result !== 'object' || result === null) {
                throw new Error('Invalid response format from AI service');
            }
            
            // Calculate latency
            const latency = Date.now() - startTime;
            
            // Check if the result indicates success
            if ('success' in result && !result.success) {
                throw new Error('error' in result && typeof result.error === 'string' 
                    ? result.error 
                    : 'Unknown error');
            }

            if ('success' in result && result.success && 'result' in result) {
                return {
                    success: true,
                    result: result.result,
                    model,
                    latency,
                    provider: model.split(':')[0] // Extract provider from model name
                };
            }
            
            throw new Error('Invalid response format from AI service');
        } catch (error) {
            const errorObj = error as { message?: string; errorType?: string };
            const errorType = 'errorType' in errorObj ? errorObj.errorType : 'UNKNOWN_ERROR';
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            
            // If the error is not retryable, return it immediately
            if (errorType && !this.errorClassifier.isRetryable(errorType)) {
                return {
                    success: false,
                    error: errorMessage,
                    errorType: errorType,
                    provider: model.split(':')[0], // Extract provider from model name
                    model
                };
            }
            
            // If retries are available, wait and try again
            if (retryCount > 0) {
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                
                return this.process(taskType, input, {
                    providerName,
                    modelName,
                    timeout,
                    retryCount: retryCount - 1,
                    retryDelay,
                    startTime
                });
            }
            
            // No more retries, return the error
            return {
                success: false,
                error: errorMessage,
                errorType: errorType,
                provider: model.split(':')[0],
                model
            };
        }
    }
    
    /**
     * Process a request using a specific strategy
     * @param taskType Type of AI task
     * @param input User input
     * @param strategy Strategy to use (e.g., 'performance', 'quality')
     * @param options Optional processing options
     * @returns AI processing result with strategy information
     */
    async processWithStrategy(
        taskType: string, 
        input: string, 
        strategy: string,
        options: EnhancedProcessingOptions = {}
    ) {
        this.logger.log(`Processing with ${strategy} strategy`);
        
        // Convert string strategy to SelectionStrategy enum if needed
        let selectionStrategy: SelectionStrategy;
        
        if (strategy === 'performance') {
            selectionStrategy = SelectionStrategy.PERFORMANCE;
        } else if (strategy === 'cost') {
            selectionStrategy = SelectionStrategy.COST_OPTIMIZED;
        } else if (strategy === 'priority') {
            selectionStrategy = SelectionStrategy.PRIORITY;
        } else if (strategy === 'loadBalanced') {
            selectionStrategy = SelectionStrategy.LOAD_BALANCED;
        } else if (strategy === 'roundRobin') {
            selectionStrategy = SelectionStrategy.ROUND_ROBIN;
        } else if (strategy === 'fallback') {
            selectionStrategy = SelectionStrategy.FALLBACK;
        } else {
            // Default to performance strategy
            selectionStrategy = SelectionStrategy.PERFORMANCE;
        }
        
        // Select the primary provider based on strategy or use provided one
        const primaryProvider = options.providerName || 
            this.selectionStrategy.selectBestProvider(taskType, selectionStrategy);
        
        // Process with the selected provider
        try {
            const result = await this.process(taskType, input, {
                ...options,
                providerName: primaryProvider
            });
            
            // Return the result with strategy information
            return {
                ...result,
                strategy,
                wasFailover: false
            };
        } catch (error) {
            this.logger.warn(`Primary provider ${primaryProvider} failed, trying fallback`);
            
            // If the primary provider fails, try with fallback
            return this.processWithFallback(taskType, input, {
                ...options,
                strategy: selectionStrategy
            });
        }
    }
    
    /**
     * Get the default model for a specific provider and task type
     * @param taskType Type of AI task
     * @param providerName Name of the provider
     * @returns Default model name for the provider and task
     */
    private getDefaultModel(taskType: string, providerName: string): string {
        // This is a simplified implementation - in a real system, this would be more sophisticated
        // and might come from configuration or a database
        if (providerName === 'openai') {
            return taskType === 'embedding' ? 'text-embedding-ada-002' : 'gpt-4-turbo';
        } else if (providerName === 'anthropic') {
            return 'claude-instant';
        } else if (providerName === 'cohere') {
            return taskType === 'embedding' ? 'embed-english-v2.0' : 'command';
        }
        
        return 'default-model';
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
