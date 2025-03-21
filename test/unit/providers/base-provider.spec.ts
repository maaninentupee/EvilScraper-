import { BaseProvider, CompletionRequest, CompletionResult } from '../../../src/services/providers/BaseProvider';

// Create a concrete implementation of the abstract BaseProvider class for testing
class TestBaseProvider extends BaseProvider {
  constructor() {
    super();
  }

  async generateCompletion(request: CompletionRequest): Promise<CompletionResult> {
    return {
      text: 'Test completion',
      provider: this.getName(),
      model: request.modelName,
      success: true
    };
  }

  getName(): string {
    return 'TestBaseProvider';
  }
}

describe('BaseProvider', () => {
  let provider: TestBaseProvider;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    provider = new TestBaseProvider();
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('isAvailable', () => {
    it('should return true by default', async () => {
      const result = await provider.isAvailable();
      expect(result).toBe(true);
    });
  });

  describe('handleAvailabilityError', () => {
    it('should log error and return false', () => {
      // Using private method for testing
      const result = (provider as any).handleAvailabilityError(new Error('Test error'));
      
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error in BaseProvider.isAvailable:',
        expect.any(Error)
      );
    });
  });

  describe('calculateQualityScore', () => {
    it('should return 0 for empty text', () => {
      const score = (provider as any).calculateQualityScore('');
      expect(score).toBe(0);
    });

    it('should calculate score based on length', () => {
      const shortText = 'Short text';
      const longText = 'A'.repeat(1000);
      
      const shortScore = (provider as any).calculateQualityScore(shortText);
      const longScore = (provider as any).calculateQualityScore(longText);
      
      expect(shortScore).toBeLessThan(longScore);
      expect(longScore).toBeGreaterThanOrEqual(0.5); // Length score is capped at 0.5
    });

    it('should calculate score based on structure (line count)', () => {
      const singleLine = 'Single line text';
      const multiLine = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6\nLine 7\nLine 8\nLine 9\nLine 10\nLine 11';
      
      const singleLineScore = (provider as any).calculateQualityScore(singleLine);
      const multiLineScore = (provider as any).calculateQualityScore(multiLine);
      
      expect(multiLineScore).toBeGreaterThan(singleLineScore);
      expect(multiLineScore - singleLineScore).toBeCloseTo(1, 1); // Structure score difference should be close to 1
    });

    it('should add score for code blocks', () => {
      // Using texts of the same length so that length points don't affect the result
      const textWithoutCode = 'Text without code blocks'.padEnd(50, ' ');
      const textWithCode = 'Text with code blocks\n```\nconst x = 1;\n```'.padEnd(50, ' ');
      
      const scoreWithoutCode = (provider as any).calculateQualityScore(textWithoutCode);
      const scoreWithCode = (provider as any).calculateQualityScore(textWithCode);
      
      expect(scoreWithCode).toBeGreaterThan(scoreWithoutCode);
      // Code block also affects line count, so the difference is not exactly 1
      expect(scoreWithCode - scoreWithoutCode).toBeGreaterThan(0.5);
    });

    it('should combine all factors for final score', () => {
      const text = 'A'.repeat(500) + '\n'.repeat(5) + '```\ncode\n```';
      const score = (provider as any).calculateQualityScore(text);
      
      // Length score: 500/1000 * 0.5 = 0.25
      // Structure score: 7/10 = 0.7 (capped at 1)
      // Code score: 1
      // Total: ~1.95
      expect(score).toBeGreaterThan(1.5);
      expect(score).toBeLessThan(2.5);
    });
  });

  describe('logError', () => {
    it('should log error message to console', () => {
      const error = new Error('Test error');
      (provider as any).logError('Test message', error);
      
      expect(consoleSpy).toHaveBeenCalledWith('Test message', error);
    });
  });
});
