export interface CompletionRequest {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  stopSequences?: string[];
  modelName: string;
  systemPrompt?: string;
  ignoreAvailabilityCheck?: boolean; // Jos true, pyyntö yritetään vaikka palvelu olisi merkitty ei-saatavilla olevaksi
  retryCount?: number; // Uudelleenyritysten määrä
  timeout?: number; // Pyyntökohtainen timeout millisekunteina
  isLoadTest?: boolean; // Merkintä kuormitustestistä
}

// Batch-pyyntöjen käsittelyä varten
export interface BatchCompletionRequest extends CompletionRequest {
  id?: string; // Valinnainen tunniste batch-pyyntöä varten
}

export interface CompletionResult {
  text: string;
  totalTokens?: number;
  provider: string;
  model: string;
  finishReason?: string;
  success: boolean;
  error?: string;
  errorType?: string; // Virhetyyppi (esim. network_error, timeout, server_error)
  qualityScore?: number;
  latency?: number; // Vasteaika millisekunteina
  wasRetry?: boolean; // Oliko tämä uudelleenyritys
}

export interface ServiceStatus {
  isAvailable: boolean;
  lastError: string | null;
  lastErrorTime: Date | null;
  consecutiveFailures: number;
  totalRequests: number;
  successfulRequests: number;
  successRate?: string;
  averageLatency?: number;
}

export interface AIProvider {
  generateCompletion(request: CompletionRequest): Promise<CompletionResult>;
  isAvailable(): Promise<boolean>;
  getName(): string;
  getServiceStatus?(): ServiceStatus; // Palvelun tilan tiedot
}

export abstract class BaseProvider implements AIProvider {
  // Virhetyypit, joita voidaan käyttää virhetilanteiden luokitteluun
  protected static readonly ERROR_TYPES = {
    NETWORK: 'network_error',
    CONNECTION: 'connection_error',
    TIMEOUT: 'timeout',
    SERVER: 'server_error',
    CLIENT: 'client_error',
    AUTHENTICATION: 'authentication_error',
    RATE_LIMIT: 'rate_limit',
    NOT_FOUND: 'not_found',
    MODEL_NOT_FOUND: 'model_not_found',
    RESOURCE: 'resource_error',
    FORMAT: 'format_error',
    UNKNOWN: 'unknown_error'
  };

  // Virhetyypit, jotka kannattaa yrittää uudelleen
  protected static readonly RETRYABLE_ERROR_TYPES = [
    BaseProvider.ERROR_TYPES.NETWORK,
    BaseProvider.ERROR_TYPES.CONNECTION,
    BaseProvider.ERROR_TYPES.TIMEOUT,
    BaseProvider.ERROR_TYPES.SERVER,
    BaseProvider.ERROR_TYPES.RATE_LIMIT
  ];

  // Palvelun tilan seuranta
  protected serviceStatus: ServiceStatus = {
    isAvailable: true,
    lastError: null,
    lastErrorTime: null,
    consecutiveFailures: 0,
    totalRequests: 0,
    successfulRequests: 0,
    averageLatency: 0
  };

  abstract generateCompletion(request: CompletionRequest): Promise<CompletionResult>;

  async isAvailable(): Promise<boolean> {
    try {
      return true;
    } catch (error: any) {
      return this.handleAvailabilityError(error);
    }
  }

  protected handleAvailabilityError(error: any): boolean {
    this.logError('Error in BaseProvider.isAvailable:', error);
    this.updateServiceStatus(false, error);
    return false;
  }

  abstract getName(): string;

  /**
   * Palauttaa palvelun tilatiedot
   * @returns Palvelun tilatiedot
   */
  getServiceStatus(): ServiceStatus {
    return {
      ...this.serviceStatus,
      successRate: this.serviceStatus.totalRequests > 0 
        ? (this.serviceStatus.successfulRequests / this.serviceStatus.totalRequests * 100).toFixed(2) + '%'
        : 'N/A'
    };
  }

  /**
   * Päivittää palvelun tilan pyynnön tuloksen perusteella
   * @param success Onnistuiko pyyntö
   * @param error Mahdollinen virhe
   * @param latency Vasteaika millisekunteina
   */
  protected updateServiceStatus(success: boolean, error?: any, latency?: number): void {
    if (success) {
      // Nollataan virhelaskuri onnistuneen pyynnön jälkeen
      this.serviceStatus.consecutiveFailures = 0;
      this.serviceStatus.isAvailable = true;
      this.serviceStatus.lastError = null;
      this.serviceStatus.lastErrorTime = null;
      this.serviceStatus.successfulRequests++;
      
      // Päivitetään keskimääräinen vasteaika
      if (latency) {
        const totalLatency = (this.serviceStatus.averageLatency || 0) * (this.serviceStatus.successfulRequests - 1);
        this.serviceStatus.averageLatency = (totalLatency + latency) / this.serviceStatus.successfulRequests;
      }
    } else {
      // Kasvatetaan virhelaskuria
      this.serviceStatus.consecutiveFailures++;
      this.serviceStatus.lastError = error?.message || 'Unknown error';
      this.serviceStatus.lastErrorTime = new Date();
      
      // Jos virheitä on liian monta peräkkäin, merkitään palvelu ei-saatavilla olevaksi
      if (this.serviceStatus.consecutiveFailures >= 5) {
        this.serviceStatus.isAvailable = false;
      }
    }
    
    this.serviceStatus.totalRequests++;
  }

  /**
   * Tunnistaa virhetyypin annetusta virheestä
   * @param error Virhe, jonka tyyppi halutaan tunnistaa
   * @returns Virhetyyppi merkkijonona
   */
  protected identifyErrorType(error: any): string {
    // Tarkistetaan yleisiä virheviestejä
    const errorMessage = error.message?.toLowerCase() || '';
    
    if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
      return BaseProvider.ERROR_TYPES.TIMEOUT;
    } else if (errorMessage.includes('network') || errorMessage.includes('connection')) {
      return BaseProvider.ERROR_TYPES.NETWORK;
    } else if (errorMessage.includes('model') && 
              (errorMessage.includes('not found') || errorMessage.includes('not available'))) {
      return BaseProvider.ERROR_TYPES.MODEL_NOT_FOUND;
    } else if (errorMessage.includes('memory') || errorMessage.includes('resources')) {
      return BaseProvider.ERROR_TYPES.RESOURCE;
    } else if (errorMessage.includes('format') || errorMessage.includes('parse')) {
      return BaseProvider.ERROR_TYPES.FORMAT;
    } else if (errorMessage.includes('rate') || errorMessage.includes('limit')) {
      return BaseProvider.ERROR_TYPES.RATE_LIMIT;
    } else if (errorMessage.includes('auth') || errorMessage.includes('key') || 
              errorMessage.includes('permission')) {
      return BaseProvider.ERROR_TYPES.AUTHENTICATION;
    } else if (errorMessage.includes('not found') || errorMessage.includes('404')) {
      return BaseProvider.ERROR_TYPES.NOT_FOUND;
    } else if (errorMessage.includes('server') || errorMessage.includes('500')) {
      return BaseProvider.ERROR_TYPES.SERVER;
    }
    
    return BaseProvider.ERROR_TYPES.UNKNOWN;
  }

  /**
   * Päättää pitäisikö pyyntö yrittää uudelleen virhetyypin perusteella
   * @param errorType Virhetyyppi
   * @returns true jos pyyntö pitäisi yrittää uudelleen
   */
  protected shouldRetry(errorType: string): boolean {
    return BaseProvider.RETRYABLE_ERROR_TYPES.includes(errorType);
  }

  protected calculateQualityScore(text: string): number {
    if (!text) return 0;

    const lengthScore = Math.min(text.length / 1000, 0.5);

    const lines = text.split('\n').length;
    const structureScore = Math.min(lines / 10, 1);

    const codeScore = text.includes('```') ? 1 : 0;

    return lengthScore + structureScore + codeScore;
  }

  protected logError(message: string, error: any): void {
    console.error(message, error);
  }
}
