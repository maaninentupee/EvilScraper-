import { Injectable, Logger } from '@nestjs/common';
import { environment } from '../config/environment';

export type ModelType = string;
export type ProviderType = string; // 'local' | 'lmstudio' | 'ollama' | 'openai' | 'anthropic'

export interface ModelInfo {
    name: string;
    provider: ProviderType;
    capabilities: string[];
    contextLength: number;
    model?: string; 
}

@Injectable()
export class ModelSelector {
    private readonly logger = new Logger(ModelSelector.name);

    private localModels = {
        "seo": "mistral-7b-instruct-q8_0.gguf",
        "code": "codellama-7b-q8_0.gguf",
        "decision": "falcon-7b-q4_0.gguf"
    };

    private lmStudioModels = {
        "seo": "mistral-7b-instruct-v0.2",
        "code": "codellama-13b-instruct",
        "decision": "wizardlm-7b"
    };

    private ollamaModels = {
        "seo": "mistral",
        "code": "codellama:7b-code",
        "decision": "llama2:13b"
    };

    private fallbackModels = {
        "seo": "gpt-4-turbo",
        "code": "claude-3-opus-20240229",
        "decision": "gpt-4-turbo"
    };

    private providerMap = {
        "gpt-4-turbo": "openai",
        "claude-3-opus-20240229": "anthropic"
    };

    private modelCapabilities: Record<string, ModelInfo> = {
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
     * Palauttaa sopivan mallin tehtävätyyppiä varten
     * @param taskType Tehtävän tyyppi (seo, code, decision)
     * @param provider Haluttu palveluntarjoaja (null = käytä oletusta prioriteetin mukaan)
     */
    public getModel(taskType: string, provider?: ProviderType): string {
        // Jos provider on määritelty, käytä sitä
        if (provider) {
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
                    this.logger.warn(`Tuntematon palveluntarjoaja: ${provider}, käytetään paikallista mallia`);
                    return this.localModels[taskType] || this.localModels["seo"];
            }
        }
        
        // Jos ei määritelty, käytä prioriteettijärjestystä
        const providerPriority = environment.providerPriorityArray;
        
        for (const priorityProvider of providerPriority) {
            if (priorityProvider === 'local' && environment.useLocalModels) {
                return this.localModels[taskType] || this.localModels["seo"];
            } else if (priorityProvider === 'lmstudio' && environment.useLMStudio) {
                return this.lmStudioModels[taskType] || this.lmStudioModels["seo"];
            } else if (priorityProvider === 'ollama' && environment.useOllama) {
                return this.ollamaModels[taskType] || this.ollamaModels["seo"];
            } else if (priorityProvider === 'openai' && environment.useOpenAI) {
                return "gpt-4-turbo";
            } else if (priorityProvider === 'anthropic' && environment.useAnthropic) {
                return "claude-3-opus-20240229";
            }
        }
        
        // Fallback käyttäen nimenomaisia fallback-malleja
        this.logger.warn(`Ei löydetty saatavilla olevaa mallia tehtävätyypille ${taskType}, käytetään fallback-mallia`);
        return this.fallbackModels[taskType] || this.fallbackModels["seo"];
    }
    
    /**
     * Muuntaa tehtävätyypin vastaavaan kyvykkyyteen mallille
     * @param taskType Tehtävän tyyppi
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
     * Hakee mallin tiedot nimen perusteella
     * @param modelName Mallin nimi
     */
    public getModelInfo(modelName: string): ModelInfo | null {
        return this.modelCapabilities[modelName] || null;
    }

    /**
     * Palauttaa mallin palveluntarjoajan
     * @param modelName Mallin nimi
     */
    public getProviderForModel(modelName: string): ProviderType {
        // Tarkista ensin suorat määrittelyt
        if (this.providerMap[modelName]) {
            return this.providerMap[modelName];
        }
        
        // Tarkista sitten modelCapabilities
        const modelInfo = this.getModelInfo(modelName);
        if (modelInfo) {
            return modelInfo.provider;
        }
        
        // Tarkista mallien nimeämiskäytännöt
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
        
        // Oletus: paikallinen malli
        return 'local';
    }

    /**
     * Tarkistaa, onko malli paikallinen malli
     * @param modelName Mallin nimi
     */
    public isLocalModel(modelName: string): boolean {
        return Object.values(this.localModels).includes(modelName);
    }

    /**
     * Tarkistaa, onko malli OpenAI-malli
     * @param modelName Mallin nimi
     */
    public isOpenAIModel(modelName: string): boolean {
        // Avoid calling getProviderForModel to prevent circular dependency
        return modelName === 'gpt-4-turbo' || 
               modelName.startsWith('gpt-') || 
               this.providerMap[modelName] === 'openai' ||
               (this.getModelInfo(modelName)?.provider === 'openai');
    }

    /**
     * Tarkistaa, onko malli Anthropic-malli
     * @param modelName Mallin nimi
     */
    public isAnthropicModel(modelName: string): boolean {
        // Avoid calling getProviderForModel to prevent circular dependency
        return modelName === 'claude-3-opus-20240229' || 
               modelName.startsWith('claude-') || 
               this.providerMap[modelName] === 'anthropic' ||
               (this.getModelInfo(modelName)?.provider === 'anthropic');
    }

    /**
     * Tarkistaa, onko malli Ollama-malli
     * @param modelName Mallin nimi
     */
    public isOllamaModel(modelName: string): boolean {
        return Object.values(this.ollamaModels).includes(modelName);
    }

    /**
     * Tarkistaa, onko malli LM Studio -malli
     * @param modelName Mallin nimi
     */
    public isLMStudioModel(modelName: string): boolean {
        return Object.values(this.lmStudioModels).includes(modelName);
    }

    /**
     * Tarkistaa, onko malli kykenevä tiettyyn toimintoon
     * @param modelName Mallin nimi
     * @param capability Kyvykkyys, jota tarkistetaan
     */
    public isModelCapableOf(modelName: string, capability: string): boolean {
        const modelInfo = this.getModelInfo(modelName);
        if (!modelInfo) {
            this.logger.warn(`Ei löydetty mallitietoja mallille ${modelName}. Oletetaan ei kyvykästä.`);
            return false;
        }
        
        return modelInfo.capabilities.includes(capability);
    }

    /**
     * Palauttaa sopivan järjestelmäpromptin tehtävätyypille
     * @param taskType Tehtävän tyyppi
     * @returns Järjestelmäprompti
     */
    public getSystemPrompt(taskType: string): string {
        switch (taskType) {
            case 'seo':
                return "Olet SEO-asiantuntija, joka auttaa luomaan laadukasta sisältöä hakukoneoptimointia varten.";
            case 'code':
                return "Olet kokenut ohjelmoija, joka auttaa koodin kirjoittamisessa, debuggauksessa ja optimoinnissa.";
            case 'decision':
                return "Olet päätöksenteon asiantuntija, joka auttaa analysoimaan vaihtoehtoja ja tekemään perusteltuja päätöksiä.";
            default:
                return "Olet avulias tekoälyassistentti, joka vastaa käyttäjän kysymyksiin selkeästi ja tarkasti.";
        }
    }

    /**
     * Palauttaa kaikki saatavilla olevat mallit ja niiden tiedot
     */
    public getAvailableModels() {
        const modelTypes: ModelType[] = ['seo', 'code', 'decision'];
        const models = {};
        
        // Lisää provider-kohtaiset mallit
        for (const type of modelTypes) {
            models[type] = {};
            
            // Lisää vain käytössä olevat providerit
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
        
        // Lisää mallien yksityiskohtaiset tiedot
        const modelDetails = {};
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
