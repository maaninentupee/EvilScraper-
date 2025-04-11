export interface CompletionRequest {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  stopSequences?: string[];
  modelName: string;
  systemPrompt?: string;
  ignoreAvailabilityCheck?: boolean; // If true, the request will be attempted even if the service is marked as unavailable
  retryCount?: number; // Number of retries
  timeout?: number; // Request-specific timeout in milliseconds
  isLoadTest?: boolean; // Indicator for load testing
}

// For handling batch requests
export interface BatchCompletionRequest extends CompletionRequest {
  id?: string; // Optional identifier for batch request
}

export interface CompletionResult {
  text: string;
  totalTokens?: number;
  provider: string;
  model: string;
  finishReason?: string;
  success: boolean;
  error?: string;
  errorType?: string; // Error type (e.g., network_error, timeout, server_error)
  qualityScore?: number;
  latency?: number; // Response time in milliseconds
  wasRetry?: boolean; // Whether this was a retry
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
  getServiceStatus?(): ServiceStatus; // Service status information
}

export abstract class BaseProvider implements AIProvider {
  // Error types that can be used to classify error situations
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

  // Error types that should be retried
  protected static readonly RETRYABLE_ERROR_TYPES = [
    BaseProvider.ERROR_TYPES.NETWORK,
    BaseProvider.ERROR_TYPES.CONNECTION,
    BaseProvider.ERROR_TYPES.TIMEOUT,
    BaseProvider.ERROR_TYPES.SERVER,
    BaseProvider.ERROR_TYPES.RATE_LIMIT
  ];

  // Service status tracking
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
    return true;
  }

  protected handleAvailabilityError(error: any): boolean {
    this.logError('Error in BaseProvider.isAvailable:', error);
    this.updateServiceStatus(false, error);
    return false;
  }

  abstract getName(): string;

  /**
   * Returns service status information
   * @returns Service status information
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
   * Updates service status based on request result
   * @param success Whether the request was successful
   * @param error Optional error
   * @param latency Optional response time in milliseconds
   */
  protected updateServiceStatus(success: boolean, error?: any, latency?: number): void {
    if (success) {
      // Reset error counter after successful request
      this.serviceStatus.consecutiveFailures = 0;
      this.serviceStatus.isAvailable = true;
      this.serviceStatus.lastError = null;
      this.serviceStatus.lastErrorTime = null;
      this.serviceStatus.successfulRequests++;
      
      // Update average latency
      if (latency) {
        const totalLatency = (this.serviceStatus.averageLatency || 0) * (this.serviceStatus.successfulRequests - 1);
        this.serviceStatus.averageLatency = (totalLatency + latency) / this.serviceStatus.successfulRequests;
      }
    } else {
      // Increment error counter
      this.serviceStatus.consecutiveFailures++;
      this.serviceStatus.lastError = error?.message || 'Unknown error';
      this.serviceStatus.lastErrorTime = new Date();
      
      // Mark as unavailable after 5 consecutive failures
      if (this.serviceStatus.consecutiveFailures >= 5) {
        this.serviceStatus.isAvailable = false;
      }
    }
    
    this.serviceStatus.totalRequests++;
  }

  /**
   * Identifies error type from given error
   * @param error Error to identify
   * @returns Error type as string
   */
  protected identifyErrorType(error: any): string {
    // Check for common error messages
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
   * Determines whether request should be retried based on error type
   * @param errorType Error type
   * @returns true if request should be retried
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
