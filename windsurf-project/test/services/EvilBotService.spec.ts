import { Test, TestingModule } from '@nestjs/testing';
import { EvilBotService, Decision } from '../../src/services/EvilBotService';
import { AIGateway } from '../../src/services/AIGateway';
import { MockLogger } from '../test-utils';

describe('EvilBotService', () => {
  let service: EvilBotService;
  let mockAIGateway: jest.Mocked<AIGateway>;
  let mockLogger: MockLogger;

  beforeEach(async () => {
    mockAIGateway = {
      processAIRequest: jest.fn()
    } as unknown as jest.Mocked<AIGateway>;

    mockLogger = new MockLogger();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EvilBotService,
        {
          provide: AIGateway,
          useValue: mockAIGateway
        }
      ],
    }).compile();

    service = module.get<EvilBotService>(EvilBotService);
    // @ts-ignore - Replace the logger with our mock
    service['logger'] = mockLogger;
  });

  afterEach(() => {
    mockLogger.clear();
    jest.clearAllMocks();
  });

  describe('makeDecision', () => {
    it('should handle valid JSON response correctly', async () => {
      // Arrange
      const situation = 'User is browsing a product page';
      const options = ['Show discount label', 'Suggest additional products'];
      
      const mockAIResponse = `
      {
        "action": "Suggest additional products",
        "reason": "Additional products increase the average order value",
        "confidence": 0.85
      }`;
      
      (mockAIGateway.processAIRequest as jest.Mock).mockResolvedValueOnce(mockAIResponse);
      
      // Act
      const result = await service.makeDecision(situation, options);
      
      // Assert
      expect(result).toEqual({
        action: 'Suggest additional products',
        reason: 'Additional products increase the average order value',
        confidence: 0.85
      });
      
      expect(mockAIGateway.processAIRequest).toHaveBeenCalledWith('decision', expect.stringContaining(situation));
      expect(mockAIGateway.processAIRequest).toHaveBeenCalledWith('decision', expect.stringContaining(options[0]));
      expect(mockAIGateway.processAIRequest).toHaveBeenCalledWith('decision', expect.stringContaining(options[1]));
    });
    
    it('should handle markdown code block in response', async () => {
      // Arrange
      const situation = 'User has added a product to the shopping cart';
      const options = ['Suggest proceeding to checkout', 'Show recommended products'];
      
      const mockAIResponse = `
      Here is the decision:
      
      \`\`\`json
      {
        "action": "Show recommended products",
        "reason": "Recommendations increase sales",
        "confidence": 0.9
      }
      \`\`\`
      `;
      
      (mockAIGateway.processAIRequest as jest.Mock).mockResolvedValueOnce(mockAIResponse);
      
      // Act
      const result = await service.makeDecision(situation, options);
      
      // Assert
      expect(result).toEqual({
        action: 'Show recommended products',
        reason: 'Recommendations increase sales',
        confidence: 0.9
      });
    });
    
    it('should extract JSON from mixed text response', async () => {
      // Arrange
      const situation = 'User has left the site';
      const options = ['Send an email', 'Show notification on next visit'];
      
      const mockAIResponse = `
      After analyzing the situation, I came to the following decision:
      
      {
        "action": "Send an email",
        "reason": "Email is a more personal approach",
        "confidence": 0.75
      }
      
      Hopefully this helps with the decision-making process!
      `;
      
      (mockAIGateway.processAIRequest as jest.Mock).mockResolvedValueOnce(mockAIResponse);
      
      // Act
      const result = await service.makeDecision(situation, options);
      
      // Assert
      expect(result).toEqual({
        action: 'Send an email',
        reason: 'Email is a more personal approach',
        confidence: 0.75
      });
      
      expect(mockLogger.logs.warn).toContainEqual(expect.stringContaining('JSON parsing failed'));
    });
    
    it('should handle invalid JSON by returning default values', async () => {
      // Arrange
      const situation = 'User is browsing blogs';
      const options = ['Suggest articles', 'Ask to subscribe to the newsletter'];
      
      const mockAIResponse = `
      The best action would be to suggest articles, as they can spark more interest.
      `;
      
      (mockAIGateway.processAIRequest as jest.Mock).mockResolvedValueOnce(mockAIResponse);
      
      // Act
      const result = await service.makeDecision(situation, options);
      
      // Assert
      expect(result).toEqual({
        action: 'Error in decision-making',
        reason: 'AI model did not produce a valid JSON response',
        confidence: 0
      });
      
      expect(mockLogger.logs.error).toContainEqual(expect.stringContaining('Failed to parse response'));
    });
    
    it('should handle AI service errors', async () => {
      // Arrange
      const situation = 'User has left the site';
      const options = ['Send an email', 'Show notification on next visit'];
      
      const mockError = new Error('AI service is not responding');
      (mockAIGateway.processAIRequest as jest.Mock).mockRejectedValueOnce(mockError);
      
      // Act
      const result = await service.makeDecision(situation, options);
      
      // Assert
      expect(result).toEqual({
        action: 'Error',
        reason: 'Decision-making failed: AI service is not responding',
        confidence: 0
      });
      
      expect(mockLogger.logs.error).toContainEqual(expect.stringContaining('Decision-making failed'));
    });
    
    it('should validate situation parameter', async () => {
      // Arrange
      const invalidSituation = undefined;
      const options = ['Option 1', 'Option 2'];
      
      // Act
      const result = await service.makeDecision(invalidSituation as any, options);
      
      // Assert
      expect(result).toEqual({
        action: 'Error',
        reason: 'Invalid input: situation is undefined or of the wrong type',
        confidence: 0
      });
      
      expect(mockLogger.logs.error).toContainEqual('Invalid input: situation is undefined or of the wrong type');
      expect(mockAIGateway.processAIRequest).not.toHaveBeenCalled();
    });
    
    it('should validate options parameter', async () => {
      // Arrange
      const situation = 'User is on the site';
      const invalidOptions = [];
      
      // Act
      const result = await service.makeDecision(situation, invalidOptions);
      
      // Assert
      expect(result).toEqual({
        action: 'Error',
        reason: 'Invalid input: options are missing or not a valid list',
        confidence: 0
      });
      
      expect(mockLogger.logs.error).toContainEqual('Invalid input: options are missing or not a valid list');
      expect(mockAIGateway.processAIRequest).not.toHaveBeenCalled();
    });
    
    it('should handle object responses directly from AI gateway', async () => {
      // Arrange
      const situation = 'User is in the shopping cart';
      const options = ['Suggest additional purchases', 'Proceed to checkout'];
      
      const mockResponse = {
        action: 'Proceed to checkout',
        reason: 'User is ready to make a purchase',
        confidence: 0.95
      };
      
      (mockAIGateway.processAIRequest as jest.Mock).mockResolvedValueOnce(mockResponse);
      
      // Act
      const result = await service.makeDecision(situation, options);
      
      // Assert
      expect(result).toEqual({
        action: 'Proceed to checkout',
        reason: 'User is ready to make a purchase',
        confidence: 0.95
      });
    });
    
    it('should clamp confidence values to range 0-1', async () => {
      // Arrange
      const situation = 'User is reading an article';
      const options = ['Show more articles', 'Suggest newsletter subscription'];
      
      const mockResponse = {
        action: 'Show more articles',
        reason: 'User is interested in the content',
        confidence: 1.5 // Above the allowed maximum
      };
      
      (mockAIGateway.processAIRequest as jest.Mock).mockResolvedValueOnce(mockResponse);
      
      // Act
      const result = await service.makeDecision(situation, options);
      
      // Assert
      expect(result.confidence).toBe(1.0); // Clamped to the maximum
    });
  });
});
