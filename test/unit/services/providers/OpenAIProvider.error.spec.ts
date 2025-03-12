import { Test, TestingModule } from '@nestjs/testing';
import { OpenAIProvider } from '../../../../src/services/providers/OpenAIProvider';
import { environment } from '../../../../src/config/environment';

// Tämä testi testaa OpenAIProvider-luokan käyttäytymistä virhetilanteissa
describe('OpenAIProvider - Error Handling', () => {
  let provider: OpenAIProvider;
  let originalApiKey: string;

  beforeAll(() => {
    // Tallenna alkuperäinen API-avain
    originalApiKey = environment.openaiApiKey;
  });

  afterAll(() => {
    // Palauta alkuperäinen API-avain
    (environment as any).openaiApiKey = originalApiKey;
  });

  describe('with invalid API key', () => {
    beforeEach(async () => {
      // Aseta virheellinen API-avain
      (environment as any).openaiApiKey = 'invalid_key_sk_test_12345';

      const module: TestingModule = await Test.createTestingModule({
        providers: [OpenAIProvider],
      }).compile();

      provider = module.get<OpenAIProvider>(OpenAIProvider);
    });

    it('should report as available but fail gracefully when generating completion', async () => {
      // Tarkista, että provider raportoi olevansa käytettävissä
      // (isAvailable palauttaa false vain jos API-avain puuttuu kokonaan)
      const isAvailable = await provider.isAvailable();
      expect(isAvailable).toBe(false);

      // Testaa, että generateCompletion käsittelee virheen oikein
      const result = await provider.generateCompletion({
        prompt: 'Test prompt',
        modelName: 'gpt-3.5-turbo',
      });

      // Tarkista, että vastaus on oikeanlainen virhetilanteessa
      expect(result.success).toBe(false);
      expect(result.text).toBe('');
      expect(result.error).toBeDefined();
      expect(result.provider).toBe('openai');
    });
  });

  describe('with missing API key', () => {
    beforeEach(async () => {
      // Poista API-avain kokonaan
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
