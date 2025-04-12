/**
 * Enhanced script for testing fallback mechanisms
 * Tests smarter fallback mechanisms, error classification, and service provider selection strategies
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { htmlReport } from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.1/index.js";

// General metrics
const errorRate = new Rate('error_rate');
const responseTime = new Trend('response_time');
const successfulRequests = new Counter('successful_requests');
const failedRequests = new Counter('failed_requests');
const fallbackUsed = new Counter('fallback_used');
const cacheHits = new Counter('cache_hits');
const totalRequests = new Counter('total_requests');

// Error type metrics
const serviceUnavailableErrors = new Counter('service_unavailable_errors');
const modelNotFoundErrors = new Counter('model_not_found_errors');
const timeoutErrors = new Counter('timeout_errors');
const rateLimitErrors = new Counter('rate_limit_errors');
const invalidRequestErrors = new Counter('invalid_request_errors');
const unexpectedErrors = new Counter('unexpected_errors');

// Service provider specific metrics
const openaiSuccessRate = new Rate('openai_success_rate');
const anthropicSuccessRate = new Rate('anthropic_success_rate');
const ollamaSuccessRate = new Rate('ollama_success_rate');
const localSuccessRate = new Rate('local_success_rate');

// Strategy specific metrics
const performanceStrategyTime = new Trend('performance_strategy_time');
const costStrategyTime = new Trend('cost_strategy_time');
const qualityStrategyTime = new Trend('quality_strategy_time');
const fallbackStrategyTime = new Trend('fallback_strategy_time');

// Test settings
export const options = {
  stages: [
    { duration: '10s', target: 5 },   // Warm-up phase
    { duration: '30s', target: 20 },  // Medium load
    { duration: '20s', target: 40 },  // High load
    { duration: '10s', target: 0 },   // Cool-down phase
  ],
  thresholds: {
    'error_rate': ['rate<0.4'],        // Error rate below 40%
    'response_time': ['p(95)<10000'],  // 95% of requests under 10s
    'fallback_used': ['count>10'],     // At least 10 fallback uses
  },
};

// Test prompts - more diverse prompts for different task types
const prompts = [
  { text: "How does artificial intelligence work?", taskType: "general" },
  { text: "How does artificial intelligence work?", taskType: "general" }, // Same prompt for cache testing
  { text: "Write a short poem", taskType: "creative" },
  { text: "Write a short poem", taskType: "creative" }, // Same prompt for cache testing
  { text: "Explain what machine learning is", taskType: "educational" },
  { text: "Explain what machine learning is", taskType: "educational" }, // Same prompt for cache testing
  { text: "Give three SEO tips", taskType: "seo" },
  { text: "What is the best programming language for beginners?", taskType: "programming" },
  { text: "Write an example of a REST API", taskType: "programming" },
  { text: "How can I improve my website's performance?", taskType: "seo" },
  { text: "Write a product description for a smartwatch", taskType: "marketing" },
  { text: "Analyze the efficiency of this code: for(let i=0; i<arr.length; i++) { console.log(arr[i]); }", taskType: "code_review" },
  { text: "How can I optimize PostgreSQL database queries?", taskType: "database" },
  { text: "Explain the advantages and disadvantages of microservice architecture", taskType: "architecture" },
  { text: "Write a simple React component that displays a counter", taskType: "programming" }
];

// Test service providers
const providers = ['openai', 'anthropic', 'ollama', 'local'];

// Test strategies
const strategies = ['performance', 'cost', 'quality', 'fallback'];

// Error simulation
const errorSimulations = [
  { type: 'none', weight: 0.6 },                  // No simulated error (60%)
  { type: 'service_unavailable', weight: 0.1 },   // Service unavailable (10%)
  { type: 'model_not_found', weight: 0.05 },      // Model not found (5%)
  { type: 'timeout', weight: 0.1 },               // Timeout (10%)
  { type: 'rate_limit', weight: 0.05 },           // Rate limit (5%)
  { type: 'invalid_request', weight: 0.05 },      // Invalid request (5%)
  { type: 'all', weight: 0.05 }                   // All service providers fail (5%)
];

// Select error simulation based on weights
function selectErrorSimulation() {
  const random = Math.random();
  let cumulativeWeight = 0;
  
  for (const error of errorSimulations) {
    cumulativeWeight += error.weight;
    if (random < cumulativeWeight) {
      return error.type;
    }
  }
  
  return 'none';
}

// Update strategy-specific response time metrics
function updateStrategyMetrics(strategy, duration) {
  const strategyMetrics = {
    performance: performanceStrategyTime,
    cost: costStrategyTime,
    quality: qualityStrategyTime,
    fallback: fallbackStrategyTime
  };
  
  if (strategyMetrics[strategy]) {
    strategyMetrics[strategy].add(duration);
  }
}

// Update provider-specific success metrics
function updateProviderMetrics(provider, success) {
  const providerMetrics = {
    openai: openaiSuccessRate,
    anthropic: anthropicSuccessRate,
    ollama: ollamaSuccessRate,
    local: localSuccessRate
  };
  
  if (providerMetrics[provider]) {
    providerMetrics[provider].add(success ? 1 : 0);
  }
}

// Process successful response
function handleSuccessfulResponse(data, provider, duration, promptObj, strategy, errorType) {
  if (data.usedFallback) {
    fallbackUsed.add(1);
    console.log(`Fallback used: ${data.provider} (original: ${provider})`);
  }
  
  if (data.fromCache) {
    cacheHits.add(1);
    console.log(`Cache hit: ${promptObj.text.substring(0, 20)}...`);
  }
  
  updateProviderMetrics(data.provider, true);
  
  console.log(`Successful request: ${data.provider} | ${duration}ms | ${promptObj.text.substring(0, 20)}... | Strategy: ${strategy} | Simulated error: ${errorType}`);
  
  check(data, {
    'Response contains text': (r) => r.text && r.text.length > 0,
    'Response contains provider': (r) => r.provider && r.provider.length > 0,
    'Response contains model': (r) => r.model && r.model.length > 0,
    'Response contains processing time': (r) => r.processingTime && r.processingTime > 0
  });
}

// Process error response
function handleErrorResponse(errorData) {
  const errorTypes = {
    service_unavailable: serviceUnavailableErrors,
    model_not_found: modelNotFoundErrors,
    timeout: timeoutErrors,
    rate_limit: rateLimitErrors,
    invalid_request: invalidRequestErrors
  };

  const errorCounter = errorTypes[errorData.errorType] || unexpectedErrors;
  errorCounter.add(1);
  
  const errorMessage = errorData.errorType === undefined ?
    `Unexpected error: ${errorData.error}` :
    `${errorData.errorType}: ${errorData.error}`;
  
  console.log(errorMessage);
}

// Test enhanced fallback mechanism
export default function () {
  const promptObj = prompts[Math.floor(Math.random() * prompts.length)];
  const provider = providers[Math.floor(Math.random() * providers.length)];
  const strategy = strategies[Math.floor(Math.random() * strategies.length)];
  const errorType = selectErrorSimulation();
  
  const url = 'http://localhost:3001/ai-enhanced/process';
  const payload = JSON.stringify({
    taskType: promptObj.taskType,
    input: promptObj.text,
    preferredProvider: provider,
    strategy: strategy,
    testMode: errorType !== 'none',
    testError: errorType !== 'none' ? errorType : undefined
  });
  
  const params = {
    headers: { 'Content-Type': 'application/json' },
    timeout: 15000
  };

  const startTime = Date.now();
  const response = http.post(url, payload, params);
  const duration = Date.now() - startTime;
  
  responseTime.add(duration);
  totalRequests.add(1);
  updateStrategyMetrics(strategy, duration);

  if (response.status === 200) {
    successfulRequests.add(1);
    const data = response.json();
    handleSuccessfulResponse(data, provider, duration, promptObj, strategy, errorType);
  } else {
    failedRequests.add(1);
    errorRate.add(1);
    updateProviderMetrics(provider, false);
    
    console.log(`Failed request: ${response.status} | ${duration}ms | ${promptObj.text.substring(0, 20)}... | Strategy: ${strategy} | Simulated error: ${errorType}`);
    
    if (response.body) {
      handleErrorResponse(response.json());
    } else {
      console.log('Empty response body');
    }
  }
  
  sleep(Math.random() * 0.5 + 0.2); // 200-700ms
}

// Print summary at the end of the test
export function handleSummary(data) {
  // Calculate success rates
  const totalSuccess = data.metrics.successful_requests.values.count;
  const totalFailed = data.metrics.failed_requests.values.count;
  const total = totalSuccess + totalFailed;
  
  const successPercentage = (totalSuccess / total * 100).toFixed(2);
  const fallbackPercentage = (data.metrics.fallback_used.values.count / total * 100).toFixed(2);
  const cacheHitPercentage = (data.metrics.cache_hits.values.count / total * 100).toFixed(2);
  
  // Service provider specific statistics
  const openaiSuccess = data.metrics.openai_success_rate ? data.metrics.openai_success_rate.values.rate * 100 : 0;
  const anthropicSuccess = data.metrics.anthropic_success_rate ? data.metrics.anthropic_success_rate.values.rate * 100 : 0;
  const ollamaSuccess = data.metrics.ollama_success_rate ? data.metrics.ollama_success_rate.values.rate * 100 : 0;
  const localSuccess = data.metrics.local_success_rate ? data.metrics.local_success_rate.values.rate * 100 : 0;
  
  // Error statistics
  const serviceUnavailable = data.metrics.service_unavailable_errors ? data.metrics.service_unavailable_errors.values.count : 0;
  const modelNotFound = data.metrics.model_not_found_errors ? data.metrics.model_not_found_errors.values.count : 0;
  const timeout = data.metrics.timeout_errors ? data.metrics.timeout_errors.values.count : 0;
  const rateLimit = data.metrics.rate_limit_errors ? data.metrics.rate_limit_errors.values.count : 0;
  const invalidRequest = data.metrics.invalid_request_errors ? data.metrics.invalid_request_errors.values.count : 0;
  const unexpected = data.metrics.unexpected_errors ? data.metrics.unexpected_errors.values.count : 0;
  
  // Strategy specific statistics
  const performanceAvg = data.metrics.performance_strategy_time ? data.metrics.performance_strategy_time.values.avg : 0;
  const costAvg = data.metrics.cost_strategy_time ? data.metrics.cost_strategy_time.values.avg : 0;
  const qualityAvg = data.metrics.quality_strategy_time ? data.metrics.quality_strategy_time.values.avg : 0;
  const fallbackAvg = data.metrics.fallback_strategy_time ? data.metrics.fallback_strategy_time.values.avg : 0;
  
  // Create summary file
  const summaryData = {
    timestamp: new Date().toISOString(),
    duration: data.state.testRunDurationMs,
    totalRequests: total,
    successfulRequests: totalSuccess,
    failedRequests: totalFailed,
    successPercentage: parseFloat(successPercentage),
    fallbackUsed: data.metrics.fallback_used.values.count,
    fallbackPercentage: parseFloat(fallbackPercentage),
    cacheHits: data.metrics.cache_hits.values.count,
    cacheHitPercentage: parseFloat(cacheHitPercentage),
    responseTime: {
      avg: data.metrics.response_time.values.avg,
      min: data.metrics.response_time.values.min,
      max: data.metrics.response_time.values.max,
      p90: data.metrics.response_time.values["p(90)"],
      p95: data.metrics.response_time.values["p(95)"],
      p99: data.metrics.response_time.values["p(99)"]
    },
    providerStats: {
      openai: {
        successRate: openaiSuccess.toFixed(2)
      },
      anthropic: {
        successRate: anthropicSuccess.toFixed(2)
      },
      ollama: {
        successRate: ollamaSuccess.toFixed(2)
      },
      local: {
        successRate: localSuccess.toFixed(2)
      }
    },
    errorStats: {
      serviceUnavailable,
      modelNotFound,
      timeout,
      rateLimit,
      invalidRequest,
      unexpected
    },
    strategyStats: {
      performance: {
        avgResponseTime: performanceAvg.toFixed(2)
      },
      cost: {
        avgResponseTime: costAvg.toFixed(2)
      },
      quality: {
        avgResponseTime: qualityAvg.toFixed(2)
      },
      fallback: {
        avgResponseTime: fallbackAvg.toFixed(2)
      }
    }
  };
  
  // Save results
  return {
    "summary.json": JSON.stringify(summaryData, null, 2),
    "summary.html": htmlReport(data),
    "stdout": textSummary(data, { indent: "  ", enableColors: true })
  };
}
