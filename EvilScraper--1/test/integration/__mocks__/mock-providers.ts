/**
 * Mock provider helpers for testing
 * Provides utility functions to easily mock provider responses
 */

import { MockErrorClassifier } from './mock-error-classifier';

/**
 * Creates a mock successful response for a provider
 * @param provider - The provider to mock
 * @param result - The result text to include in the response
 */
export const mockProviderResponse = (provider: any, result: string) => {
  provider.generateCompletion.mockResolvedValue({
    success: true,
    text: result,
    provider: provider.getName(),
    model: provider.getModelName(),
    latency: 123
  });
};

/**
 * Creates a mock error response for a provider
 * @param provider - The provider to mock
 * @param errorMessage - The error message
 * @param errorType - The type of error
 */
export const mockProviderError = (provider: any, errorMessage: string, errorType: string = 'unknown_error') => {
  provider.generateCompletion.mockRejectedValue({
    success: false,
    error: errorMessage,
    errorType: errorType,
    provider: provider.getName(),
    model: provider.getModelName()
  });
};

/**
 * Creates a mock unavailable provider
 * @param provider - The provider to mock
 */
export const mockProviderUnavailable = (provider: any) => {
  provider.isAvailable.mockResolvedValue(false);
};

/**
 * Creates a mock available provider
 * @param provider - The provider to mock
 */
export const mockProviderAvailable = (provider: any) => {
  provider.isAvailable.mockResolvedValue(true);
};

/**
 * Creates a mock retryable error for a provider
 * @param provider - The provider to mock
 * @param errorType - The specific retryable error type
 */
export const mockRetryableError = (provider: any, errorType?: string) => {
  const type = errorType || MockErrorClassifier.ERROR_TYPES.TIMEOUT;
  let errorMessage = 'Request timed out';
  
  if (type === MockErrorClassifier.ERROR_TYPES.RATE_LIMIT) {
    errorMessage = 'Rate limit exceeded';
  } else if (type === MockErrorClassifier.ERROR_TYPES.SERVER_ERROR) {
    errorMessage = 'Server error occurred';
  } else if (type === MockErrorClassifier.ERROR_TYPES.NETWORK_ERROR) {
    errorMessage = 'Network error occurred';
  } else if (type === MockErrorClassifier.ERROR_TYPES.CONNECTION_ERROR) {
    errorMessage = 'Connection error occurred';
  }
  
  provider.generateCompletion.mockRejectedValue({
    success: false,
    error: errorMessage,
    errorType: type,
    provider: provider.getName(),
    model: provider.getModelName(),
    isRetryable: true
  });
};

/**
 * Creates a mock non-retryable error for a provider
 * @param provider - The provider to mock
 * @param errorType - The specific non-retryable error type
 */
export const mockNonRetryableError = (provider: any, errorType?: string) => {
  const type = errorType || MockErrorClassifier.ERROR_TYPES.AUTHENTICATION_ERROR;
  let errorMessage = 'Authentication error';
  
  if (type === MockErrorClassifier.ERROR_TYPES.MODEL_NOT_FOUND) {
    errorMessage = 'Model not found';
  } else if (type === MockErrorClassifier.ERROR_TYPES.CONTENT_FILTER) {
    errorMessage = 'Content filtered';
  } else if (type === MockErrorClassifier.ERROR_TYPES.CONTEXT_LENGTH) {
    errorMessage = 'Context length exceeded';
  }
  
  provider.generateCompletion.mockRejectedValue({
    success: false,
    error: errorMessage,
    errorType: type,
    provider: provider.getName(),
    model: provider.getModelName(),
    isRetryable: false
  });
};

/**
 * Creates a mock provider-specific error
 * @param provider - The provider to mock
 * @param providerName - The name of the provider (e.g., 'openai', 'anthropic')
 * @param errorType - The specific error type
 */
export const mockProviderSpecificError = (provider: any, providerName: string, errorType: string) => {
  let errorMessage = 'Unknown error';
  let errorObj: any = {
    provider: providerName
  };
  
  if (providerName === 'openai') {
    if (errorType === MockErrorClassifier.ERROR_TYPES.RATE_LIMIT) {
      errorMessage = 'You have exceeded your quota';
      errorObj.type = 'rate_limit_error';
    } else if (errorType === MockErrorClassifier.ERROR_TYPES.AUTHENTICATION_ERROR) {
      errorMessage = 'Invalid API key';
      errorObj.type = 'authentication_error';
    } else if (errorType === MockErrorClassifier.ERROR_TYPES.MODEL_NOT_FOUND) {
      errorMessage = 'The model does not exist';
      errorObj.type = 'invalid_request_error';
    } else if (errorType === MockErrorClassifier.ERROR_TYPES.CONTENT_FILTER) {
      errorMessage = 'Your request was rejected as a result of our safety system';
      errorObj.type = 'invalid_request_error';
    } else if (errorType === MockErrorClassifier.ERROR_TYPES.CONTEXT_LENGTH) {
      errorMessage = "This model's maximum context length is 4097 tokens";
      errorObj.type = 'invalid_request_error';
    } else if (errorType === MockErrorClassifier.ERROR_TYPES.SERVER_ERROR) {
      errorMessage = 'The server had an error while processing your request';
      errorObj.type = 'server_error';
    }
  } else if (providerName === 'anthropic') {
    if (errorType === MockErrorClassifier.ERROR_TYPES.RATE_LIMIT) {
      errorMessage = 'You have exceeded your quota';
    } else if (errorType === MockErrorClassifier.ERROR_TYPES.AUTHENTICATION_ERROR) {
      errorMessage = 'Invalid API key';
    } else if (errorType === MockErrorClassifier.ERROR_TYPES.MODEL_NOT_FOUND) {
      errorMessage = 'Model not found';
    } else if (errorType === MockErrorClassifier.ERROR_TYPES.CONTENT_FILTER) {
      errorMessage = 'Your request has been filtered due to content policy';
    } else if (errorType === MockErrorClassifier.ERROR_TYPES.CONTEXT_LENGTH) {
      errorMessage = 'Your prompt is too long, please reduce the number of tokens';
    }
  }
  
  errorObj.message = errorMessage;
  
  provider.generateCompletion.mockRejectedValue({
    success: false,
    error: errorMessage,
    errorType: errorType,
    provider: provider.getName(),
    model: provider.getModelName(),
    originalError: errorObj
  });
};
