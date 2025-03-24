import { Test, TestingModule } from '@nestjs/testing';
import { AIControllerEnhanced } from '../../src/controllers/AIControllerEnhanced';
import { AIGatewayEnhancer } from '../../src/services/AIGatewayEnhancer';
import { AIGateway } from '../../src/services/AIGateway';
import { ProviderSelectionStrategy } from '../../src/services/utils/ProviderSelectionStrategy';
import { ProviderHealthMonitor } from '../../src/services/ProviderHealthMonitor';
import { ErrorClassifier } from '../../src/services/utils/ErrorClassifier';
import { ConfigService } from '@nestjs/config';

/**
 * AIControllerEnhanced Integration Test
 * 
 * This test verifies the functionality of the AIControllerEnhanced class
 * for both single and batch request processing.
 */
describe('AIControllerEnhanced Integration Test', () => {
  let aiController: AIControllerEnhanced;
  let aiGateway: AIGatewayEnhancer;
  let mockAIGateway: jest.Mocked<AIGateway>;
  let mockProviderSelectionStrategy: jest.Mocked<ProviderSelectionStrategy>;
  let mockProviderHealthMonitor: jest.Mocked<ProviderHealthMonitor>;
  let mockErrorClassifier: jest.Mocked<ErrorClassifier>;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    // Create mock implementations
    mockAIGateway = {
      processAIRequest: jest.fn(),
    } as unknown as jest.Mocked<AIGateway>;

    mockProviderSelectionStrategy = {
      selectProvider: jest.fn(),
    } as unknown as jest.Mocked<ProviderSelectionStrategy>;

    mockProviderHealthMonitor = {
      getProviderHealth: jest.fn(),
      recordSuccess: jest.fn(),
      recordFailure: jest.fn(),
    } as unknown as jest.Mocked<ProviderHealthMonitor>;

    mockErrorClassifier = {
      classifyError: jest.fn(),
    } as unknown as jest.Mocked<ErrorClassifier>;

    mockConfigService = {
      get: jest.fn().mockImplementation((key) => {
        if (key === 'AI_REQUEST_TIMEOUT') return 10000;
        if (key === 'AI_MAX_RETRIES') return 3;
        if (key === 'AI_RETRY_DELAY') return 500;
        return null;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AIControllerEnhanced],
      providers: [
        AIGatewayEnhancer,
        {
          provide: AIGateway,
          useValue: mockAIGateway,
        },
        {
          provide: ProviderSelectionStrategy,
          useValue: mockProviderSelectionStrategy,
        },
        {
          provide: ProviderHealthMonitor,
          useValue: mockProviderHealthMonitor,
        },
        {
          provide: ErrorClassifier,
          useValue: mockErrorClassifier,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    aiController = module.get<AIControllerEnhanced>(AIControllerEnhanced);
    aiGateway = module.get<AIGatewayEnhancer>(AIGatewayEnhancer);
  });

  it('should return AI response for a single request', async () => {
    jest.spyOn(aiGateway, 'processWithSmartFallback').mockResolvedValue({
      success: true,
      result: 'This is an AI response',
      provider: 'openai',
      model: 'gpt-4'
    });

    const result = await aiController.processWithSmartFallback({ 
      input: 'How does AI work?',
      taskType: 'text-generation'
    }, '127.0.0.1');

    expect(result).toEqual(expect.objectContaining({ 
      result: 'This is an AI response',
      provider: 'openai'
    }));
  });

  it('should process batch requests successfully', async () => {
    jest.spyOn(aiGateway, 'processBatchWithSmartFallback').mockResolvedValue([
      {
        success: true,
        result: 'Batch response 1',
        provider: 'openai',
        model: 'gpt-4'
      },
      {
        success: true,
        result: 'Batch response 2',
        provider: 'openai',
        model: 'gpt-4'
      }
    ]);

    const batchRequest = {
      inputs: ['Tell me about AI', 'How does NLP work?'],
      taskType: 'text-generation'
    };

    const result = await aiController.processBatchWithSmartFallback(batchRequest, '127.0.0.1');

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(expect.objectContaining({ 
      result: 'Batch response 1',
      provider: 'openai'
    }));
    expect(result[1]).toEqual(expect.objectContaining({ 
      result: 'Batch response 2',
      provider: 'openai'
    }));
  });

  it('should handle batch request failures', async () => {
    jest.spyOn(aiGateway, 'processBatchWithSmartFallback').mockRejectedValue(
      new Error('All AI services failed')
    );

    const batchRequest = {
      inputs: ['Tell me about AI', 'How does NLP work?'],
      taskType: 'text-generation'
    };

    await expect(aiController.processBatchWithSmartFallback(batchRequest, '127.0.0.1')).rejects.toThrow(
      /All AI services failed/
    );
  });

  it('should handle fallback scenarios in single requests', async () => {
    // First call fails, second succeeds (simulating fallback)
    jest.spyOn(aiGateway, 'processWithSmartFallback').mockResolvedValue({
      success: true,
      result: 'Response from fallback provider',
      provider: 'anthropic',
      model: 'claude-3-opus',
      wasFailover: true
    });

    const result = await aiController.processWithSmartFallback({ 
      input: 'Complex AI question',
      taskType: 'text-generation',
      providerName: 'openai'
    }, '127.0.0.1');

    expect(result).toEqual(expect.objectContaining({ 
      result: 'Response from fallback provider',
      provider: 'anthropic',
      wasFailover: true
    }));
  });

  it('should pass through options to the gateway', async () => {
    const mockProcessWithOptions = jest.spyOn(aiGateway, 'processWithSmartFallback')
      .mockResolvedValue({
        success: true,
        result: 'Response with options',
        provider: 'openai',
        model: 'gpt-4'
      });

    await aiController.processWithSmartFallback({ 
      input: 'Test with options',
      taskType: 'text-generation',
      strategy: 'performance',
      cacheResults: false,
      testMode: true,
      testError: 'timeout'
    }, '127.0.0.1');

    // Verify that options were passed to the gateway
    expect(mockProcessWithOptions).toHaveBeenCalledWith(
      'text-generation',
      'Test with options',
      expect.objectContaining({
        strategy: expect.any(String),
        cacheResults: false,
        testMode: true,
        testError: 'timeout'
      })
    );
  });
});
