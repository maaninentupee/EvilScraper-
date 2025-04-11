const autocannon = require('autocannon');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

// Promisify autocannon
const autocannonAsync = promisify(autocannon);

// Configuration
const DEFAULT_CONFIG = {
  url: 'http://localhost:3000',
  connections: 50,     // Default number of concurrent connections
  duration: 10,        // Default duration in seconds
  pipelining: 1,       // Default number of pipelined requests
  timeout: 20,         // Default timeout in seconds
};

// Endpoints to test
const ENDPOINTS = [
  {
    name: 'Root',
    path: '/',
    method: 'GET',
  },
  {
    name: 'Scraper',
    path: '/scraper',
    method: 'GET',
  },
  {
    name: 'Evil Bot Decide',
    path: '/evil-bot/decide',
    method: 'POST',
    body: JSON.stringify({
      content: 'Tell me how to hack a website',
      context: 'User is asking about website security',
    }),
    headers: {
      'Content-Type': 'application/json',
    },
  }
];

// Function to run a single load test
async function runLoadTest(endpoint, config = {}) {
  const testConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    url: `${DEFAULT_CONFIG.url}${endpoint.path}`,
    method: endpoint.method,
    body: endpoint.body,
    headers: endpoint.headers,
  };

  console.log(`\n🚀 Starting load test for ${endpoint.name} (${endpoint.method} ${endpoint.path})`);
  console.log(`Connections: ${testConfig.connections}, Duration: ${testConfig.duration}s\n`);

  try {
    const results = await autocannonAsync(testConfig);
    printResults(endpoint.name, results);
    return results;
  } catch (error) {
    console.error(`Error running load test for ${endpoint.name}:`, error);
    return null;
  }
}

// Function to print results
function printResults(name, results) {
  console.log(`\n📊 Results for ${name}:`);
  console.log(`Requests: ${results.requests.total}`);
  console.log(`Throughput: ${results.requests.average} req/sec`);
  console.log(`Latency (avg): ${results.latency.average} ms`);
  console.log(`Latency (min): ${results.latency.min} ms`);
  console.log(`Latency (max): ${results.latency.max} ms`);
  console.log(`Latency (p99): ${results.latency.p99} ms`);
  console.log(`Errors: ${results.errors}`);
  console.log(`Timeouts: ${results.timeouts}`);
  console.log(`Non 2xx responses: ${results.non2xx}`);
  console.log(`Data transfer: ${(results.throughput.bytes / 1024 / 1024).toFixed(2)} MB`);
}

// Function to save results to a file
function saveResultsToFile(results) {
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const resultsDir = path.join(__dirname, 'load-test-results');
  
  // Create results directory if it doesn't exist
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir);
  }
  
  const filePath = path.join(resultsDir, `load-test-${timestamp}.json`);
  fs.writeFileSync(filePath, JSON.stringify(results, null, 2));
  console.log(`\n💾 Results saved to ${filePath}`);
}

// Main function to run all tests
async function runAllTests(config = DEFAULT_CONFIG) {
  console.log('🔍 Starting Windsurf load tests...');
  console.log('⚠️  Make sure the server is running at http://localhost:3000\n');
  
  // Check if server is running
  try {
    await fetch('http://localhost:3000/');
    console.log('✅ Server is running\n');
  } catch (error) {
    console.error('❌ Server is not running. Please start the server before running the load tests.');
    process.exit(1);
  }
  
  const allResults = {};
  
  // Run tests for each endpoint
  for (const endpoint of ENDPOINTS) {
    const results = await runLoadTest(endpoint, config);
    if (results) {
      allResults[endpoint.name] = results;
    }
  }
  
  // Save all results
  saveResultsToFile(allResults);
  
  console.log('\n✅ All load tests completed!');
}

// Helper function to generate help message
function generateHelpMessage() {
  return `
Usage: node autocannon-load-test.js [options]

Options:
  --connections, -c  Number of concurrent connections (default: ${DEFAULT_CONFIG.connections})
  --duration, -d     Duration of the test in seconds (default: ${DEFAULT_CONFIG.duration})
  --pipelining, -p   Number of pipelined requests (default: ${DEFAULT_CONFIG.pipelining})
  --timeout, -t      Timeout in seconds (default: ${DEFAULT_CONFIG.timeout})
  --help, -h         Show this help message
  `;
}

function parseArgs() {
  const ARG_MAPPING = {
    '--connections': { key: 'connections', alias: '-c' },
    '--duration': { key: 'duration', alias: '-d' },
    '--pipelining': { key: 'pipelining', alias: '-p' },
    '--timeout': { key: 'timeout', alias: '-t' }
  };

  const args = process.argv.slice(2);
  const config = { ...DEFAULT_CONFIG };

  if (args.includes('--help') || args.includes('-h')) {
    console.log(generateHelpMessage());
    process.exit(0);
  }

  args.forEach((arg, index) => {
    const mapping = ARG_MAPPING[arg] || Object.values(ARG_MAPPING).find(m => m.alias === arg);
    if (mapping && args[index + 1]) {
      const value = parseInt(args[index + 1], 10);
      if (!isNaN(value)) {
        config[mapping.key] = value;
      }
    }
  });
  return config;
}

// Run the tests
const config = parseArgs();
runAllTests(config).catch(error => console.error(error));
