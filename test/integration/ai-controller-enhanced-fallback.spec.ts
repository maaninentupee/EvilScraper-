import { Test, TestingModule } from '@nestjs/testing';
import { AIControllerEnhanced } from '../../src/controllers/AIControllerEnhanced';
import { AIGatewayEnhancer, AIResponse } from '../../src/services/AIGatewayEnhancer';

describe('AIControllerEnhanced - Fallback Strategy', () => {
  let controller: AIControllerEnhanced;
  let gateway: AIGatewayEnhancer;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AIControllerEnhanced],
      providers: [
        {
          provide: AIGatewayEnhancer,
          useValue: {
            processWithFallback: jest.fn(),
            processBatchWithStrategy: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AIControllerEnhanced>(AIControllerEnhanced);
    gateway = module.get<AIGatewayEnhancer>(AIGatewayEnhancer);
  });

  it('should return successful fallback response', async () => {
    const input = 'What is fallback?';
    const taskType = 'decision';
    const providerName = 'openai';

    const mockedResponse: AIResponse = {
      success: true,
      result: 'This is a fallback response.',
      model: 'gpt-4-turbo',
      provider: 'openai',
      wasFailover: false,
    };

    (gateway.processWithFallback as jest.Mock).mockResolvedValueOnce(mockedResponse);

    const result = await controller.processWithFallback(input, taskType, providerName);
    expect(result).toEqual(mockedResponse);
  });

  it('should handle fallback error properly when all providers fail', async () => {
    const input = 'Simulated error scenario';
    const taskType = 'decision';

    const error = new Error('All AI services failed');
    
    (gateway.processWithFallback as jest.Mock).mockRejectedValueOnce(error);

    try {
      await controller.processWithFallback(input, taskType);
      fail('Should have thrown an error');
    } catch (err) {
      expect(err.message).toContain('Failed to process request with fallback');
    }
  });

  it('should fallback only for failed inputs in performance strategy', async () => {
    // Arrange
    const inputs = ['prompt 1', 'prompt 2', 'prompt 3'];
    const taskType = 'translation';
    
    // Mock responses: provider A succeeds for prompts 1 and 3, fails for prompt 2
    // provider B succeeds as fallback for prompt 2
    const mockedResults: AIResponse[] = [
      {
        success: true,
        result: 'Response for prompt 1',
        model: 'gpt-4-turbo',
        provider: 'openai',
        wasFailover: false
      },
      {
        success: true,
        result: 'Response for prompt 2',
        model: 'claude-instant',
        provider: 'anthropic',
        wasFailover: true
      },
      {
        success: true,
        result: 'Response for prompt 3',
        model: 'gpt-4-turbo',
        provider: 'openai',
        wasFailover: false
      }
    ];

    (gateway.processBatchWithStrategy as jest.Mock).mockResolvedValueOnce(mockedResults);

    // Act
    const result = await controller.processBatchWithPerformanceStrategy(inputs, taskType);

    // Assert
    expect(result).toEqual(mockedResults);
    expect(gateway.processBatchWithStrategy).toHaveBeenCalledWith(
      inputs,
      taskType,
      'performance',
      expect.any(Object)
    );
  });
});
