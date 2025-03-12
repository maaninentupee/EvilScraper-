import { Controller, Post, Body, Logger, HttpException, HttpStatus, Get, Param, Query, Ip } from '@nestjs/common';
import { AIGateway, AIResponse } from '../services/AIGateway';
import { EvilBotService } from '../services/EvilBotService';
import { ConfigService } from '@nestjs/config';

/**
 * Pyyntö tekoälyn käsittelyä varten
 */
interface CompletionRequestDto {
  // Syöte tekoälylle
  input: string;
  
  // Tehtävän tyyppi
  taskType?: string;
  
  // Mallin nimi
  modelName?: string;
  
  // Palveluntarjoajan nimi
  provider?: string;
  
  // Käytetäänkö fallback-mekanismia
  useFallback?: boolean;
}

/**
 * Pyyntö tekoälyn eräkäsittelyä varten
 */
interface BatchCompletionRequestDto {
  // Syötteet tekoälylle
  inputs: string[];
  
  // Tehtävän tyyppi
  taskType?: string;
  
  // Mallin nimi
  modelName?: string;
  
  // Palveluntarjoajan nimi
  provider?: string;
}

/**
 * Pyyntö tekoälyn kuormitustestausta varten
 */
interface LoadTestRequestDto {
  // Pyyntöjen määrä
  requestCount: number;
  
  // Samanaikaisten pyyntöjen määrä
  concurrentRequests?: number;
  
  // Tehtävän tyyppi
  taskType?: string;
  
  // Mallin nimi
  modelName?: string;
  
  // Syöte tekoälylle
  input?: string;
  
  // Käytetäänkö fallback-mekanismia
  useFallback?: boolean;
}

/**
 * Tekoälyn kuormitustestin tulos
 */
interface LoadTestResult {
  // Onnistuneiden pyyntöjen määrä
  successCount: number;
  
  // Epäonnistuneiden pyyntöjen määrä
  failureCount: number;
  
  // Kokonaismäärä pyyntöjä
  totalRequests: number;
  
  // Onnistumisprosentti
  successRate: number;
  
  // Keskimääräinen vasteaika
  averageLatency: number;
  
  // Mediaanivasteaika
  medianLatency: number;
  
  // Minimi vasteaika
  minLatency: number;
  
  // Maksimi vasteaika
  maxLatency: number;
  
  // Testin kokonaiskesto
  totalDuration: number;
  
  // Virheet tyypeittäin
  errorsByType: Record<string, number>;
}

/**
 * Kontrolleri tekoälyn käsittelyä varten
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
   * Generoi tekoälyn vastauksen
   * @param requestDto Pyyntö
   * @returns Tekoälyn vastaus
   */
  @Post('generate')
  async generateCompletion(@Body() requestDto: CompletionRequestDto, @Ip() ip: string) {
    try {
      this.logger.log(`Käsitellään tekoälypyyntö IP-osoitteesta ${ip}`);
      
      const { input, taskType = 'text-generation', modelName, provider, useFallback = false } = requestDto;
      
      if (!input || input.trim() === '') {
        throw new HttpException('Syöte on pakollinen', HttpStatus.BAD_REQUEST);
      }
      
      // Käsitellään pyyntö AIGateway-luokan avulla
      let result: AIResponse;
      
      if (useFallback) {
        this.logger.log('Käytetään fallback-mekanismia');
        result = await this.aiGateway.processAIRequestWithFallback(taskType, input);
      } else {
        result = await this.aiGateway.processAIRequest(taskType, input, modelName);
      }
      
      // Tarkistetaan tulos
      if (!result.success) {
        this.logger.error(`Virhe tekoälypyynnön käsittelyssä: ${result.error}`);
        
        throw new HttpException(
          `Virhe tekoälypyynnön käsittelyssä: ${result.error}`,
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
      
      return result;
      
    } catch (error) {
      this.logger.error(`Virhe tekoälypyynnön käsittelyssä: ${error.message}`);
      
      throw new HttpException(
        `Virhe tekoälypyynnön käsittelyssä: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
  
  /**
   * Generoi tekoälyn vastauksen EvilBot-palvelun avulla
   * @param requestDto Pyyntö
   * @returns Tekoälyn vastaus
   */
  @Post('evil-bot')
  async generateEvilBotResponse(@Body() requestDto: CompletionRequestDto, @Ip() ip: string) {
    try {
      this.logger.log(`Käsitellään EvilBot-pyyntö IP-osoitteesta ${ip}`);
      
      const { input, taskType = 'decision-making' } = requestDto;
      
      if (!input || input.trim() === '') {
        throw new HttpException('Syöte on pakollinen', HttpStatus.BAD_REQUEST);
      }
      
      // Käsitellään pyyntö EvilBotService-luokan avulla
      const result = await this.evilBotService.processRequest(taskType, input);
      
      // Tarkistetaan tulos
      if (!result.success) {
        this.logger.error(`Virhe EvilBot-pyynnön käsittelyssä: ${result.error}`);
        
        throw new HttpException(
          `Virhe EvilBot-pyynnön käsittelyssä: ${result.error}`,
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
      
      return result;
      
    } catch (error) {
      this.logger.error(`Virhe EvilBot-pyynnön käsittelyssä: ${error.message}`);
      
      throw new HttpException(
        `Virhe EvilBot-pyynnön käsittelyssä: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
  
  /**
   * Käsittelee useita tekoälypyyntöjä rinnakkain
   * @param requestDto Pyyntö
   * @returns Tekoälyn vastaukset
   */
  @Post('batch')
  async processBatch(@Body() requestDto: BatchCompletionRequestDto, @Ip() ip: string) {
    try {
      this.logger.log(`Käsitellään tekoälyn eräkäsittelypyyntö IP-osoitteesta ${ip}`);
      
      const { inputs, taskType = 'text-generation' } = requestDto;
      
      if (!inputs || !Array.isArray(inputs) || inputs.length === 0) {
        throw new HttpException('Syötteet ovat pakollisia', HttpStatus.BAD_REQUEST);
      }
      
      if (inputs.length > 100) {
        throw new HttpException('Liian monta syötettä (max 100)', HttpStatus.BAD_REQUEST);
      }
      
      // Käsitellään batch-pyyntö AIGateway-luokan avulla
      const results = await this.aiGateway.processBatchRequests(
        taskType || 'code',
        inputs
      );
      
      // Tarkistetaan tulokset
      const successCount = results.filter(result => result.success).length;
      
      this.logger.log(`Eräkäsittely valmis: ${successCount}/${results.length} onnistui`);
      
      return {
        results,
        summary: {
          totalCount: results.length,
          successCount,
          failureCount: results.length - successCount
        }
      };
      
    } catch (error) {
      this.logger.error(`Virhe tekoälyn eräkäsittelypyynnön käsittelyssä: ${error.message}`);
      
      throw new HttpException(
        `Virhe tekoälyn eräkäsittelypyynnön käsittelyssä: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
  
  /**
   * Palauttaa saatavilla olevat palveluntarjoajat
   * @returns Palveluntarjoajat
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
      this.logger.error(`Virhe palveluntarjoajien hakemisessa: ${error.message}`);
      
      throw new HttpException(
        `Virhe palveluntarjoajien hakemisessa: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
  
  /**
   * Palauttaa saatavilla olevat mallit
   * @returns Mallit
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
      this.logger.error(`Virhe mallien hakemisessa: ${error.message}`);
      
      throw new HttpException(
        `Virhe mallien hakemisessa: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
  
  /**
   * Suorittaa kuormitustestin
   * @param provider Palveluntarjoajan nimi
   * @param requestDto Pyyntö
   * @returns Testin tulos
   */
  @Post('load-test/:provider')
  async runLoadTest(
    @Param('provider') provider: string,
    @Body() requestDto: LoadTestRequestDto,
    @Ip() ip: string
  ) {
    try {
      this.logger.log(`Käynnistetään kuormitustesti palveluntarjoajalle ${provider} IP-osoitteesta ${ip}`);
      
      const {
        requestCount,
        concurrentRequests = 10,
        taskType = 'text-generation',
        modelName,
        input = 'Testaa tekoälypalvelun toimintaa kuormituksen alla',
        useFallback = false
      } = requestDto;
      
      if (requestCount <= 0 || requestCount > 1000) {
        throw new HttpException('Pyyntöjen määrän pitää olla välillä 1-1000', HttpStatus.BAD_REQUEST);
      }
      
      if (concurrentRequests <= 0 || concurrentRequests > 100) {
        throw new HttpException('Samanaikaisten pyyntöjen määrän pitää olla välillä 1-100', HttpStatus.BAD_REQUEST);
      }
      
      // Alustetaan tulokset
      const results: AIResponse[] = [];
      const latencies: number[] = [];
      const errors: Record<string, number> = {};
      const startTime = Date.now();
      
      // Luodaan pyyntöfunktio
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
      
      // Suoritetaan pyynnöt rinnakkain
      for (let i = 0; i < requestCount; i += concurrentRequests) {
        const batch = Math.min(concurrentRequests, requestCount - i);
        const promises = Array(batch).fill(0).map(() => makeRequest());
        
        await Promise.all(promises);
        
        this.logger.log(`Kuormitustesti: ${i + batch}/${requestCount} pyyntöä käsitelty`);
      }
      
      // Lasketaan tulokset
      const totalDuration = Date.now() - startTime;
      const successCount = results.filter(result => result.success).length;
      const failureCount = results.length - successCount;
      
      // Järjestetään latenssit
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
      
      this.logger.log(`Kuormitustesti valmis: ${successCount}/${results.length} onnistui, kesto ${totalDuration}ms`);
      
      return result;
      
    } catch (error) {
      this.logger.error(`Virhe kuormitustestin suorittamisessa: ${error.message}`);
      
      throw new HttpException(
        `Virhe kuormitustestin suorittamisessa: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
