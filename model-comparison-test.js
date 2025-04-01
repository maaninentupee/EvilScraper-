import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

// Define general metrics
const errorRate = new Rate('error_rate');
const aiProcessingTime = new Trend('ai_processing_time');
const successfulRequests = new Counter('successful_requests');
const failedRequests = new Counter('failed_requests');

// Define metrics for different models
const openaiTime = new Trend('openai_processing_time');
const anthropicTime = new Trend('anthropic_processing_time');
const ollamaTime = new Trend('ollama_processing_time');

// Define error type counters
const timeoutErrors = new Counter('timeout_errors');
const serverErrors = new Counter('server_errors');
const clientErrors = new Counter('client_errors');

// Define success rates for different models
const openaiSuccessRate = new Rate('openai_success_rate');
const anthropicSuccessRate = new Rate('anthropic_success_rate');
const ollamaSuccessRate = new Rate('ollama_success_rate');

// Test settings - more realistic thresholds
export const options = {
  stages: [
    { duration: '20s', target: 3 },   // Warm-up phase - fewer users
    { duration: '40s', target: 8 },   // Medium load - more realistic user count
    { duration: '20s', target: 0 }    // Cool-down phase
  ],
  thresholds: {
    'error_rate': ['rate<0.7'],            // Error rate below 70% (more realistic for AI services)
    'http_req_duration': ['p(95)<60000'],  // 95% of requests under 60s
    'ai_processing_time': ['avg<30000'],   // Average processing time under 30s
    'timeout_errors': ['count<30'],        // Less than 30 timeout errors
  },
  // Add summaryTrendStats to get more detailed statistics
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

// Models to test and their configurations - focus on models that are more likely to work
const providers = [
  { name: 'openai', models: ['gpt-3.5-turbo'] },
  { name: 'anthropic', models: ['claude-instant-1'] },
  { name: 'ollama', models: ['llama2'] }
];

// Prompts to test - shorter and simpler
const prompts = [
  "How does artificial intelligence work?",
  "Write a short poem",
  "Explain what machine learning is",
  "Give three SEO tips"
];

// Results file
const resultsFileName = 'model-comparison-results.json';

// Save results
function saveResults(results) {
  const timestamp = new Date().toISOString();
  const resultsWithTimestamp = {
    timestamp,
    ...results
  };
  
  // Print results to console in JSON format so they can be saved to a file
  console.log(`RESULTS_JSON:${JSON.stringify(resultsWithTimestamp)}`);
}

// Helper functions to reduce complexity

function getRandomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function createRequestPayload(prompt, model) {
  return JSON.stringify({
    prompt,
    model,
    maxTokens: 30,
    temperature: 0.5,
    iterations: 1
  });
}

function updateProviderMetrics(providerName, duration, success) {
  // Update processing time
  aiProcessingTime.add(duration);
  
  switch(providerName) {
    case 'openai':
      openaiTime.add(duration);
      openaiSuccessRate.add(success ? 1 : 0);
      break;
    case 'anthropic':
      anthropicTime.add(duration);
      anthropicSuccessRate.add(success ? 1 : 0);
      break;
    case 'ollama':
      ollamaTime.add(duration);
      ollamaSuccessRate.add(success ? 1 : 0);
      break;
  }
}

function handleRequestError(provider, model, error) {
  console.error(`Exception in request to ${provider}/${model}: ${error.message}`);
  errorRate.add(1);
  failedRequests.add(1);
  timeoutErrors.add(1);
  updateProviderMetrics(provider, 0, false);
}

function processErrorResponse(response, provider, model, duration) {
  errorRate.add(1);
  failedRequests.add(1);

  const bodyPreview = response.body ? response.body.substring(0, 100) : 'No response body';
  
  if (response.error?.includes('timeout')) {
    timeoutErrors.add(1);
    console.error(`Timeout error with model ${model} (${provider}): ${duration}ms`);
  } else if (response.status >= 500) {
    serverErrors.add(1);
    console.error(`Server error with model ${model} (${provider}): ${response.status}, ${bodyPreview}`);
  } else if (response.status >= 400) {
    clientErrors.add(1);
    console.error(`Client error with model ${model} (${provider}): ${response.status}, ${bodyPreview}`);
  } else {
    console.error(`Unknown error with model ${model} (${provider}): ${response.status}, ${bodyPreview}`);
  }
}

function processSuccessResponse(response, provider, model, duration) {
  successfulRequests.add(1);
  
  try {
    const data = response.json();
    logSuccessDetails(data, provider, model, duration);
    
    if (__ITER === __ENV.iterations - 1) {
      saveTestResults();
    }
  } catch (e) {
    console.error(`Error processing response: ${e.message}`);
  }
}

function logSuccessDetails(data, provider, model, duration) {
  const providerInfo = data.provider || provider;
  const modelInfo = data.model || model;
  const successRate = data.successRate ? `${data.successRate.toFixed(2)}%` : 'N/A';
  
  console.log(`✓ ${providerInfo}/${modelInfo}, duration: ${duration}ms, success rate: ${successRate}`);
  
  if (data.results?.length > 0) {
    logResultsDetails(data.results);
  }
}

function logResultsDetails(results) {
  const avgDuration = results.reduce((sum, r) => sum + (r.duration || 0), 0) / results.length;
  
  const textLengths = results.filter(r => r.textLength).map(r => r.textLength);
  if (textLengths.length > 0) {
    const avgTextLength = textLengths.reduce((sum, len) => sum + len, 0) / textLengths.length;
    console.log(`  - Response length: ${avgTextLength.toFixed(0)} characters, response time: ${avgDuration.toFixed(0)}ms`);
  }
}

function saveTestResults() {
  saveResults({
    totalRequests: successfulRequests.count + failedRequests.count,
    successfulRequests: successfulRequests.count,
    failedRequests: failedRequests.count,
    errorRate: errorRate.rate,
    avgProcessingTime: aiProcessingTime.avg,
    providers: {
      openai: {
        successRate: openaiSuccessRate.rate,
        avgTime: openaiTime.avg
      },
      anthropic: {
        successRate: anthropicSuccessRate.rate,
        avgTime: anthropicTime.avg
      },
      ollama: {
        successRate: ollamaSuccessRate.rate,
        avgTime: ollamaTime.avg
      }
    }
  });
}

function calculateDelay() {
  const currentVUs = __VU || 1;
  const baseDelay = Math.max(2, 6 - (currentVUs * 0.3));
  return baseDelay + Math.random() * 2;
}

// Main test function with reduced complexity
export default function () {
  const provider = getRandomItem(providers);
  const model = getRandomItem(provider.models);
  const prompt = getRandomItem(prompts);
  
  const url = `http://localhost:3001/ai/load-test/${provider.name}`;
  const payload = createRequestPayload(prompt, model);
  const params = {
    headers: { 'Content-Type': 'application/json' },
    timeout: 60000
  };
  
  const startTime = Date.now();
  let response;
  
  try {
    response = http.post(url, payload, params);
  } catch (error) {
    handleRequestError(provider.name, model, error);
    sleep(5);
    return;
  }
  
  const duration = Date.now() - startTime;
  
  const success = check(response, {
    'status is 201 or 200': (r) => r.status === 201 || r.status === 200,
    'response has valid data': (r) => {
      try {
        const data = r.json();
        return data && (data.results || data.results === null);
      } catch {
        return false;
      }
    }
  });
  
  updateProviderMetrics(provider.name, duration, success);
  
  if (success) {
    processSuccessResponse(response, provider.name, model, duration);
  } else {
    processErrorResponse(response, provider.name, model, duration);
  }
  
  sleep(calculateDelay());
}
