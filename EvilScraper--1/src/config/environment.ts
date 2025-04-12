// ...existing code...

export function validateEnvironment(): boolean {
  // Check local providers with nullish coalescing
  const localProviders = {
    useLocal: environment.useLocalModels ?? false,
    useLMStudio: environment.useLMStudio ?? false,
    useOllama: environment.useOllama ?? false
  };
  
  // Chain nullish coalescing for provider checks
  const hasLocalProvider = localProviders.useLocal ?? 
                         (localProviders.useLMStudio ?? 
                          localProviders.useOllama);
                             
  if (!hasLocalProvider) {
    // Check cloud provider configurations
    const openAIConfig = {
      enabled: environment.useOpenAI ?? true,
      keyPresent: (environment.openaiApiKey ?? '') !== ''
    };
    
    const anthropicConfig = {
      enabled: environment.useAnthropic ?? true,
      keyPresent: (environment.anthropicApiKey ?? '') !== ''
    };
    
    // Validate OpenAI configuration
    if (openAIConfig.enabled && !openAIConfig.keyPresent) {
      console.error('OPENAI_API_KEY is required when OpenAI is enabled and not using local models');
      return false;
    }
    
    // Validate Anthropic configuration
    if (anthropicConfig.enabled && !anthropicConfig.keyPresent) {
      console.error('ANTHROPIC_API_KEY is required when Anthropic is enabled and not using local models');
      return false;
    }
  }
  return true;
}
