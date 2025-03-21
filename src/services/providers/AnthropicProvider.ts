import { Injectable, Logger } from '@nestjs/common';
import { BaseProvider, CompletionRequest, CompletionResult, BatchCompletionRequest } from './BaseProvider';
import { environment } from '../../config/environment';
import axios from 'axios';

@Injectable()
export class AnthropicProvider extends BaseProvider {
  private readonly logger = new Logger(AnthropicProvider.name);
  private readonly apiUrl = 'https://api.anthropic.com/v1/messages';
  private readonly batchApiUrl = 'https://api.anthropic.com/v1/messages/batches';
  private readonly apiKey: string;
  private readonly batchPollingIntervalMs = 2000; // 2 seconds
  private readonly batchMaxPollingAttempts = 30; // 1 minute maximum

  constructor() {
    super();
    this.apiKey = environment.anthropicApiKey;
  }

  async generateCompletion(request: CompletionRequest): Promise<CompletionResult> {
    if (!this.apiKey) {
      return {
        text: '',
        provider: this.getName(),
        model: request.modelName,
        success: false,
        error: 'Anthropic API key not configured',
        qualityScore: 0
      };
    }

    try {
      this.logger.log(`Generating completion with Anthropic model: ${request.modelName}`);
      
      const response = await axios.post(
        this.apiUrl,
        {
          model: request.modelName,
          messages: [
            { role: 'user', content: request.prompt }
          ],
          max_tokens: request.maxTokens || 1024,
          temperature: request.temperature || 0.7,
          system: request.systemPrompt || ''
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01'
          }
        }
      );

      const content = response.data.content[0]?.text || '';
      const qualityScore = this.calculateQualityScore(content);
      
      return {
        text: content,
        totalTokens: response.data.usage?.output_tokens + response.data.usage?.input_tokens,
        provider: this.getName(),
        model: request.modelName,
        finishReason: response.data.stop_reason,
        success: true,
        qualityScore
      };
    } catch (error) {
      this.logger.error(`Error generating completion with Anthropic: ${error.message}`);
      
      // Determine error type based on response
      let errorType = 'unexpected_error';
      if (error.response) {
        if (error.response.status === 429) {
          errorType = 'rate_limit';
        } else if (error.response.status === 404) {
          errorType = 'model_not_found';
        } else if (error.response.status >= 500) {
          errorType = 'service_unavailable';
        }
      } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        errorType = 'timeout';
      }
      
      return {
        text: '',
        provider: this.getName(),
        model: request.modelName,
        success: false,
        error: error.message,
        errorType,
        qualityScore: 0
      };
    }
  }

  /**
   * Generate responses in batches for multiple requests using the Anthropic Batch API
   * @param requests List of requests
   * @returns List of responses
   */
  async generateBatchCompletions(requests: BatchCompletionRequest[]): Promise<CompletionResult[]> {
    if (!this.apiKey) {
      return requests.map(request => ({
        text: '',
        provider: this.getName(),
        model: request.modelName,
        success: false,
        error: 'Anthropic API key not configured',
        errorType: 'configuration_error',
        qualityScore: 0
      }));
    }

    try {
      this.logger.log(`Generating batch completions with Anthropic for ${requests.length} requests`);
      
      // Create batch requests
      const batchRequests = requests.map((request, index) => ({
        custom_id: `request-${index}`,
        params: {
          model: request.modelName,
          messages: [
            { role: 'user', content: request.prompt }
          ],
          max_tokens: request.maxTokens || 1024,
          temperature: request.temperature || 0.7,
          system: request.systemPrompt || ''
        }
      }));

      // Submit batch request
      const batchResponse = await axios.post(
        this.batchApiUrl,
        {
          requests: batchRequests
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01'
          }
        }
      );

      const batchId = batchResponse.data.id;
      this.logger.log(`Batch created with ID: ${batchId}`);

      // Poll for batch results
      const batchResults = await this.pollBatchResults(batchId);
      
      // Combine results with original requests
      return requests.map((request, index) => {
        const customId = `request-${index}`;
        const result = batchResults.find(r => r.custom_id === customId);
        
        if (!result || result.error) {
          return {
            text: '',
            provider: this.getName(),
            model: request.modelName,
            success: false,
            error: result?.error?.message || 'Batch processing failed',
            errorType: this.mapBatchErrorType(result?.error),
            qualityScore: 0
          };
        }
        
        const content = result.message.content[0]?.text || '';
        const qualityScore = this.calculateQualityScore(content);
        
        return {
          text: content,
          totalTokens: result.message.usage?.output_tokens + result.message.usage?.input_tokens,
          provider: this.getName(),
          model: request.modelName,
          finishReason: result.message.stop_reason,
          success: true,
          qualityScore
        };
      });
    } catch (error) {
      this.logger.error(`Error generating batch completions with Anthropic: ${error.message}`);
      
      // If batch request fails entirely, return error for all requests
      return requests.map(request => ({
        text: '',
        provider: this.getName(),
        model: request.modelName,
        success: false,
        error: error.message,
        errorType: 'batch_processing_error',
        qualityScore: 0
      }));
    }
  }

  /**
   * Poll for batch results until all requests are processed
   * @param batchId Batch ID
   * @returns Batch results
   */
  private async pollBatchResults(batchId: string): Promise<any[]> {
    for (let attempt = 0; attempt < this.batchMaxPollingAttempts; attempt++) {
      try {
        // Check batch status
        const statusResponse = await axios.get(
          `${this.batchApiUrl}/${batchId}`,
          {
            headers: {
              'x-api-key': this.apiKey,
              'anthropic-version': '2023-06-01'
            }
          }
        );
        
        const status = statusResponse.data;
        
        // If batch is complete, retrieve results
        if (status.processing_status === 'completed' && status.results_url) {
          const resultsResponse = await axios.get(
            `${this.batchApiUrl}/${batchId}/results`,
            {
              headers: {
                'x-api-key': this.apiKey,
                'anthropic-version': '2023-06-01'
              }
            }
          );
          
          return resultsResponse.data.results;
        }
        
        // If batch is still processing, wait before next poll
        if (status.processing_status === 'in_progress') {
          await new Promise(resolve => setTimeout(resolve, this.batchPollingIntervalMs));
          continue;
        }
        
        // If batch has failed or been cancelled, return empty list
        if (['errored', 'canceled', 'expired'].includes(status.processing_status)) {
          this.logger.error(`Batch processing failed with status: ${status.processing_status}`);
          return [];
        }
      } catch (error) {
        this.logger.error(`Error polling batch results: ${error.message}`);
        // Continue polling despite error
      }
    }
    
    this.logger.error(`Batch polling timed out after ${this.batchMaxPollingAttempts} attempts`);
    return [];
  }

  /**
   * Map Anthropic batch API error type to internal error type
   * @param error Anthropic batch API error
   * @returns Internal error type
   */
  private mapBatchErrorType(error: any): string {
    if (!error) return 'unexpected_error';
    
    if (error.type === 'rate_limit_error') {
      return 'rate_limit';
    } else if (error.type === 'invalid_request_error' && error.param === 'model') {
      return 'model_not_found';
    } else if (error.type === 'server_error') {
      return 'service_unavailable';
    } else if (error.type === 'timeout_error') {
      return 'timeout';
    }
    
    return 'unexpected_error';
  }

  getName(): string {
    return 'anthropic';
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) return false;
    
    try {
      // Simple API check to verify connectivity
      await axios.get('https://api.anthropic.com/v1/models', {
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        }
      });
      return true;
    } catch (error) {
      this.logger.error(`Anthropic API not available: ${error.message}`);
      return false;
    }
  }
}
