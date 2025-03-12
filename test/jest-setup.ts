// Global setup file for Jest tests

// Mock environment for all tests
jest.mock('../src/config/environment', () => ({
  environment: {
    useLocalModels: true,
    defaultModelType: 'seo',
    fallbackThreshold: 0.7,
    openAIApiKey: 'test-openai-key',
    anthropicApiKey: 'test-anthropic-key',
    localModelHost: 'http://localhost:5000'
  }
}));

// Mock axios
jest.mock('axios', () => ({
  post: jest.fn(),
  get: jest.fn(),
  create: jest.fn().mockReturnThis(),
  interceptors: {
    request: { use: jest.fn(), eject: jest.fn() },
    response: { use: jest.fn(), eject: jest.fn() }
  }
}));
