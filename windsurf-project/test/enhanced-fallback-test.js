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

// Run tests
async function runTests() {
  console.log('Starting AIGatewayEnhancer tests...');
  
  try {
    // Start NestJS application
    const app = await NestFactory.createApplicationContext(AppModule);
  
    // Get required services
    const { AIGatewayEnhancer } = require('../dist/services/AIGatewayEnhancer');
    const { ProviderHealthMonitor } = require('../dist/services/ProviderHealthMonitor');
    
    const aiGatewayEnhancer = app.get(AIGatewayEnhancer);
    const providerHealthMonitor = app.get(ProviderHealthMonitor);
  
    console.log('Services initialized, starting tests');
  
    // Reset health data before tests
    providerHealthMonitor.resetStats();
  
    // Run tests with different settings
    for (const strategy of STRATEGIES) {
      for (const errorType of ERROR_TYPES) {
        for (let i = 0; i < TEST_ITERATIONS; i++) {
          const prompt = TEST_PROMPTS[Math.floor(Math.random() * TEST_PROMPTS.length)];
          
          try {
            console.log(`Running test: strategy=${strategy}, errorType=${errorType}, iteration=${i+1}`);
            
            const startTime = Date.now();
            
            // Run test
            const result = await aiGatewayEnhancer.processWithSmartFallback('text-generation', prompt, {
              strategy: strategy,
              testMode: true,
              testErrorType: errorType
            });
            
            const endTime = Date.now();
            const responseTime = endTime - startTime;
            
            // Update results
            results.total++;
            results.byStrategy[strategy].total++;
            results.byErrorType[errorType].total++;
            
            if (result.success) {
              results.success++;
              results.byStrategy[strategy].success++;
              results.byErrorType[errorType].success++;
              
              if (result.usedFallback) {
                results.fallback++;
                results.byStrategy[strategy].fallback++;
                results.byErrorType[errorType].fallback++;
                
                if (result.provider) {
                  results.byProvider[result.provider].total++;
                  results.byProvider[result.provider].fallback++;
                }
              } else if (result.provider) {
                results.byProvider[result.provider].total++;
                results.byProvider[result.provider].success++;
              }
            } else {
              results.failed++;
              results.byStrategy[strategy].failed++;
              results.byErrorType[errorType].failed++;
            }
            
            results.totalResponseTime += responseTime;
            
            console.log(`Test complete: success=${result.success}, used fallback=${result.usedFallback || false}, provider=${result.provider || 'unknown'}, response time=${responseTime}ms`);
            
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
    }
    
    // Calculate average response time
    results.averageResponseTime = results.totalResponseTime / results.total;
    
    // Save results
    const resultsPath = path.join(__dirname, 'results', 'enhanced-fallback-results.json');
    
    // Ensure directory exists
    const resultsDir = path.dirname(resultsPath);
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    
    console.log('Tests completed successfully!');
    console.log(`Results saved to: ${resultsPath}`);
    console.log(`Summary: total=${results.total}, successful=${results.success}, fallback=${results.fallback}, failed=${results.failed}, average response time=${results.averageResponseTime.toFixed(2)}ms`);
    
    // Close application
    await app.close();
    
  } catch (error) {
    console.error(`Error running tests: ${error}`);
  }
}

// Start tests
runTests();
