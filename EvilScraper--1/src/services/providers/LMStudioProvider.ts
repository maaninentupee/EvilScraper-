import { Injectable, Logger } from '@nestjs/common';
import { BaseProvider, CompletionRequest, CompletionResult } from './BaseProvider';
import { environment } from '../../config/environment';
import axios from 'axios';

@Injectable()
export class LMStudioProvider extends BaseProvider {
  private readonly logger = new Logger(LMStudioProvider.name);
  private readonly axiosInstance;
  private activeRequests = 0;
  private readonly MAX_CONCURRENT_REQUESTS = 20; // Limit the number of concurrent requests
  private readonly requestQueue = [];
  private readonly isProcessingQueue = false;

  constructor() {
    super();
    // Create a custom axios instance with better configuration
    this.axiosInstance = axios.create({
      baseURL: environment.lmStudioApiEndpoint,
      timeout: 60000, // 60 second timeout (previously 30 seconds)
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  async generateCompletion(request: CompletionRequest): Promise<CompletionResult> {
    // If the number of concurrent requests is too high, add the request to the queue
    if (this.activeRequests >= this.MAX_CONCURRENT_REQUESTS) {
      return new Promise((resolve, reject) => {
        this.logger.log(`Queuing LM Studio request, current queue length: ${this.requestQueue.length}`);
        this.requestQueue.push({
          request,
          resolve,
          reject
        });
      });
    }

    return this.processCompletionRequest(request);
  }

  private async processCompletionRequest(request: CompletionRequest): Promise<CompletionResult> {
    this.activeRequests++;
    
    try {
      this.logger.log(`Generating completion with LM Studio model: ${request.modelName} (active: ${this.activeRequests})`);
      
      // LM Studio follows OpenAI-compatible API format
      const startTime = Date.now();
      this.logger.log(`Sending request to LM Studio API: ${JSON.stringify({
        model: request.modelName,
        prompt: request.prompt.substring(0, 50) + '...',
        max_tokens: request.maxTokens || 512,
        temperature: request.temperature || 0.7
      })}`);
      
      const response = await this.axiosInstance.post('/completions', {
        model: request.modelName,
        prompt: request.prompt,
        max_tokens: request.maxTokens || 512,
        temperature: request.temperature || 0.7,
        stop: request.stopSequences || []
      });
      
      const duration = Date.now() - startTime;
      this.logger.log(`Received response from LM Studio API in ${duration}ms with status ${response.status}`);

      // Accept both 200 and 201 status codes as successful responses
      if (response.status === 200 || response.status === 201) {
        if (response.data?.choices?.length > 0) {
          const text = response.data?.choices?.[0]?.text;
          const qualityScore = this.calculateQualityScore(text);
          
          return {
            text,
            totalTokens: response.data?.usage?.total_tokens || 0,
            provider: this.getName(),
            model: request.modelName,
            finishReason: response.data?.choices?.[0]?.finish_reason ?? 'unknown',
            success: true,
            qualityScore
          };
        } else {
          throw new Error('LM Studio API returned an unexpected response format');
        }
      }
    } catch (error) {
      this.logger.error(`Error generating completion with LM Studio model: ${error.message}`);
      
      if (error.response) {
        this.logger.error(`LM Studio API error: ${JSON.stringify(error.response.data)}`);
      }
      
      return {
        text: '',
        provider: this.getName(),
        model: request.modelName,
        success: false,
        error: error.message,
        qualityScore: 0
      };
    } finally {
      this.activeRequests--;
      this.processNextQueuedRequest();
    }
  }

  private processNextQueuedRequest(): void {
    if (this.requestQueue.length > 0 && this.activeRequests < this.MAX_CONCURRENT_REQUESTS) {
      const { request, resolve, reject } = this.requestQueue.shift();
      
      this.processCompletionRequest(request)
        .then(resolve)
        .catch(reject);
    }
  }

  getName(): string {
    return 'lmstudio';
  }

  async isAvailable(): Promise<boolean> {
    this.logger.log(`LM Studio isAvailable check, environment.useLMStudio=${environment.useLMStudio}`);
    
    if (!environment.useLMStudio) {
      this.logger.warn('LM Studio provider disabled in environment settings');
      return false;
    }
    
    try {
      this.logger.log(`Attempting to connect to LM Studio API at ${environment.lmStudioApiEndpoint}/models`);
      // LM Studio has a models endpoint to list available models
      const response = await this.axiosInstance.get('/models');
      this.logger.log(`LM Studio API response status: ${response.status}`);
      
      if (response.status === 200) {
        const models = response.data?.data || [];
        if (models.length === 0) {
          this.logger.warn('LM Studio API returned empty models list');
        } else {
          this.logger.log(`LM Studio available models: ${models.map(m => m.id).join(', ')}`);
        }
        return true;
      }
      
      return false;
    } catch (error) {
      this.logger.error(`LM Studio not available: ${error.message}`);
      
      // Add more detailed error information
      if (error.code === 'ECONNREFUSED') {
        this.logger.error('Connection refused: LM Studio server may not be running');
      } else if (error.code === 'ECONNABORTED') {
        this.logger.error('Connection timeout: LM Studio server is not responding in time');
      }
      
      return false;
    }
  }
}
