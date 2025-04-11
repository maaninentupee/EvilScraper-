import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { AIGatewayEnhancer, AIResponse } from '../../src/services/AIGatewayEnhancer';
import { ProviderHealthMonitor } from '../../src/services/ProviderHealthMonitor';
import { SelectionStrategy } from '../../src/services/utils/ProviderSelectionStrategy';

/**
 * Integration tests for AIGatewayEnhancer
 * 
 * These tests verify that the fallback mechanism works correctly in various error scenarios,
 * including timeouts, rate limits, and other API errors.
 */
describe('AIGatewayEnhancer Integration Tests', () => {
  let app: INestApplication;
  let aiGatewayEnhancer: AIGatewayEnhancer;
  let healthMonitor: ProviderHealthMonitor;
  
  // Test data
  const testPrompts = [
    'Tell me about artificial intelligence',
    'Write a function to calculate the Fibonacci sequence',
    'Explain the concept of machine learning',
    'Summarize the history of computing',
    'Translate "Hello world" to Finnish'
  ];
  
  // Error types to test
  const errorTypes = [
    'timeout',
    'rate_limit',
    'service_unavailable',
    'invalid_request',
    'authentication_error',
    'model_unavailable',
    'all'
  ];
  
  // Selection strategies to test
  const strategies = [
    SelectionStrategy.PRIORITY,
    SelectionStrategy.COST_OPTIMIZED,
    SelectionStrategy.PERFORMANCE,
    SelectionStrategy.LOAD_BALANCED,
    SelectionStrategy.FALLBACK
  ];
  
  beforeAll(async () => {
    // Create testing module with the AppModule
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    // Create NestJS application
    app = moduleRef.createNestApplication();
    await app.init();

    // Get the required services
    aiGatewayEnhancer = app.get<AIGatewayEnhancer>(AIGatewayEnhancer);
    healthMonitor = app.get<ProviderHealthMonitor>(ProviderHealthMonitor);
    
    // Silence console output during tests
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Functionality Tests', () => {
    it('should process a request successfully', async () => {
      // Get a random test prompt
      const prompt = testPrompts[Math.floor(Math.random() * testPrompts.length)];
      
      // Process the request
      const result: AIResponse = await aiGatewayEnhancer.processWithSmartFallback(
        'text-generation',
        prompt,
        { strategy: SelectionStrategy.PRIORITY }
      );
      
      // Verify the result
      expect(result.success).toBe(true);
      expect(result.provider).toBeDefined();
      expect(result.model).toBeDefined();
      expect(result.result).toBeDefined();
      expect(result.latency).toBeGreaterThan(0);
    });

    it('should process batch requests successfully', async () => {
      // Process batch request
      const results: AIResponse[] = await aiGatewayEnhancer.processBatchWithSmartFallback(
        'text-generation',
        testPrompts.slice(0, 2),
        { strategy: SelectionStrategy.PRIORITY }
      );
      
      // Verify the results
      expect(results.length).toBe(2);
      expect(results[0].success).toBe(true);
      expect(results[0].provider).toBeDefined();
      expect(results[0].model).toBeDefined();
      expect(results[0].result).toBeDefined();
      
      expect(results[1].success).toBe(true);
      expect(results[1].provider).toBeDefined();
      expect(results[1].model).toBeDefined();
      expect(results[1].result).toBeDefined();
    });
  });

  describe('Error Handling and Fallback Tests', () => {
    // Test each error type
    errorTypes.forEach(errorType => {
      it(`should handle ${errorType} errors and trigger fallback mechanism`, async () => {
        // Get a random test prompt
        const prompt = testPrompts[Math.floor(Math.random() * testPrompts.length)];
        
        // Process the request with test error simulation
        const result: AIResponse = await aiGatewayEnhancer.processWithSmartFallback(
          'text-generation',
          prompt,
          { 
            strategy: SelectionStrategy.PRIORITY,
            testMode: true,
            testError: errorType
          }
        );
        
        if (errorType === 'all') {
          // All providers should fail
          expect(result.success).toBe(false);
          expect(result.error).toBeDefined();
          expect(result.errorType).toBeDefined();
        } else {
          // Should fallback to another provider
          expect(result.success).toBe(true);
          expect(result.provider).toBeDefined();
          expect(result.model).toBeDefined();
          expect(result.result).toBeDefined();
          expect(result.wasFailover).toBe(true);
        }
      });
    });

    it('should handle timeout errors correctly', async () => {
      // Get a random test prompt
      const prompt = testPrompts[Math.floor(Math.random() * testPrompts.length)];
      
      // Process the request with a very short timeout
      const result: AIResponse = await aiGatewayEnhancer.processWithSmartFallback(
        'text-generation',
        prompt,
        { 
          strategy: SelectionStrategy.PRIORITY,
          timeout: 1 // 1ms timeout (will definitely timeout)
        }
      );
      
      // Should either fallback successfully or return an error
      if (result.success) {
        expect(result.wasFailover).toBe(true);
      } else {
        expect(result.error).toBeDefined();
        expect(result.errorType).toContain('timeout');
      }
    });

    it('should retry on retryable errors', async () => {
      // Get a random test prompt
      const prompt = testPrompts[Math.floor(Math.random() * testPrompts.length)];
      
      // Process the request with retry configuration
      const result: AIResponse = await aiGatewayEnhancer.processWithSmartFallback(
        'text-generation',
        prompt,
        { 
          strategy: SelectionStrategy.PRIORITY,
          testMode: true,
          testError: 'service_unavailable',
          retryCount: 3,
          retryDelay: 10
        }
      );
      
      // Should eventually succeed with fallback
      expect(result.success).toBe(true);
      expect(result.provider).toBeDefined();
      expect(result.model).toBeDefined();
      expect(result.result).toBeDefined();
      expect(result.wasFailover).toBe(true);
    });
  });

  describe('Selection Strategy Tests', () => {
    // Test each selection strategy
    strategies.forEach(strategy => {
      it(`should use ${strategy} strategy correctly`, async () => {
        // Get a random test prompt
        const prompt = testPrompts[Math.floor(Math.random() * testPrompts.length)];
        
        // Process the request with the strategy
        const result: AIResponse = await aiGatewayEnhancer.processWithSmartFallback(
          'text-generation',
          prompt,
          { strategy }
        );
        
        // Verify the result
        expect(result.success).toBe(true);
        expect(result.provider).toBeDefined();
        expect(result.model).toBeDefined();
        expect(result.result).toBeDefined();
        
        // For some strategies, we can make additional assertions
        if (strategy === SelectionStrategy.PERFORMANCE) {
          // Should use the fastest provider based on health metrics
          const providerHealth = healthMonitor.getProviderHealth(result.provider);
          expect(providerHealth.averageLatency).toBeLessThan(5000); // Reasonable latency
        }
      });
    });

    it('should process batch requests with different strategies', async () => {
      // Test each strategy with batch processing
      for (const strategy of strategies) {
        // Process batch request with the strategy
        const results: AIResponse[] = await aiGatewayEnhancer.processBatchWithSmartFallback(
          'text-generation',
          testPrompts.slice(0, 2),
          { strategy }
        );
        
        // Verify the results
        expect(results.length).toBe(2);
        expect(results[0].success).toBe(true);
        expect(results[0].provider).toBeDefined();
        expect(results[0].model).toBeDefined();
        expect(results[0].result).toBeDefined();
        
        expect(results[1].success).toBe(true);
        expect(results[1].provider).toBeDefined();
        expect(results[1].model).toBeDefined();
        expect(results[1].result).toBeDefined();
      }
    });
  });

  describe('Caching Tests', () => {
    it('should cache successful results', async () => {
      const prompt = testPrompts[Math.floor(Math.random() * testPrompts.length)];
      
      const cachedResult: AIResponse = await aiGatewayEnhancer.processWithSmartFallback(
        'text-generation',
        prompt,
        { 
          strategy: SelectionStrategy.PRIORITY,
          cacheResults: true
        }
      );
      
      // Process the same request again
      const secondResult: AIResponse = await aiGatewayEnhancer.processWithSmartFallback(
        'text-generation',
        prompt,
        { 
          strategy: SelectionStrategy.PRIORITY,
          cacheResults: true
        }
      );
      
      // Second result should be from cache and match the first result
      expect(secondResult.success).toBe(true);
      expect(secondResult.provider).toBe(cachedResult.provider);
      expect(secondResult.model).toBe(cachedResult.model);
      expect(secondResult.result).toBe(cachedResult.result);
      expect(secondResult.fromCache).toBe(true);
      
      // Second request should be faster than first
      expect(secondResult.latency).toBeLessThan(cachedResult.latency);
    });


    it('should not cache results when caching is disabled', async () => {
      // Get a random test prompt
      const prompt = testPrompts[Math.floor(Math.random() * testPrompts.length)];
      
      // Process the request with caching disabled
      const firstResult: AIResponse = await aiGatewayEnhancer.processWithSmartFallback(
        'text-generation',
        prompt,
        { 
          strategy: SelectionStrategy.PRIORITY,
          cacheResults: false
        }
      );
      
      // Process the same request again
      const secondResult: AIResponse = await aiGatewayEnhancer.processWithSmartFallback(
        'text-generation',
        prompt,
        { 
          strategy: SelectionStrategy.PRIORITY,
          cacheResults: false
        }
      );
      
      // Second result should not be from cache
      expect(secondResult.fromCache).toBeUndefined();
    });
  });
});
