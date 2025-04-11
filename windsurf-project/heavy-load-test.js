import http from 'k6/http';
import { sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// General metrics
const errorRate = new Rate('error_rate');
const responseTime = new Trend('response_time');
const successfulRequests = new Counter('successful_requests');
const failedRequests = new Counter('failed_requests');

// Model-specific metrics
const openaiTime = new Trend('openai_processing_time');
const anthropicTime = new Trend('anthropic_processing_time');
const ollamaTime = new Trend('ollama_processing_time');

// Model-specific success rates
const openaiSuccessRate = new Rate('openai_success_rate');
const anthropicSuccessRate = new Rate('anthropic_success_rate');
const ollamaSuccessRate = new Rate('ollama_success_rate');

// Error type counters
const timeoutErrors = new Counter('timeout_errors');
const serverErrors = new Counter('server_errors');
const clientErrors = new Counter('client_errors');

// Test settings
export const options = {
  stages: [
    { duration: '10s', target: 10 },   // Warm-up phase
    { duration: '30s', target: 100 },  // Medium load
    { duration: '10s', target: 0 },    // Cool-down phase
  ],
  thresholds: {
    'error_rate': ['rate<0.5'],          // Error rate below 50%
    'response_time': ['p(95)<30000'],    // 95% of requests under 30s
  },
};

// Test prompts
const prompts = [
  "How does artificial intelligence work?",
  "Write a short poem",
  "Explain what machine learning is",
  "Give three SEO tips",
  "What is the best programming language for beginners?",
  "Write an example of a REST API",
  "How can I improve my website's performance?",
  "Explain what quantum computing is",
  "How can AI help in business?",
  "Write a short story about a robot"
];

// Test models and their weights
const providers = [
  { name: 'openai', weight: 0.4, models: ['gpt-3.5-turbo'] },
  { name: 'anthropic', weight: 0.4, models: ['claude-instant-1'] },
  { name: 'ollama', weight: 0.2, models: ['llama2'] }
];

// Write to log
function log(message, status, duration) {
  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp} | Status: ${status} | Duration: ${duration}ms | ${message}`;
  console.log(logEntry);
}

// Select service provider based on weights
function selectProvider() {
  const random = Math.random();
  let cumulativeWeight = 0;
  
  for (const provider of providers) {
    cumulativeWeight += provider.weight;
    if (random < cumulativeWeight) {
      return provider;
    }
  }
  
  // Return the first one as a fallback
  return providers[0];
}

// Update model-specific metrics
function updateModelMetrics(modelName, duration, success) {
  const metrics = {
    openai: { time: openaiTime, rate: openaiSuccessRate },
    anthropic: { time: anthropicTime, rate: anthropicSuccessRate },
    ollama: { time: ollamaTime, rate: ollamaSuccessRate }
  };

  if (metrics[modelName]) {
    if (success) {
      metrics[modelName].time.add(duration);
    }
    metrics[modelName].rate.add(success ? 1 : 0);
  }
}

// Handle error response
function handleError(response, provider, duration) {
  failedRequests.add(1);
  errorRate.add(1);
  
  if (response.error_code === 'ETIMEDOUT' || response.error_code === 'ESOCKETTIMEDOUT') {
    timeoutErrors.add(1);
    log(`Timeout error`, 'timeout', duration);
  } else if (response.status >= 500) {
    serverErrors.add(1);
    log(`Server error: ${response.status}`, 'server_error', duration);
  } else if (response.status >= 400) {
    clientErrors.add(1);
    log(`Client error: ${response.status}`, 'client_error', duration);
  } else {
    log(`Other error: ${response.status}`, 'other_error', duration);
  }
  
  updateModelMetrics(provider.name, duration, false);
}

export default function () {
  const provider = selectProvider();
  const prompt = prompts[Math.floor(Math.random() * prompts.length)];
  
  const url = 'http://localhost:3001/ai/process';
  const payload = JSON.stringify({
    taskType: 'seo',
    input: prompt,
    primaryModel: provider.name,
  });
  
  const params = {
    headers: { 'Content-Type': 'application/json' },
    timeout: 30000
  };

  const startTime = Date.now();
  const response = http.post(url, payload, params);
  const duration = Date.now() - startTime;
  
  responseTime.add(duration);

  if (response.status === 200) {
    successfulRequests.add(1);
    try {
      const data = response.json();
      const modelUsed = data.model || data.provider || provider.name;
      
      log(`Request successful, model used: ${modelUsed}`, 'success', duration);
      updateModelMetrics(modelUsed, duration, true);
    } catch (e) {
      log(`Response parsing error: ${e.message}`, 'error', duration);
    }
  } else {
    handleError(response, provider, duration);
  }

  sleep(Math.random() * 0.4 + 0.1);
}

// Print summary at the end of the test
export function handleSummary(data) {
  // Calculate model-specific metrics
  const openaiAvg = data.metrics.openai_processing_time ? data.metrics.openai_processing_time.values.avg : 0;
  const openaiP95 = data.metrics.openai_processing_time ? data.metrics.openai_processing_time.values['p(95)'] : 0;
  const openaiCount = data.metrics.openai_success_rate ? data.metrics.openai_success_rate.values.passes : 0;
  const openaiSuccess = data.metrics.openai_success_rate ? (data.metrics.openai_success_rate.values.rate * 100) : 0;
  
  const anthropicAvg = data.metrics.anthropic_processing_time ? data.metrics.anthropic_processing_time.values.avg : 0;
  const anthropicP95 = data.metrics.anthropic_processing_time ? data.metrics.anthropic_processing_time.values['p(95)'] : 0;
  const anthropicCount = data.metrics.anthropic_success_rate ? data.metrics.anthropic_success_rate.values.passes : 0;
  const anthropicSuccess = data.metrics.anthropic_success_rate ? (data.metrics.anthropic_success_rate.values.rate * 100) : 0;
  
  const ollamaAvg = data.metrics.ollama_processing_time ? data.metrics.ollama_processing_time.values.avg : 0;
  const ollamaP95 = data.metrics.ollama_processing_time ? data.metrics.ollama_processing_time.values['p(95)'] : 0;
  const ollamaCount = data.metrics.ollama_success_rate ? data.metrics.ollama_success_rate.values.passes : 0;
  const ollamaSuccess = data.metrics.ollama_success_rate ? (data.metrics.ollama_success_rate.values.rate * 100) : 0;
  
  // Print summary
  console.log(`OpenAI: avg=${openaiAvg}ms, p95=${openaiP95}ms, count=${openaiCount}, success=${openaiSuccess}%`);
  console.log(`Anthropic: avg=${anthropicAvg}ms, p95=${anthropicP95}ms, count=${anthropicCount}, success=${anthropicSuccess}%`);
  console.log(`Ollama: avg=${ollamaAvg}ms, p95=${ollamaP95}ms, count=${ollamaCount}, success=${ollamaSuccess}%`);
  
  return {
    'stdout': JSON.stringify({
      timestamp: new Date().toISOString(),
      metrics: {
        openai: { avg: openaiAvg, p95: openaiP95, count: openaiCount, success: openaiSuccess },
        anthropic: { avg: anthropicAvg, p95: anthropicP95, count: anthropicCount, success: anthropicSuccess },
        ollama: { avg: ollamaAvg, p95: ollamaP95, count: ollamaCount, success: ollamaSuccess },
        total: {
          count: openaiCount + anthropicCount + ollamaCount,
          success: (openaiCount + anthropicCount + ollamaCount > 0) ? 
            ((openaiSuccess * openaiCount + anthropicSuccess * anthropicCount + ollamaSuccess * ollamaCount) / 
             (openaiCount + anthropicCount + ollamaCount)) : 0
        }
      }
    }),
    'model-comparison-log.txt': data.metrics.openai_processing_time ? 
      `OpenAI: avg=${openaiAvg}ms, p95=${openaiP95}ms, count=${openaiCount}, success=${openaiSuccess}%\n` +
      `Anthropic: avg=${anthropicAvg}ms, p95=${anthropicP95}ms, count=${anthropicCount}, success=${anthropicSuccess}%\n` +
      `Ollama: avg=${ollamaAvg}ms, p95=${ollamaP95}ms, count=${ollamaCount}, success=${ollamaSuccess}%\n` : 
      'No results available'
  };
}
