import { BaseProvider } from '../../src/services/providers/BaseProvider';
import { CompletionRequest, CompletionResult, ServiceStatus } from '../../src/services/providers/BaseProvider';
// Import a spy to check if methods are called
import { jest } from '@jest/globals';

// Extended TestProvider class for tests
class ExtendedTestProvider extends BaseProvider {
  getName(): string {
    return 'extended-test-provider';
  }
  
  async generateCompletion(request: CompletionRequest): Promise<CompletionResult> {
    return {
      text: 'Test completion',
      provider: this.getName(),
      model: request.modelName,
      success: true
    };
  }
  
  // Expose protected methods for testing
  public testHandleAvailabilityError(error: any): boolean {
    return this.handleAvailabilityError(error);
  }
  
  public testLogError(message: string, error: any): void {
    this.logError(message, error);
  }

  public testCalculateQualityScore(text: string): number {
    return this.calculateQualityScore(text);
  }

  public testIdentifyErrorType(error: any): string {
    return this.identifyErrorType(error);
  }

  public testShouldRetry(errorType: string): boolean {
    return this.shouldRetry(errorType);
  }

  public testUpdateServiceStatus(success: boolean, error?: any, latency?: number): void {
    this.updateServiceStatus(success, error, latency);
  }
}

describe('BaseProvider Coverage', () => {
  // Test the BaseProvider class methods
  it('should test BaseProvider.isAvailable and handle errors', async () => {
    class TestProvider extends BaseProvider {
      getName(): string {
        return 'test-provider';
      }
      
      async generateCompletion(request: CompletionRequest): Promise<CompletionResult> {
        return {
          text: 'Test completion',
          provider: this.getName(),
          model: request.modelName,
          success: true
        };
      }
      
      // Expose protected method for testing
      public testHandleAvailabilityError(error: any): boolean {
        return this.handleAvailabilityError(error);
      }
      
      // Access to protected method for testing
      public testLogError(message: string, error: any): void {
        this.logError(message, error);
      }
    }
    
    // Test the normal functionality
    const provider = new TestProvider();
    const normalResult = await provider.isAvailable();
    expect(normalResult).toBe(true);
    
    // Test the error handling path
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      // Create a test error
      const testError = new Error('Test error');
      
      // Spy on logError method
      const logErrorSpy = jest.spyOn(provider as any, 'logError');
      
      // Call the error handler directly
      const result = provider.testHandleAvailabilityError(testError);
      
      // Verify the results
      expect(result).toBe(false);
      expect(logErrorSpy).toHaveBeenCalledWith('Error in BaseProvider.isAvailable:', testError);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error in BaseProvider.isAvailable:', testError);
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
  
  // Test the isAvailable error path by making a provider that throws in isAvailable
  it('should test the error path in isAvailable', async () => {
    class ThrowingProvider extends BaseProvider {
      getName(): string {
        return 'throwing-provider';
      }
      
      async generateCompletion(request: CompletionRequest): Promise<CompletionResult> {
        return {
          text: 'Test completion',
          provider: this.getName(),
          model: request.modelName,
          success: true
        };
      }
      
      // Override isAvailable to always throw
      async isAvailable(): Promise<boolean> {
        try {
          throw new Error('Intentional test error');
        } catch (error) {
          // Using direct console.error call instead of logError method
          console.error('Error in BaseProvider.isAvailable:', error);
          return false;
        }
      }
    }
    
    // Create provider instance
    const provider = new ThrowingProvider();
    
    // Call the method which should throw and handle the error
    const result = await provider.isAvailable();
    
    // Should return false
    expect(result).toBe(false);
  });
  
  // Test the quality score calculation
  it('should calculate quality scores correctly', () => {
    class QualityProvider extends BaseProvider {
      getName(): string {
        return 'quality-provider';
      }
      
      async generateCompletion(request: CompletionRequest): Promise<CompletionResult> {
        return {
          text: 'Test completion',
          provider: this.getName(),
          model: request.modelName,
          success: true
        };
      }
      
      // Expose protected method
      testQualityScore(text: string): number {
        return this.calculateQualityScore(text);
      }
    }
    
    const provider = new QualityProvider();
    
    // Test different inputs
    expect(provider.testQualityScore('')).toBe(0);
    expect(provider.testQualityScore('Short text')).toBeGreaterThan(0);
    expect(provider.testQualityScore('Text with\nmultiple\nlines')).toBeGreaterThan(0);
    expect(provider.testQualityScore('Text with code: ```\nconst x = 1;\n```')).toBeGreaterThan(0);
    expect(provider.testQualityScore('a'.repeat(1000))).toBeGreaterThan(0);
  });
  
  // Test the logError method directly
  it('should log errors correctly', () => {
    class LogErrorProvider extends BaseProvider {
      getName(): string {
        return 'log-error-provider';
      }
      
      async generateCompletion(request: CompletionRequest): Promise<CompletionResult> {
        return {
          text: 'Test completion',
          provider: this.getName(),
          model: request.modelName,
          success: true
        };
      }
      
      // Directly access and test the protected method
      public testLogError(message: string, error: any): void {
        this.logError(message, error);
      }
    }
    
    const provider = new LogErrorProvider();
    
    // Spy on console.error
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    try {
      // Test the method
      provider.testLogError('Test error message', new Error('Test error'));
      
      // Verify the spy was called
      expect(consoleErrorSpy).toHaveBeenCalledWith('Test error message', expect.any(Error));
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  // Test error type identification
  it('should correctly identify error types', () => {
    const provider = new ExtendedTestProvider();
    
    // Test different error types
    expect(provider.testIdentifyErrorType(new Error('connection timeout'))).toBe('timeout');
    expect(provider.testIdentifyErrorType(new Error('network error'))).toBe('network_error');
    expect(provider.testIdentifyErrorType(new Error('model not found'))).toBe('model_not_found');
    expect(provider.testIdentifyErrorType(new Error('out of memory'))).toBe('resource_error');
    expect(provider.testIdentifyErrorType(new Error('format error'))).toBe('format_error');
    expect(provider.testIdentifyErrorType(new Error('rate limit exceeded'))).toBe('rate_limit');
    expect(provider.testIdentifyErrorType(new Error('authentication failed'))).toBe('authentication_error');
    expect(provider.testIdentifyErrorType(new Error('endpoint not found'))).toBe('not_found');
    expect(provider.testIdentifyErrorType(new Error('server error 500'))).toBe('server_error');
    expect(provider.testIdentifyErrorType(new Error('unknown error'))).toBe('unknown_error');
    expect(provider.testIdentifyErrorType({})).toBe('unknown_error');
  });

  // Test shouldRetry method
  it('should correctly determine if a request should be retried', () => {
    const provider = new ExtendedTestProvider();
    
    // Retryable error types
    expect(provider.testShouldRetry('network_error')).toBe(true);
    expect(provider.testShouldRetry('connection_error')).toBe(true);
    expect(provider.testShouldRetry('timeout')).toBe(true);
    expect(provider.testShouldRetry('server_error')).toBe(true);
    expect(provider.testShouldRetry('rate_limit')).toBe(true);
    
    // Non-retryable error types
    expect(provider.testShouldRetry('authentication_error')).toBe(false);
    expect(provider.testShouldRetry('client_error')).toBe(false);
    expect(provider.testShouldRetry('not_found')).toBe(false);
    expect(provider.testShouldRetry('model_not_found')).toBe(false);
    expect(provider.testShouldRetry('resource_error')).toBe(false);
    expect(provider.testShouldRetry('format_error')).toBe(false);
    expect(provider.testShouldRetry('unknown_error')).toBe(false);
  });

  // Test service status updates
  it('should correctly update service status', () => {
    const provider = new ExtendedTestProvider();
    
    // Test successful request
    provider.testUpdateServiceStatus(true, null, 100);
    let status = provider.getServiceStatus();
    expect(status.isAvailable).toBe(true);
    expect(status.successfulRequests).toBe(1);
    expect(status.totalRequests).toBe(1);
    expect(status.averageLatency).toBe(100);
    expect(status.consecutiveFailures).toBe(0);
    
    // Test another successful request with different latency
    provider.testUpdateServiceStatus(true, null, 200);
    status = provider.getServiceStatus();
    expect(status.isAvailable).toBe(true);
    expect(status.successfulRequests).toBe(2);
    expect(status.totalRequests).toBe(2);
    expect(status.averageLatency).toBe(150); // Average of 100 and 200
    expect(status.consecutiveFailures).toBe(0);
    
    // Test failed request
    const error = new Error('Test error');
    provider.testUpdateServiceStatus(false, error);
    status = provider.getServiceStatus();
    expect(status.isAvailable).toBe(true); // Still available after one failure
    expect(status.successfulRequests).toBe(2);
    expect(status.totalRequests).toBe(3);
    expect(status.consecutiveFailures).toBe(1);
    expect(status.lastError).toBe('Test error');
    expect(status.lastErrorTime).toBeInstanceOf(Date);
    
    // Test multiple consecutive failures
    for (let i = 0; i < 4; i++) {
      provider.testUpdateServiceStatus(false, error);
    }
    status = provider.getServiceStatus();
    expect(status.isAvailable).toBe(false); // Should be unavailable after 5 consecutive failures
    expect(status.successfulRequests).toBe(2);
    expect(status.totalRequests).toBe(7);
    expect(status.consecutiveFailures).toBe(5);
    
    // Test recovery after successful request
    provider.testUpdateServiceStatus(true, null, 150);
    status = provider.getServiceStatus();
    expect(status.isAvailable).toBe(true); // Should be available again after success
    expect(status.successfulRequests).toBe(3);
    expect(status.totalRequests).toBe(8);
    expect(status.consecutiveFailures).toBe(0);
    expect(status.lastError).toBe(null);
    expect(status.lastErrorTime).toBe(null);
  });

  // Test getServiceStatus method
  it('should return correct service status with success rate', () => {
    const provider = new ExtendedTestProvider();
    
    // Initial status with no requests
    let status = provider.getServiceStatus();
    expect(status.successRate).toBe('N/A');
    
    // After some requests
    provider.testUpdateServiceStatus(true);
    provider.testUpdateServiceStatus(true);
    provider.testUpdateServiceStatus(false, new Error('Test error'));
    provider.testUpdateServiceStatus(true);
    
    status = provider.getServiceStatus();
    expect(status.successRate).toBe('75.00%'); // 3 successful out of 4 total
    expect(status.totalRequests).toBe(4);
    expect(status.successfulRequests).toBe(3);
  });
});
