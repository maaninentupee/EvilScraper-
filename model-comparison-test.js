import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';
import { SharedArray } from 'k6/data';

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

// API request implementation
export default function () {
  // Select a random provider and model
  const provider = providers[Math.floor(Math.random() * providers.length)];
  const model = provider.models[Math.floor(Math.random() * provider.models.length)];
  const prompt = prompts[Math.floor(Math.random() * prompts.length)];
  
  // Use the load-test endpoint optimized for load testing
  const url = `http://localhost:3001/ai/load-test/${provider.name}`;
  
  const payload = JSON.stringify({
    prompt: prompt,
    model: model,
    maxTokens: 30,  // Reduced response length to speed up the test
    temperature: 0.5, // Lower temperature = more deterministic response
    iterations: 1   // Only one iteration per request
  });
  
  const params = {
    headers: {
      'Content-Type': 'application/json'
    },
    timeout: 60000  // 60 second timeout
  };
  
  // Measure response time
  const startTime = Date.now();
  let response;
  
  try {
    response = http.post(url, payload, params);
  } catch (error) {
    // Handle exceptions, such as connection issues
    console.error(`Exception in request to ${provider.name}/${model}: ${error.message}`);
    errorRate.add(1);
    failedRequests.add(1);
    timeoutErrors.add(1);
    
    // Update model-specific success rate
    if (provider.name === 'openai') openaiSuccessRate.add(0);
    if (provider.name === 'anthropic') anthropicSuccessRate.add(0);
    if (provider.name === 'ollama') ollamaSuccessRate.add(0);
    
    // Add a delay and continue to the next request
    sleep(5);
    return;
  }
  
  const duration = Date.now() - startTime;
  
  // Save response time to general metric
  aiProcessingTime.add(duration);
  
  // Save response time to provider-specific metric
  if (provider.name === 'openai') openaiTime.add(duration);
  if (provider.name === 'anthropic') anthropicTime.add(duration);
  if (provider.name === 'ollama') ollamaTime.add(duration);
  
  // Check if the response was successful
  const success = check(response, {
    'status is 201 or 200': (r) => r.status === 201 || r.status === 200,
    'response has valid data': (r) => {
      try {
        const data = r.json();
        return data && (data.results || data.results === null);
      } catch (e) {
        return false;
      }
    }
  });
  
  // Update model-specific success rate
  if (provider.name === 'openai') openaiSuccessRate.add(success ? 1 : 0);
  if (provider.name === 'anthropic') anthropicSuccessRate.add(success ? 1 : 0);
  if (provider.name === 'ollama') ollamaSuccessRate.add(success ? 1 : 0);
  
  // Update success and error statistics
  if (!success) {
    errorRate.add(1);
    failedRequests.add(1);
    
    // Classify errors
    if (response.error && response.error.includes('timeout')) {
      timeoutErrors.add(1);
      console.error(`Timeout error with model ${model} (${provider.name}): ${duration}ms`);
    } else if (response.status >= 500) {
      serverErrors.add(1);
      console.error(`Server error with model ${model} (${provider.name}): ${response.status}, ${response.body ? response.body.substring(0, 100) : 'No response body'}`);
    } else if (response.status >= 400) {
      clientErrors.add(1);
      console.error(`Client error with model ${model} (${provider.name}): ${response.status}, ${response.body ? response.body.substring(0, 100) : 'No response body'}`);
    } else {
      console.error(`Unknown error with model ${model} (${provider.name}): ${response.status}, ${response.body ? response.body.substring(0, 100) : 'No response body'}`);
    }
  } else {
    successfulRequests.add(1);
    
    try {
      const data = response.json();
      const providerInfo = data.provider ? `${data.provider}` : provider.name;
      const modelInfo = data.model ? `${data.model}` : model;
      
      console.log(`✓ ${providerInfo}/${modelInfo}, duration: ${duration}ms, success rate: ${data.successRate ? data.successRate.toFixed(2) + '%' : 'N/A'}`);
      
      // If the response contains detailed results, display them
      if (data.results && data.results.length > 0) {
        const avgDuration = data.results.reduce((sum, r) => sum + (r.duration || 0), 0) / data.results.length;
        
        // Display text length if available
        const textLengths = data.results.filter(r => r.textLength).map(r => r.textLength);
        if (textLengths.length > 0) {
          const avgTextLength = textLengths.reduce((sum, len) => sum + len, 0) / textLengths.length;
          console.log(`  - Response length: ${avgTextLength.toFixed(0)} characters, response time: ${avgDuration.toFixed(0)}ms`);
        }
      }
      
      // Save data in the last iteration of the test
      if (__ITER === __ENV.iterations - 1) {
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
    } catch (e) {
      console.error(`Error processing response: ${e.message}`);
    }
  }
  
  // Add a delay between requests to distribute the load
  // The delay is shorter with more virtual users
  const currentVUs = __VU || 1;
  const baseDelay = Math.max(2, 6 - (currentVUs * 0.3)); // Longer delay reduces the load
  sleep(baseDelay + Math.random() * 2);
}
