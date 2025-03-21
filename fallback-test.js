/**
 * Script for testing the fallback mechanism
 * Tests caching, rate limiting, and intelligent model selection
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// General metrics
const errorRate = new Rate('error_rate');
const responseTime = new Trend('response_time');
const successfulRequests = new Counter('successful_requests');
const failedRequests = new Counter('failed_requests');
const fallbackUsed = new Counter('fallback_used');
const cacheHits = new Counter('cache_hits');

// Error type metrics
const serviceUnavailableErrors = new Counter('service_unavailable_errors');
const modelNotFoundErrors = new Counter('model_not_found_errors');
const timeoutErrors = new Counter('timeout_errors');
const rateLimitErrors = new Counter('rate_limit_errors');
const unexpectedErrors = new Counter('unexpected_errors');

// Service provider specific metrics
const openaiSuccessRate = new Rate('openai_success_rate');
const anthropicSuccessRate = new Rate('anthropic_success_rate');
const ollamaSuccessRate = new Rate('ollama_success_rate');
const localSuccessRate = new Rate('local_success_rate');

// Test settings
export const options = {
  stages: [
    { duration: '5s', target: 5 },    // Warm-up phase
    { duration: '15s', target: 30 },  // Medium load
    { duration: '5s', target: 0 },    // Cool-down phase
  ],
  thresholds: {
    'error_rate': ['rate<0.5'],        // Error rate below 50%
    'response_time': ['p(95)<15000'],  // 95% of requests under 15s
  },
};

// Test prompts - using the same prompt multiple times to test caching
const prompts = [
  "How does AI work?",
  "How does AI work?", // Same prompt to test caching
  "Write a short poem",
  "Write a short poem", // Same prompt to test caching
  "Explain what machine learning is",
  "Explain what machine learning is", // Same prompt to test caching
  "Give three SEO tips",
  "What is the best programming language for beginners?",
  "What is the best programming language for beginners?",
  "How can I improve my website performance?"
];

// Error simulation types and their weights
const errorSimulations = [
  { type: 'none', weight: 0.7 },                  // No simulated error (70%)
  { type: 'service_unavailable', weight: 0.1 },   // Service unavailable (10%)
  { type: 'model_not_found', weight: 0.05 },      // Model not found (5%)
  { type: 'timeout', weight: 0.1 },               // Timeout (10%)
  { type: 'rate_limit', weight: 0.05 }            // Rate limit (5%)
];

// Select error simulation based on weights
function selectErrorSimulation() {
  const totalWeight = errorSimulations.reduce((sum, sim) => sum + sim.weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const simulation of errorSimulations) {
    if (random < simulation.weight) {
      return simulation.type;
    }
    random -= simulation.weight;
  }
  
  return 'none'; // Default fallback
}

// Test the fallback mechanism
export default function () {
  // Select a random prompt
  const promptIndex = Math.floor(Math.random() * prompts.length);
  const prompt = prompts[promptIndex];
  
  // Select a random error simulation
  const errorType = selectErrorSimulation();
  
  // Create request
  const payload = {
    prompt: prompt,
    modelName: 'gpt-3.5-turbo',
    maxTokens: 100,
    temperature: 0.7,
    simulateError: errorType !== 'none' ? errorType : undefined
  };
  
  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: '30s'
  };
  
  const startTime = new Date().getTime();
  
  // Make the API request
  const response = http.post('http://localhost:3000/api/ai/completion-with-fallback', 
                           JSON.stringify(payload), 
                           params);
  
  const endTime = new Date().getTime();
  const duration = endTime - startTime;
  
  // Add response time to general metrics
  responseTime.add(duration);
  
  // Check if the request was successful
  const success = response.status === 200;
  
  // Record success/failure
  errorRate.add(!success);
  
  if (success) {
    successfulRequests.add(1);
    
    try {
      const responseData = JSON.parse(response.body);
      
      // Check if fallback was used
      if (responseData.wasFailover) {
        fallbackUsed.add(1);
      }
      
      // Check if cache was used
      if (responseData.fromCache) {
        cacheHits.add(1);
      }
      
      // Record provider-specific success
      if (responseData.provider === 'openai') {
        openaiSuccessRate.add(1);
      } else if (responseData.provider === 'anthropic') {
        anthropicSuccessRate.add(1);
      } else if (responseData.provider === 'ollama') {
        ollamaSuccessRate.add(1);
      } else if (responseData.provider === 'local') {
        localSuccessRate.add(1);
      }
      
    } catch (e) {
      console.error('Error parsing response:', e);
    }
  } else {
    failedRequests.add(1);
    
    // Record error types
    try {
      const responseData = JSON.parse(response.body);
      
      if (responseData.errorType === 'service_unavailable') {
        serviceUnavailableErrors.add(1);
      } else if (responseData.errorType === 'model_not_found') {
        modelNotFoundErrors.add(1);
      } else if (responseData.errorType === 'timeout') {
        timeoutErrors.add(1);
      } else if (responseData.errorType === 'rate_limit') {
        rateLimitErrors.add(1);
      } else {
        unexpectedErrors.add(1);
      }
    } catch (e) {
      unexpectedErrors.add(1);
    }
  }
  
  // Add a small delay between requests
  sleep(1);
}

// Print summary at the end of the test
export function handleSummary(data) {
  const summary = {
    "Test Summary": {
      "Total Requests": data.metrics.iterations.values.count,
      "Successful Requests": data.metrics.successful_requests.values.count,
      "Failed Requests": data.metrics.failed_requests.values.count,
      "Error Rate": `${(data.metrics.error_rate.values.rate * 100).toFixed(2)}%`,
      "Response Time (avg)": `${(data.metrics.response_time.values.avg / 1000).toFixed(2)}s`,
      "Response Time (p95)": `${(data.metrics.response_time.values.p(95) / 1000).toFixed(2)}s`,
      "Fallback Used": data.metrics.fallback_used?.values.count || 0,
      "Cache Hits": data.metrics.cache_hits?.values.count || 0,
    },
    "Error Types": {
      "Service Unavailable": data.metrics.service_unavailable_errors?.values.count || 0,
      "Model Not Found": data.metrics.model_not_found_errors?.values.count || 0,
      "Timeout": data.metrics.timeout_errors?.values.count || 0,
      "Rate Limit": data.metrics.rate_limit_errors?.values.count || 0,
      "Unexpected Errors": data.metrics.unexpected_errors?.values.count || 0,
    },
    "Provider Success Rates": {
      "OpenAI": `${((data.metrics.openai_success_rate?.values.rate || 0) * 100).toFixed(2)}%`,
      "Anthropic": `${((data.metrics.anthropic_success_rate?.values.rate || 0) * 100).toFixed(2)}%`,
      "Ollama": `${((data.metrics.ollama_success_rate?.values.rate || 0) * 100).toFixed(2)}%`,
      "Local": `${((data.metrics.local_success_rate?.values.rate || 0) * 100).toFixed(2)}%`,
    }
  };
  
  // Calculate fallback usage percentage
  const totalRequests = data.metrics.iterations.values.count;
  const fallbackUsed = data.metrics.fallback_used?.values.count || 0;
  const fallbackPercentage = totalRequests > 0 ? (fallbackUsed / totalRequests * 100).toFixed(2) : '0.00';
  
  // Calculate cache hit percentage
  const cacheHits = data.metrics.cache_hits?.values.count || 0;
  const cacheHitPercentage = totalRequests > 0 ? (cacheHits / totalRequests * 100).toFixed(2) : '0.00';
  
  // Add derived metrics
  summary["Key Performance Indicators"] = {
    "Fallback Usage": `${fallbackPercentage}%`,
    "Cache Hit Rate": `${cacheHitPercentage}%`,
    "Average Response Time": `${(data.metrics.response_time.values.avg / 1000).toFixed(2)}s`,
  };
  
  // Add analysis and recommendations
  summary["Analysis"] = {
    "Fallback Mechanism": fallbackPercentage > 30 
      ? "The fallback mechanism is being used frequently. Consider improving the primary service reliability."
      : "The fallback mechanism is working as expected with moderate usage.",
    
    "Caching Efficiency": cacheHitPercentage < 10
      ? "Cache hit rate is low. Consider adjusting cache settings or TTL values."
      : "Cache is working effectively with good hit rates.",
    
    "Response Time": (data.metrics.response_time.values.avg / 1000) > 5
      ? "Average response time is high. Consider performance optimizations."
      : "Response times are within acceptable ranges.",
    
    "Error Handling": (data.metrics.error_rate.values.rate) > 0.3
      ? "Error rate is high. Review error logs and improve error handling."
      : "Error handling is working effectively with acceptable error rates.",
  };
  
  return {
    'summary.json': JSON.stringify(summary, null, 2),
    'summary.txt': textSummary(summary, { indent: ' ' }),
  };
}

function textSummary(summary, options = {}) {
  const indent = options.indent || '  ';
  let text = 'Fallback Mechanism Test Summary\n';
  text += '==============================\n\n';
  
  for (const [section, data] of Object.entries(summary)) {
    text += `${section}:\n`;
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'object') {
        text += `${indent}${key}:\n`;
        for (const [subKey, subValue] of Object.entries(value)) {
          text += `${indent}${indent}${subKey}: ${subValue}\n`;
        }
      } else {
        text += `${indent}${key}: ${value}\n`;
      }
    }
    text += '\n';
  }
  
  return text;
}
