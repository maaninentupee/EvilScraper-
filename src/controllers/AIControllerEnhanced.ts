import { Controller, Post, Body, Logger, HttpException, HttpStatus, Ip } from '@nestjs/common';
import { AIGatewayEnhancer } from '../services/AIGatewayEnhancer';
import { SelectionStrategy } from '../services/utils/ProviderSelectionStrategy';
import { EnhancedProcessingOptions } from '../services/AIGatewayEnhancer';

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
  preferredProvider?: string;
  
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
  preferredProvider?: string;
  
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
        preferredProvider,
        cacheResults = true,
        testMode = false,
        testError 
      } = request;
      
      if (!input || input.trim() === '') {
        throw new HttpException('Input is required', HttpStatus.BAD_REQUEST);
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
      
      // Process the request
      const result = await this.aiGatewayEnhancer.processWithSmartFallback(
        taskType,
        input,
        {
          strategy: selectionStrategy,
          preferredProvider,
          cacheResults,
          testMode,
          testError
        }
      );
      
      // Return the result
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
        preferredProvider,
        cacheResults = true,
        testMode = false,
        testError 
      } = request;
      
      if (!inputs || !Array.isArray(inputs) || inputs.length === 0) {
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
          preferredProvider,
          cacheResults,
          testMode,
          testError
        }
      );
      
      // Return the result
      return result;
      
    } catch (error) {
      this.logger.error(`Error processing AI batch request: ${error.message}`);
      
      throw new HttpException(
        `Error processing AI batch request: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
