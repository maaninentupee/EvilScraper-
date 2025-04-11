import { ErrorClassifier } from '../../src/services/utils/ErrorClassifier';
import { MockErrorClassifier } from './__mocks__/mock-error-classifier';

describe('ErrorClassifier Integration Tests', () => {
  let classifier: ErrorClassifier;
  let mockClassifier: MockErrorClassifier;

  beforeEach(() => {
    classifier = new ErrorClassifier();
    mockClassifier = new MockErrorClassifier();
  });

  describe('Provider-specific error classification', () => {
    it('should classify OpenAI rate limit errors', () => {
      const error = {
        provider: 'openai',
        type: 'rate_limit_error',
        message: 'You have exceeded your quota'
      };

      const errorType = classifier.classifyError(error);
      expect(errorType).toBe(ErrorClassifier.ERROR_TYPES.RATE_LIMIT);
      
      // Verify that the mock classifier also works as expected
      const mockErrorType = mockClassifier.classifyError(error);
      expect(mockErrorType).toBe(MockErrorClassifier.ERROR_TYPES.RATE_LIMIT);
    });

    it('should classify OpenAI authentication errors', () => {
      const error = {
        provider: 'openai',
        type: 'authentication_error',
        message: 'Invalid API key'
      };

      const errorType = classifier.classifyError(error);
      expect(errorType).toBe(ErrorClassifier.ERROR_TYPES.AUTHENTICATION_ERROR);
      
      // Verify that the mock classifier also works as expected
      const mockErrorType = mockClassifier.classifyError(error);
      expect(mockErrorType).toBe(MockErrorClassifier.ERROR_TYPES.AUTHENTICATION_ERROR);
    });

    it('should classify OpenAI model not found errors', () => {
      const error = {
        provider: 'openai',
        type: 'invalid_request_error',
        message: 'The model does not exist'
      };

      const errorType = classifier.classifyError(error);
      expect(errorType).toBe(ErrorClassifier.ERROR_TYPES.MODEL_NOT_FOUND);
      
      // Verify that the mock classifier also works as expected
      const mockErrorType = mockClassifier.classifyError(error);
      expect(mockErrorType).toBe(MockErrorClassifier.ERROR_TYPES.MODEL_NOT_FOUND);
    });

    it('should classify OpenAI content filter errors', () => {
      const error = {
        provider: 'openai',
        type: 'invalid_request_error',
        message: 'Your request was rejected as a result of our safety system'
      };

      const errorType = classifier.classifyError(error);
      expect(errorType).toBe(ErrorClassifier.ERROR_TYPES.CONTENT_FILTER);
      
      // Verify that the mock classifier also works as expected
      const mockErrorType = mockClassifier.classifyError(error);
      expect(mockErrorType).toBe(MockErrorClassifier.ERROR_TYPES.CONTENT_FILTER);
    });

    it('should classify OpenAI context length errors', () => {
      const error = {
        provider: 'openai',
        type: 'invalid_request_error',
        message: "This model's maximum context length is 4097 tokens"
      };

      const errorType = classifier.classifyError(error);
      expect(errorType).toBe(ErrorClassifier.ERROR_TYPES.CONTEXT_LENGTH);
      
      // Verify that the mock classifier also works as expected
      const mockErrorType = mockClassifier.classifyError(error);
      expect(mockErrorType).toBe(MockErrorClassifier.ERROR_TYPES.CONTEXT_LENGTH);
    });

    it('should classify OpenAI server errors', () => {
      const error = {
        provider: 'openai',
        type: 'server_error',
        message: 'The server had an error while processing your request'
      };

      const errorType = classifier.classifyError(error);
      expect(errorType).toBe(ErrorClassifier.ERROR_TYPES.SERVER_ERROR);
      
      // Verify that the mock classifier also works as expected
      const mockErrorType = mockClassifier.classifyError(error);
      expect(mockErrorType).toBe(MockErrorClassifier.ERROR_TYPES.SERVER_ERROR);
    });

    it('should classify Anthropic rate limit errors', () => {
      const error = {
        provider: 'anthropic',
        message: 'You have exceeded your quota'
      };

      const errorType = classifier.classifyError(error);
      expect(errorType).toBe(ErrorClassifier.ERROR_TYPES.RATE_LIMIT);
      
      // Verify that the mock classifier also works as expected
      const mockErrorType = mockClassifier.classifyError(error);
      expect(mockErrorType).toBe(MockErrorClassifier.ERROR_TYPES.RATE_LIMIT);
    });

    it('should classify Anthropic authentication errors', () => {
      const error = {
        provider: 'anthropic',
        message: 'Invalid API key'
      };

      const errorType = classifier.classifyError(error);
      expect(errorType).toBe(ErrorClassifier.ERROR_TYPES.AUTHENTICATION_ERROR);
      
      // Verify that the mock classifier also works as expected
      const mockErrorType = mockClassifier.classifyError(error);
      expect(mockErrorType).toBe(MockErrorClassifier.ERROR_TYPES.AUTHENTICATION_ERROR);
    });

    it('should classify Anthropic model not found errors', () => {
      const error = {
        provider: 'anthropic',
        message: 'Model not found'
      };

      const errorType = classifier.classifyError(error);
      expect(errorType).toBe(ErrorClassifier.ERROR_TYPES.MODEL_NOT_FOUND);
      
      // Verify that the mock classifier also works as expected
      const mockErrorType = mockClassifier.classifyError(error);
      expect(mockErrorType).toBe(MockErrorClassifier.ERROR_TYPES.MODEL_NOT_FOUND);
    });

    it('should classify Anthropic content filter errors', () => {
      const error = {
        provider: 'anthropic',
        message: 'Your request has been filtered due to content policy'
      };

      const errorType = classifier.classifyError(error);
      expect(errorType).toBe(ErrorClassifier.ERROR_TYPES.CONTENT_FILTER);
      
      // Verify that the mock classifier also works as expected
      const mockErrorType = mockClassifier.classifyError(error);
      expect(mockErrorType).toBe(MockErrorClassifier.ERROR_TYPES.CONTENT_FILTER);
    });

    it('should classify Anthropic context length errors', () => {
      const error = {
        provider: 'anthropic',
        message: 'Your prompt is too long, please reduce the number of tokens'
      };

      const errorType = classifier.classifyError(error);
      expect(errorType).toBe(ErrorClassifier.ERROR_TYPES.CONTEXT_LENGTH);
      
      // Verify that the mock classifier also works as expected
      const mockErrorType = mockClassifier.classifyError(error);
      expect(mockErrorType).toBe(MockErrorClassifier.ERROR_TYPES.CONTEXT_LENGTH);
    });
  });

  describe('isRetryable and isSevere', () => {
    it('should correctly identify retryable errors', () => {
      const retryableErrorTypes = [
        ErrorClassifier.ERROR_TYPES.NETWORK_ERROR,
        ErrorClassifier.ERROR_TYPES.CONNECTION_ERROR,
        ErrorClassifier.ERROR_TYPES.TIMEOUT,
        ErrorClassifier.ERROR_TYPES.SERVER_ERROR,
        ErrorClassifier.ERROR_TYPES.RATE_LIMIT,
        ErrorClassifier.ERROR_TYPES.PROVIDER_UNAVAILABLE
      ];

      retryableErrorTypes.forEach(errorType => {
        expect(classifier.isRetryable(errorType)).toBe(true);
        expect(mockClassifier.isRetryable(errorType)).toBe(true);
      });
    });

    it('should correctly identify non-retryable errors', () => {
      const nonRetryableErrorTypes = [
        ErrorClassifier.ERROR_TYPES.AUTHENTICATION_ERROR,
        ErrorClassifier.ERROR_TYPES.INVALID_REQUEST,
        ErrorClassifier.ERROR_TYPES.MODEL_NOT_FOUND,
        ErrorClassifier.ERROR_TYPES.MODEL_UNAVAILABLE,
        ErrorClassifier.ERROR_TYPES.CONTENT_FILTER,
        ErrorClassifier.ERROR_TYPES.CONTEXT_LENGTH,
        ErrorClassifier.ERROR_TYPES.UNKNOWN
      ];

      nonRetryableErrorTypes.forEach(errorType => {
        expect(classifier.isRetryable(errorType)).toBe(false);
        expect(mockClassifier.isRetryable(errorType)).toBe(false);
      });
    });

    it('should correctly identify severe errors', () => {
      const severeErrorTypes = [
        ErrorClassifier.ERROR_TYPES.AUTHENTICATION_ERROR,
        ErrorClassifier.ERROR_TYPES.MODEL_NOT_FOUND,
        ErrorClassifier.ERROR_TYPES.MODEL_UNAVAILABLE,
        ErrorClassifier.ERROR_TYPES.CONTENT_FILTER,
        ErrorClassifier.ERROR_TYPES.CONTEXT_LENGTH
      ];

      severeErrorTypes.forEach(errorType => {
        expect(classifier.isSevere(errorType)).toBe(true);
        expect(mockClassifier.isSevere(errorType)).toBe(true);
      });
    });

    it('should correctly identify non-severe errors', () => {
      const nonSevereErrorTypes = [
        ErrorClassifier.ERROR_TYPES.NETWORK_ERROR,
        ErrorClassifier.ERROR_TYPES.CONNECTION_ERROR,
        ErrorClassifier.ERROR_TYPES.TIMEOUT,
        ErrorClassifier.ERROR_TYPES.SERVER_ERROR,
        ErrorClassifier.ERROR_TYPES.RATE_LIMIT,
        ErrorClassifier.ERROR_TYPES.PROVIDER_UNAVAILABLE,
        ErrorClassifier.ERROR_TYPES.INVALID_REQUEST,
        ErrorClassifier.ERROR_TYPES.UNKNOWN
      ];

      nonSevereErrorTypes.forEach(errorType => {
        expect(classifier.isSevere(errorType)).toBe(false);
        expect(mockClassifier.isSevere(errorType)).toBe(false);
      });
    });
  });
});
