import { Controller, Post, Body, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { EvilBotService, Decision } from '../services/EvilBotService';

interface DecisionRequestDto {
  situation: string;
  options: string[];
}

// AIGateway's error response type
interface AIErrorResponse {
  error: boolean;
  message: string;
  details?: string;
}

// Type validations
function isAIErrorResponse(obj: any): obj is AIErrorResponse {
  return obj 
    && typeof obj === 'object'
    && 'error' in obj 
    && typeof obj.error === 'boolean'
    && obj.error === true
    && 'message' in obj 
    && typeof obj.message === 'string';
}

function isDecision(obj: any): obj is Decision {
  return obj 
    && typeof obj === 'object'
    && 'action' in obj 
    && 'reason' in obj 
    && 'confidence' in obj;
}

@Controller('evil-bot')
export class EvilBotController {
  private readonly logger = new Logger(EvilBotController.name);

  constructor(private readonly evilBotService: EvilBotService) {}

  @Post('decide')
  async makeDecision(@Body() request: DecisionRequestDto): Promise<Decision> {
    // Validate request
    if (!request || typeof request !== 'object') {
      this.logger.error('Invalid request: request object missing');
      throw new HttpException({
        status: HttpStatus.BAD_REQUEST,
        error: 'Invalid request: request object missing'
      }, HttpStatus.BAD_REQUEST);
    }
    
    if (!request.situation || typeof request.situation !== 'string' || request.situation.trim() === '') {
      this.logger.error('Invalid request: situation missing or empty');
      throw new HttpException({
        status: HttpStatus.BAD_REQUEST,
        error: 'Invalid request: situation missing or empty'
      }, HttpStatus.BAD_REQUEST);
    }
    
    if (!request.options || !Array.isArray(request.options) || request.options.length === 0) {
      this.logger.error('Invalid request: options missing or empty array');
      throw new HttpException({
        status: HttpStatus.BAD_REQUEST,
        error: 'Invalid request: options missing or empty array'
      }, HttpStatus.BAD_REQUEST);
    }
    
    // Validate that all options are non-empty strings
    if (!request.options.every(option => typeof option === 'string' && option.trim() !== '')) {
      this.logger.error('Invalid request: not all options are valid non-empty strings');
      throw new HttpException({
        status: HttpStatus.BAD_REQUEST,
        error: 'Invalid request: not all options are valid non-empty strings'
      }, HttpStatus.BAD_REQUEST);
    }
    
    this.logger.log(`Evil Bot making decision in situation: ${request.situation.substring(0, 50)}...`);
    
    try {
      const result = await this.evilBotService.makeDecision(request.situation, request.options);
      
      // Check if the response is an AI gateway error
      if (isAIErrorResponse(result)) {
        this.logger.error(`AI service error: ${result.message}`);
        throw new HttpException({
          status: HttpStatus.SERVICE_UNAVAILABLE,
          error: result.message,
          details: result.details
        }, HttpStatus.SERVICE_UNAVAILABLE);
      }
      
      // Validate that the response is a valid decision
      if (isDecision(result)) {
        return result;
      } else {
        this.logger.error('Unexpected response format from AI service');
        throw new HttpException({
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Unexpected response format from AI service'
        }, HttpStatus.INTERNAL_SERVER_ERROR);
      }
    } catch (error) {
      // If the error is already an HttpException, rethrow it
      if (error instanceof HttpException) {
        throw error;
      }
      
      // Handle any other unexpected errors
      this.logger.error(`Unexpected error making decision: ${error.message}`);
      throw new HttpException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        error: 'System error making decision',
        details: error.message
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
