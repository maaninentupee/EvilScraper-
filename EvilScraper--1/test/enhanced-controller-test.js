/**
 * Test for AIControllerEnhanced class functionality
 * 
 * This script tests the functionality of the AIControllerEnhanced class in various situations,
 * such as individual requests and batch processing.
 * 
 * Usage: node test/enhanced-controller-test.js
 */

const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Test settings
const TEST_ITERATIONS = 5;
const STRATEGIES = ['performance', 'cost', 'quality', 'fallback'];
const ERROR_TYPES = [null, 'timeout', 'rate_limit', 'invalid_request'];
const BATCH_SIZES = [2, 5];

// Test prompts
const TEST_PROMPTS = [
  'Tell me about Finnish history',
  'How does artificial intelligence work?',
  'Write a poem about spring',
  'Explain the basics of quantum mechanics',
  'What is climate change?'
];

// Test results
const results = {
  singleRequests: createResultsStructure(),
  batchRequests: createResultsStructure()
};

function createResultsStructure() {
  return {
    ...createBaseMetrics(),
    byStrategy: createStrategyMetrics(STRATEGIES),
    byErrorType: createErrorMetrics(ERROR_TYPES),
    byBatchSize: createBatchMetrics(BATCH_SIZES)
  };
}

function createBaseMetrics() {
  return {
    total: 0,
    success: 0,
    failed: 0,
    averageResponseTime: 0,
    totalResponseTime: 0
  };
}

function createMetricsObject() {
  return { total: 0, success: 0, failed: 0 };
}

function createStrategyMetrics(strategies) {
  return Object.fromEntries(
    strategies.map(strategy => [strategy, createMetricsObject()])
  );
}

function createErrorMetrics(errorTypes) {
  return Object.fromEntries(
    errorTypes.filter(type => type).map(type => [type, createMetricsObject()])
  );
}

// Helper function to generate an array of random test prompts for batch requests
function createBatchMetrics(batchSizes) {
  return Object.fromEntries(
    batchSizes.map(size => [size, createMetricsObject()])
  );
}

// New helper: Generate an array of random prompts for a given batch size
function generateBatchInputs(batchSize) {
  return Array.from({ length: batchSize }, () =>
    TEST_PROMPTS[Math.floor(Math.random() * TEST_PROMPTS.length)]
  );
}

// Run tests
async function runTests() {
  console.log('Starting AIControllerEnhanced tests...');
  
  try {
    // Start NestJS application
    const app = await NestFactory.create(AppModule);
    await app.listen(3000);
    
    console.log('Application started on port 3000, beginning tests');
    
    // Test individual requests
    await testSingleRequests();
    
    // Test batch processing
    await testBatchRequests();
    
    // Save results
    const resultsPath = path.join(__dirname, 'results', 'enhanced-controller-results.json');
    
    // Ensure directory exists
    const resultsDir = path.dirname(resultsPath);
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    
    console.log('Tests completed successfully!');
    console.log(`Results saved to: ${resultsPath}`);
    console.log(`Summary of individual requests: total=${results.singleRequests.total}, successful=${results.singleRequests.success}, failed=${results.singleRequests.failed}, average response time=${results.singleRequests.averageResponseTime.toFixed(2)}ms`);
    console.log(`Summary of batch processing: total=${results.batchRequests.total}, successful=${results.batchRequests.success}, failed=${results.batchRequests.failed}, average response time=${results.batchRequests.averageResponseTime.toFixed(2)}ms`);
    
    // Close application
    await app.close();
    
  } catch (error) {
    console.error(`Error running tests: ${error}`);
  }
}

async function processIndividualRequest(strategy, errorType, prompt) {
  const response = await axios.post('http://localhost:3000/ai-enhanced/process', {
    input: prompt,
    taskType: 'text-generation',
    strategy,
    cacheResults: true,
    testMode: errorType !== null,
    testError: errorType
  });
  return response.data;
}

async function processBatchRequest(strategy, batchSize, inputs) {
  const response = await axios.post('http://localhost:3000/ai-enhanced/process-batch', {
    inputs,
    taskType: 'text-generation',
    strategy,
    cacheResults: true
  });
  return response.data;
}

function updateSingleRequestResults(strategy, errorType, success, responseTime) {
  results.singleRequests.total++;
  results.singleRequests.byStrategy[strategy].total++;
  
  if (errorType) {
    results.singleRequests.byErrorType[errorType].total++;
  }
  
  if (success) {
    results.singleRequests.success++;
    results.singleRequests.byStrategy[strategy].success++;
    if (errorType) {
      results.singleRequests.byErrorType[errorType].success++;
    }
  } else {
    results.singleRequests.failed++;
    results.singleRequests.byStrategy[strategy].failed++;
    if (errorType) {
      results.singleRequests.byErrorType[errorType].failed++;
    }
  }
  
  results.singleRequests.totalResponseTime += responseTime;
}

function updateBatchRequestResults(strategy, batchSize, success, responseTime) {
  results.batchRequests.total++;
  results.batchRequests.byStrategy[strategy].total++;
  results.batchRequests.byBatchSize[batchSize].total++;
  
  if (success) {
    results.batchRequests.success++;
    results.batchRequests.byStrategy[strategy].success++;
    results.batchRequests.byBatchSize[batchSize].success++;
  } else {
    results.batchRequests.failed++;
    results.batchRequests.byStrategy[strategy].failed++;
    results.batchRequests.byBatchSize[batchSize].failed++;
  }
  
  results.batchRequests.totalResponseTime += responseTime;
}

// Test individual requests
async function testSingleRequests() {
  console.log('Testing individual requests...');
  
  for (const strategy of STRATEGIES) {
    await testStrategyRequests(strategy);
  }
  
  if (results.singleRequests.total > 0) {
    results.singleRequests.averageResponseTime = 
      results.singleRequests.totalResponseTime / results.singleRequests.total;
  }
  
  console.log('Individual request tests completed');
}

async function testStrategyRequests(strategy) {
  for (const errorType of ERROR_TYPES) {
    for (let i = 0; i < TEST_ITERATIONS; i++) {
      await runSingleTest(strategy, errorType, i);
    }
  }
}

async function runSingleTest(strategy, errorType, iteration) {
  const prompt = TEST_PROMPTS[Math.floor(Math.random() * TEST_PROMPTS.length)];
  console.log(`Running individual test: strategy=${strategy}, error type=${errorType || 'no error'}, iteration=${iteration+1}`);
  
  const startTime = Date.now();
  try {
    const data = await processIndividualRequest(strategy, errorType, prompt);
    const responseTime = Date.now() - startTime;
    updateSingleRequestResults(strategy, errorType, data.success, responseTime);
    console.log(`Individual test complete: success=${data.success}, response time=${responseTime}ms`);
  } catch (error) {
    console.error(`Error running individual test: ${error.message}`);
    updateSingleRequestResults(strategy, errorType, false, 0);
  }
}

 // New helper function to run a single batch processing test iteration
 async function runBatchTest(strategy, batchSize, iteration) {
   const inputs = Array.from({ length: batchSize }, () =>
     TEST_PROMPTS[Math.floor(Math.random() * TEST_PROMPTS.length)]
   );
   console.log(`Running batch processing test: strategy=${strategy}, batch size=${batchSize}, iteration=${iteration + 1}`);
   const startTime = Date.now();
   try {
     const response = await processBatchRequest(strategy, batchSize, inputs);
     const responseTime = Date.now() - startTime;
     const success = response && Array.isArray(response) && response.every(item => item.success);
     updateBatchRequestResults(strategy, batchSize, success, responseTime);
     console.log(`Batch processing test complete: success=${success}, response time=${responseTime}ms`);
   } catch (error) {
     console.error(`Error running batch processing test: ${error.message}`);
     updateBatchRequestResults(strategy, batchSize, false, 0);
   }
 }
 
 // Refactored testBatchRequests to reduce cognitive complexity
 async function testBatchRequests() {
   console.log('Testing batch processing...');
   
   for (const strategy of STRATEGIES) {
     for (const batchSize of BATCH_SIZES) {
       for (let i = 0; i < TEST_ITERATIONS; i++) {
         await runBatchTest(strategy, batchSize, i);
       }
     }
   }
   
   if (results.batchRequests.total > 0) {
     results.batchRequests.averageResponseTime = results.batchRequests.totalResponseTime / results.batchRequests.total;
   }
   
   console.log('Batch processing tests completed');
}

// Start tests
runTests();
