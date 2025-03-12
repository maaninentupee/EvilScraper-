import { Injectable, Logger } from '@nestjs/common';
import { BaseProvider, CompletionRequest, CompletionResult, ServiceStatus } from './BaseProvider';
import { environment } from '../../config/environment';
import * as fs from 'fs';
import * as path from 'path';
import * as childProcess from 'child_process';

@Injectable()
export class LocalProvider extends BaseProvider {
  private readonly logger = new Logger(LocalProvider.name);
  private isServiceAvailable = true;
  private lastError: string | null = null;
  private lastErrorTime: Date | null = null;
  private consecutiveFailures = 0;
  private totalRequests = 0;
  private successfulRequests = 0;
  private readonly MAX_CONSECUTIVE_FAILURES = 3;
  private readonly LLAMA_BINARY_PATH: string;

  constructor() {
    super();
    // Määritellään llama-binäärin polku
    this.LLAMA_BINARY_PATH = this.getLlamaBinaryPath();
    // Tarkistetaan llama-binäärin olemassaolo käynnistyksen yhteydessä
    this.checkLlamaBinaryExists();
  }

  /**
   * Määrittää llama-binäärin polun ympäristön perusteella
   * @returns Absoluuttinen polku llama-binääriin
   */
  private getLlamaBinaryPath(): string {
    // Käytetään ympäristömuuttujaa, jos se on määritetty
    if (process.env.LLAMA_BINARY_PATH) {
      this.logger.log(`Käytetään ympäristömuuttujassa määritettyä llama-binäärin polkua: ${process.env.LLAMA_BINARY_PATH}`);
      return path.resolve(process.env.LLAMA_BINARY_PATH);
    }
    
    // Muuten käytetään projektin juuressa olevaa llama-binääriä
    const defaultPath = path.resolve(process.cwd(), 'llama');
    this.logger.log(`Käytetään oletuspolkua llama-binäärille: ${defaultPath}`);
    return defaultPath;
  }

  /**
   * Tarkistaa llama-binäärin olemassaolon
   */
  private checkLlamaBinaryExists(): void {
    try {
      const absolutePath = path.resolve(this.LLAMA_BINARY_PATH);
      this.logger.log(`Tarkistetaan llama-binäärin olemassaolo polusta: ${absolutePath}`);
      
      if (!fs.existsSync(absolutePath)) {
        this.isServiceAvailable = false;
        this.lastError = `Llama-binääriä ei löydy polusta: ${absolutePath}`;
        this.lastErrorTime = new Date();
        this.consecutiveFailures = this.MAX_CONSECUTIVE_FAILURES; // Asetetaan maksimimäärä epäonnistumisia
        
        this.logger.error(this.lastError);
      } else {
        // Tarkistetaan, onko tiedosto suoritettava
        try {
          fs.accessSync(absolutePath, fs.constants.X_OK);
          this.logger.log(`Llama-binääri löytyi ja on suoritettava: ${absolutePath}`);
          this.isServiceAvailable = true;
        } catch (error) {
          this.isServiceAvailable = false;
          this.lastError = `Llama-binääri löytyi, mutta ei ole suoritettava: ${absolutePath}`;
          this.lastErrorTime = new Date();
          this.consecutiveFailures = this.MAX_CONSECUTIVE_FAILURES;
          
          this.logger.error(this.lastError);
        }
      }
    } catch (error) {
      this.isServiceAvailable = false;
      this.lastError = `Virhe tarkistettaessa llama-binäärin olemassaoloa: ${error.message}`;
      this.lastErrorTime = new Date();
      this.consecutiveFailures = this.MAX_CONSECUTIVE_FAILURES;
      
      this.logger.error(this.lastError);
    }
  }

  /**
   * Hakee mallin tiedostopolun
   * @param modelName Mallin nimi
   * @returns Absoluuttinen polku mallitiedostoon
   */
  private getModelPath(modelName: string): string {
    return path.join(environment.localModelsDir, modelName);
  }

  /**
   * Generoi vastauksen paikallisella mallilla
   * @param request Pyyntö
   * @returns Vastaus
   */
  async generateCompletion(request: CompletionRequest): Promise<CompletionResult> {
    try {
      // Tarkistetaan, onko palvelu käytettävissä
      if (!await this.isAvailable()) {
        return { 
          success: false, 
          error: this.lastError || 'Paikallinen palvelu ei ole saatavilla', 
          errorType: 'service_unavailable',
          text: '',
          provider: this.getName(),
          model: request.modelName || 'unknown'
        };
      }
      
      // Tarkistetaan mallitiedoston olemassaolo
      const modelPath = this.getModelPath(request.modelName);
      if (!fs.existsSync(modelPath)) {
        this.lastError = `Mallitiedostoa ei löydy: ${modelPath}`;
        this.lastErrorTime = new Date();
        this.consecutiveFailures++;
        
        this.logger.error(this.lastError);
        
        return {
          success: false,
          error: this.lastError,
          errorType: 'model_not_found',
          text: '',
          provider: this.getName(),
          model: request.modelName || 'unknown'
        };
      }
      
      // Käytetään runLocalModel-metodia vastauksen generointiin
      this.totalRequests++;
      const result = await this.runLocalModel(modelPath, request);
      
      if (result.success) {
        this.successfulRequests++;
        this.consecutiveFailures = 0;
      } else {
        this.consecutiveFailures++;
        
        // Jos peräkkäisiä epäonnistumisia on liikaa, merkitään palvelu ei-saatavilla olevaksi
        if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
          this.isServiceAvailable = false;
          this.logger.warn(`Palvelu merkitty ei-saatavilla olevaksi ${this.consecutiveFailures} peräkkäisen epäonnistumisen jälkeen`);
        }
      }
      
      return result;
    } catch (error) {
      this.lastError = `Virhe generoidessa vastausta: ${error.message}`;
      this.lastErrorTime = new Date();
      this.consecutiveFailures++;
      
      this.logger.error(this.lastError);
      
      // Jos peräkkäisiä epäonnistumisia on liikaa, merkitään palvelu ei-saatavilla olevaksi
      if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
        this.isServiceAvailable = false;
        this.logger.warn(`Palvelu merkitty ei-saatavilla olevaksi ${this.consecutiveFailures} peräkkäisen epäonnistumisen jälkeen`);
      }
      
      return {
        success: false,
        error: this.lastError,
        errorType: 'unexpected_error',
        text: '',
        provider: this.getName(),
        model: request.modelName || 'unknown'
      };
    }
  }

  getName(): string {
    return 'local';
  }

  getServiceStatus(): ServiceStatus {
    return {
      isAvailable: this.isServiceAvailable,
      lastError: this.lastError,
      lastErrorTime: this.lastErrorTime,
      consecutiveFailures: this.consecutiveFailures,
      totalRequests: this.totalRequests,
      successfulRequests: this.successfulRequests,
      successRate: this.totalRequests > 0 ? `${((this.successfulRequests / this.totalRequests) * 100).toFixed(2)}%` : '0%',
      averageLatency: 0 // Tämä pitäisi laskea oikeasti, mutta nyt käytetään oletusarvoa
    };
  }

  /**
   * Tarkistaa, onko palvelu käytettävissä
   * @returns True, jos palvelu on käytettävissä
   */
  public async isAvailable(): Promise<boolean> {
    try {
      // Jos palvelu on jo merkitty ei-saatavilla olevaksi, tarkistetaan se uudelleen
      if (!this.isServiceAvailable) {
        this.logger.log('Palvelu on merkitty ei-saatavilla olevaksi, tarkistetaan uudelleen');
        this.checkLlamaBinaryExists();
      }
      
      // Jos palvelu on edelleen merkitty ei-saatavilla olevaksi, palautetaan false
      if (!this.isServiceAvailable) {
        this.logger.warn(`Paikallinen palvelu ei ole saatavilla: ${this.lastError}`);
        return false;
      }
      
      // Tarkistetaan llama-binäärin olemassaolo
      const absolutePath = path.resolve(this.LLAMA_BINARY_PATH);
      if (!fs.existsSync(absolutePath)) {
        this.isServiceAvailable = false;
        this.lastError = `Llama-binääriä ei löydy polusta: ${absolutePath}`;
        this.lastErrorTime = new Date();
        this.consecutiveFailures++;
        
        this.logger.error(this.lastError);
        return false;
      }
      
      // Kaikki kunnossa, palvelu on saatavilla
      return true;
    } catch (error) {
      this.isServiceAvailable = false;
      this.lastError = `Virhe tarkistettaessa palvelun saatavuutta: ${error.message}`;
      this.lastErrorTime = new Date();
      this.consecutiveFailures++;
      
      this.logger.error(this.lastError);
      return false;
    }
  }

  /**
   * Suorittaa paikallisen mallin
   * @param modelPath Mallitiedoston polku
   * @param request Pyyntö
   * @returns Vastaus
   */
  private runLocalModel(modelPath: string, request: CompletionRequest): Promise<CompletionResult> {
    return new Promise((resolve) => {
      // Tarkistetaan vielä kerran, onko palvelu käytettävissä
      if (!this.isServiceAvailable) {
        this.logger.warn(`Paikallinen palvelu ei ole käytettävissä: ${this.lastError}`);
        resolve({
          success: false,
          error: this.lastError || 'Paikallinen palvelu ei ole saatavilla',
          errorType: 'service_unavailable',
          text: '',
          provider: this.getName(),
          model: request.modelName || 'unknown'
        });
        return;
      }
      
      // Varmistetaan vielä kerran, että llama-binääri on olemassa
      try {
        const absolutePath = path.resolve(this.LLAMA_BINARY_PATH);
        if (!fs.existsSync(absolutePath)) {
          this.isServiceAvailable = false;
          this.lastError = `Llama-binääriä ei löydy polusta: ${absolutePath}`;
          this.lastErrorTime = new Date();
          this.consecutiveFailures = this.MAX_CONSECUTIVE_FAILURES; // Asetetaan maksimimäärä epäonnistumisia
          
          this.logger.error(this.lastError);
          
          resolve({
            success: false,
            error: this.lastError,
            errorType: 'service_unavailable', // Muutettu binary_not_found -> service_unavailable
            text: '',
            provider: this.getName(),
            model: request.modelName || 'unknown'
          });
          return;
        }
        
        this.logger.log(`Generoidaan vastausta paikallisella mallilla: ${request.modelName}`);
        
        // Käytetään execFile-metodia spawn-metodin sijaan
        // execFile on turvallisempi ja helpompi käsitellä
        childProcess.execFile(absolutePath, [
          '-m', modelPath,
          '--temp', String(request.temperature || 0.7),
          '--ctx_size', '2048',
          '-n', String(request.maxTokens || 1000),
          '-p', request.prompt
        ], { timeout: 30000 }, (error, stdout, stderr) => {
          if (error) {
            this.consecutiveFailures++;
            this.lastError = `Virhe suoritettaessa paikallista mallia: ${error.message || 'Tuntematon virhe'}`;
            this.lastErrorTime = new Date();
            
            // Jos virhe johtuu siitä, että binääriä ei löydy (ENOENT)
            if (error && 'code' in error && error.code === 'ENOENT') {
              this.isServiceAvailable = false;
              this.lastError = `Llama-binääriä ei löydy tai se ei ole suoritettava: ${absolutePath}`;
              this.logger.error(this.lastError);
              
              resolve({
                success: false,
                error: this.lastError,
                errorType: 'service_unavailable',
                text: '',
                provider: this.getName(),
                model: request.modelName || 'unknown'
              });
              return;
            }
            
            if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
              this.isServiceAvailable = false;
              this.logger.warn(`Paikallinen palvelu merkitty ei-saatavilla olevaksi ${this.consecutiveFailures} peräkkäisen epäonnistumisen jälkeen`);
            }
            
            this.logger.error(this.lastError);
            
            resolve({
              success: false,
              error: this.lastError,
              errorType: 'process_error',
              text: '',
              provider: this.getName(),
              model: request.modelName || 'unknown'
            });
            return;
          }
          
          if (stderr && stderr.length > 0) {
            this.logger.warn(`Paikallinen malli tuotti virhetulosteen: ${stderr}`);
          }
          
          // Onnistunut suoritus
          this.logger.log(`Paikallisen mallin suoritus onnistui`);
          
          // Puhdistetaan vastaus
          const cleanedOutput = this.cleanOutput(stdout);
          
          resolve({
            success: true,
            text: cleanedOutput,
            provider: this.getName(),
            model: request.modelName || 'unknown'
          });
        });
      } catch (error) {
        this.consecutiveFailures++;
        this.lastError = `Odottamaton virhe: ${error.message || 'Tuntematon virhe'}`;
        this.lastErrorTime = new Date();
        
        if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
          this.isServiceAvailable = false;
          this.logger.warn(`Paikallinen palvelu merkitty ei-saatavilla olevaksi ${this.consecutiveFailures} peräkkäisen epäonnistumisen jälkeen`);
        }
        
        this.logger.error(this.lastError);
        
        resolve({
          success: false,
          error: this.lastError,
          errorType: 'unexpected_error',
          text: '',
          provider: this.getName(),
          model: request.modelName || 'unknown'
        });
      }
    });
  }

  /**
   * Puhdistaa mallin tuottaman tekstin
   * @param output Mallin tuottama raaka teksti
   * @returns Puhdistettu teksti
   */
  private cleanOutput(output: string): string {
    try {
      // Poistetaan mahdolliset prompt-osiot
      let cleanedOutput = output;
      
      // Poistetaan mahdolliset järjestelmäviestit
      cleanedOutput = cleanedOutput.replace(/^.*?<\/s>/, '').trim();
      
      // Poistetaan ylimääräiset rivinvaihdot
      cleanedOutput = cleanedOutput.replace(/\n{3,}/g, '\n\n');
      
      // Poistetaan mahdolliset mallin tunnisteet
      cleanedOutput = cleanedOutput.replace(/\[.*?\]:/g, '');
      
      return cleanedOutput || output; // Jos puhdistus epäonnistui, palautetaan alkuperäinen
    } catch (error) {
      this.logger.warn(`Error cleaning output: ${error.message}`);
      return output; // Palautetaan alkuperäinen, jos puhdistus epäonnistui
    }
  }

  /**
   * Parsii mallin tuottaman tekstin
   * @param output Mallin tuottama raaka teksti
   * @returns Parsittu teksti
   * @deprecated Käytä cleanOutput-metodia
   */
  private parseOutput(output: string): string {
    return this.cleanOutput(output);
  }
}
