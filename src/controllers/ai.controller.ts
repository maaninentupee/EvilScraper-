import { Controller, Post, Body, Logger, HttpException, HttpStatus, Get, Param, Ip } from '@nestjs/common';
import { AIGateway, AIResponse } from '../services/AIGateway';
import { EvilBotService } from '../services/EvilBotService';
import { ConfigService } from '@nestjs/config';

/**
 * Request for AI processing
 */
interface CompletionRequestDto {
  // Input for the AI
  input: string;
  
  // Task type
  taskType?: string;
  
  // Model name
  modelName?: string;
  
  // Service provider name
  provider?: string;
  
  // Whether to use fallback mechanism
  useFallback?: boolean;
}

/**
 * Request for AI batch processing
 */
interface BatchCompletionRequestDto {
  // Inputs for the AI
  inputs: string[];
  
  // Task type
  taskType?: string;
  
  // Model name
  modelName?: string;
  
  // Service provider name
  provider?: string;
}

/**
 * Request for AI load testing
 */
interface LoadTestRequestDto {
  // Number of requests
  requestCount: number;
  
  // Number of concurrent requests
  concurrentRequests?: number;
  
  // Task type
  taskType?: string;
  
  // Model name
  modelName?: string;
  
  // Input for the AI
  input?: string;
  
  // Whether to use fallback mechanism
  useFallback?: boolean;
}

/**
 * AI load test result
 */
interface LoadTestResult {
  // Number of successful requests
  successCount: number;
  
  // Number of failed requests
  failureCount: number;
  
  // Total number of requests
  totalRequests: number;
  
  // Success rate (0-1)
  successRate: number;
  
  // Average latency in milliseconds
  averageLatency: number;
  
  // Median latency in milliseconds
  medianLatency: number;
  
  // Minimum latency in milliseconds
  minLatency: number;
  
  // Maximum latency in milliseconds
  maxLatency: number;
  
  // Total duration in milliseconds
  totalDuration: number;
  
  // Errors by type
  errorsByType: Record<string, number>;
}

/**
 * Controller for AI processing
 */
@Controller('ai')
export class AIController {
  private readonly logger = new Logger(AIController.name);
  
  constructor(
    private readonly aiGateway: AIGateway,
    private readonly evilBotService: EvilBotService,
    private readonly configService: ConfigService
  ) {}
  
  /**
   * Generates an AI response
   * @param requestDto Request
   * @returns AI response
   */
  @Post('generate')
  async generateCompletion(@Body() requestDto: CompletionRequestDto, @Ip() ip: string) {
    try {
      this.logger.log(`Processing AI request from IP address ${ip}`);
      
      const { input, taskType = 'text-generation', modelName, useFallback = false } = requestDto;
      
      if (!input || input.trim() === '') {
        throw new HttpException('Input is required', HttpStatus.BAD_REQUEST);
      }
      
      // Process the request using the AIGateway class
      let result: AIResponse;
      
      if (useFallback) {
        this.logger.log('Using fallback mechanism');
        result = await this.aiGateway.processAIRequestWithFallback(taskType, input);
      } else {
        result = await this.aiGateway.processAIRequest(taskType, input, modelName);
      }
      
      // Check the result
      if (!result.success) {
        this.logger.error(`Error processing AI request: ${result.error}`);
        
        throw new HttpException(
          `Error processing AI request: ${result.error}`,
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
      
      return result;
      
    } catch (error) {
      this.logger.error(`Error processing AI request: ${error.message}`);
      
      throw new HttpException(
        `Error processing AI request: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
  
  /**
   * Generates an AI response using the EvilBot service
   * @param requestDto Request
   * @returns AI response
   */
  @Post('evil-bot')
  async generateEvilBotResponse(@Body() requestDto: CompletionRequestDto, @Ip() ip: string) {
    try {
      this.logger.log(`Processing EvilBot request from IP address ${ip}`);
      
      const { input, taskType = 'decision-making' } = requestDto;
      
      if (!input || input.trim() === '') {
        throw new HttpException('Input is required', HttpStatus.BAD_REQUEST);
      }
      
      // Process the request using the EvilBotService class
      const result = await this.evilBotService.processRequest(taskType, input);
      
      // Check the result
      if (!result.success) {
        this.logger.error(`Error processing EvilBot request: ${result.error}`);
        
        throw new HttpException(
          `Error processing EvilBot request: ${result.error}`,
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
      
      return result;
      
    } catch (error) {
      this.logger.error(`Error processing EvilBot request: ${error.message}`);
      
      throw new HttpException(
        `Error processing EvilBot request: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
  
  /**
   * Processes multiple AI requests in parallel
   * @param requestDto Request
   * @returns AI responses
   */
  @Post('batch')
  async processBatch(@Body() requestDto: BatchCompletionRequestDto, @Ip() ip: string) {
    try {
      this.logger.log(`Processing AI batch request from IP address ${ip}`);
      
      const { inputs, taskType = 'text-generation' } = requestDto;
      
      if (!inputs || !Array.isArray(inputs) || inputs.length === 0) {
        throw new HttpException('Inputs are required', HttpStatus.BAD_REQUEST);
      }
      
      if (inputs.length > 100) {
        throw new HttpException('Too many inputs (max 100)', HttpStatus.BAD_REQUEST);
      }
      
      // Process the batch request using the AIGateway class
      const results = await this.aiGateway.processBatchRequests(
        taskType || 'code',
        inputs
      );
      
      // Check the results
      const successCount = results.filter(result => result.success).length;
      
      this.logger.log(`Batch processing complete: ${successCount}/${results.length} successful`);
      
      return {
        results,
        summary: {
          totalCount: results.length,
          successCount,
          failureCount: results.length - successCount
        }
      };
      
    } catch (error) {
      this.logger.error(`Error processing AI batch request: ${error.message}`);
      
      throw new HttpException(
        `Error processing AI batch request: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
  
  /**
   * Returns available service providers
   * @returns Service providers
   */
  @Get('providers')
  async getProviders() {
    try {
      const providers = await this.aiGateway.getAvailableProviders();
      
      return {
        providers,
        count: providers.length
      };
      
    } catch (error) {
      this.logger.error(`Error retrieving service providers: ${error.message}`);
      
      throw new HttpException(
        `Error retrieving service providers: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
  
  /**
   * Returns available models
   * @returns Models
   */
  @Get('models')
  async getModels() {
    try {
      const models = this.aiGateway.getAvailableModels();
      
      return {
        models,
        count: Object.keys(models).length
      };
      
    } catch (error) {
      this.logger.error(`Error retrieving models: ${error.message}`);
      
      throw new HttpException(
        `Error retrieving models: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
  
  /**
   * Runs a load test
   * @param provider Service provider name
   * @param requestDto Request
   * @returns Test result
   */
  @Post('load-test/:provider')
  async runLoadTest(
    @Param('provider') provider: string,
    @Body() requestDto: LoadTestRequestDto,
    @Ip() ip: string
  ) {
    try {
      this.logger.log(`Running load test for provider ${provider} from IP address ${ip}`);
      
      const {
        requestCount,
        concurrentRequests = 10,
        taskType = 'text-generation',
        modelName,
        input = 'Test AI service under load',
        useFallback = false
      } = requestDto;
      
      if (requestCount <= 0 || requestCount > 1000) {
        throw new HttpException('Number of requests must be between 1 and 1000', HttpStatus.BAD_REQUEST);
      }
      
      if (concurrentRequests <= 0 || concurrentRequests > 100) {
        throw new HttpException('Number of concurrent requests must be between 1 and 100', HttpStatus.BAD_REQUEST);
      }
      
      // Initialize results
      const results: AIResponse[] = [];
      const latencies: number[] = [];
      const errors: Record<string, number> = {};
      const startTime = Date.now();
      
      // Create request function
      const makeRequest = async (): Promise<void> => {
        const requestStartTime = Date.now();
        
        try {
          let result: AIResponse;
          
          if (useFallback) {
            result = await this.aiGateway.processAIRequestWithFallback(taskType, input);
          } else {
            result = await this.aiGateway.processAIRequest(taskType, input, modelName);
          }
          
          const latency = Date.now() - requestStartTime;
          
          results.push(result);
          latencies.push(latency);
          
          if (!result.success && result.errorType) {
            errors[result.errorType] = (errors[result.errorType] || 0) + 1;
          }
          
        } catch (error) {
          const latency = Date.now() - requestStartTime;
          
          results.push({
            success: false,
            error: error.message,
            provider: 'unknown',
            model: 'unknown'
          });
          
          latencies.push(latency);
          
          const errorType = error.errorType || 'unknown';
          errors[errorType] = (errors[errorType] || 0) + 1;
        }
      };
      
      // Run requests in parallel
      for (let i = 0; i < requestCount; i += concurrentRequests) {
        const batch = Math.min(concurrentRequests, requestCount - i);
        const promises = Array(batch).fill(0).map(() => makeRequest());
        
        await Promise.all(promises);
        
        this.logger.log(`Load test: ${i + batch}/${requestCount} requests processed`);
      }
      
      // Calculate results
      const totalDuration = Date.now() - startTime;
      const successCount = results.filter(result => result.success).length;
      const failureCount = results.length - successCount;
      
      // Sort latencies
      latencies.sort((a, b) => a - b);
      
      const averageLatency = latencies.reduce((sum, latency) => sum + latency, 0) / latencies.length;
      const medianLatency = latencies[Math.floor(latencies.length / 2)];
      const minLatency = latencies[0];
      const maxLatency = latencies[latencies.length - 1];
      
      const result: LoadTestResult = {
        successCount,
        failureCount,
        totalRequests: results.length,
        successRate: successCount / results.length,
        averageLatency,
        medianLatency,
        minLatency,
        maxLatency,
        totalDuration,
        errorsByType: errors
      };
      
      this.logger.log(`Load test complete: ${successCount}/${results.length} successful, duration ${totalDuration}ms`);
      
      return result;
      
    } catch (error) {
      this.logger.error(`Error running load test: ${error.message}`);
      
      throw new HttpException(
        `Error running load test: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
