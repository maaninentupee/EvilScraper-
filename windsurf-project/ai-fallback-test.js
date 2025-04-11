import http from 'k6/http';
import { sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// General metrics
const errorRate = new Rate('error_rate');
const fallbackSuccessRate = new Rate('fallback_success_rate');
const responseTime = new Trend('response_time');
const successfulRequests = new Counter('successful_requests');
const failedRequests = new Counter('failed_requests');

// Model-specific metrics
const openaiSuccessRate = new Rate('openai_success_rate');
const anthropicSuccessRate = new Rate('anthropic_success_rate');
const ollamaSuccessRate = new Rate('ollama_success_rate');

// Error type counters
const timeoutErrors = new Counter('timeout_errors');
const serverErrors = new Counter('server_errors');
const clientErrors = new Counter('client_errors');

export const options = {
  stages: [
    { duration: '5s', target: 5 },   // Warm-up phase
    { duration: '10s', target: 20 }, // Medium load
    { duration: '5s', target: 0 },   // Cool-down phase
  ],
  thresholds: {
    'error_rate': ['rate<0.5'],               // Error rate below 50%
    'fallback_success_rate': ['rate>0.5'],    // Fallback succeeds at least 50% of the time
    'response_time': ['avg<30000'],           // Average response time below 30s
  },
};

// Test prompts
const prompts = [
  "How does artificial intelligence work?",
  "Write a short poem",
  "Explain what machine learning is",
  "Give three SEO tips"
];

// Logging
const logs = [];
function log(message, model, status, duration) {
  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp} | Model: ${model} | Status: ${status} | Duration: ${duration}ms | ${message}`;
  console.log(logEntry);
  logs.push({
    timestamp,
    model,
    status,
    duration,
    message
  });
}

// Prepare request payload
function prepareRequest() {
  const prompt = prompts[Math.floor(Math.random() * prompts.length)];
  const primaryModel = Math.random() < 0.5 ? 'openai' : 'ollama';
  
  return {
    url: 'http://localhost:3001/ai/process',
    payload: JSON.stringify({
      taskType: 'seo',
      input: prompt,
      primaryModel,
      forceError: Math.random() < 0.3,
    }),
    params: {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000
    },
    primaryModel
  };
}

// Update model-specific success metrics
function updateModelMetrics(provider) {
  const metrics = {
    'openai': openaiSuccessRate,
    'anthropic': anthropicSuccessRate,
    'ollama': ollamaSuccessRate
  };
  
  metrics[provider]?.add(1);
}

// Get success message based on fallback status
function getSuccessMessage(model, usedFallback) {
  if (usedFallback) {
    return `Fallback succeeded, used model: ${model}`;
  }
  return `Primary model succeeded: ${model}`;
}

// Log success response
function logSuccess(data, primaryModel, duration) {
  const model = data.model || primaryModel;
  const message = getSuccessMessage(model, data.usedFallback);
  log(message, model, 'success', duration);
}

// Handle successful response
function handleSuccess(data, primaryModel, duration) {
  if (data.usedFallback) {
    fallbackSuccessRate.add(1);
  }
  
  logSuccess(data, primaryModel, duration);
  updateModelMetrics(data.model || data.provider);
}

// Handle error response
function handleError(response, primaryModel, duration) {
  failedRequests.add(1);
  errorRate.add(1);
  
  if (response.error_code?.includes('TIMEOUT')) {
    timeoutErrors.add(1);
    log('Timeout error', primaryModel, 'timeout', duration);
    return;
  }
  
  const errorMap = {
    500: { counter: serverErrors, type: 'server_error' },
    400: { counter: clientErrors, type: 'client_error' }
  };
  
  const errorType = errorMap[Math.floor(response.status / 100) * 100];
  if (errorType) {
    errorType.counter.add(1);
    log(`${errorType.type}: ${response.status}`, primaryModel, errorType.type, duration);
    return;
  }
  
  log(`Other error: ${response.status}`, primaryModel, 'other_error', duration);
}

export default function () {
  const { url, payload, params, primaryModel } = prepareRequest();
  
  const startTime = Date.now();
  const response = http.post(url, payload, params);
  const duration = Date.now() - startTime;
  
  responseTime.add(duration);
  
  if (response.status !== 200) {
    handleError(response, primaryModel, duration);
    sleep(Math.random() * 0.5 + 0.5);
    return;
  }
  
  successfulRequests.add(1);
  try {
    handleSuccess(response.json(), primaryModel, duration);
  } catch (e) {
    log(`Response parsing error: ${e.message}`, primaryModel, 'error', duration);
  }
  
  sleep(Math.random() * 0.5 + 0.5);
}

// Print summary at the end of the test
export function handleSummary(data) {
  // Calculate model-specific metrics
  const openaiSuccessRateValue = data.metrics.openai_success_rate ? data.metrics.openai_success_rate.values.rate * 100 : 0;
  const anthropicSuccessRateValue = data.metrics.anthropic_success_rate ? data.metrics.anthropic_success_rate.values.rate * 100 : 0;
  const ollamaSuccessRateValue = data.metrics.ollama_success_rate ? data.metrics.ollama_success_rate.values.rate * 100 : 0;
  
  // Calculate general metrics
  const errorRateValue = data.metrics.error_rate ? data.metrics.error_rate.values.rate * 100 : 0;
  const fallbackSuccessRateValue = data.metrics.fallback_success_rate ? data.metrics.fallback_success_rate.values.rate * 100 : 0;
  const responseTimeAvg = data.metrics.response_time ? data.metrics.response_time.values.avg : 0;
  const responseTimeP95 = data.metrics.response_time ? data.metrics.response_time.values['p(95)'] : 0;
  
  // Calculate request counts
  const successfulRequestsCount = data.metrics.successful_requests ? data.metrics.successful_requests.values.count : 0;
  const failedRequestsCount = data.metrics.failed_requests ? data.metrics.failed_requests.values.count : 0;
  const totalRequests = successfulRequestsCount + failedRequestsCount;
  
  // Calculate error types
  const timeoutErrorsCount = data.metrics.timeout_errors ? data.metrics.timeout_errors.values.count : 0;
  const serverErrorsCount = data.metrics.server_errors ? data.metrics.server_errors.values.count : 0;
  const clientErrorsCount = data.metrics.client_errors ? data.metrics.client_errors.values.count : 0;
  
  // Create summary
  const summary = {
    timestamp: new Date().toISOString(),
    duration: data.state.testRunDurationMs,
    iterations: data.metrics.iterations.values.count,
    vus: data.state.maxVUs,
    metrics: {
      error_rate: errorRateValue,
      fallback_success_rate: fallbackSuccessRateValue,
      response_time: {
        avg: responseTimeAvg,
        p95: responseTimeP95
      },
      requests: {
        successful: successfulRequestsCount,
        failed: failedRequestsCount,
        total: totalRequests
      },
      errors: {
        timeout: timeoutErrorsCount,
        server: serverErrorsCount,
        client: clientErrorsCount,
        other: failedRequestsCount - timeoutErrorsCount - serverErrorsCount - clientErrorsCount
      },
      models: {
        openai: {
          success_rate: openaiSuccessRateValue
        },
        anthropic: {
          success_rate: anthropicSuccessRateValue
        },
        ollama: {
          success_rate: ollamaSuccessRateValue
        }
      }
    },
    logs: logs
  };
  
  // Print summary to console
  console.log('=== Fallback test summary ===');
  console.log(`Error rate: ${errorRateValue.toFixed(2)}%`);
  console.log(`Fallback success rate: ${fallbackSuccessRateValue.toFixed(2)}%`);
  console.log(`Average response time: ${(responseTimeAvg / 1000).toFixed(2)} s`);
  console.log(`95th percentile response time: ${(responseTimeP95 / 1000).toFixed(2)} s`);
  console.log(`Successful requests: ${successfulRequestsCount}`);
  console.log(`Failed requests: ${failedRequestsCount}`);
  console.log(`Total requests: ${totalRequests}`);
  
  // Return summary as files
  return {
    'stdout': JSON.stringify(summary, null, 2),
    'fallback-test-summary.json': JSON.stringify(summary, null, 2),
    'fallback-test-log.txt': logs.map(entry => 
      `${entry.timestamp} | Model: ${entry.model} | Status: ${entry.status} | Duration: ${entry.duration}ms | ${entry.message}`
    ).join('\n')
  };
}
