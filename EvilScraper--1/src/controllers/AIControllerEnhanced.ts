// @ts-ignore: Module '@nestjs/common' not found in this collection; using central dependencies instead.
import { Controller, Post, Body, Logger, HttpException, HttpStatus, Ip, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { AIGatewayEnhancer } from '../services/AIGatewayEnhancer';
import type { EnhancedProcessingOptions } from '../services/AIGatewayEnhancer';
import { SelectionStrategy } from '../services/utils/ProviderSelectionStrategy';

/**
 * Request for AI processing
 */
interface EnhancedProcessingRequest {
  // Input for the AI
  input: string;
  
  // Task type
  taskType?: string;
  
  // Selection strategy
  strategy?: string;
  
  // Preferred service provider
  providerName?: string;
  
  // Whether to use cache
  cacheResults?: boolean;
  
  // Test mode
  testMode?: boolean;
  
  // Error type to simulate in test mode
  testError?: string;
}

/**
 * Request for AI batch processing
 */
interface BatchProcessingRequest {
  // Inputs for the AI
  inputs: string[];
  
  // Task type
  taskType?: string;
  
  // Selection strategy
  strategy?: string;
  
  // Preferred service provider
  providerName?: string;
  
  // Whether to use cache
  cacheResults?: boolean;
  
  // Test mode
  testMode?: boolean;
  
  // Error type to simulate in test mode
  testError?: string;
}

/**
 * Enhanced AI controller that uses the AIGatewayEnhancer class
 */
@Controller('ai-enhanced')
export class AIControllerEnhanced {
  private readonly logger = new Logger(AIControllerEnhanced.name);
  
  constructor(
    private readonly aiGatewayEnhancer: AIGatewayEnhancer
  ) {}
  
  /**
   * Processes an AI request with smart fallback
   * @param request Request
   * @returns AI response
   */
  @Post('process')
  async processWithSmartFallback(
    @Body() request: EnhancedProcessingRequest,
    @Ip() ip: string
  ) {
    try {
      this.logger.log(`Processing AI request from IP address ${ip}`);
      
      const { 
        input, 
        taskType = 'text-generation',
        strategy,
        providerName,
        cacheResults = true,
        testMode = false,
        testError 
      } = request;
      
      if (!input?.trim()) {
        throw new HttpException('Input is required', HttpStatus.BAD_REQUEST);
      }
      
      // Select strategy
      let selectionStrategy = SelectionStrategy.PRIORITY;
      
      if (strategy?.toLowerCase()) {
        switch (strategy.toLowerCase()) {
          case 'performance':
            selectionStrategy = SelectionStrategy.PERFORMANCE;
            break;
          case 'cost':
            selectionStrategy = SelectionStrategy.COST_OPTIMIZED;
            break;
          case 'quality':
            selectionStrategy = SelectionStrategy.PRIORITY;
            break;
          case 'fallback':
            selectionStrategy = SelectionStrategy.FALLBACK;
            break;
          default:
            this.logger.warn(`Unknown strategy: ${strategy}, using default strategy`);
        }
      }

      // Process the request
      return await this.aiGatewayEnhancer.processWithSmartFallback(
        taskType,
        input,
        {
          strategy: selectionStrategy,
          providerName,
          cacheResults,
          testMode,
          testError
        }
      );
      
    } catch (error) {
      this.logger.error(`Error processing AI request: ${error?.message}`);
      
      throw new HttpException(
        `Error processing AI request: ${error?.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
  
  /**
   * Processes multiple AI requests in parallel with smart fallback
   * @param request Request
   * @returns AI responses
   */
  @Post('process-batch')
  async processBatchWithSmartFallback(
    @Body() request: BatchProcessingRequest,
    @Ip() ip: string
  ) {
    try {
      this.logger.log(`Processing AI batch request from IP address ${ip}`);
      
      const { 
        inputs, 
        taskType = 'text-generation',
        strategy,
        providerName,
        cacheResults = true,
        testMode = false,
        testError 
      } = request;
      
      if (!inputs?.length) {
        throw new HttpException('Inputs are required', HttpStatus.BAD_REQUEST);
      }
      
      // Select strategy
      let selectionStrategy = SelectionStrategy.PRIORITY;
      
      if (strategy) {
        switch (strategy.toLowerCase()) {
          case 'performance':
            selectionStrategy = SelectionStrategy.PERFORMANCE;
            break;
          case 'cost':
            selectionStrategy = SelectionStrategy.COST_OPTIMIZED;
            break;
          case 'quality':
            selectionStrategy = SelectionStrategy.PRIORITY;
            break;
          case 'fallback':
            selectionStrategy = SelectionStrategy.FALLBACK;
            break;
          default:
            this.logger.warn(`Unknown strategy: ${strategy}, using default strategy`);
        }
      }
      
      // Process the batch request
      const result = await this.aiGatewayEnhancer.processBatchWithSmartFallback(
        taskType,
        inputs,
        {
          strategy: selectionStrategy,
          providerName,
          cacheResults,
          testMode,
          testError
        }
      );
      
      // Return the result
      return result;
      
    } catch (error) {
      this.logger.error(`Error processing AI batch request: ${error?.message}`);
      
      throw new HttpException(
        `Error processing AI batch request: ${error?.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Process a request with fallback mechanism
   * @param input User input
   * @param taskType Type of AI task
   * @param providerName Optional preferred provider name
   * @returns AI processing result with fallback information
   */
  @Post('fallback')
  async processWithFallback(
    @Body('input') input: string,
    @Body('taskType') taskType: string,
    @Body('providerName') providerName?: string
  ) {
    try {
      if (!input?.trim() || !taskType?.trim()) {
        throw new BadRequestException('Input and task type are required');
      }
      
      // Create options object if providerName is specified
      const options: EnhancedProcessingOptions = providerName?.trim() 
        ? { providerName } 
        : {};
      
      const result = await this.aiGatewayEnhancer.processWithSmartFallback(
        taskType,
        input,
        options
      );
      
      return result;
    } catch (error) {
      this.logger.error(`Error processing fallback AI request: ${error?.message}`);
      throw new InternalServerErrorException('Failed to process request with fallback');
    }
  }

  /**
   * Process a request using the performance strategy with fallback
   * @param input User input
   * @param taskType Type of AI task
   * @param providerName Optional preferred provider
   * @returns AI processing result
   */
  @Post('performance')
  async processWithPerformanceStrategy(
    @Body('input') input: string,
    @Body('taskType') taskType: string,
    @Body('providerName') providerName?: string
  ) {
    if (!input || !taskType) {
      throw new BadRequestException('Input and task type are required');
    }

    try {
      const options: EnhancedProcessingOptions = {};
      
      if (providerName) {
        options.providerName = providerName;
      }
      
      const result = await this.aiGatewayEnhancer.processWithSmartFallback(
        taskType,
        input,
        { ...options, strategy: SelectionStrategy.PERFORMANCE }
      );

      return result;
    } catch (error) {
      this.logger.error(`Error processing with performance strategy: ${error?.message}`);
      throw new InternalServerErrorException('Failed to process request');
    }
  }

  /**
   * Process a batch of inputs using the performance strategy with fallback
   * @param inputs Array of input prompts to process
   * @param taskType Type of AI task
   * @param providerName Optional preferred provider
   * @returns Array of AI processing results
   */
  @Post('batch/performance')
  async processBatchWithPerformanceStrategy(
    @Body('inputs') inputs: string[],
    @Body('taskType') taskType: string,
    @Body('providerName') providerName?: string
  ) {
    if (!inputs || !inputs.length || !taskType) {
      throw new BadRequestException('Inputs array and task type are required');
    }

    try {
      const options: EnhancedProcessingOptions = {};
      
      if (providerName) {
        options.providerName = providerName;
      }
      
      const results = await this.aiGatewayEnhancer.processBatchWithSmartFallback(
        taskType,
        inputs,
        { ...options, strategy: SelectionStrategy.PERFORMANCE }
      );

      return results;
    } catch (error) {
      this.logger.error(`Error processing batch with performance strategy: ${error?.message}`);
      throw new InternalServerErrorException('Failed to process batch');
    }
  }

  /**
   * Process a request with a specific provider
   * @param input User input
   * @param taskType Type of AI task
   * @param providerName Name of the provider to use
   * @returns AI processing result
   */
  @Post('provider')
  async processWithProvider(
    @Body('input') input: string,
    @Body('taskType') taskType: string,
    @Body('providerName') providerName: string
  ) {
    if (!input || !taskType || !providerName) {
      throw new BadRequestException('Input, task type, and provider name are required');
    }

    try {
      const options: EnhancedProcessingOptions = { providerName };
      
      const result = await this.aiGatewayEnhancer.processWithSmartFallback(
        taskType,
        input,
        options
      );

      return result;
    } catch (error) {
      this.logger.error(`Error processing with provider ${providerName}: ${error?.message}`);
      throw new InternalServerErrorException('Failed to process request');
    }
  }
}
