import { Controller, Post, Body, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { EvilBotService, Decision } from '../services/EvilBotService';

interface DecisionRequestDto {
  situation: string;
  options: string[];
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

  constructor(private evilBotService: EvilBotService) {}

  @Post('decide')
  async makeDecision(@Body() request: DecisionRequestDto): Promise<Decision> {
    // Validate request
    if (!request || typeof request !== 'object') {
      this.logger.error('Virheellinen pyyntö: pyyntöobjekti puuttuu');
      throw new HttpException({
        status: HttpStatus.BAD_REQUEST,
        error: 'Virheellinen pyyntö: pyyntöobjekti puuttuu'
      }, HttpStatus.BAD_REQUEST);
    }
    
    if (!request.situation || typeof request.situation !== 'string' || request.situation.trim() === '') {
      this.logger.error('Virheellinen pyyntö: tilanne puuttuu tai on tyhjä');
      throw new HttpException({
        status: HttpStatus.BAD_REQUEST,
        error: 'Virheellinen pyyntö: tilanne puuttuu tai on tyhjä'
      }, HttpStatus.BAD_REQUEST);
    }
    
    if (!request.options || !Array.isArray(request.options) || request.options.length === 0) {
      this.logger.error('Virheellinen pyyntö: vaihtoehdot puuttuvat tai lista on tyhjä');
      throw new HttpException({
        status: HttpStatus.BAD_REQUEST,
        error: 'Virheellinen pyyntö: vaihtoehdot puuttuvat tai lista on tyhjä' 
      }, HttpStatus.BAD_REQUEST);
    }
    
    // Varmistetaan, että kaikki vaihtoehdot ovat merkkijonoja
    if (!request.options.every(option => typeof option === 'string' && option.trim() !== '')) {
      this.logger.error('Virheellinen pyyntö: kaikki vaihtoehdot eivät ole kelvollisia merkkijonoja');
      throw new HttpException({
        status: HttpStatus.BAD_REQUEST,
        error: 'Virheellinen pyyntö: kaikki vaihtoehdot eivät ole kelvollisia merkkijonoja'
      }, HttpStatus.BAD_REQUEST);
    }
    
    this.logger.log(`Evil Bot tekee päätöstä tilanteessa: ${request.situation.substring(0, 50)}...`);
    
    try {
      const result = await this.evilBotService.makeDecision(request.situation, request.options);
      
      // Tarkista, onko vastaus AIGateway:n virheilmoitus
      if (isAIErrorResponse(result)) {
        this.logger.error(`AI-palvelun virhe: ${result.message}`);
        throw new HttpException({
          status: HttpStatus.SERVICE_UNAVAILABLE,
          error: result.message,
          details: result.details
        }, HttpStatus.SERVICE_UNAVAILABLE);
      }
      
      // Varmistetaan, että kyseessä on Decision-tyyppinen vastaus
      if (isDecision(result)) {
        return result;
      } else {
        this.logger.error('Odottamaton vastausmuoto AI-palvelulta');
        throw new HttpException({
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Odottamaton vastausmuoto AI-palvelulta'
        }, HttpStatus.INTERNAL_SERVER_ERROR);
      }
    } catch (error) {
      // Jos kyseessä on jo HttpException, heitetään se eteenpäin
      if (error instanceof HttpException) {
        throw error;
      }
      
      // Muu tuntematon virhe
      this.logger.error(`Odottamaton virhe päätöksenteossa: ${error.message}`);
      throw new HttpException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        error: 'Järjestelmävirhe päätöksenteossa',
        details: error.message
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
