import { config } from 'dotenv';
import * as process from 'process';
import { ProviderType } from '../services/ModelSelector';

// Load environment variables from .env file
config();

function getProviderPriorityArray(): ProviderType[] {
  // Sort service providers by priority (lower number = higher priority)
  const priorityObject = {
    lmstudio: parseInt(process.env.LMSTUDIO_PRIORITY || '1'),
    ollama: parseInt(process.env.OLLAMA_PRIORITY || '2'),
    local: parseInt(process.env.LOCAL_PRIORITY || '3'),
    openai: parseInt(process.env.OPENAI_PRIORITY || '4'),
    anthropic: parseInt(process.env.ANTHROPIC_PRIORITY || '5')
  };
  
  return Object.entries(priorityObject)
    .sort((a, b) => a[1] - b[1])
    .map(entry => entry[0]);
}

export const environment = {
  // API Keys
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  
  // Model Configuration
  defaultModelType: process.env.DEFAULT_MODEL_TYPE || 'seo',
  fallbackThreshold: parseFloat(process.env.FALLBACK_THRESHOLD || '0.7'),
  useLocalModels: process.env.USE_LOCAL_MODELS === 'true',
  useLMStudio: process.env.USE_LM_STUDIO === 'true',
  useOllama: process.env.USE_OLLAMA === 'true',
  useOpenAI: process.env.USE_OPENAI !== 'false', // Enabled by default unless explicitly disabled
  useAnthropic: process.env.USE_ANTHROPIC !== 'false', // Enabled by default unless explicitly disabled
  
  // Provider API Endpoints
  localApiEndpoint: process.env.LOCAL_API_ENDPOINT || 'http://localhost:3001',
  lmStudioApiEndpoint: process.env.LMSTUDIO_API_ENDPOINT || 'http://localhost:1234',
  ollamaApiEndpoint: process.env.OLLAMA_API_ENDPOINT || 'http://localhost:11434',
  
  // Provider Priority (Lower number = higher priority)
  providerPriority: {
    lmstudio: parseInt(process.env.LMSTUDIO_PRIORITY || '1'),
    ollama: parseInt(process.env.OLLAMA_PRIORITY || '2'),
    local: parseInt(process.env.LOCAL_PRIORITY || '3'),
    openai: parseInt(process.env.OPENAI_PRIORITY || '4'),
    anthropic: parseInt(process.env.ANTHROPIC_PRIORITY || '5')
  },
  
  // Provider Priority as array (sorted by priority)
  providerPriorityArray: getProviderPriorityArray(),
  
  // Local Model Paths
  localModelsDir: process.env.LOCAL_MODELS_DIR || '/path/to/local/models',

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
};

// Validate required environment variables
export function validateEnvironment(): boolean {
  const usingLocalProviders = environment.useLocalModels || 
                             environment.useLMStudio || 
                             environment.useOllama;
                             
  if (!usingLocalProviders) {
    // If not using any local providers, API keys are required
    if (environment.useOpenAI && !environment.openaiApiKey) {
      console.error('OPENAI_API_KEY is required when OpenAI is enabled and not using local models');
      return false;
    }
    if (environment.useAnthropic && !environment.anthropicApiKey) {
      console.error('ANTHROPIC_API_KEY is required when Anthropic is enabled and not using local models');
      return false;
    }
  }
  return true;
}
