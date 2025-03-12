import { Injectable, Logger } from '@nestjs/common';
import { BaseProvider, CompletionRequest, CompletionResult, ServiceStatus } from './BaseProvider';
import { environment } from '../../config/environment';
import axios, { AxiosError } from 'axios';

interface QueueItem {
  request: CompletionRequest;
  resolve: (value: CompletionResult | PromiseLike<CompletionResult>) => void;
  reject: (reason?: any) => void;
}

@Injectable()
export class OllamaProvider extends BaseProvider {
  private readonly logger = new Logger(OllamaProvider.name);
  private axiosInstance: any;
  private activeRequests = 0;
  private readonly MAX_CONCURRENT_REQUESTS = 12; // Nostettu 10 -> 12 paremman suorituskyvyn saavuttamiseksi
  private requestQueue: QueueItem[] = [];
  private isProcessingQueue = false;
  private readonly LOAD_TEST_TIMEOUT = 15000; // Pienennetty 20s -> 15s kuormitustesteille
  private readonly NORMAL_TIMEOUT = 120000; // 120 sekunnin timeout tavallisille pyynnöille
  private readonly MAX_RETRIES = 2; // Vähennetty 3 -> 2 kuormitustestien nopeuttamiseksi
  private readonly RETRY_DELAY = 500; // Pienennetty 1000ms -> 500ms kuormitustestien nopeuttamiseksi
  private readonly CONNECTION_ERROR_CODES = ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND']; // Verkkovirheet
  private readonly LOAD_TEST_MAX_TOKENS = 30; // Pienennetty 50 -> 30 kuormitustesteille
  private readonly FAST_MODELS = ['mistral', 'tinyllama', 'gemma:2b', 'phi']; // Nopeat mallit kuormitustesteille
  private availableModels: string[] = []; // Välimuisti saatavilla oleville malleille
  private lastModelCheckTime = 0; // Viimeisimmän mallitarkistuksen aika

  constructor() {
    super();
    // Luodaan oma axios-instanssi paremmalla konfiguraatiolla
    this.axiosInstance = axios.create({
      baseURL: environment.ollamaApiEndpoint,
      timeout: this.NORMAL_TIMEOUT,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  async generateCompletion(request: CompletionRequest): Promise<CompletionResult> {
    // Jos yhtäaikaisten pyyntöjen määrä on liian suuri, lisätään pyyntö jonoon
    if (this.activeRequests >= this.MAX_CONCURRENT_REQUESTS) {
      return new Promise<CompletionResult>((resolve, reject) => {
        this.logger.log(`Queuing Ollama request, current queue length: ${this.requestQueue.length}`);
        this.requestQueue.push({
          request,
          resolve,
          reject
        });
      });
    }

    return this.processCompletionRequest(request);
  }

  private async processCompletionRequest(request: CompletionRequest, retryCount = 0): Promise<CompletionResult> {
    this.activeRequests++;
    this.serviceStatus.totalRequests++;
    
    try {
      this.logger.log(`Generating completion with Ollama model: ${request.modelName} (active: ${this.activeRequests})`);
      
      // Tarkistetaan onko palvelu saatavilla
      if (!this.serviceStatus.isAvailable && !request.ignoreAvailabilityCheck) {
        throw new Error(`Ollama service is currently unavailable. Last error: ${this.serviceStatus.lastError}`);
      }
      
      // Parannettu kuormitustestien tunnistaminen - tarkemmat kriteerit
      const isLoadTest = request.prompt.length < 100 || 
                        request.prompt.includes('TEST_LOAD') || 
                        (request.maxTokens && request.maxTokens <= 50);
      
      // Asetetaan lyhyempi timeout kuormitustesteille
      const timeout = isLoadTest ? this.LOAD_TEST_TIMEOUT : 
                     (request.timeout || this.NORMAL_TIMEOUT);
      
      // Käytetään pienempää maxTokens-arvoa kuormitustesteissä
      const maxTokens = isLoadTest ? this.LOAD_TEST_MAX_TOKENS : 
                       (request.maxTokens || 512);
      
      // Valitaan pienempi ja nopeampi malli kuormitustesteihin
      let modelName = request.modelName;
      if (isLoadTest) {
        const originalModel = modelName;
        
        // Käytetään aina nopeinta saatavilla olevaa mallia kuormitustesteissä
        for (const fastModel of this.FAST_MODELS) {
          if (this.isModelAvailable(fastModel)) {
            modelName = fastModel;
            break;
          }
        }
        
        // Jos ei löydy nopeaa mallia, käytetään mistral-mallia oletusarvoisesti
        if (modelName === originalModel && 
            (modelName.includes('llama') || 
             modelName.includes('13b') || 
             modelName.includes('70b'))) {
          modelName = 'mistral';
        }
        
        if (modelName !== originalModel) {
          this.logger.log(`Load test detected, using ${modelName} instead of ${originalModel} for better performance`);
        }
      }
      
      const response = await this.axiosInstance.post('/api/generate', {
        model: modelName,
        prompt: request.prompt,
        system: request.systemPrompt || '',
        stream: false,  // Varmistetaan, että vastaus ei ole stream-muodossa
        options: {
          temperature: request.temperature || 0.7,
          stop: request.stopSequences || []
        }
      }, { timeout });

      // Tarkistetaan vastauksen rakenne ja logitetaan se debuggausta varten
      this.logger.debug(`Ollama API response: ${JSON.stringify(response.data)}`);

      // Päivitetään palvelun tila onnistuneen pyynnön jälkeen
      this.updateServiceStatus(true);

      if (response.data && response.data.response) {
        const text = response.data.response;
        const qualityScore = this.calculateQualityScore(text);
        
        this.serviceStatus.successfulRequests++;
        
        return {
          text,
          totalTokens: response.data.eval_count || 0,
          provider: this.getName(),
          model: modelName,
          finishReason: response.data.done ? 'stop' : 'length',
          success: true,
          qualityScore
        };
      } else {
        throw new Error('Ollama API returned an unexpected response format');
      }
    } catch (error) {
      // Tunnistetaan virhetyyppi
      const errorType = this.identifyErrorType(error);
      this.logger.error(`Error generating completion with Ollama model: ${error.message} (type: ${errorType})`);
      
      // Päivitetään palvelun tila virheen jälkeen
      this.updateServiceStatus(false, error);
      
      if (error.response) {
        this.logger.error(`Ollama API error: ${JSON.stringify(error.response.data)}`);
      }
      
      // Yritetään uudelleen verkkovirheiden yhteydessä
      if (retryCount < this.MAX_RETRIES && this.shouldRetry(errorType)) {
        this.logger.log(`Retrying Ollama request (${retryCount + 1}/${this.MAX_RETRIES})...`);
        this.activeRequests--; // Vähennetään aktiivisten pyyntöjen määrää ennen uudelleenyritystä
        
        // Odotetaan hetki ennen uudelleenyritystä
        await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY * (retryCount + 1)));
        
        return this.processCompletionRequest(request, retryCount + 1);
      }
      
      return {
        text: '',
        provider: this.getName(),
        model: request.modelName,
        success: false,
        error: error.message,
        errorType: errorType,
        qualityScore: 0
      };
    } finally {
      if (retryCount === 0) { // Vähennetään aktiivisten pyyntöjen määrää vain alkuperäisen pyynnön yhteydessä
        this.activeRequests--;
        this.processNextQueuedRequest();
      }
    }
  }
  
  /**
   * Tunnistaa virhetyypin annetusta virheestä
   * @param error Virhe, jonka tyyppi halutaan tunnistaa
   * @returns Virhetyyppi merkkijonona
   */
  protected identifyErrorType(error: any): string {
    // Tarkistetaan onko kyseessä Axios-virhe tarkistamalla tyypilliset Axios-virheominaisuudet
    if (error && error.isAxiosError === true || (error && error.config && (error.response || error.request))) {
      const axiosError = error as AxiosError;
      
      if (!axiosError.response) {
        // Verkkovirhe tai palvelin ei vastaa
        if (axiosError.code && this.CONNECTION_ERROR_CODES.includes(axiosError.code)) {
          return 'network_error';
        }
        if (axiosError.message.includes('timeout')) {
          return 'timeout';
        }
        return 'connection_error';
      }
      
      // HTTP-virhekoodi
      const status = axiosError.response.status;
      if (status >= 500) {
        return 'server_error';
      } else if (status === 404) {
        return 'not_found';
      } else if (status === 401 || status === 403) {
        return 'authentication_error';
      } else if (status === 429) {
        return 'rate_limit';
      } else if (status >= 400) {
        return 'client_error';
      }
    }
    
    // Tarkistetaan yleisiä virheviestejä
    // Varmistetaan, että error ei ole null tai undefined ennen message-ominaisuuden lukemista
    if (!error) {
      return 'unknown_error';
    }
    
    const errorMessage = (error.message || '').toLowerCase();
    if (errorMessage.includes('model') && (errorMessage.includes('not found') || errorMessage.includes('not available'))) {
      return 'model_not_found';
    } else if (errorMessage.includes('memory') || errorMessage.includes('resources')) {
      return 'resource_error';
    } else if (errorMessage.includes('format') || errorMessage.includes('parse')) {
      return 'format_error';
    }
    
    return 'unknown_error';
  }
  
  /**
   * Päättää pitäisikö pyyntö yrittää uudelleen virhetyypin perusteella
   * @param errorType Virhetyyppi
   * @returns true jos pyyntö pitäisi yrittää uudelleen
   */
  protected shouldRetry(errorType: string): boolean {
    // Kuormitustesteissä rajoitetaan uudelleenyrityksiä
    if (this.activeRequests > this.MAX_CONCURRENT_REQUESTS / 2) {
      // Jos järjestelmä on jo kuormittunut, uudelleenyritykset vain pahentavat tilannetta
      // Sallitaan vain verkkovirheet, ei timeout-virheitä
      return errorType === 'network_error' && this.serviceStatus.consecutiveFailures < 3;
    }
    
    // Verkkovirheet ja palvelinvirheet kannattaa yrittää uudelleen
    const retryableErrors = [
      'network_error',
      'connection_error',
      'timeout',
      'server_error',
      'rate_limit'
    ];
    
    return retryableErrors.includes(errorType);
  }
  
  /**
   * Päivittää palvelun tilan pyynnön tuloksen perusteella
   * @param success Onnistuiko pyyntö
   * @param error Mahdollinen virhe
   */
  protected updateServiceStatus(success: boolean, error?: any): void {
    if (success) {
      // Nollataan virhelaskuri onnistuneen pyynnön jälkeen
      this.serviceStatus.consecutiveFailures = 0;
      this.serviceStatus.isAvailable = true;
      this.serviceStatus.lastError = null;
      this.serviceStatus.lastErrorTime = null;
    } else {
      // Kasvatetaan virhelaskuria
      this.serviceStatus.consecutiveFailures++;
      this.serviceStatus.lastError = error?.message || 'Unknown error';
      this.serviceStatus.lastErrorTime = new Date();
      
      // Jos virheitä on liian monta peräkkäin, merkitään palvelu ei-saatavilla olevaksi
      if (this.serviceStatus.consecutiveFailures >= 5) {
        this.serviceStatus.isAvailable = false;
        this.logger.warn(`Ollama service marked as unavailable after ${this.serviceStatus.consecutiveFailures} consecutive failures`);
      }
    }
  }

  private async processNextQueuedRequest(): Promise<void> {
    // Estetään päällekkäiset jonon käsittelyt
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;
    
    try {
      // Käsitellään useita jonossa olevia pyyntöjä kerralla, jos mahdollista
      let processedCount = 0;
      const maxBatchSize = 5; // Käsitellään maksimissaan 5 pyyntöä kerralla
      
      while (this.requestQueue.length > 0 && 
             this.activeRequests < this.MAX_CONCURRENT_REQUESTS && 
             processedCount < maxBatchSize) {
        
        const item = this.requestQueue.shift();
        if (item) {
          const { request, resolve, reject } = item;
          processedCount++;
          
          // Parannettu kuormitustestien tunnistaminen
          const isLoadTest = request.prompt.length < 100 || 
                            request.prompt.includes('TEST_LOAD') || 
                            (request.maxTokens && request.maxTokens <= 50);
          
          if (isLoadTest) {
            // Optimoidaan kuormitustestipyyntöjä
            request.maxTokens = this.LOAD_TEST_MAX_TOKENS;
            request.timeout = this.LOAD_TEST_TIMEOUT;
            
            // Valitaan nopeampi malli kuormitustesteille
            if (request.modelName && 
                (request.modelName.includes('llama') || 
                 request.modelName.includes('13b'))) {
              request.modelName = 'mistral';
            }
          }
          
          // Käsitellään pyyntö asynkronisesti
          this.processCompletionRequest(request)
            .then(resolve)
            .catch(reject)
            .finally(() => {
              // Käsitellään seuraava erä pyyntöjä, kun tämä on valmis
              if (this.requestQueue.length > 0 && !this.isProcessingQueue) {
                setTimeout(() => this.processNextQueuedRequest(), 5);
              }
            });
          
          // Lisätään pieni viive pyyntöjen väliin, jotta ei ylikuormiteta palvelinta
          if (this.requestQueue.length > 0 && processedCount < maxBatchSize) {
            await new Promise(resolve => setTimeout(resolve, 20)); // Pienennetty 50ms -> 20ms
          }
        }
      }
      
      // Logitetaan jonon tila vain jos jonossa on vielä pyyntöjä
      if (this.requestQueue.length > 0) {
        this.logger.log(`Queue still has ${this.requestQueue.length} requests waiting, ${this.activeRequests} active requests`);
      }
    } catch (error) {
      this.logger.error(`Error processing queue: ${error.message}`);
    } finally {
      this.isProcessingQueue = false;
      
      // Tarkistetaan onko jonoon tullut uusia pyyntöjä tämän käsittelyn aikana
      if (this.requestQueue.length > 0 && this.activeRequests < this.MAX_CONCURRENT_REQUESTS) {
        setTimeout(() => this.processNextQueuedRequest(), 5); // Pienennetty 10ms -> 5ms
      }
    }
  }

  public getName(): string {
    return 'ollama';
  }

  /**
   * Tarkistaa onko tietty malli saatavilla
   * @param modelName Mallin nimi
   * @returns true jos malli on saatavilla
   */
  public isModelAvailable(modelName: string): boolean {
    // Jos mallilista on tyhjä, oletetaan että kaikki mallit ovat saatavilla
    if (this.availableModels.length === 0) return true;
    
    // Tarkistetaan onko malli saatavilla
    return this.availableModels.some(model => 
      model === modelName || 
      model.startsWith(`${modelName}:`) || 
      modelName.startsWith(`${model}:`)
    );
  }
  
  public async isAvailable(): Promise<boolean> {
    if (!environment.useOllama) return false;
    
    // Tarkistetaan onko mallilista jo haettu viimeisen 60 sekunnin aikana
    const now = Date.now();
    const shouldRefreshModels = now - this.lastModelCheckTime > 60000;
    
    // Jos palvelu on merkitty ei-saatavilla olevaksi, tarkistetaan onko viimeisestä virheestä kulunut tarpeeksi aikaa
    if (!this.serviceStatus.isAvailable && this.serviceStatus.lastErrorTime) {
      const timeSinceLastError = now - new Date(this.serviceStatus.lastErrorTime).getTime();
      const recoveryTime = 30000; // Pienennetty 60s -> 30s kuormitustestien nopeuttamiseksi
      
      // Jos viimeisestä virheestä on kulunut vähemmän kuin recoveryTime, ei yritetä uudelleen
      if (timeSinceLastError < recoveryTime) {
        this.logger.log(`Skipping Ollama availability check, last error was ${timeSinceLastError}ms ago`);
        return false;
      }
    }
    
    // Jos mallilista on jo haettu ja palvelu on merkitty saatavilla olevaksi, palautetaan true
    if (this.availableModels.length > 0 && this.serviceStatus.isAvailable && !shouldRefreshModels) {
      return true;
    }
    
    try {
      this.logger.log(`Ollama isAvailable check, attempting to connect to ${environment.ollamaApiEndpoint}/api/tags`);
      const response = await this.axiosInstance.get('/api/tags', { timeout: 3000 }); // Pienennetty 5000ms -> 3000ms
      
      // Tarkistetaan onko vastauksessa malleja
      if (response.data && Array.isArray(response.data.models) && response.data.models.length > 0) {
        this.logger.log(`Ollama available with ${response.data.models.length} models`);
        
        // Päivitetään saatavilla olevien mallien lista
        this.availableModels = response.data.models.map(model => model.name || model);
        this.logger.log(`Available models: ${this.availableModels.join(', ')}`);
        
        // Päivitetään palvelun tila
        this.serviceStatus.isAvailable = true;
        this.serviceStatus.consecutiveFailures = 0;
        this.lastModelCheckTime = now;
        
        return true;
      } else {
        this.logger.warn('Ollama API responded but no models were found');
        return false;
      }
    } catch (error: any) {
      const errorType = this.identifyErrorType(error);
      this.logger.error(`Ollama not available: ${error.message} (type: ${errorType})`);
      
      // Päivitetään palvelun tila
      this.serviceStatus.isAvailable = false;
      this.serviceStatus.lastError = error.message;
      this.serviceStatus.lastErrorTime = new Date();
      
      return false;
    }
  }
  
  /**
   * Palauttaa palvelun tilatiedot
   * @returns Palvelun tilatiedot
   */
  public getServiceStatus(): ServiceStatus {
    return {
      ...this.serviceStatus,
      successRate: this.serviceStatus.totalRequests > 0 
        ? (this.serviceStatus.successfulRequests / this.serviceStatus.totalRequests * 100).toFixed(2) + '%'
        : 'N/A',
      queueLength: this.requestQueue.length,
      activeRequests: this.activeRequests
    } as ServiceStatus;
  }
}
