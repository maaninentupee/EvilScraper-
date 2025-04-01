import { Injectable, Logger } from '@nestjs/common';
import { BaseProvider, CompletionRequest, CompletionResult } from './BaseProvider';
import { environment } from '../../config/environment';
import OpenAI from 'openai';

@Injectable()
export class OpenAIProvider extends BaseProvider {
  private readonly logger = new Logger(OpenAIProvider.name);
  private readonly client: OpenAI | undefined;

  constructor() {
    super();
    if (environment.openaiApiKey) {
      this.client = new OpenAI({
        apiKey: environment.openaiApiKey
      });
    }
  }

  async generateCompletion(request: CompletionRequest): Promise<CompletionResult> {
    if (!this.client) {
      return {
        text: '',
        provider: this.getName(),
        model: request.modelName,
        success: false,
        error: 'OpenAI client not initialized. API key missing.',
        qualityScore: 0
      };
    }

    try {
      this.logger.log(`Generating completion with OpenAI model: ${request.modelName}`);
      
      const response = await this.client.chat.completions.create({
        model: request.modelName,
        messages: [
          ...(request.systemPrompt ? [{ role: 'system' as const, content: request.systemPrompt }] : []),
          { role: 'user' as const, content: request.prompt }
        ],
        max_tokens: request.maxTokens,
        temperature: request.temperature,
        stop: request.stopSequences
      });

      const text = response.choices[0]?.message?.content || '';
      const qualityScore = this.calculateQualityScore(text);
      
      return {
        text,
        totalTokens: response.usage?.total_tokens,
        provider: this.getName(),
        model: request.modelName,
        finishReason: response.choices[0]?.finish_reason || undefined,
        success: true,
        qualityScore
      };
    } catch (error) {
      this.logger.error(`Error generating completion with OpenAI: ${error.message}`);
      return {
        text: '',
        provider: this.getName(),
        model: request.modelName,
        success: false,
        error: error.message,
        qualityScore: 0
      };
    }
  }

  getName(): string {
    return 'openai';
  }

  async isAvailable(): Promise<boolean> {
    if (!environment.openaiApiKey) return false;
    
    try {
      // Simple API check to verify connectivity
      await this.client.models.list();
      return true;
    } catch (error) {
      this.logger.error(`OpenAI API not available: ${error.message}`);
      return false;
    }
  }
}
