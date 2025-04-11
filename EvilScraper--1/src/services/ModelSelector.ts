import { Injectable, Logger } from '@nestjs/common';
import { environment } from '../config/environment';


export interface ModelInfo {
    name: string;
    provider: string;
    capabilities: string[];
    contextLength: number;
    model?: string; 
}

@Injectable()
export class ModelSelector {
    private readonly logger = new Logger(ModelSelector.name);

    private readonly localModels = {
        "seo": "mistral-7b-instruct-q8_0.gguf",
        "code": "codellama-7b-q8_0.gguf",
        "decision": "falcon-7b-q4_0.gguf"
    };

    private readonly lmStudioModels = {
        "seo": "mistral-7b-instruct-v0.2",
        "code": "codellama-13b-instruct",
        "decision": "wizardlm-7b"
    };

    private readonly ollamaModels = {
        "seo": "mistral",
        "code": "codellama:7b-code",
        "decision": "llama2:13b"
    };

    private readonly fallbackModels = {
        "seo": "gpt-4-turbo",
        "code": "claude-3-opus-20240229",
        "decision": "gpt-4-turbo"
    };

    private readonly providerMap = {
        "gpt-4-turbo": "openai",
        "claude-3-opus-20240229": "anthropic"
    };

    private readonly modelCapabilities: Record<string, ModelInfo> = {
        // Local Models
        "mistral-7b-instruct-q8_0.gguf": {
            name: "mistral-7b-instruct-q8_0.gguf",
            provider: "local",
            capabilities: ["text-generation", "summarization"],
            contextLength: 8192,
            model: "mistral-7b-instruct-q8_0.gguf"
        },
        "codellama-7b-q8_0.gguf": {
            name: "codellama-7b-q8_0.gguf",
            provider: "local",
            capabilities: ["code-generation", "code-completion"],
            contextLength: 8192,
            model: "codellama-7b-q8_0.gguf"
        },
        "falcon-7b-q4_0.gguf": {
            name: "falcon-7b-q4_0.gguf",
            provider: "local",
            capabilities: ["text-generation", "decision-making"],
            contextLength: 4096,
            model: "falcon-7b-q4_0.gguf"
        },
        
        // LM Studio Models
        "mistral-7b-instruct-v0.2": {
            name: "mistral-7b-instruct-v0.2",
            provider: "lmstudio",
            capabilities: ["text-generation", "summarization"],
            contextLength: 8192,
            model: "mistral-7b-instruct-v0.2"
        },
        "codellama-13b-instruct": {
            name: "codellama-13b-instruct",
            provider: "lmstudio",
            capabilities: ["code-generation", "code-completion"],
            contextLength: 16384,
            model: "codellama-13b-instruct"
        },
        "wizardlm-7b": {
            name: "wizardlm-7b",
            provider: "lmstudio",
            capabilities: ["text-generation", "decision-making"],
            contextLength: 8192,
            model: "wizardlm-7b"
        },
        
        // Ollama Models
        "mistral": {
            name: "mistral",
            provider: "ollama",
            capabilities: ["text-generation", "summarization"],
            contextLength: 8192,
            model: "mistral"
        },
        "codellama:7b-code": {
            name: "codellama:7b-code",
            provider: "ollama",
            capabilities: ["code-generation", "code-completion"],
            contextLength: 8192,
            model: "codellama:7b-code"
        },
        "llama2:13b": {
            name: "llama2:13b",
            provider: "ollama",
            capabilities: ["text-generation", "decision-making"],
            contextLength: 4096,
            model: "llama2:13b"
        },
        
        // OpenAI and Anthropic Models
        "gpt-4-turbo": {
            name: "gpt-4-turbo",
            provider: "openai",
            capabilities: ["text-generation", "code-generation", "decision-making"],
            contextLength: 128000,
            model: "gpt-4-turbo"
        },
        "claude-3-opus-20240229": {
            name: "claude-3-opus-20240229",
            provider: "anthropic",
            capabilities: ["text-generation", "code-generation", "reasoning"],
            contextLength: 200000,
            model: "claude-3-opus-20240229"
        }
    };

    /**
     * Returns a suitable model for the task type
     * @param taskType Task type (seo, code, decision)
     * @param provider Desired service provider (null = use default priority)
     */
    public getModel(taskType: string, provider?: string): string | null {
        if (provider) return this.getModelByProvider(provider, taskType);
        if (!this.isValidTaskType(taskType)) {
            this.logger.warn(`Unknown task type: ${taskType}`);
            return null;
        }
        const providerPriority = environment.providerPriorityArray || ['local', 'lmstudio', 'ollama', 'openai', 'anthropic'];
        for (const p of providerPriority) {
            if (this.isProviderEnabled(p)) {
                return this.getModelByProvider(p, taskType);
            }
        }
        this.logger.warn(`No available model found for task type ${taskType}, using fallback model`);
        return this.fallbackModels[taskType] || this.fallbackModels["seo"];
    }
    
    private getModelByProvider(provider: string, taskType: string): string {
        switch (provider) {
            case 'local':
                return this.localModels[taskType] || this.localModels["seo"];
            case 'lmstudio':
                return this.lmStudioModels[taskType] || this.lmStudioModels["seo"];
            case 'ollama':
                return this.ollamaModels[taskType] || this.ollamaModels["seo"];
            case 'openai':
                return "gpt-4-turbo";
            case 'anthropic':
                return "claude-3-opus-20240229";
            default:
                this.logger.warn(`Unknown service provider: ${provider}, using local model`);
                return this.localModels[taskType] || this.localModels["seo"];
        }
    }
    
    private isValidTaskType(taskType: string): boolean {
        return Boolean(
            this.localModels[taskType] ||
            this.lmStudioModels[taskType] ||
            this.ollamaModels[taskType] ||
            this.fallbackModels[taskType]
        );
    }
    
    private isProviderEnabled(provider: string): boolean {
        switch (provider) {
            case 'local': return environment.useLocalModels;
            case 'lmstudio': return environment.useLMStudio;
            case 'ollama': return environment.useOllama;
            case 'openai': return environment.useOpenAI;
            case 'anthropic': return environment.useAnthropic;
            default: return false;
        }
    }
    
    /**
     * Converts task type to corresponding capability for the model
     * @param taskType Task type
     */
    public mapTaskTypeToCapability(taskType: string): string | null {
        switch (taskType) {
            case 'seo':
                return 'summarization';
            case 'code':
                return 'code-generation';
            case 'decision':
                return 'decision-making';
            default:
                return 'text-generation';
        }
    }

    /**
     * Gets model information by name
     * @param modelName Model name
     */
    public getModelInfo(modelName: string): ModelInfo | undefined {
        return this.modelCapabilities[modelName] || undefined;
    }

    /**
     * Returns the model's service provider
     * @param modelName Model name
     */
    public getProviderForModel(modelName: string): string {
        // First check direct definitions
        if (this.providerMap[modelName]) {
            return this.providerMap[modelName];
        }
        
        // Then check modelCapabilities
        const modelInfo = this.getModelInfo(modelName);
        if (modelInfo) {
            return modelInfo.provider;
        }
        
        // Check model naming conventions
        // Check model name prefixes directly to avoid circular dependency
        if (modelName === 'gpt-4-turbo' || modelName.startsWith('gpt-')) {
            return 'openai';
        }
        
        if (modelName === 'claude-3-opus-20240229' || modelName.startsWith('claude-')) {
            return 'anthropic';
        }
        
        if (this.isOllamaModel(modelName)) {
            return 'ollama';
        }
        
        if (this.isLMStudioModel(modelName)) {
            return 'lmstudio';
        }
        
        // Default: local model
        return 'local';
    }

    /**
     * Checks if the model is a local model
     * @param modelName Model name
     */
    public isLocalModel(modelName: string): boolean {
        return Object.values(this.localModels).includes(modelName);
    }

    /**
     * Checks if the model is an OpenAI model
     * @param modelName Model name
     */
    public isOpenAIModel(modelName: string): boolean {
        // Avoid calling getProviderForModel to prevent circular dependency
        return modelName === 'gpt-4-turbo' || 
               modelName.startsWith('gpt-') || 
               this.providerMap[modelName] === 'openai' ||
               (this.getModelInfo(modelName)?.provider === 'openai');
    }

    /**
     * Checks if the model is an Anthropic model
     * @param modelName Model name
     */
    public isAnthropicModel(modelName: string): boolean {
        // Avoid calling getProviderForModel to prevent circular dependency
        return modelName === 'claude-3-opus-20240229' || 
               modelName.startsWith('claude-') || 
               this.providerMap[modelName] === 'anthropic' ||
               (this.getModelInfo(modelName)?.provider === 'anthropic');
    }

    /**
     * Checks if the model is an Ollama model
     * @param modelName Model name
     */
    public isOllamaModel(modelName: string): boolean {
        return Object.values(this.ollamaModels).includes(modelName);
    }

    /**
     * Checks if the model is an LM Studio model
     * @param modelName Model name
     */
    public isLMStudioModel(modelName: string): boolean {
        return Object.values(this.lmStudioModels).includes(modelName);
    }

    /**
     * Checks if the model is capable of a specific capability
     * @param modelName Model name
     * @param capability Capability to check
     */
    public isModelCapableOf(modelName: string, capability: string): boolean {
        const modelInfo = this.getModelInfo(modelName);
        if (!modelInfo) {
            this.logger.warn(`No model information found for model ${modelName}. Assuming not capable.`);
            return false;
        }
        
        return modelInfo.capabilities.includes(capability);
    }

    /**
     * Returns a suitable system prompt for the task type
     * @param taskType Task type
     * @returns System prompt
     */
    public getSystemPrompt(taskType: string): string {
        switch (taskType) {
            case 'seo':
                return "You are an SEO expert, helping to create high-quality content for search engine optimization.";
            case 'code':
                return "You are an experienced programmer, helping with code writing, debugging, and optimization.";
            case 'decision':
                return "You are a decision-making expert, helping to analyze options and make informed decisions.";
            default:
                return "You are a helpful AI assistant, answering user questions clearly and accurately.";
        }
    }

    /**
     * Returns all available providers based on environment settings
     * @returns Array of available provider names
     */
    public getAvailableProviders(): string[] {
        const providers: string[] = [];
        
        if (environment.useLocalModels) {
            providers.push('local');
        }
        
        if (environment.useLMStudio) {
            providers.push('lmstudio');
        }
        
        // For test environment, check environment variables directly
        if (environment.useOllama || process.env.OLLAMA_ENABLED === 'true') {
            providers.push('ollama');
        }
        
        if (environment.useOpenAI || process.env.OPENAI_API_KEY) {
            providers.push('openai');
        }
        
        if (environment.useAnthropic || process.env.ANTHROPIC_API_KEY) {
            providers.push('anthropic');
        }
        
        return providers;
    }

    /**
     * Returns all available models and their information
     */
    public getAvailableModels(): {
        models: {
            [taskType: string]: {
                [provider: string]: string;
            };
        };
        modelDetails: {
            [modelName: string]: ModelInfo;
        };
        environmentConfig: {
            useLocalModels: boolean;
            useLMStudio: boolean;
            useOllama: boolean;
            useOpenAI: boolean;
            useAnthropic: boolean;
            providerPriority: string[];
        };
    } {
        const modelTypes: string[] = ['seo', 'code', 'decision'];
        const models: { [taskType: string]: { [provider: string]: string } } = {};
        
        // Add provider-specific models
        for (const type of modelTypes) {
            models[type] = {};
            
            // Only add providers that are in use
            if (environment.useLocalModels) {
                models[type]['local'] = this.getModel(type, 'local');
            }
            
            if (environment.useLMStudio) {
                models[type]['lmstudio'] = this.getModel(type, 'lmstudio');
            }
            
            if (environment.useOllama) {
                models[type]['ollama'] = this.getModel(type, 'ollama');
            }
            
            if (environment.useOpenAI) {
                models[type]['openai'] = this.getModel(type, 'openai');
            }
            
            if (environment.useAnthropic) {
                models[type]['anthropic'] = this.getModel(type, 'anthropic');
            }
        }
        
        // Add model details
        const modelDetails: { [modelName: string]: ModelInfo } = {};
        Object.values(this.modelCapabilities).forEach(modelInfo => {
            modelDetails[modelInfo.name] = modelInfo;
        });
        
        return { 
            models,
            modelDetails,
            environmentConfig: {
                useLocalModels: environment.useLocalModels,
                useLMStudio: environment.useLMStudio,
                useOllama: environment.useOllama,
                useOpenAI: environment.useOpenAI,
                useAnthropic: environment.useAnthropic,
                providerPriority: environment.providerPriorityArray
            }
        };
    }
}
