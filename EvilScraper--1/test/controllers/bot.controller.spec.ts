import { Test, TestingModule } from '@nestjs/testing';
import { BotController } from '../../src/controllers/bot.controller';
import { BotService } from '../../src/services/BotService';
import { HttpException } from '@nestjs/common';

describe('BotController', () => {
  let controller: BotController;
  let botService: BotService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BotController],
      providers: [
        {
          provide: BotService,
          useValue: {
            decideNextAction: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<BotController>(BotController);
    botService = module.get<BotService>(BotService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('decideNextAction', () => {
    it('should call decideNextAction and return response with timestamp', async () => {
      // Mock the service response
      const mockDecision = { action: 'reply', message: 'Testivastaus' };
      jest.spyOn(botService, 'decideNextAction').mockResolvedValue(mockDecision);

      // Call the controller method
      const result = await controller.decideNextAction({ message: 'Test input' });

      // Verify the result
      expect(result).toHaveProperty('decision', mockDecision);
      expect(result).toHaveProperty('timestamp');
      expect(typeof result.timestamp).toBe('string');
      expect(botService.decideNextAction).toHaveBeenCalledWith('Test input');
    });

    it('should handle empty message input', async () => {
      // Try with empty message
      await expect(controller.decideNextAction({ message: '' }))
        .rejects.toThrow(HttpException);
    });

    it('should handle null message input', async () => {
      // Try with null message
      await expect(controller.decideNextAction({ message: null }))
        .rejects.toThrow(HttpException);
    });

    it('should handle bot service errors', async () => {
      // Mock service to throw an error
      jest.spyOn(botService, 'decideNextAction').mockRejectedValue(new Error('AI Service Error'));

      // Call the controller method and expect it to throw
      await expect(controller.decideNextAction({ message: 'Test input' }))
        .rejects.toThrow('AI Service Error');
    });

    it('should handle AI error response', async () => {
      // Mock the service to return an error object
      const errorResponse = {
        error: true,
        message: 'AI service unavailable',
        details: 'Connection timeout'
      };
      jest.spyOn(botService, 'decideNextAction').mockResolvedValue(errorResponse);

      // Call the controller method and expect it to throw
      await expect(controller.decideNextAction({ message: 'Test input' }))
        .rejects.toThrow(HttpException);
    });

    it('should handle long user inputs by truncating logs', async () => {
      // Create a very long input
      const longInput = 'a'.repeat(200);
      const mockDecision = { action: 'reply', message: 'Testivastaus' };
      jest.spyOn(botService, 'decideNextAction').mockResolvedValue(mockDecision);

      // Call the controller method
      const result = await controller.decideNextAction({ message: longInput });

      // Verify the result
      expect(result).toHaveProperty('decision', mockDecision);
      expect(botService.decideNextAction).toHaveBeenCalledWith(longInput);
    });
  });
});
