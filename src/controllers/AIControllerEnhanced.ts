import { Controller, Post, Body, Logger, HttpException, HttpStatus, Ip } from '@nestjs/common';
import { AIGatewayEnhancer } from '../services/AIGatewayEnhancer';
import { SelectionStrategy } from '../services/utils/ProviderSelectionStrategy';
import { EnhancedProcessingOptions } from '../services/AIGatewayEnhancer';

/**
 * Pyyntö tekoälyn käsittelyä varten
 */
interface EnhancedProcessingRequest {
  // Syöte tekoälylle
  input: string;
  
  // Tehtävän tyyppi
  taskType?: string;
  
  // Valintastrategia
  strategy?: string;
  
  // Haluttu palveluntarjoaja
  preferredProvider?: string;
  
  // Käytetäänkö välimuistia
  cacheResults?: boolean;
  
  // Testitila
  testMode?: boolean;
  
  // Simuloitava virhetyyppi testitilassa
  testError?: string;
}

/**
 * Pyyntö tekoälyn eräkäsittelyä varten
 */
interface BatchProcessingRequest {
  // Syötteet tekoälylle
  inputs: string[];
  
  // Tehtävän tyyppi
  taskType?: string;
  
  // Valintastrategia
  strategy?: string;
  
  // Haluttu palveluntarjoaja
  preferredProvider?: string;
  
  // Käytetäänkö välimuistia
  cacheResults?: boolean;
  
  // Testitila
  testMode?: boolean;
  
  // Simuloitava virhetyyppi testitilassa
  testError?: string;
}

/**
 * Paranneltu AI-kontrolleri, joka käyttää AIGatewayEnhancer-luokkaa
 */
@Controller('ai-enhanced')
export class AIControllerEnhanced {
  private readonly logger = new Logger(AIControllerEnhanced.name);
  
  constructor(
    private readonly aiGatewayEnhancer: AIGatewayEnhancer
  ) {}
  
  /**
   * Käsittelee tekoälypyynnön älykkäällä fallback-mekanismilla
   * @param request Pyyntö
   * @returns Tekoälyn vastaus
   */
  @Post('process')
  async processWithSmartFallback(
    @Body() request: EnhancedProcessingRequest,
    @Ip() ip: string
  ) {
    try {
      this.logger.log(`Käsitellään tekoälypyyntö IP-osoitteesta ${ip}`);
      
      const { 
        input, 
        taskType = 'text-generation',
        strategy,
        preferredProvider,
        cacheResults = true,
        testMode = false,
        testError = null
      } = request;
      
      if (!input || input.trim() === '') {
        throw new HttpException('Syöte on pakollinen', HttpStatus.BAD_REQUEST);
      }
      
      // Valitaan strategia
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
            this.logger.warn(`Tuntematon strategia: ${strategy}, käytetään oletusstrategiaa`);
        }
      }
      
      // Käsitellään pyyntö
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
      
      // Palautetaan tulos
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
   * Käsittelee useita tekoälypyyntöjä rinnakkain
   * @param request Pyyntö
   * @returns Tekoälyn vastaukset
   */
  @Post('process-batch')
  async processBatchWithSmartFallback(
    @Body() request: BatchProcessingRequest,
    @Ip() ip: string
  ) {
    try {
      this.logger.log(`Käsitellään tekoälyn eräkäsittelypyyntö IP-osoitteesta ${ip}`);
      
      const { 
        inputs, 
        taskType = 'text-generation',
        strategy,
        preferredProvider,
        cacheResults = true,
        testMode = false,
        testError = null
      } = request;
      
      if (!inputs || !Array.isArray(inputs) || inputs.length === 0) {
        throw new HttpException('Syötteet ovat pakollisia', HttpStatus.BAD_REQUEST);
      }
      
      // Valitaan strategia
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
            this.logger.warn(`Tuntematon strategia: ${strategy}, käytetään oletusstrategiaa`);
        }
      }
      
      // Käsitellään pyyntö
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
      
      // Palautetaan tulos
      return result;
      
    } catch (error) {
      this.logger.error(`Virhe tekoälyn eräkäsittelypyynnön käsittelyssä: ${error.message}`);
      
      throw new HttpException(
        `Virhe tekoälyn eräkäsittelypyynnön käsittelyssä: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
