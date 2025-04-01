import { Controller, Post, Body, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { BotService } from '../services/BotService';

interface UserInputDto {
  message: string;
}

// AI Gateway's returned error type
interface AIErrorResponse {
  error: boolean;
  message: string;
  details?: string;
}

// Type checks
function isAIErrorResponse(obj: any): obj is AIErrorResponse {
  return obj 
    && typeof obj === 'object'
    && 'error' in obj 
    && typeof obj.error === 'boolean'
    && obj.error === true
    && 'message' in obj 
    && typeof obj.message === 'string';
}

@Controller('bot')
export class BotController {
  private readonly logger = new Logger(BotController.name);

  constructor(private readonly botService: BotService) {}

  @Post('decide')
  async decideNextAction(@Body() request: UserInputDto) {
    // Check if the message is empty or null
    if (!request.message) {
      this.logger.error('Invalid input: message is empty or null');
      throw new HttpException(
        'Invalid input: message cannot be empty or null',
        HttpStatus.BAD_REQUEST
      );
    }
    
    this.logger.log(`Processing user input: ${request.message.substring(0, 50)}...`);
    
    const decision = await this.botService.decideNextAction(request.message);
    
    // Check if the response is an error message
    if (isAIErrorResponse(decision)) {
      this.logger.error(`AI service error: ${decision.message}`);
      throw new HttpException({
        status: HttpStatus.SERVICE_UNAVAILABLE,
        error: decision.message,
        details: decision.details
      }, HttpStatus.SERVICE_UNAVAILABLE);
    }
    
    return {
      decision,
      timestamp: new Date().toISOString()
    };
  }
}
