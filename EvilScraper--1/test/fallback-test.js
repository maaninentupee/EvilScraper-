/**
 * Fallback mechanism testing
 * 
 * This script tests the functionality of the AI service's fallback mechanism
 * by simulating error situations for different service providers and ensuring
 * that the system automatically switches to using alternative models.
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const config = {
  // API address
  apiUrl: 'http://localhost:3001/ai/process',
  
  // Number of tests per error type
  testsPerErrorType: 5,
  
  // Error simulation
  simulateErrors: true,
  
  // Error types for testing
  errorTypes: ['timeout', 'service_unavailable', 'rate_limit_exceeded', 'invalid_request'],
  
  // Task types
  taskTypes: ['general', 'code', 'translation', 'summarization'],
  
  // Test inputs
  inputs: [
    'What is the future of artificial intelligence?',
    'Write a Python function that calculates the Fibonacci sequence.',
    'Translate the following text to English: "Artificial intelligence is changing the world rapidly."',
    'Summarize the following text: "Artificial intelligence is a field of computer science that aims to create intelligent machines. It is an important technology area that includes many different methods, such as machine learning, deep learning, and reinforcement learning. AI is already used in many applications, such as image recognition, natural language processing, and autonomous vehicles."'
  ]
};

// Results directory
const resultsDir = path.join(__dirname, 'results');
if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir);
}

// Test results file
const resultsFile = path.join(resultsDir, `fallback-test-results-${new Date().toISOString().replace(/:/g, '-')}.json`);

// Initialize test results
const testResults = {
  summary: {
    totalTests: 0,
    successfulTests: 0,
    failedTests: 0,
    fallbacksTriggered: 0,
    averageResponseTime: 0
  },
  providerStats: {},
  errorTypeStats: {},
  detailedResults: []
};

/**
 * Runs a single test
 * @param {string} taskType - Task type
 * @param {string} input - Input
 * @param {string} errorType - Error type to simulate
 * @returns {Promise<Object>} - Test result
 */
async function runTest(taskType, input, errorType) {
  const startTime = Date.now();
  
  try {
    // Set environment variables for error simulation
    process.env.SIMULATE_ERRORS = config.simulateErrors ? 'true' : 'false';
    process.env.ERROR_TYPE = errorType;
    process.env.ERROR_RATE = '0.8'; // 80% probability of error
    
    // Send request to the API
    const response = await axios.post(config.apiUrl, {
      taskType,
      input
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 second timeout
    });
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    // Return test result
    return {
      success: response.data.success,
      result: response.data.result,
      provider: response.data.provider,
      model: response.data.model,
      errorType: response.data.errorType,
      error: response.data.error,
      responseTime,
      taskType,
      input,
      simulatedErrorType: errorType,
      fallbackTriggered: response.data.provider !== 'openai' // Assume OpenAI is the primary service provider
    };
  } catch (error) {
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    // Return error situation
    return {
      success: false,
      result: null,
      provider: null,
      model: null,
      errorType: error.response?.data?.errorType || 'request_error',
      error: error.response?.data?.error || error.message,
      responseTime,
      taskType,
      input,
      simulatedErrorType: errorType,
      fallbackTriggered: false
    };
  }
}

/**
 * Updates provider statistics
 * @param {Object} result - Result of a single test
 * @param {Object} providerStats - Provider statistics object
 */
function updateProviderStats(result, providerStats) {
  const provider = result.provider || 'unknown';
  if (!providerStats[provider]) {
    providerStats[provider] = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      averageResponseTime: 0
    };
  }
  
  const stats = providerStats[provider];
  stats.totalCalls++;
  result.success ? stats.successfulCalls++ : stats.failedCalls++;
  stats.averageResponseTime = 
    (stats.averageResponseTime * (stats.totalCalls - 1) + result.responseTime) / 
    stats.totalCalls;
}

/**
 * Updates error type statistics
 * @param {Object} result - Result of a single test
 * @param {Object} errorTypeStats - Error type statistics object
 */
function updateErrorTypeStats(result, errorTypeStats) {
  const errorType = result.errorType || 'unknown';
  if (!errorTypeStats[errorType]) {
    errorTypeStats[errorType] = {
      count: 0,
      fallbacksTriggered: 0
    };
  }
  
  errorTypeStats[errorType].count++;
  if (result.fallbackTriggered) {
    errorTypeStats[errorType].fallbacksTriggered++;
  }
}

/**
 * Updates test results
 * @param {Object} result - Result of a single test
 */
function updateTestResults(result) {
  // Update summary
  testResults.summary.totalTests++;
  result.success ? testResults.summary.successfulTests++ : testResults.summary.failedTests++;
  if (result.fallbackTriggered) {
    testResults.summary.fallbacksTriggered++;
  }
  
  testResults.summary.averageResponseTime = 
    (testResults.summary.averageResponseTime * (testResults.summary.totalTests - 1) + result.responseTime) / 
    testResults.summary.totalTests;
  
  // Update service provider statistics
  updateProviderStats(result, testResults.providerStats);
  
  // Update error type statistics
  if (!result.success) {
    updateErrorTypeStats(result, testResults.errorTypeStats);
  }
  
  // Add detailed results
  testResults.detailedResults.push(result);
}

/**
 * Saves test results to a file
 */
function saveTestResults() {
  fs.writeFileSync(resultsFile, JSON.stringify(testResults, null, 2));
  console.log(`Test results saved to file: ${resultsFile}`);
}

/**
 * Prints a summary of test results
 */
function printSummary() {
  console.log('\n===== FALLBACK TESTS SUMMARY =====');
  console.log(`Total tests: ${testResults.summary.totalTests}`);
  console.log(`Successful tests: ${testResults.summary.successfulTests} (${(testResults.summary.successfulTests / testResults.summary.totalTests * 100).toFixed(2)}%)`);
  console.log(`Failed tests: ${testResults.summary.failedTests} (${(testResults.summary.failedTests / testResults.summary.totalTests * 100).toFixed(2)}%)`);
  console.log(`Fallback mechanism triggered: ${testResults.summary.fallbacksTriggered} times (${(testResults.summary.fallbacksTriggered / testResults.summary.totalTests * 100).toFixed(2)}%)`);
  console.log(`Average response time: ${testResults.summary.averageResponseTime.toFixed(2)} ms`);
  
  console.log('\n----- Service Provider Statistics -----');
  for (const [provider, stats] of Object.entries(testResults.providerStats)) {
    console.log(`${provider}:`);
    console.log(`  Total calls: ${stats.totalCalls}`);
    console.log(`  Successful calls: ${stats.successfulCalls} (${(stats.successfulCalls / stats.totalCalls * 100).toFixed(2)}%)`);
    console.log(`  Failed calls: ${stats.failedCalls} (${(stats.failedCalls / stats.totalCalls * 100).toFixed(2)}%)`);
    console.log(`  Average response time: ${stats.averageResponseTime.toFixed(2)} ms`);
  }
  
  console.log('\n----- Error Type Statistics -----');
  for (const [errorType, stats] of Object.entries(testResults.errorTypeStats)) {
    console.log(`${errorType}:`);
    console.log(`  Occurrences: ${stats.count}`);
    console.log(`  Fallback mechanism triggered: ${stats.fallbacksTriggered} times (${(stats.fallbacksTriggered / stats.count * 100).toFixed(2)}%)`);
  }
  
  console.log('\n======================================');
}

/**
 * Main function for running tests
 */
async function main() {
  console.log('Starting fallback mechanism testing...');
  
  // Run tests for each error type
  for (const errorType of config.errorTypes) {
    console.log(`\nTesting error type: ${errorType}`);
    
    // Run tests for each task type
    for (const taskType of config.taskTypes) {
      // Run tests for each input
      for (const input of config.inputs) {
        // Run multiple tests with the same configuration
        for (let i = 0; i < config.testsPerErrorType; i++) {
          console.log(`Running test #${i + 1} for task type '${taskType}' with error type '${errorType}'...`);
          
          // Run the test
          const result = await runTest(taskType, input, errorType);
          
          // Update test results
          updateTestResults(result);
          
          // Print test result
          if (result.success) {
            console.log(`  Test successful! Service provider: ${result.provider}, Model: ${result.model}, Response time: ${result.responseTime} ms`);
          } else {
            console.log(`  Test failed! Error: ${result.error}, Error type: ${result.errorType}, Response time: ${result.responseTime} ms`);
          }
          
          // Small delay between tests
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }
  }
  
  // Save test results
  saveTestResults();
  
  // Print summary
  printSummary();
}

// Run tests
main().catch(error => {
  console.error('Error running tests:', error);
  process.exit(1);
});
