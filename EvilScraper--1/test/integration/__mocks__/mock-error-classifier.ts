/**
 * Mock implementation of the ErrorClassifier for testing
 */
export class MockErrorClassifier {
  // Error types
  public static readonly ERROR_TYPES = {
    NETWORK_ERROR: 'network_error',
    CONNECTION_ERROR: 'connection_error',
    TIMEOUT: 'timeout',
    SERVER_ERROR: 'server_error',
    RATE_LIMIT: 'rate_limit',
    AUTHENTICATION_ERROR: 'authentication_error',
    INVALID_REQUEST: 'invalid_request',
    MODEL_NOT_FOUND: 'model_not_found',
    MODEL_UNAVAILABLE: 'model_unavailable',
    CONTENT_FILTER: 'content_filter',
    CONTEXT_LENGTH: 'context_length',
    PROVIDER_UNAVAILABLE: 'provider_unavailable',
    ALL_PROVIDERS_FAILED: 'all_providers_failed',
    UNKNOWN: 'unknown'
  };

  // Retryable error types
  private static readonly RETRYABLE_ERROR_TYPES = [
    MockErrorClassifier.ERROR_TYPES.NETWORK_ERROR,
    MockErrorClassifier.ERROR_TYPES.CONNECTION_ERROR,
    MockErrorClassifier.ERROR_TYPES.TIMEOUT,
    MockErrorClassifier.ERROR_TYPES.SERVER_ERROR,
    MockErrorClassifier.ERROR_TYPES.RATE_LIMIT,
    MockErrorClassifier.ERROR_TYPES.PROVIDER_UNAVAILABLE
  ];

  // Severe error types
  private static readonly SEVERE_ERROR_TYPES = [
    MockErrorClassifier.ERROR_TYPES.AUTHENTICATION_ERROR,
    MockErrorClassifier.ERROR_TYPES.MODEL_NOT_FOUND,
    MockErrorClassifier.ERROR_TYPES.MODEL_UNAVAILABLE,
    MockErrorClassifier.ERROR_TYPES.CONTENT_FILTER,
    MockErrorClassifier.ERROR_TYPES.CONTEXT_LENGTH
  ];

  private classifyProviderError(error: any): string | null {
    if (!error?.provider) return null;
    
    const provider = error?.provider?.toLowerCase();
    if (provider === 'openai') {
      return this.classifyOpenAIError(error);
    }
    if (provider === 'anthropic') {
      return this.classifyAnthropicError(error);
    }
    return null;
  }

  private classifyOpenAIError(error: any): string | null {
    const errorMessage = error?.message?.toLowerCase() ?? '';
    const errorType = error?.type?.toLowerCase() ?? '';

    if (this.isRateLimitError(errorType, errorMessage)) {
      return MockErrorClassifier.ERROR_TYPES.RATE_LIMIT;
    }
    if (this.isAuthenticationError(errorType, errorMessage)) {
      return MockErrorClassifier.ERROR_TYPES.AUTHENTICATION_ERROR;
    }
    if (errorType === 'invalid_request_error') {
      return this.classifyInvalidRequestError(errorMessage);
    }
    if (errorType === 'server_error') {
      return MockErrorClassifier.ERROR_TYPES.SERVER_ERROR;
    }
    return null;
  }

  private classifyAnthropicError(error: any): string | null {
    const errorMessage = error?.message?.toLowerCase() ?? '';

    if (errorMessage.includes('rate limit') || errorMessage.includes('quota')) {
      return MockErrorClassifier.ERROR_TYPES.RATE_LIMIT;
    }
    if (errorMessage.includes('api key') || errorMessage.includes('auth')) {
      return MockErrorClassifier.ERROR_TYPES.AUTHENTICATION_ERROR;
    }
    if (errorMessage.includes('model')) {
      return MockErrorClassifier.ERROR_TYPES.MODEL_NOT_FOUND;
    }
    if (errorMessage.includes('content') || errorMessage.includes('policy')) {
      return MockErrorClassifier.ERROR_TYPES.CONTENT_FILTER;
    }
    if (errorMessage.includes('context') || errorMessage.includes('token')) {
      return MockErrorClassifier.ERROR_TYPES.CONTEXT_LENGTH;
    }
    return null;
  }

  private classifyHttpError(error: any): string | null {
    if (!error?.response?.status) return null;

    const status = error?.response?.status;
    if (status === 429) return MockErrorClassifier.ERROR_TYPES.RATE_LIMIT;
    if (status === 401 || status === 403) return MockErrorClassifier.ERROR_TYPES.AUTHENTICATION_ERROR;
    if (status === 404) return MockErrorClassifier.ERROR_TYPES.MODEL_NOT_FOUND;
    if (status >= 500) return MockErrorClassifier.ERROR_TYPES.SERVER_ERROR;
    return null;
  }

  private classifyCommonError(error: any): string | null {
    if (this.isTimeoutError(error)) return MockErrorClassifier.ERROR_TYPES.TIMEOUT;
    if (this.isConnectionError(error)) return MockErrorClassifier.ERROR_TYPES.CONNECTION_ERROR;
    return null;
  }

  private isRateLimitError(errorType: string, message: string): boolean {
    return errorType === 'rate_limit_error' || 
           message.includes('rate limit') || 
           message.includes('quota');
  }

  private isAuthenticationError(errorType: string, message: string): boolean {
    return errorType === 'authentication_error' || 
           message.includes('api key');
  }

  private classifyInvalidRequestError(message: string): string {
    if (message.includes('content filter') || message.includes('safety') || message.includes('rejected')) {
      return MockErrorClassifier.ERROR_TYPES.CONTENT_FILTER;
    }
    if (message.includes('context length') || message.includes('token') || message.includes('maximum context')) {
      return MockErrorClassifier.ERROR_TYPES.CONTEXT_LENGTH;
    }
    if (message.includes('model')) {
      return MockErrorClassifier.ERROR_TYPES.MODEL_NOT_FOUND;
    }
    return MockErrorClassifier.ERROR_TYPES.INVALID_REQUEST;
  }

  private isTimeoutError(error: any): boolean {
    return error?.code === 'ETIMEDOUT' ||
           error?.message?.toLowerCase()?.includes('timeout');
  }

  private isConnectionError(error: any): boolean {
    return error?.code === 'ECONNREFUSED' ||
           error?.code === 'ECONNRESET' ||
           error?.message?.toLowerCase()?.includes('connection');
  }

  /**
   * Mock implementation of classifyError that returns the expected error type
   * based on the error object properties
   */
  public classifyError(error: any): string {
    if (!error) return MockErrorClassifier.ERROR_TYPES.UNKNOWN;

    return this.classifyProviderError(error) ??
           this.classifyHttpError(error) ??
           this.classifyCommonError(error) ??
           MockErrorClassifier.ERROR_TYPES.UNKNOWN;
  }

  /**
   * Checks if an error type is retryable
   */
  public isRetryable(errorType: string): boolean {
    return MockErrorClassifier.RETRYABLE_ERROR_TYPES.includes(errorType);
  }

  /**
   * Checks if an error type is severe
   */
  public isSevere(errorType: string): boolean {
    return MockErrorClassifier.SEVERE_ERROR_TYPES.includes(errorType);
  }
}
