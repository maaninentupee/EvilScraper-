const axios = require('axios');
const prompts = require('./config/prompts');
const metrics = require('./config/metrics');

// Configuration
const config = {
  baseUrl: 'http://localhost:3001',
  concurrentRequests: 10,
  totalRequests: 50,
  delayBetweenBatches: 500, // ms
};

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

// Helper functions to reduce complexity

function classifyError(error, index, duration, model) {
  if (error.code === 'ECONNABORTED') {
    incrementErrorCount('timeout', index, duration, model, 'timeout');
  } else if (error.response) {
    handleHttpError(error, index, duration, model);
  } else if (error.request) {
    incrementErrorCount('server', index, duration, model, 'no_response');
  } else {
    incrementErrorCount('unknown', index, duration, model, 'unknown_error', error.message);
  }
}

function incrementErrorCount(type, index, duration, model, logType, message = '') {
  metrics.errors[type]++;
  log(`Request ${index} failed: ${message}`, model, logType, duration);
}

function handleHttpError(error, index, duration, model) {
  const errorMessage = error.response.data?.message || error.message;
  if (error.response.status >= 500) {
    incrementErrorCount('server', index, duration, model, 'server_error', errorMessage);
  } else if (error.response.status >= 400) {
    incrementErrorCount('client', index, duration, model, 'client_error', errorMessage);
  } else {
    incrementErrorCount('unknown', index, duration, model, 'unknown_error', errorMessage);
  }
}

function updateMetricsOnSuccess(response, duration, model, provider) {
  metrics.successfulRequests++;
  metrics.totalLatency += duration;
  if (metrics.providerUsage[provider]) {
    const providerMetrics = metrics.providerUsage[provider];
    providerMetrics.count++;
    providerMetrics.success++;
    providerMetrics.totalLatency += duration;
  }
}

function processResponse(response, index, duration) {
  const { success, result } = response.data || {};
  const model = result?.model || 'unknown';
  const provider = result?.provider || 'unknown';
  if (success) {
    updateMetricsOnSuccess(response, duration, model, provider);
    log(`Request ${index} successful`, model, 'success', duration);
  } else {
    handleFailedResponse(response, index, duration, model);
  }
  return { success, duration, model, provider };
}

function handleFailedResponse(response, index, duration, model) {
  metrics.failedRequests++;
  const errorMessage = response.data?.error || 'Unknown error';
  const logType = errorMessage.includes('All AI services failed') ? 'all_providers_failed' : 'failed_response';
  log(`Request ${index} failed: ${errorMessage}`, model, logType, duration);
}

// Sends one AI request
async function sendRequest(prompt, index) {
  const startTime = Date.now();
  metrics.totalRequests++;

  try {
    const response = await axios.post(`${config.baseUrl}/ai/process`, {
      taskType: 'seo',
      input: prompt
    }, {
      timeout: 30000
    });

    const duration = Date.now() - startTime;
    return processResponse(response, index, duration);
  } catch (error) {
    const duration = Date.now() - startTime;
    metrics.failedRequests++;
    classifyError(error, index, duration, 'unknown');
    return { success: false, duration, error: error.message };
  }
}

// Sends multiple requests simultaneously
async function sendBatch(startIndex, batchSize) {
  const batch = [];
  for (let i = 0; i < batchSize; i++) {
    const index = startIndex + i;
    if (index < config.totalRequests) {
      const promptIndex = index % prompts.length;
      batch.push(sendRequest(prompts[promptIndex], index));
    }
  }
  
  return Promise.all(batch);
}

// Runs the test
async function runTest() {
  console.log(`Starting fallback test with ${config.totalRequests} total requests, ${config.concurrentRequests} concurrent`);
  console.log(`Server URL: ${config.baseUrl}`);
  console.log('---------------------------------------------------');
  
  const startTime = Date.now();
  
  for (let i = 0; i < config.totalRequests; i += config.concurrentRequests) {
    await sendBatch(i, config.concurrentRequests);
    
    // Small delay between batches
    if (i + config.concurrentRequests < config.totalRequests) {
      await new Promise(resolve => setTimeout(resolve, config.delayBetweenBatches));
    }
  }
  
  const endTime = Date.now();
  const totalDuration = endTime - startTime;
  
  // Print summary
  printSummary(totalDuration);
}

// Prints test summary
function printSummary(totalDuration) {
  console.log('\n---------------------------------------------------');
  console.log('FALLBACK TEST SUMMARY');
  console.log('---------------------------------------------------');
  console.log(`Total test duration: ${totalDuration}ms (${(totalDuration / 1000).toFixed(2)}s)`);
  console.log(`Total requests: ${metrics.totalRequests}`);
  console.log(`Successful requests: ${metrics.successfulRequests} (${((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(2)}%)`);
  console.log(`Failed requests: ${metrics.failedRequests} (${((metrics.failedRequests / metrics.totalRequests) * 100).toFixed(2)}%)`);
  
  if (metrics.successfulRequests > 0) {
    console.log(`Average response time: ${(metrics.totalLatency / metrics.successfulRequests).toFixed(2)}ms`);
  }
  
  console.log('\nPROVIDER USAGE:');
  for (const [provider, data] of Object.entries(metrics.providerUsage)) {
    if (data.count > 0) {
      console.log(`  ${provider}: ${data.count} requests, ${data.success} successful (${((data.success / data.count) * 100).toFixed(2)}%), avg time: ${(data.totalLatency / data.count).toFixed(2)}ms`);
    }
  }
  
  console.log('\nERROR BREAKDOWN:');
  console.log(`  Timeout errors: ${metrics.errors.timeout}`);
  console.log(`  Server errors: ${metrics.errors.server}`);
  console.log(`  Client errors: ${metrics.errors.client}`);
  console.log(`  Unknown errors: ${metrics.errors.unknown}`);
  console.log('---------------------------------------------------');
}

// Run the test
runTest().catch(error => {
  console.error('Test failed with error:', error);
  process.exit(1);
});
