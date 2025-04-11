'./providers/BaseProvider' imported multiple times.import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProviderRegistry } from './providers/ProviderRegistry';
import { ProviderHealthMonitor } from './ProviderHealthMonitor';
import { ProviderSelectionStrategy } from './utils/ProviderSelectionStrategy';
import { ErrorClassifier } from './utils/ErrorClassifier';

/**
 * AI response interface
 */
export interface AIResponse {
    success: boolean;
    text?: string;
    result?: string;
    error?: string;
    errorType?: string;
    provider: string;
    model: string;
    usedFallback?: boolean;
    fromCache?: boolean;
    processingTime?: number;
    wasFailover?: boolean;
    wasRetry?: boolean;
    message?: string;
    timestamp?: number;
}

/**
 * Error class for AI services
 */
export class AIServiceError extends Error {
    constructor(
        message: string,
        public readonly errorType: string,
        public readonly provider: string,
        public readonly model: string
    ) {
        super(message);
        this.name = 'AIServiceError';
    }
}

/**
 * Class responsible for handling AI requests
 */
@Injectable()
export class AIGateway {
    private readonly logger = new Logger(AIGateway.name);
    
    // Cache
    private readonly cache: Map<string, AIResponse> = new Map();
    private readonly CACHE_MAX_SIZE = 1000;
    private readonly CACHE_TTL_MS = 3600 * 1000; // 1 hour
    
    // Retry settings
    private readonly MAX_RETRIES = 3;
    private readonly RETRY_DELAY_MS = 500;
    
    // Models for different task types
    private readonly modelsByTaskType: Record<string, Record<string, string>> = {
        'text-generation': {
            'openai': 'gpt-4',
            'anthropic': 'claude-3-opus-20240229',
            'ollama': 'llama3',
            'lmstudio': 'openchat',
            'local': 'gpt4all'
        },
        'code-generation': {
            'openai': 'gpt-4',
            'anthropic': 'claude-3-opus-20240229',
            'ollama': 'codellama',
            'lmstudio': 'openchat',
            'local': 'gpt4all'
        },
        'decision-making': {
            'openai': 'gpt-4',
            'anthropic': 'claude-3-opus-20240229',
            'ollama': 'llama3',
            'lmstudio': 'openchat',
            'local': 'gpt4all'
        },
        'default': {
            'openai': 'gpt-3.5-turbo',
            'anthropic': 'claude-3-haiku-20240307',
            'ollama': 'llama3',
            'lmstudio': 'openchat',
            'local': 'gpt4all'
        }
    };
    
    constructor(
        private readonly providerRegistry: ProviderRegistry,
        private readonly configService: ConfigService,
        private readonly healthMonitor: ProviderHealthMonitor,
        private readonly selectionStrategy: ProviderSelectionStrategy,
        private readonly errorClassifier: ErrorClassifier
    ) {}
    
    /**
     * Process an AI request
     * @param taskType Task type
     * @param input Input text
     * @param modelName Optional model name
     * @returns AI response
     */
    public async processAIRequest(
        taskType: string,
        input: string,
        modelName?: string
    ): Promise<AIResponse> {
        try {
            // Check cache
            const cachedResult = this.getCachedResult(taskType, input);
            if (cachedResult) {
                this.logger.log(`Found cached result for request "${input.substring(0, 30)}..."`);
                return {
                    ...cachedResult,
                    fromCache: true
                };
            }
            
            // Select provider
            const providerName = this.getInitialProvider(taskType);
            
            if (!providerName) {
                this.logger.error('No providers available');
                return {
                    success: false,
                    error: 'No providers available',
                    errorType: ErrorClassifier.ERROR_TYPES.PROVIDER_UNAVAILABLE,
                    provider: 'none',
                    model: 'none'
                };
            }
            
            // Get provider
            const provider = this.providerRegistry.getProvider(providerName);
            
            if (!provider) {
                this.logger.error(`Provider ${providerName} not found`);
                return {
                    success: false,
                    error: `Provider ${providerName} not found`,
                    errorType: ErrorClassifier.ERROR_TYPES.PROVIDER_UNAVAILABLE,
                    provider: 'none',
                    model: 'none'
                };
            }
            
            // Get model name
            const model = modelName || this.getModelNameForProvider(providerName, taskType);
            
            if (!model) {
                this.logger.error(`Model not found for provider ${providerName} and task type ${taskType}`);
                return {
                    success: false,
                    error: `Model not found for provider ${providerName} and task type ${taskType}`,
                    errorType: ErrorClassifier.ERROR_TYPES.MODEL_UNAVAILABLE,
                    provider: providerName,
                    model: 'none'
                };
            }
            
            // Process request
            const startTime = Date.now();
            const result = await provider.generateCompletion({
                prompt: input,
                modelName: model
            });
            const processingTime = Date.now() - startTime;
            
            // Update provider health
            this.healthMonitor.updateProviderHealth(providerName, true, processingTime);
            
            // Cache result
            this.cacheResult(taskType, input, {
                success: true,
                text: result.text,
                provider: providerName,
                model,
                processingTime
            });
            
            return {
                success: true,
                text: result.text,
                provider: providerName,
                model,
                processingTime
            };
            
        } catch (error) {
            // Handle error
            this.logger.error(`Error processing AI request: ${error.message}`);
            
            // Classify error
            const errorType = this.errorClassifier.classifyError(error.message);
            
            // Update provider health if error is related to a specific provider
            if (error instanceof AIServiceError) {
                this.healthMonitor.updateProviderHealth(error.provider, false, 0, errorType);
            }
            
            return {
                success: false,
                error: error.message,
                errorType,
                provider: error instanceof AIServiceError ? error.provider : 'unknown',
                model: error instanceof AIServiceError ? error.model : 'unknown'
            };
        }
    }
    
    /**
     * Process an AI request with fallback mechanism
     * @param taskType Task type
     * @param input Input text
     * @returns AI response
     */
    public async processAIRequestWithFallback(
        taskType: string,
        input: string
    ): Promise<AIResponse> {
        try {
            // Check cache
            const cachedResult = this.getCachedResult(taskType, input);
            if (cachedResult) {
                this.logger.log(`Found cached result for request "${input.substring(0, 30)}..."`);
                return {
                    ...cachedResult,
                    fromCache: true
                };
            }
            
            // Select initial provider
            const initialProviderName = this.getInitialProvider(taskType);
            
            if (!initialProviderName) {
                this.logger.error('No providers available');
                return {
                    success: false,
                    error: 'No providers available',
                    errorType: ErrorClassifier.ERROR_TYPES.PROVIDER_UNAVAILABLE,
                    provider: 'none',
                    model: 'none'
                };
            }
            
            // Try to use initial provider
            try {
                // Get model name
                const modelName = this.getModelNameForProvider(initialProviderName, taskType);
                
                if (!modelName) {
                    this.logger.error(`Model not found for provider ${initialProviderName} and task type ${taskType}`);
                    throw new AIServiceError(
                        `Model not found for provider ${initialProviderName} and task type ${taskType}`,
                        ErrorClassifier.ERROR_TYPES.MODEL_UNAVAILABLE,
                        initialProviderName,
                        'none'
                    );
                }
                
                // Process request
                const startTime = Date.now();
                const result = await this.processAIRequest(taskType, input, modelName);
                const processingTime = Date.now() - startTime;
                
                if (result.success) {
                    return {
                        ...result,
                        processingTime
                    };
                }
                
                // If request failed, try fallback mechanism
                this.logger.warn(`Provider ${initialProviderName} failed, trying fallback mechanism`);
                
                // Check if error is retryable
                if (!this.errorClassifier.isRetryable(result.errorType)) {
                    this.logger.warn(`Error type ${result.errorType} is not retryable, returning error`);
                    return result;
                }
                
                // Try fallback mechanism
                return await this.handleFallback(taskType, input, initialProviderName);
                
            } catch (error) {
                // Handle error
                this.logger.warn(`Error with provider ${initialProviderName}: ${error.message}`);
                
                // Try fallback mechanism
                return await this.handleFallback(taskType, input, initialProviderName);
            }
            
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
     * Handle fallback mechanism
     * @param taskType Task type
     * @param input Input text
     * @param excludeProvider Provider to exclude
     * @returns AI response
     */
    private async handleFallback(
        taskType: string,
        input: string,
        excludeProvider: string
    ): Promise<AIResponse> {
        // Try to use alternative providers
        for (let retryCount = 0; retryCount < this.MAX_RETRIES; retryCount++) {
            // Wait before retrying
            if (retryCount > 0) {
                await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY_MS));
            }
            
            this.logger.log(`Trying fallback mechanism, attempt ${retryCount + 1}/${this.MAX_RETRIES}`);
            
            // Select next provider
            const providerName = this.selectionStrategy.selectNextProvider(
                taskType,
                excludeProvider,
                'unknown',
                retryCount
            );
            
            if (!providerName) {
                this.logger.error(`No alternative providers available for retry ${retryCount + 1}`);
                continue;
            }
            
            this.logger.log(`Selected alternative provider: ${providerName}`);
            
            try {
                // Get model name
                const modelName = this.getModelNameForProvider(providerName, taskType);
                
                if (!modelName) {
                    this.logger.warn(`Model not found for provider ${providerName} and task type ${taskType}`);
                    continue;
                }
                
                // Process request
                const startTime = Date.now();
                const result = await this.processAIRequest(taskType, input, modelName);
                const processingTime = Date.now() - startTime;
                
                if (result.success) {
                    return {
                        ...result,
                        processingTime,
                        wasFailover: true
                    };
                }
                
                // If request failed, try next provider
                this.logger.warn(`Provider ${providerName} failed, trying next provider`);
                
            } catch (error) {
                // Handle error
                this.logger.warn(`Error with provider ${providerName}: ${error.message}`);
            }
        }
        
        // If all retries failed, return error
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
     * Process multiple AI requests in parallel
     * @param taskType Task type
     * @param inputs Input texts
     * @returns Array of AI responses
     */
    public async processBatchRequests(
        taskType: string,
        inputs: string[]
    ): Promise<AIResponse[]> {
        const results: AIResponse[] = [];
        
        for (const input of inputs) {
            try {
                const result = await this.processAIRequest(taskType, input);
                results.push(result);
            } catch (error) {
                results.push({
                    success: false,
                    error: error.message,
                    errorType: ErrorClassifier.ERROR_TYPES.UNKNOWN,
                    provider: 'unknown',
                    model: 'unknown'
                });
            }
        }
        
        return results;
    }
    
    /**
     * Get cached result
     * @param taskType Task type
     * @param input Input text
     * @returns AI response
     */
    public getCachedResult(taskType: string, input: string): AIResponse | null {
        const cacheKey = this.getCacheKey(taskType, input);
        const cachedResult = this.cache.get(cacheKey);
        
        if (cachedResult) {
            // Check if result is expired
            const now = Date.now();
            const timestamp = cachedResult.timestamp;
            
            if (timestamp && now - timestamp > this.CACHE_TTL_MS) {
                // Remove expired result
                this.cache.delete(cacheKey);
                return null;
            }
            
            return cachedResult;
        }
        
        return null;
    }
    
    /**
     * Cache result
     * @param taskType Task type
     * @param input Input text
     * @param result AI response
     */
    public cacheResult(taskType: string, input: string, result: AIResponse): void {
        // Check if cache is full
        if (this.cache.size >= this.CACHE_MAX_SIZE) {
            // Remove oldest result
            let oldestKey: string = null;
            let oldestTimestamp = Infinity;
            
            for (const [key, value] of this.cache.entries()) {
                const timestamp = value.timestamp || 0;
                
                if (timestamp < oldestTimestamp) {
                    oldestTimestamp = timestamp;
                    oldestKey = key;
                }
            }
            
            if (oldestKey) {
                this.cache.delete(oldestKey);
            }
        }
        
        // Cache result
        const cacheKey = this.getCacheKey(taskType, input);
        
        this.cache.set(cacheKey, {
            ...result,
            timestamp: Date.now()
        });
    }
    
    /**
     * Get cache key
     * @param taskType Task type
     * @param input Input text
     * @returns Cache key
     */
    private getCacheKey(taskType: string, input: string): string {
        return `${taskType}:${input}`;
    }
    
    /**
     * Get model name for provider
     * @param providerName Provider name
     * @param taskType Task type
     * @returns Model name
     */
    public getModelNameForProvider(providerName: string, taskType: string): string {
        const models = this.modelsByTaskType[taskType] || this.modelsByTaskType['default'];
        return models[providerName];
    }
    
    /**
     * Get initial provider
     * @param taskType Task type
     * @returns Provider name
     */
    private getInitialProvider(taskType: string): string {
        return this.selectionStrategy.selectBestProvider(taskType);
    }
    
    /**
     * Get available providers
     * @returns List of provider names
     */
    public getAvailableProviders(): string[] {
        return Array.from(this.providerRegistry.getAllProviders().keys());
    }
    
    /**
     * Get available models
     * @returns List of model names
     */
    public getAvailableModels(): Record<string, string[]> {
        const result: Record<string, string[]> = {};
        
        for (const providerName of this.getAvailableProviders()) {
            result[providerName] = [];
            
            for (const taskType in this.modelsByTaskType) {
                const models = this.modelsByTaskType[taskType];
                const model = models[providerName];
                
                if (model && !result[providerName].includes(model)) {
                    result[providerName].push(model);
                }
            }
        }
        
        return result;
    }
}
