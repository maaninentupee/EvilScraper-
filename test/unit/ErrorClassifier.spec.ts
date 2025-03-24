import { ErrorClassifier } from '../../src/services/utils/ErrorClassifier';

describe('ErrorClassifier', () => {
  let classifier: ErrorClassifier;

  beforeEach(() => {
    classifier = new ErrorClassifier();
  });

  describe('classifyError', () => {
    it('should classify timeout errors', () => {
      const error1 = { message: 'timeout exceeded' };
      const error2 = { code: 'ETIMEDOUT' };
      const error3 = { message: 'request timed out' };
      
      expect(classifier.classifyError(error1)).toBe(ErrorClassifier.ERROR_TYPES.TIMEOUT);
      expect(classifier.classifyError(error2)).toBe(ErrorClassifier.ERROR_TYPES.TIMEOUT);
      expect(classifier.classifyError(error3)).toBe(ErrorClassifier.ERROR_TYPES.TIMEOUT);
    });

    it('should classify rate limit errors', () => {
      const error1 = { 
        response: { status: 429 },
        message: 'Too many requests'
      };
      
      expect(classifier.classifyError(error1)).toBe(ErrorClassifier.ERROR_TYPES.RATE_LIMIT);
    });

    it('should classify provider-specific rate limit errors', () => {
      // The provider property needs to be recognized
      const error = { 
        provider: 'openai',
        type: 'rate_limit_error',
        message: 'You have exceeded your quota'
      };
      
      // First check if provider property is correctly detected
      expect(error.provider).toBeDefined();
      expect(classifier.classifyError(error)).toBe(ErrorClassifier.ERROR_TYPES.RATE_LIMIT);
    });

    it('should classify network errors', () => {
      const error1 = { code: 'ENETUNREACH' };
      
      expect(classifier.classifyError(error1)).toBe(ErrorClassifier.ERROR_TYPES.NETWORK_ERROR);
    });

    it('should classify connection errors', () => {
      const error1 = { message: 'connection refused' };
      const error2 = { code: 'ECONNREFUSED' };
      const error3 = { code: 'ECONNRESET' };
      
      expect(classifier.classifyError(error1)).toBe(ErrorClassifier.ERROR_TYPES.CONNECTION_ERROR);
      expect(classifier.classifyError(error2)).toBe(ErrorClassifier.ERROR_TYPES.CONNECTION_ERROR);
      expect(classifier.classifyError(error3)).toBe(ErrorClassifier.ERROR_TYPES.CONNECTION_ERROR);
    });

    it('should classify auth errors from HTTP status', () => {
      const error = { 
        response: { status: 401 },
        message: 'Unauthorized'
      };
      
      expect(classifier.classifyError(error)).toBe(ErrorClassifier.ERROR_TYPES.AUTHENTICATION_ERROR);
    });

    it('should classify provider-specific auth errors', () => {
      // The provider property needs to be recognized
      const error = { 
        provider: 'openai',
        type: 'authentication_error',
        message: 'Invalid API key'
      };
      
      // First check if provider property is correctly detected
      expect(error.provider).toBeDefined();
      expect(classifier.classifyError(error)).toBe(ErrorClassifier.ERROR_TYPES.AUTHENTICATION_ERROR);
    });

    it('should classify model not found errors from HTTP status', () => {
      const error = { 
        response: { status: 404 },
        message: 'Not found'
      };
      
      expect(classifier.classifyError(error)).toBe(ErrorClassifier.ERROR_TYPES.MODEL_NOT_FOUND);
    });

    it('should classify provider-specific model not found errors', () => {
      // The provider property needs to be recognized
      const error = { 
        provider: 'openai',
        type: 'invalid_request_error',
        message: 'The model does not exist'
      };
      
      // First check if provider property is correctly detected
      expect(error.provider).toBeDefined();
      expect(classifier.classifyError(error)).toBe(ErrorClassifier.ERROR_TYPES.MODEL_NOT_FOUND);
    });

    it('should classify context length exceeded errors', () => {
      // The provider property needs to be recognized
      const error1 = { 
        provider: 'openai',
        type: 'invalid_request_error',
        message: "This model's maximum context length is 4097 tokens"
      };
      
      // First check if provider property is correctly detected
      expect(error1.provider).toBeDefined();
      expect(classifier.classifyError(error1)).toBe(ErrorClassifier.ERROR_TYPES.CONTEXT_LENGTH);
    });

    it('should classify anthropic context length exceeded errors', () => {
      // The provider property needs to be recognized
      const error = { 
        provider: 'anthropic',
        message: 'Your prompt is too long, please reduce the number of tokens'
      };
      
      // First check if provider property is correctly detected
      expect(error.provider).toBeDefined();
      expect(classifier.classifyError(error)).toBe(ErrorClassifier.ERROR_TYPES.CONTEXT_LENGTH);
    });

    it('should classify content filter errors', () => {
      // The provider property needs to be recognized
      const error1 = { 
        provider: 'openai',
        type: 'invalid_request_error',
        message: 'Your request was rejected as a result of our safety system'
      };
      
      // First check if provider property is correctly detected
      expect(error1.provider).toBeDefined();
      expect(classifier.classifyError(error1)).toBe(ErrorClassifier.ERROR_TYPES.CONTENT_FILTER);
    });

    it('should classify anthropic content filter errors', () => {
      // The provider property needs to be recognized
      const error = { 
        provider: 'anthropic',
        message: 'Your request has been filtered due to content policy'
      };
      
      // First check if provider property is correctly detected
      expect(error.provider).toBeDefined();
      expect(classifier.classifyError(error)).toBe(ErrorClassifier.ERROR_TYPES.CONTENT_FILTER);
    });

    it('should classify server errors from HTTP status', () => {
      const error = { 
        response: { status: 500 },
        message: 'Internal server error'
      };
      
      expect(classifier.classifyError(error)).toBe(ErrorClassifier.ERROR_TYPES.SERVER_ERROR);
    });

    it('should classify provider-specific server errors', () => {
      // The provider property needs to be recognized
      const error = { 
        provider: 'openai',
        type: 'server_error',
        message: 'The server had an error while processing your request'
      };
      
      // First check if provider property is correctly detected
      expect(error.provider).toBeDefined();
      expect(classifier.classifyError(error)).toBe(ErrorClassifier.ERROR_TYPES.SERVER_ERROR);
    });

    it('should classify unknown errors', () => {
      const error1 = { message: 'unexpected database error' };
      const error2 = { message: 'something went wrong' };
      const error3 = null;
      
      expect(classifier.classifyError(error1)).toBe(ErrorClassifier.ERROR_TYPES.UNKNOWN);
      expect(classifier.classifyError(error2)).toBe(ErrorClassifier.ERROR_TYPES.UNKNOWN);
      expect(classifier.classifyError(error3)).toBe(ErrorClassifier.ERROR_TYPES.UNKNOWN);
    });
  });

  describe('isRetryable', () => {
    it('should return true for retryable error types', () => {
      expect(classifier.isRetryable(ErrorClassifier.ERROR_TYPES.TIMEOUT)).toBe(true);
      expect(classifier.isRetryable(ErrorClassifier.ERROR_TYPES.RATE_LIMIT)).toBe(true);
      expect(classifier.isRetryable(ErrorClassifier.ERROR_TYPES.NETWORK_ERROR)).toBe(true);
      expect(classifier.isRetryable(ErrorClassifier.ERROR_TYPES.CONNECTION_ERROR)).toBe(true);
      expect(classifier.isRetryable(ErrorClassifier.ERROR_TYPES.SERVER_ERROR)).toBe(true);
      expect(classifier.isRetryable(ErrorClassifier.ERROR_TYPES.PROVIDER_UNAVAILABLE)).toBe(true);
    });

    it('should return false for non-retryable error types', () => {
      expect(classifier.isRetryable(ErrorClassifier.ERROR_TYPES.AUTHENTICATION_ERROR)).toBe(false);
      expect(classifier.isRetryable(ErrorClassifier.ERROR_TYPES.MODEL_NOT_FOUND)).toBe(false);
      expect(classifier.isRetryable(ErrorClassifier.ERROR_TYPES.MODEL_UNAVAILABLE)).toBe(false);
      expect(classifier.isRetryable(ErrorClassifier.ERROR_TYPES.CONTENT_FILTER)).toBe(false);
      expect(classifier.isRetryable(ErrorClassifier.ERROR_TYPES.CONTEXT_LENGTH)).toBe(false);
      expect(classifier.isRetryable(ErrorClassifier.ERROR_TYPES.UNKNOWN)).toBe(false);
      expect(classifier.isRetryable(ErrorClassifier.ERROR_TYPES.ALL_PROVIDERS_FAILED)).toBe(false);
    });
  });

  describe('isSevere', () => {
    it('should return true for severe error types', () => {
      expect(classifier.isSevere(ErrorClassifier.ERROR_TYPES.AUTHENTICATION_ERROR)).toBe(true);
      expect(classifier.isSevere(ErrorClassifier.ERROR_TYPES.MODEL_NOT_FOUND)).toBe(true);
      expect(classifier.isSevere(ErrorClassifier.ERROR_TYPES.MODEL_UNAVAILABLE)).toBe(true);
      expect(classifier.isSevere(ErrorClassifier.ERROR_TYPES.CONTENT_FILTER)).toBe(true);
      expect(classifier.isSevere(ErrorClassifier.ERROR_TYPES.CONTEXT_LENGTH)).toBe(true);
    });

    it('should return false for non-severe error types', () => {
      expect(classifier.isSevere(ErrorClassifier.ERROR_TYPES.TIMEOUT)).toBe(false);
      expect(classifier.isSevere(ErrorClassifier.ERROR_TYPES.RATE_LIMIT)).toBe(false);
      expect(classifier.isSevere(ErrorClassifier.ERROR_TYPES.NETWORK_ERROR)).toBe(false);
      expect(classifier.isSevere(ErrorClassifier.ERROR_TYPES.CONNECTION_ERROR)).toBe(false);
      expect(classifier.isSevere(ErrorClassifier.ERROR_TYPES.SERVER_ERROR)).toBe(false);
      expect(classifier.isSevere(ErrorClassifier.ERROR_TYPES.PROVIDER_UNAVAILABLE)).toBe(false);
      expect(classifier.isSevere(ErrorClassifier.ERROR_TYPES.UNKNOWN)).toBe(false);
      expect(classifier.isSevere(ErrorClassifier.ERROR_TYPES.ALL_PROVIDERS_FAILED)).toBe(false);
    });
  });

  describe('getUserFriendlyErrorMessage', () => {
    it('should return user-friendly error messages for different error types', () => {
      // Test a few representative error types
      expect(ErrorClassifier.getUserFriendlyErrorMessage(ErrorClassifier.ERROR_TYPES.TIMEOUT))
        .toContain('timed out');
      
      expect(ErrorClassifier.getUserFriendlyErrorMessage(ErrorClassifier.ERROR_TYPES.RATE_LIMIT))
        .toContain('Rate limit exceeded');
      
      expect(ErrorClassifier.getUserFriendlyErrorMessage(ErrorClassifier.ERROR_TYPES.AUTHENTICATION_ERROR))
        .toContain('Authentication error');
      
      expect(ErrorClassifier.getUserFriendlyErrorMessage(ErrorClassifier.ERROR_TYPES.UNKNOWN))
        .toContain('unknown error');
    });
  });
});
