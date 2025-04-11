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
  singleRequests: {
    total: 0,
    success: 0,
    failed: 0,
    byStrategy: {},
    byErrorType: {},
    averageResponseTime: 0,
    totalResponseTime: 0
  },
  batchRequests: {
    total: 0,
    success: 0,
    failed: 0,
    byStrategy: {},
    byBatchSize: {},
    averageResponseTime: 0,
    totalResponseTime: 0
  }
};

// Initialize results
STRATEGIES.forEach(strategy => {
  results.singleRequests.byStrategy[strategy] = {
    total: 0,
    success: 0,
    failed: 0
  };
  results.batchRequests.byStrategy[strategy] = {
    total: 0,
    success: 0,
    failed: 0
  };
});

ERROR_TYPES.forEach(errorType => {
  if (errorType) {
    results.singleRequests.byErrorType[errorType] = {
      total: 0,
      success: 0,
      failed: 0
    };
  }
});

BATCH_SIZES.forEach(size => {
  results.batchRequests.byBatchSize[size] = {
    total: 0,
    success: 0,
    failed: 0
  };
});

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

// Test individual requests
async function testSingleRequests() {
  console.log('Testing individual requests...');
  
  for (const strategy of STRATEGIES) {
    for (const errorType of ERROR_TYPES) {
      for (let i = 0; i < TEST_ITERATIONS; i++) {
        const prompt = TEST_PROMPTS[Math.floor(Math.random() * TEST_PROMPTS.length)];
        
        try {
          console.log(`Running individual test: strategy=${strategy}, error type=${errorType || 'no error'}, iteration=${i+1}`);
          
          const startTime = Date.now();
          
          // Run test
          const response = await axios.post('http://localhost:3000/ai-enhanced/process', {
            input: prompt,
            taskType: 'text-generation',
            strategy,
            cacheResults: true,
            testMode: errorType !== null,
            testError: errorType
          });
          
          const endTime = Date.now();
          const responseTime = endTime - startTime;
          
          // Update results
          results.singleRequests.total++;
          results.singleRequests.byStrategy[strategy].total++;
          
          if (errorType) {
            results.singleRequests.byErrorType[errorType].total++;
          }
          
          if (response.data && response.data.success) {
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
          
          console.log(`Individual test complete: success=${response.data && response.data.success}, response time=${responseTime}ms`);
          
        } catch (error) {
          console.error(`Error running individual test: ${error.message}`);
          results.singleRequests.total++;
          results.singleRequests.failed++;
          results.singleRequests.byStrategy[strategy].total++;
          results.singleRequests.byStrategy[strategy].failed++;
          
          if (errorType) {
            results.singleRequests.byErrorType[errorType].total++;
            results.singleRequests.byErrorType[errorType].failed++;
          }
        }
      }
    }
  }
  
  // Calculate average response time
  if (results.singleRequests.total > 0) {
    results.singleRequests.averageResponseTime = results.singleRequests.totalResponseTime / results.singleRequests.total;
  }
  
  console.log('Individual request tests completed');
}

// Test batch processing
async function testBatchRequests() {
  console.log('Testing batch processing...');
  
  for (const strategy of STRATEGIES) {
    for (const batchSize of BATCH_SIZES) {
      for (let i = 0; i < TEST_ITERATIONS; i++) {
        const inputs = [];
        
        // Create random prompts
        for (let j = 0; j < batchSize; j++) {
          inputs.push(TEST_PROMPTS[Math.floor(Math.random() * TEST_PROMPTS.length)]);
        }
        
        try {
          console.log(`Running batch processing test: strategy=${strategy}, batch size=${batchSize}, iteration=${i+1}`);
          
          const startTime = Date.now();
          
          // Run test
          const response = await axios.post('http://localhost:3000/ai-enhanced/process-batch', {
            inputs,
            taskType: 'text-generation',
            strategy,
            cacheResults: true
          });
          
          const endTime = Date.now();
          const responseTime = endTime - startTime;
          
          // Update results
          results.batchRequests.total++;
          results.batchRequests.byStrategy[strategy].total++;
          results.batchRequests.byBatchSize[batchSize].total++;
          
          if (response.data && Array.isArray(response.data) && response.data.every(item => item.success)) {
            results.batchRequests.success++;
            results.batchRequests.byStrategy[strategy].success++;
            results.batchRequests.byBatchSize[batchSize].success++;
          } else {
            results.batchRequests.failed++;
            results.batchRequests.byStrategy[strategy].failed++;
            results.batchRequests.byBatchSize[batchSize].failed++;
          }
          
          results.batchRequests.totalResponseTime += responseTime;
          
          console.log(`Batch processing test complete: success=${response.data && Array.isArray(response.data) && response.data.every(item => item.success)}, response time=${responseTime}ms`);
          
        } catch (error) {
          console.error(`Error running batch processing test: ${error.message}`);
          results.batchRequests.total++;
          results.batchRequests.failed++;
          results.batchRequests.byStrategy[strategy].total++;
          results.batchRequests.byStrategy[strategy].failed++;
          results.batchRequests.byBatchSize[batchSize].total++;
          results.batchRequests.byBatchSize[batchSize].failed++;
        }
      }
    }
  }
  
  // Calculate average response time
  if (results.batchRequests.total > 0) {
    results.batchRequests.averageResponseTime = results.batchRequests.totalResponseTime / results.batchRequests.total;
  }
  
  console.log('Batch processing tests completed');
}

// Start tests
runTests();
