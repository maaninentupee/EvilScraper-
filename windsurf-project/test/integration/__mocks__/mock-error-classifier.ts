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

  /**
   * Mock implementation of classifyError that returns the expected error type
   * based on the error object properties
   */
  public classifyError(error: any): string {
    if (!error) {
      return MockErrorClassifier.ERROR_TYPES.UNKNOWN;
    }

    // Simulate provider-specific errors first
    if (error.provider) {
      const provider = error.provider.toLowerCase();
      const errorMessage = error.message ? error.message.toLowerCase() : '';
      const errorType = error.type ? error.type.toLowerCase() : '';

      // OpenAI errors
      if (provider === 'openai') {
        if (errorType === 'rate_limit_error' || errorMessage.includes('rate limit') || errorMessage.includes('quota')) {
          return MockErrorClassifier.ERROR_TYPES.RATE_LIMIT;
        }
        if (errorType === 'authentication_error' || errorMessage.includes('api key')) {
          return MockErrorClassifier.ERROR_TYPES.AUTHENTICATION_ERROR;
        }
        if (errorType === 'invalid_request_error') {
          // Check for content filter first
          if (errorMessage.includes('content filter') || errorMessage.includes('safety') || errorMessage.includes('rejected')) {
            return MockErrorClassifier.ERROR_TYPES.CONTENT_FILTER;
          }
          // Then check for context length
          if (errorMessage.includes('context length') || errorMessage.includes('token') || errorMessage.includes('maximum context')) {
            return MockErrorClassifier.ERROR_TYPES.CONTEXT_LENGTH;
          }
          // Finally check for model not found
          if (errorMessage.includes('model')) {
            return MockErrorClassifier.ERROR_TYPES.MODEL_NOT_FOUND;
          }
          return MockErrorClassifier.ERROR_TYPES.INVALID_REQUEST;
        }
        if (errorType === 'server_error') {
          return MockErrorClassifier.ERROR_TYPES.SERVER_ERROR;
        }
      }

      // Anthropic errors
      if (provider === 'anthropic') {
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
      }
    }

    // Simulate HTTP errors
    if (error.response && error.response.status) {
      if (error.response.status === 429) {
        return MockErrorClassifier.ERROR_TYPES.RATE_LIMIT;
      }
      if (error.response.status === 401 || error.response.status === 403) {
        return MockErrorClassifier.ERROR_TYPES.AUTHENTICATION_ERROR;
      }
      if (error.response.status === 404) {
        return MockErrorClassifier.ERROR_TYPES.MODEL_NOT_FOUND;
      }
      if (error.response.status >= 500) {
        return MockErrorClassifier.ERROR_TYPES.SERVER_ERROR;
      }
    }

    // Simulate timeout errors
    if (error.code === 'ETIMEDOUT' || 
        (error.message && error.message.toLowerCase().includes('timeout'))) {
      return MockErrorClassifier.ERROR_TYPES.TIMEOUT;
    }

    // Simulate connection errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET' ||
        (error.message && error.message.toLowerCase().includes('connection'))) {
      return MockErrorClassifier.ERROR_TYPES.CONNECTION_ERROR;
    }

    return MockErrorClassifier.ERROR_TYPES.UNKNOWN;
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
