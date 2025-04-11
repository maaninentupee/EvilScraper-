import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { EvilBotController } from '../../src/controllers/evil-bot.controller';
import { EvilBotService, Decision } from '../../src/services/EvilBotService';
import { MockLogger } from '../test-utils';

describe('EvilBotController', () => {
  let controller: EvilBotController;
  let mockEvilBotService: jest.Mocked<Partial<EvilBotService>>;
  let mockLogger: MockLogger;

  beforeEach(async () => {
    mockEvilBotService = {
      makeDecision: jest.fn()
    } as jest.Mocked<Partial<EvilBotService>>;
    
    mockLogger = new MockLogger();
    
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EvilBotController],
      providers: [
        {
          provide: EvilBotService,
          useValue: mockEvilBotService
        }
      ],
    }).compile();

    controller = module.get<EvilBotController>(EvilBotController);
    // @ts-ignore - Override the logger to our mock
    controller['logger'] = mockLogger;
  });

  afterEach(() => {
    mockLogger.clear();
    jest.clearAllMocks();
  });

  describe('makeDecision', () => {
    it('should return a successful decision', async () => {
      // Arrange
      const decisionRequest = {
        situation: 'User has been searching for information about mobile broadband subscriptions',
        options: ['Show pop-up offer', 'Send chatbot']
      };
      
      const mockDecision: Decision = {
        action: 'Send chatbot',
        reason: 'Chatbot is more interactive',
        confidence: 0.85
      };
      
      (mockEvilBotService.makeDecision as jest.Mock).mockResolvedValueOnce(mockDecision);
      
      // Act
      const result = await controller.makeDecision(decisionRequest);
      
      // Assert
      expect(result).toEqual(mockDecision);
      expect(mockEvilBotService.makeDecision).toHaveBeenCalledWith(
        decisionRequest.situation, 
        decisionRequest.options
      );
      expect(mockLogger.logs.log).toContain(
        `Evil Bot makes a decision in the situation: ${decisionRequest.situation.substring(0, 50)}...`
      );
    });

    it('should handle AI error response', async () => {
      // Arrange
      const decisionRequest = {
        situation: 'User has been searching for information about mobile broadband subscriptions',
        options: ['Show pop-up offer', 'Send chatbot']
      };
      
      (mockEvilBotService.makeDecision as jest.Mock).mockResolvedValueOnce({
        error: true,
        message: 'AI service is not available',
        details: 'All services failed'
      });
      
      // Act & Assert
      try {
        await controller.makeDecision(decisionRequest);
        fail('Should have thrown an exception');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
        expect(error.getResponse()).toHaveProperty('error', 'AI service is not available');
      }
      
      expect(mockEvilBotService.makeDecision).toHaveBeenCalledWith(
        decisionRequest.situation, 
        decisionRequest.options
      );
      expect(mockLogger.logs.error).toContain('AI service error: AI service is not available');
    });

    it('should handle invalid response format', async () => {
      // Arrange
      const decisionRequest = {
        situation: 'User has been searching for information about mobile broadband subscriptions',
        options: ['Show pop-up offer', 'Send chatbot']
      };
      
      const invalidResponse = {
        wrongField: 'incorrect format',
        anotherField: 123 
      };
      
      (mockEvilBotService.makeDecision as jest.Mock).mockResolvedValueOnce(invalidResponse);
      
      // Act & Assert
      try {
        await controller.makeDecision(decisionRequest);
        fail('Should have thrown an exception');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
        expect(error.getResponse()).toHaveProperty('error', 'Unexpected response format from AI service');
      }
      
      expect(mockEvilBotService.makeDecision).toHaveBeenCalledWith(
        decisionRequest.situation, 
        decisionRequest.options
      );
      expect(mockLogger.logs.error).toContain('Unexpected response format from AI service');
    });

    it('should handle service exceptions', async () => {
      // Arrange
      const decisionRequest = {
        situation: 'User has been searching for information about mobile broadband subscriptions',
        options: ['Show pop-up offer', 'Send chatbot']
      };
      
      const serviceError = new Error('Service failure');
      (mockEvilBotService.makeDecision as jest.Mock).mockRejectedValueOnce(serviceError);
      
      // Act & Assert
      await expect(controller.makeDecision(decisionRequest)).rejects.toThrow(Error);
      expect(mockEvilBotService.makeDecision).toHaveBeenCalledWith(
        decisionRequest.situation, 
        decisionRequest.options
      );
    });

    it('should reject requests with missing situation', async () => {
      // Arrange
      const invalidRequest = {
        options: ['Option 1', 'Option 2']
      };
      
      // Act & Assert
      try {
        await controller.makeDecision(invalidRequest as any);
        fail('Should have thrown an exception');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
        expect(error.getResponse().error).toContain('situation is missing');
      }
      
      expect(mockLogger.logs.error).toContain('Invalid request: situation is missing or empty');
    });
    
    it('should reject requests with empty situation', async () => {
      // Arrange
      const invalidRequest = {
        situation: '  ',
        options: ['Option 1', 'Option 2']
      };
      
      // Act & Assert
      try {
        await controller.makeDecision(invalidRequest);
        fail('Should have thrown an exception');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
        expect(error.getResponse().error).toContain('situation is missing or empty');
      }
    });
    
    it('should reject requests with empty options array', async () => {
      // Arrange
      const invalidRequest = {
        situation: 'User has been searching for information about mobile broadband subscriptions',
        options: []
      };
      
      // Act & Assert
      try {
        await controller.makeDecision(invalidRequest);
        fail('Should have thrown an exception');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
        expect(error.getResponse().error).toContain('options are missing or the list is empty');
      }
    });
    
    it('should reject requests with invalid option values', async () => {
      // Arrange
      const invalidRequest = {
        situation: 'User has been searching for information about mobile broadband subscriptions',
        options: ['Option 1', '', null]
      };
      
      // Act & Assert
      try {
        await controller.makeDecision(invalidRequest as any);
        fail('Should have thrown an exception');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
        expect(error.getResponse().error).toContain('not all options are valid strings');
      }
    });
  });
});
