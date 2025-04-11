/**
 * Error types for AI service providers
 */
export enum ErrorType {
  TIMEOUT_ERROR = 'timeout',
  RATE_LIMIT_ERROR = 'rate_limit',
  NETWORK_ERROR = 'network_error',
  CONNECTION_ERROR = 'connection_error',
  SERVER_ERROR = 'server_error',
  AUTH_ERROR = 'authentication_error',
  INVALID_REQUEST = 'invalid_request',
  MODEL_NOT_FOUND = 'model_not_found',
  MODEL_UNAVAILABLE = 'model_unavailable',
  CONTENT_FILTER = 'content_filter',
  CONTEXT_LENGTH_EXCEEDED = 'context_length',
  PROVIDER_UNAVAILABLE = 'provider_unavailable',
  ALL_PROVIDERS_FAILED = 'all_providers_failed',
  UNKNOWN_ERROR = 'unknown'
}
