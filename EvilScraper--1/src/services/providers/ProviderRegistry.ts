import { Injectable, Logger } from '@nestjs/common';
import { BaseProvider } from './BaseProvider';
import { OllamaProvider } from './OllamaProvider';
import { LMStudioProvider } from './LMStudioProvider';
import { OpenAIProvider } from './OpenAIProvider';
import { AnthropicProvider } from './AnthropicProvider';
import { LocalProvider } from './LocalProvider';

@Injectable()
export class ProviderRegistry {
  private readonly logger = new Logger(ProviderRegistry.name);
  private readonly providers: Map<string, BaseProvider> = new Map();

  constructor(
    private readonly ollamaProvider: OllamaProvider,
    readonly lmStudioProvider: LMStudioProvider,
    readonly openAIProvider: OpenAIProvider,
    readonly anthropicProvider: AnthropicProvider,
    readonly localProvider: LocalProvider
  ) {
    this.registerProviders();
  }

  private registerProviders(): void {
    // Register all providers
    this.providers.set(this.ollamaProvider.getName(), this.ollamaProvider);
    this.providers.set(this.lmStudioProvider.getName(), this.lmStudioProvider);
    this.providers.set(this.openAIProvider.getName(), this.openAIProvider);
    this.providers.set(this.anthropicProvider.getName(), this.anthropicProvider);
    this.providers.set(this.localProvider.getName(), this.localProvider);
    
    this.logger.log(`Registered ${this.providers.size} providers`);
  }

  /**
   * Get provider by name
   */
  public getProviderByName(name: string): BaseProvider | undefined {
    return this.providers.get(name);
  }
  
  /**
   * Get provider by name (alias for getProviderByName for backward compatibility)
   */
  public getProvider(name: string): BaseProvider | undefined {
    return this.getProviderByName(name);
  }
  
  /**
   * Get enabled providers
   */
  public getEnabledProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Get all available providers
   */
  public async getAvailableProviders(): Promise<{ name: string; available: boolean }[]> {
    const result = [];
    
    for (const [name, provider] of this.providers.entries()) {
      try {
        const available = await provider.isAvailable();
        result.push({
          name,
          available
        });
      } catch (error) {
        this.logger.error(`Error checking provider availability for ${name}: ${error.message}`);
        result.push({
          name,
          available: false,
          error: error.message
        });
      }
    }
    
    return result;
  }

  /**
   * Get all registered providers
   */
  public getAllProviders(): Map<string, BaseProvider> {
    return this.providers;
  }
}
