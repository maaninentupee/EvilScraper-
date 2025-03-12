import { Module } from '@nestjs/common';
import { LocalProvider } from './LocalProvider';
import { OpenAIProvider } from './OpenAIProvider';
import { AnthropicProvider } from './AnthropicProvider';
import { LMStudioProvider } from './LMStudioProvider';
import { OllamaProvider } from './OllamaProvider';
import { ProviderRegistry } from './ProviderRegistry';

@Module({
  providers: [
    LocalProvider,
    OpenAIProvider,
    AnthropicProvider,
    LMStudioProvider,
    OllamaProvider,
    ProviderRegistry
  ],
  exports: [
    LocalProvider,
    OpenAIProvider,
    AnthropicProvider,
    LMStudioProvider,
    OllamaProvider,
    ProviderRegistry
  ]
})
export class ProvidersModule {}
