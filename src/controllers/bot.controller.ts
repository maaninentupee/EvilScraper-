import { Controller, Post, Body, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { BotService } from '../services/BotService';

interface UserInputDto {
  message: string;
}

// AIGateway:n palauttama virhetyyppi
interface AIErrorResponse {
  error: boolean;
  message: string;
  details?: string;
}

// Tyypinvarmistukset
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

  constructor(private botService: BotService) {}

  @Post('decide')
  async decideNextAction(@Body() request: UserInputDto) {
    // Tarkistetaan, onko viesti tyhjä tai null
    if (!request.message) {
      this.logger.error('Virheellinen syöte: viesti on tyhjä tai null');
      throw new HttpException(
        'Virheellinen syöte: viesti ei voi olla tyhjä tai null',
        HttpStatus.BAD_REQUEST
      );
    }
    
    this.logger.log(`Käsitellään käyttäjän syöte: ${request.message.substring(0, 50)}...`);
    
    const decision = await this.botService.decideNextAction(request.message);
    
    // Tarkista, onko vastaus virheilmoitus
    if (isAIErrorResponse(decision)) {
      this.logger.error(`AI-palvelun virhe: ${decision.message}`);
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
