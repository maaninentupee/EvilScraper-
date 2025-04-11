/**
 * Mock provider factory for testing
 * Creates a mock AI provider with configurable behavior
 */

export const mockProviderFactory = (config: any = {}) => {
  const defaultConfig = {
    success: true,
    text: 'Default response',
    provider: 'mock-provider',
    model: 'mock-model',
    generateCompletion: jest.fn().mockResolvedValue({
      success: config.success !== undefined ? config.success : true,
      text: config.text || 'Default response',
      provider: config.provider || 'mock-provider',
      model: config.model || 'mock-model'
    })
  };

  const mergedConfig = { ...defaultConfig, ...config };

  return {
    name: mergedConfig.provider,
    generateCompletion: mergedConfig.generateCompletion,
    isAvailable: jest.fn().mockReturnValue(true),
    getModels: jest.fn().mockReturnValue(['mock-model']),
    getCapabilities: jest.fn().mockReturnValue({
      supportsStreaming: true,
      supportedTaskTypes: ['test']
    })
  };
};
