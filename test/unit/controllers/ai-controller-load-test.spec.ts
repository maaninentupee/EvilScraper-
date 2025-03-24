import { Test, TestingModule } from '@nestjs/testing';
import { AIController } from '../../../src/controllers/ai.controller';
import { AIGateway } from '../../../src/services/AIGateway';
import { AIService } from '../../../src/services/AIService';
import { ModelSelector } from '../../../src/services/ModelSelector';
import { ProviderRegistry } from '../../../src/services/providers/ProviderRegistry';
import { BaseProvider } from '../../../src/services/providers/BaseProvider';

// Mock provider for testing
class MockProvider extends BaseProvider {
  constructor(private shouldSucceed: boolean = true) {
    super();
  }

  getName(): string {
    return 'mock-provider';
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async generateCompletion(options: any): Promise<any> {
    if (this.shouldSucceed) {
      return {
        success: true,
        text: 'This is a mock response',
        totalTokens: 10,
        finishReason: 'completed'
      };
    } else {
      return {
        success: false,
        error: 'Mock error'
      };
    }
  }
}

describe('AIController - Load Test Endpoint', () => {
  let controller: AIController;
  let providerRegistry: ProviderRegistry;
  let mockSuccessProvider: MockProvider;
  let mockFailureProvider: MockProvider;

  beforeEach(async () => {
    // Create mock providers
    mockSuccessProvider = new MockProvider(true);
    mockFailureProvider = new MockProvider(false);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AIController],
      providers: [
        {
          provide: AIGateway,
          useValue: {
            processAIRequest: jest.fn(),
            processAIRequestWithFallback: jest.fn(),
          },
        },
        {
          provide: AIService,
          useValue: {
            analyzeSEO: jest.fn(),
            generateCode: jest.fn(),
            makeDecision: jest.fn(),
          },
        },
        {
          provide: ModelSelector,
          useValue: {
            getAvailableModels: jest.fn().mockReturnValue(['model1', 'model2']),
          },
        },
        {
          provide: ProviderRegistry,
          useValue: {
            getAvailableProviders: jest.fn().mockReturnValue(['provider1', 'provider2']),
            getProviderByName: jest.fn((name) => {
              if (name === 'success-provider') return mockSuccessProvider;
              if (name === 'failure-provider') return mockFailureProvider;
              return null;
            }),
          },
        },
      ],
    }).compile();

    controller = module.get<AIController>(AIController);
    providerRegistry = module.get<ProviderRegistry>(ProviderRegistry);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('runLoadTest', () => {
    it('should run a successful load test with default parameters', async () => {
      // Arrange
      const provider = 'success-provider';
      const request = { prompt: 'Test prompt', requestCount: 1 };

      // Act
      const result = await controller.runLoadTest(provider, request, '127.0.0.1');

      // Assert
      expect(result).toBeDefined();
      expect(result.successCount).toBeGreaterThan(0);
      expect(result.totalRequests).toBe(1);
      expect(result.successRate).toBe(100);
      expect(result.averageLatency).toBeGreaterThanOrEqual(0);
      expect(result.errorsByType).toEqual({});
    });

    it('should run a load test with multiple iterations', async () => {
      // Arrange
      const provider = 'success-provider';
      const request = { prompt: 'Test prompt', requestCount: 5 };

      // Act
      const result = await controller.runLoadTest(provider, request, '127.0.0.1');

      // Assert
      expect(result).toBeDefined();
      expect(result.successCount).toBe(5);
      expect(result.totalRequests).toBe(5);
      expect(result.successRate).toBe(100);
      expect(result.averageLatency).toBeGreaterThanOrEqual(0);
      expect(result.errorsByType).toEqual({});
    });

    it('should handle provider failures correctly', async () => {
      // Arrange
      const provider = 'failure-provider';
      const request = { prompt: 'Test prompt', requestCount: 3 };

      // Act
      const result = await controller.runLoadTest(provider, request, '127.0.0.1');

      // Assert
      expect(result).toBeDefined();
      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(3);
      expect(result.totalRequests).toBe(3);
      expect(result.successRate).toBe(0);
      expect(result.errorsByType).toBeDefined();
    });

    it('should handle non-existent provider', async () => {
      // Arrange
      const provider = 'non-existent-provider';
      const request = { prompt: 'Test prompt', requestCount: 1 };

      // Act
      const result = await controller.runLoadTest(provider, request, '127.0.0.1');

      // Assert
      expect(result).toBeDefined();
      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(1);
      expect(result.totalRequests).toBe(1);
      expect(result.successRate).toBe(0);
      expect(result.errorsByType).toBeDefined();
      expect(Object.values(result.errorsByType).some(count => count > 0)).toBe(true);
    });

    it('should use default values when not provided', async () => {
      // Arrange
      const provider = 'success-provider';
      const request = { prompt: 'Default test prompt', requestCount: 1 };

      // Act
      const result = await controller.runLoadTest(provider, request, '127.0.0.1');

      // Assert
      expect(result).toBeDefined();
      expect(result.totalRequests).toBe(1);
      expect(result.successCount).toBe(1);
      expect(result.successRate).toBe(100);
    });
  });
});
