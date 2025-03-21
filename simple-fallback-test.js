/**
 * Simple test for AI fallback mechanism
 * This script doesn't require real LLM models
 */

const axios = require('axios');
const fs = require('fs');

// Settings
const BASE_URL = 'http://localhost:3001';
const TOTAL_REQUESTS = 30;
const UNIQUE_PROMPTS = 5;
const DELAY_BETWEEN_REQUESTS = 200; // ms

// Statistics
let successCount = 0;
let errorCount = 0;
let fallbackCount = 0;
let cacheHitCount = 0;

// Error type statistics
let serviceUnavailableCount = 0;
let modelNotFoundCount = 0;
let timeoutCount = 0;
let rateLimitCount = 0;
let unexpectedErrorCount = 0;

// Provider-specific statistics
const providerStats = {
  openai: { success: 0, failure: 0, fallback: 0 },
  anthropic: { success: 0, failure: 0, fallback: 0 },
  ollama: { success: 0, failure: 0, fallback: 0 },
  local: { success: 0, failure: 0, fallback: 0 }
};

// Response times
const responseTimes = [];

// Prompts
const prompts = [
  "How does artificial intelligence work?",
  "Write a short poem",
  "Explain what machine learning is",
  "Give three SEO tips",
  "What is the best programming language for beginners?"
];

// Service providers
const providers = ['openai', 'anthropic', 'ollama', 'local'];

// Error simulation
const errorSimulations = [
  { type: 'none', weight: 0.6 },                  // No simulated error (60%)
  { type: 'service_unavailable', weight: 0.1 },   // Service unavailable (10%)
  { type: 'model_not_found', weight: 0.1 },       // Model not found (10%)
  { type: 'timeout', weight: 0.1 },               // Timeout (10%)
  { type: 'rate_limit', weight: 0.1 }             // Rate limit (10%)
];

// Select error scenario based on weights
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

// Helper functions
async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendRequest(prompt, provider, errorType = 'none') {
  const startTime = Date.now();
  
  try {
    const response = await axios.post(`${BASE_URL}/ai/process`, {
      taskType: 'seo',
      input: prompt,
      primaryModel: provider,
      testMode: errorType !== 'none' ? true : false,
      testError: errorType !== 'none' ? errorType : undefined
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-Test-Mode': errorType !== 'none' ? 'true' : 'false',
        'X-Test-Error': errorType !== 'none' ? errorType : ''
      },
      timeout: 10000 // 10 second timeout
    });

    const duration = Date.now() - startTime;
    responseTimes.push(duration);
    
    successCount++;
    const data = response.data;

    // Check if fallback was used
    if (data.usedFallback) {
      fallbackCount++;
      
      // Update provider-specific statistics
      if (data.provider && providerStats[data.provider]) {
        providerStats[data.provider].fallback++;
      }
      
      console.log(`Fallback used: ${data.provider} (original: ${provider}) | ${duration}ms`);
    }

    // Check if cache was used
    if (data.fromCache) {
      cacheHitCount++;
      console.log(`Cache hit: ${prompt.substring(0, 20)}... | ${duration}ms`);
    }
    
    // Update provider-specific statistics
    if (data.provider && providerStats[data.provider]) {
      providerStats[data.provider].success++;
    }

    console.log(`Successful request: ${data.provider || 'unknown'} | ${prompt.substring(0, 20)}... | ${duration}ms | Simulated error: ${errorType}`);
    return { success: true, data, duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    responseTimes.push(duration);
    
    // Update provider-specific statistics
    if (providerStats[provider]) {
      providerStats[provider].failure++;
    }
    
    if (error.response) {
      // Server responded with an error
      try {
        const errorData = error.response.data;
        
        // Classify error type
        if (errorData.errorType === 'service_unavailable') {
          serviceUnavailableCount++;
          console.log(`Service unavailable: ${errorData.error} | ${duration}ms`);
        } else if (errorData.errorType === 'model_not_found') {
          modelNotFoundCount++;
          console.log(`Model not found: ${errorData.error} | ${duration}ms`);
        } else if (errorData.errorType === 'timeout') {
          timeoutCount++;
          console.log(`Timeout: ${errorData.error} | ${duration}ms`);
        } else if (errorData.errorType === 'rate_limit') {
          rateLimitCount++;
          console.log(`Rate limit exceeded: ${errorData.error} | ${duration}ms`);
        } else {
          unexpectedErrorCount++;
          console.log(`Unexpected error: ${errorData.error} | ${duration}ms`);
        }
      } catch (e) {
        // If response is not in JSON format or doesn't contain errorType field
        if (error.response.status === 429) {
          rateLimitCount++;
          console.log(`Rate limit exceeded: ${error.response.statusText} | ${duration}ms`);
        } else if (error.response.status === 504) {
          timeoutCount++;
          console.log(`Timeout: ${error.response.statusText} | ${duration}ms`);
        } else if (error.response.status >= 500) {
          serviceUnavailableCount++;
          console.log(`Server error: ${error.response.status} - ${error.response.statusText} | ${duration}ms`);
        } else {
          unexpectedErrorCount++;
          console.log(`Other error: ${error.response.status} - ${error.response.statusText} | ${duration}ms`);
        }
      }
    } else if (error.code === 'ECONNABORTED') {
      timeoutCount++;
      console.log(`Request timed out: ${error.message} | ${duration}ms`);
    } else if (error.code === 'ECONNREFUSED') {
      serviceUnavailableCount++;
      console.log(`Server not responding: ${error.message} | ${duration}ms`);
    } else {
      unexpectedErrorCount++;
      console.log(`Error in request: ${error.message} | ${duration}ms`);
    }
    
    errorCount++;
    return { success: false, error: error.message, duration };
  }
}

// Main function
async function runTest() {
  console.log(`Starting test: ${TOTAL_REQUESTS} requests`);
  
  const startTime = Date.now();
  
  // Send requests
  for (let i = 0; i < TOTAL_REQUESTS; i++) {
    // Select a random prompt
    const promptIndex = i % UNIQUE_PROMPTS; // Ensure same prompts are reused
    const prompt = prompts[promptIndex];
    
    // Select a random service provider
    const providerIndex = Math.floor(Math.random() * providers.length);
    const provider = providers[providerIndex];
    
    // Select a random error scenario
    const errorType = selectErrorSimulation();
    
    console.log(`Request ${i+1}/${TOTAL_REQUESTS}: ${provider} - ${prompt.substring(0, 20)}... - Simulated error: ${errorType}`);
    
    await sendRequest(prompt, provider, errorType);
    
    // Wait a moment between requests
    await sleep(DELAY_BETWEEN_REQUESTS);
  }
  
  const totalDuration = Date.now() - startTime;
  
  // Calculate statistics
  const avgResponseTime = responseTimes.length > 0 
    ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
    : 0;
  
  // Calculate p95 response time
  let p95ResponseTime = 0;
  if (responseTimes.length > 0) {
    const sortedTimes = [...responseTimes].sort((a, b) => a - b);
    const p95Index = Math.floor(sortedTimes.length * 0.95);
    p95ResponseTime = sortedTimes[p95Index];
  }
  
  // Print summary
  console.log("\n--- Test summary ---");
  console.log(`Total requests: ${TOTAL_REQUESTS}`);
  console.log(`Successful requests: ${successCount} (${(successCount/TOTAL_REQUESTS*100).toFixed(2)}%)`);
  console.log(`Failed requests: ${errorCount} (${(errorCount/TOTAL_REQUESTS*100).toFixed(2)}%)`);
  
  if (successCount > 0) {
    console.log(`Fallback used: ${fallbackCount} (${(fallbackCount/successCount*100).toFixed(2)}% of successful requests)`);
    console.log(`Cache hits: ${cacheHitCount} (${(cacheHitCount/successCount*100).toFixed(2)}% of successful requests)`);
  } else {
    console.log(`Fallback used: ${fallbackCount} (0% of successful requests)`);
    console.log(`Cache hits: ${cacheHitCount} (0% of successful requests)`);
  }
  
  console.log(`\nError types:`);
  console.log(`- Service unavailable: ${serviceUnavailableCount} (${(serviceUnavailableCount/TOTAL_REQUESTS*100).toFixed(2)}%)`);
  console.log(`- Model not found: ${modelNotFoundCount} (${(modelNotFoundCount/TOTAL_REQUESTS*100).toFixed(2)}%)`);
  console.log(`- Timeout: ${timeoutCount} (${(timeoutCount/TOTAL_REQUESTS*100).toFixed(2)}%)`);
  console.log(`- Rate limit exceeded: ${rateLimitCount} (${(rateLimitCount/TOTAL_REQUESTS*100).toFixed(2)}%)`);
  console.log(`- Unexpected errors: ${unexpectedErrorCount} (${(unexpectedErrorCount/TOTAL_REQUESTS*100).toFixed(2)}%)`);
  
  console.log(`\nProvider statistics:`);
  for (const [provider, stats] of Object.entries(providerStats)) {
    const total = stats.success + stats.failure;
    const successRate = total > 0 ? (stats.success / total * 100).toFixed(2) : '0.00';
    const fallbackRate = stats.success > 0 ? (stats.fallback / stats.success * 100).toFixed(2) : '0.00';
    
    console.log(`- ${provider}: ${stats.success} successful (${successRate}%), ${stats.failure} failed, ${stats.fallback} fallback (${fallbackRate}%)`);
  }
  
  console.log(`\nResponse times:`);
  console.log(`- Average: ${avgResponseTime.toFixed(2)}ms`);
  console.log(`- P95: ${p95ResponseTime.toFixed(2)}ms`);
  console.log(`- Total test duration: ${totalDuration}ms`);
  
  // Save results to JSON file
  const results = {
    timestamp: new Date().toISOString(),
    metrics: {
      totalRequests: TOTAL_REQUESTS,
      successfulRequests: successCount,
      failedRequests: errorCount,
      fallbackUsed: fallbackCount,
      cacheHits: cacheHitCount,
      avgResponseTime: avgResponseTime,
      p95ResponseTime: p95ResponseTime,
      totalDuration: totalDuration,
      errorTypes: {
        serviceUnavailable: serviceUnavailableCount,
        modelNotFound: modelNotFoundCount,
        timeout: timeoutCount,
        rateLimit: rateLimitCount,
        unexpected: unexpectedErrorCount
      },
      providerStats: providerStats
    }
  };
  
  fs.writeFileSync('simple-fallback-test-results.json', JSON.stringify(results, null, 2));
  console.log('\nResults saved to file: simple-fallback-test-results.json');
}

// Run the test
runTest().catch(error => {
  console.error(`Test failed: ${error.message}`);
});
