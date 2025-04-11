module.exports = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  totalLatency: 0,
  providerUsage: {
    openai: { count: 0, success: 0, totalLatency: 0 },
    anthropic: { count: 0, success: 0, totalLatency: 0 },
    ollama: { count: 0, success: 0, totalLatency: 0 },
    lmstudio: { count: 0, success: 0, totalLatency: 0 },
    local: { count: 0, success: 0, totalLatency: 0 }
  },
  errors: {
    timeout: 0,
    server: 0,
    client: 0,
    unknown: 0
  }
};
