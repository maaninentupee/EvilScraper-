/**
 * Test for AIGatewayEnhancer class functionality
 * 
 * This script tests the functionality of the AIGatewayEnhancer class in various situations,
 * such as service provider error scenarios and fallback mechanism operation.
 * 
 * Usage: node test/enhanced-fallback-test.js
 */

const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const fs = require('fs');
const path = require('path');

// Test settings
const TEST_ITERATIONS = 10;
const PROVIDERS = ['openai', 'anthropic', 'ollama'];
const ERROR_TYPES = ['timeout', 'rate_limit', 'invalid_request', 'all'];
const STRATEGIES = ['COST_OPTIMIZED', 'PRIORITY', 'PERFORMANCE', 'LOAD_BALANCED'];

// Test prompts
const TEST_PROMPTS = [
  'Tell me about the history of Finland',
  'How does artificial intelligence work?',
  'Write a poem about spring',
  'Explain the basics of quantum mechanics',
  'What is climate change?'
];

// Test results
const results = {
  total: 0,
  success: 0,
  fallback: 0,
  failed: 0,
  byProvider: {},
  byErrorType: {},
  byStrategy: {},
  averageResponseTime: 0,
  totalResponseTime: 0
};

// Initialize results
PROVIDERS.forEach(provider => {
  results.byProvider[provider] = {
    total: 0,
    success: 0,
    fallback: 0,
    failed: 0
  };
});

ERROR_TYPES.forEach(errorType => {
  results.byErrorType[errorType] = {
    total: 0,
    success: 0,
    fallback: 0,
    failed: 0
  };
});

STRATEGIES.forEach(strategy => {
  results.byStrategy[strategy] = {
    total: 0,
    success: 0,
    fallback: 0,
    failed: 0
  };
});

async function executeTest(aiGatewayEnhancer, strategy, errorType, prompt) {
  const startTime = Date.now();
  
  const result = await aiGatewayEnhancer.processWithSmartFallback('text-generation', prompt, {
    strategy: strategy,
    testMode: true,
    testErrorType: errorType
  });
  
  const responseTime = Date.now() - startTime;
  return { result, responseTime };
}

function processTestResult(results, strategy, errorType, testResult) {
  const { result, responseTime } = testResult;
  
  results.total++;
  results.byStrategy[strategy].total++;
  results.byErrorType[errorType].total++;
  results.totalResponseTime += responseTime;
  
  if (!result.success) {
    results.failed++;
    results.byStrategy[strategy].failed++;
    results.byErrorType[errorType].failed++;
    return;
  }
  
  results.success++;
  results.byStrategy[strategy].success++;
  results.byErrorType[errorType].success++;
  
  if (result.usedFallback) {
    results.fallback++;
    results.byStrategy[strategy].fallback++;
    results.byErrorType[errorType].fallback++;
  }
  
  if (result.provider) {
    results.byProvider[result.provider].total++;
    results.byProvider[result.provider][result.usedFallback ? 'fallback' : 'success']++;
  }
}

async function saveTestResults(results, resultsPath) {
  const resultsDir = path.dirname(resultsPath);
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }
  
  results.averageResponseTime = results.totalResponseTime / results.total;
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
}

async function runTestIterations(aiGatewayEnhancer, strategy, errorType, results) {
  for (let i = 0; i < TEST_ITERATIONS; i++) {
    const prompt = TEST_PROMPTS[Math.floor(Math.random() * TEST_PROMPTS.length)];
    console.log(`Running test: strategy=${strategy}, errorType=${errorType}, iteration=${i+1}`);
    
    try {
      const testResult = await executeTest(aiGatewayEnhancer, strategy, errorType, prompt);
      processTestResult(results, strategy, errorType, testResult);
      
      console.log(`Test complete: success=${testResult.result.success}, used fallback=${testResult.result.usedFallback || false}, provider=${testResult.result.provider || 'unknown'}, response time=${testResult.responseTime}ms`);
    } catch (error) {
      console.error(`Error during test execution: ${error.message}`);
      results.total++;
      results.failed++;
      results.byStrategy[strategy].total++;
      results.byStrategy[strategy].failed++;
      results.byErrorType[errorType].total++;
      results.byErrorType[errorType].failed++;
    }
  }
}

async function runTests() {
  console.log('Starting AIGatewayEnhancer tests...');
  
  try {
    const app = await NestFactory.createApplicationContext(AppModule);
    const { AIGatewayEnhancer } = require('../dist/services/AIGatewayEnhancer');
    const { ProviderHealthMonitor } = require('../dist/services/ProviderHealthMonitor');
    
    const aiGatewayEnhancer = app.get(AIGatewayEnhancer);
    const providerHealthMonitor = app.get(ProviderHealthMonitor);
    
    console.log('Services initialized, starting tests');
    providerHealthMonitor.resetStats();
    
    for (const strategy of STRATEGIES) {
      for (const errorType of ERROR_TYPES) {
        await runTestIterations(aiGatewayEnhancer, strategy, errorType, results);
      }
    }
    
    const resultsPath = path.join(__dirname, 'results', 'enhanced-fallback-results.json');
    await saveTestResults(results, resultsPath);
    
    console.log('Tests completed successfully!');
    console.log(`Results saved to: ${resultsPath}`);
    console.log(`Summary: total=${results.total}, successful=${results.success}, fallback=${results.fallback}, failed=${results.failed}, average response time=${results.averageResponseTime.toFixed(2)}ms`);
    
    await app.close();
  } catch (error) {
    console.error(`Error running tests: ${error}`);
  }
}

// Start tests
runTests();
