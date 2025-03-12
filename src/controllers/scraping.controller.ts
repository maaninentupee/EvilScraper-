import { Controller, Post, Body, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ScrapingService } from '../services/ScrapingService';

interface ScrapedDataDto {
  url: string;
  title: string;
  description: string;
  keywords: string[];
  content: string;
  metadata?: Record<string, any>;
}

// AIGateway:n palauttama virhetyyppi
interface AIErrorResponse {
  error: boolean;
  message: string;
  details?: string;
}

// Tyypinvarmistukset
function isScrapedDataDto(obj: any): obj is ScrapedDataDto {
  return obj 
    && typeof obj === 'object'
    && 'url' in obj 
    && typeof obj.url === 'string'
    && 'title' in obj 
    && typeof obj.title === 'string'
    && 'description' in obj 
    && typeof obj.description === 'string'
    && 'keywords' in obj 
    && Array.isArray(obj.keywords)
    && 'content' in obj 
    && typeof obj.content === 'string';
}

function isAIErrorResponse(obj: any): obj is AIErrorResponse {
  return obj 
    && typeof obj === 'object'
    && 'error' in obj 
    && typeof obj.error === 'boolean'
    && obj.error === true
    && 'message' in obj 
    && typeof obj.message === 'string';
}

@Controller('scraping')
export class ScrapingController {
  private readonly logger = new Logger(ScrapingController.name);

  constructor(private scrapingService: ScrapingService) {}

  @Post('analyze-seo')
  async analyzeSEO(@Body() scrapedData: ScrapedDataDto) {
    if (!isScrapedDataDto(scrapedData)) {
      throw new HttpException('Invalid scraped data', HttpStatus.BAD_REQUEST);
    }
    
    this.logger.log(`Analyzing SEO for URL: ${scrapedData.url}`);
    
    const analysis = await this.scrapingService.analyzeSEO(scrapedData);
    
    // Tarkista, onko vastaus virheilmoitus
    if (isAIErrorResponse(analysis)) {
      this.logger.error(`AI-palvelun virhe SEO-analyysissa: ${analysis.message}`);
      throw new HttpException({
        status: HttpStatus.SERVICE_UNAVAILABLE,
        error: analysis.message,
        details: analysis.details
      }, HttpStatus.SERVICE_UNAVAILABLE);
    }
    
    return {
      url: scrapedData.url,
      analysis,
      timestamp: new Date().toISOString()
    };
  }
}
