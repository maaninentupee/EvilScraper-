import { Test, TestingModule } from '@nestjs/testing';
import { OpenAIProvider } from '../../../../src/services/providers/OpenAIProvider';
import { environment } from '../../../../src/config/environment';

// This test tests the behavior of the OpenAIProvider class in error situations
describe('OpenAIProvider - Error Handling', () => {
  let provider: OpenAIProvider;
  let originalApiKey: string;

  beforeAll(() => {
    // Save the original API key
    originalApiKey = environment.openaiApiKey;
  });

  afterAll(() => {
    // Restore the original API key
    (environment as any).openaiApiKey = originalApiKey;
  });

  describe('with invalid API key', () => {
    beforeEach(async () => {
      // Set an invalid API key
      (environment as any).openaiApiKey = 'invalid_key_sk_test_12345';

      const module: TestingModule = await Test.createTestingModule({
        providers: [OpenAIProvider],
      }).compile();

      provider = module.get<OpenAIProvider>(OpenAIProvider);
    });

    it('should report as available but fail gracefully when generating completion', async () => {
      // Check that the provider reports itself as available
      // (isAvailable returns false only if the API key is completely missing)
      const isAvailable = await provider.isAvailable();
      expect(isAvailable).toBe(false);

      // Test that generateCompletion handles the error correctly
      const result = await provider.generateCompletion({
        prompt: 'Test prompt',
        modelName: 'gpt-3.5-turbo',
      });

      // Check that the response is appropriate for an error situation
      expect(result.success).toBe(false);
      expect(result.text).toBe('');
      expect(result.error).toBeDefined();
      expect(result.provider).toBe('openai');
    });
  });

  describe('with missing API key', () => {
    beforeEach(async () => {
      // Remove the API key completely
      (environment as any).openaiApiKey = '';

      const module: TestingModule = await Test.createTestingModule({
        providers: [OpenAIProvider],
      }).compile();

      provider = module.get<OpenAIProvider>(OpenAIProvider);
    });

    it('should report as unavailable', async () => {
      const isAvailable = await provider.isAvailable();
      expect(isAvailable).toBe(false);
    });

    it('should return appropriate error when generating completion', async () => {
      const result = await provider.generateCompletion({
        prompt: 'Test prompt',
        modelName: 'gpt-3.5-turbo',
      });

      expect(result.success).toBe(false);
      expect(result.text).toBe('');
      expect(result.error).toBe('OpenAI client not initialized. API key missing.');
      expect(result.provider).toBe('openai');
    });
  });
});
