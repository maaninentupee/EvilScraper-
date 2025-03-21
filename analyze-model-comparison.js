/**
 * Tool for analyzing the results of model-comparison-test.js test
 * 
 * Usage:
 * 1. Run the test: k6 run model-comparison-test.js --out json=results.json
 * 2. Analyze results: node analyze-model-comparison.js results.json
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',
  
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m'
};

/**
 * Main function that analyzes test results produced by k6
 * @param {string} filePath - Path to the JSON file produced by k6
 */
async function analyzeResults(filePath) {
  try {
    // Check if the file exists
    if (!fs.existsSync(filePath)) {
      console.error(`${colors.red}Error: File ${filePath} not found.${colors.reset}`);
      console.log(`Run the test first with command: ${colors.cyan}k6 run model-comparison-test.js --out json=results.json${colors.reset}`);
      return;
    }

    // Read the file
    const rawData = fs.readFileSync(filePath, 'utf8');
    
    // Check if this is a JSON file or a log file
    let data = { metrics: {} };
    let isLogFile = false;
    
    if (filePath.endsWith('.json')) {
      try {
        // Try to parse the JSON file
        data = JSON.parse(rawData);
      } catch (e) {
        // If parsing fails, process the file as before
        console.log(`${colors.yellow}Warning: JSON file parsing failed: ${e.message}${colors.reset}`);
        console.log(`${colors.yellow}Attempting to process the file as a log file...${colors.reset}`);
        isLogFile = true;
      }
    } else {
      // This is likely a log file
      isLogFile = true;
    }
    
    if (isLogFile) {
      // Calculate averages
      const calculateAvg = (arr) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
      
      // Calculate p95 (95th percentile)
      const calculateP95 = (arr) => {
        if (arr.length === 0) return 0;
        const sorted = [...arr].sort((a, b) => a - b);
        const idx = Math.floor(sorted.length * 0.95);
        return sorted[idx] || sorted[sorted.length - 1];
      };
      
      // Find model metrics from the summary
      const openaiTimeRegex = /openai_processing_time[.\s]*: avg=([0-9.]+).*?p\(95\)=([0-9.]+)/;
      const anthropicTimeRegex = /anthropic_processing_time[.\s]*: avg=([0-9.]+).*?p\(95\)=([0-9.]+)/;
      const ollamaTimeRegex = /ollama_processing_time[.\s]*: avg=([0-9.]+).*?p\(95\)=([0-9.]+)/;
      
      const openaiSuccessRegex = /openai_success_rate[.\s]*: ([0-9.]+)% ([0-9]+) out of ([0-9]+)/;
      const anthropicSuccessRegex = /anthropic_success_rate[.\s]*: ([0-9.]+)% ([0-9]+) out of ([0-9]+)/;
      const ollamaSuccessRegex = /ollama_success_rate[.\s]*: ([0-9.]+)% ([0-9]+) out of ([0-9]+)/;
      
      // Find the total test duration
      const durationRegex = /running \(([0-9]+)m([0-9]+)\.([0-9]+)s\)/;
      
      // Find the number of virtual users
      const vusRegex = /vus_max[.\s]*: ([0-9]+)/;
      
      // Find the total number of requests
      const requestsRegex = /http_reqs[.\s]*: ([0-9]+)/;
      
      // Find the error rate
      const errorRateRegex = /error_rate[.\s]*: ([0-9.]+)%/;
      
      // Find the average response time
      const avgDurationRegex = /http_req_duration[.\s]*: avg=([0-9.]+)ms.*?p\(95\)=([0-9.]+)s/;
      
      // Initialize variables
      let openaiAvg = 0;
      let openaiP95 = 0;
      let openaiCount = 0;
      let openaiSuccessRate = 0;
      
      let anthropicAvg = 0;
      let anthropicP95 = 0;
      let anthropicCount = 0;
      let anthropicSuccessRate = 0;
      
      let ollamaAvg = 0;
      let ollamaP95 = 0;
      let ollamaCount = 0;
      let ollamaSuccessRate = 0;
      
      let totalDuration = 0;
      let maxVUs = 0;
      let totalRequests = 0;
      let errorRate = 0;
      let avgDuration = 0;
      let p95Duration = 0;
      
      // Find data from the log
      const openaiTimeMatch = rawData.match(openaiTimeRegex);
      if (openaiTimeMatch) {
        openaiAvg = parseFloat(openaiTimeMatch[1]);
        openaiP95 = parseFloat(openaiTimeMatch[2]);
      }
      
      const anthropicTimeMatch = rawData.match(anthropicTimeRegex);
      if (anthropicTimeMatch) {
        anthropicAvg = parseFloat(anthropicTimeMatch[1]);
        anthropicP95 = parseFloat(anthropicTimeMatch[2]);
      }
      
      const ollamaTimeMatch = rawData.match(ollamaTimeRegex);
      if (ollamaTimeMatch) {
        ollamaAvg = parseFloat(ollamaTimeMatch[1]);
        ollamaP95 = parseFloat(ollamaTimeMatch[2]);
      }
      
      const openaiSuccessMatch = rawData.match(openaiSuccessRegex);
      if (openaiSuccessMatch) {
        openaiSuccessRate = parseFloat(openaiSuccessMatch[1]);
        openaiCount = parseInt(openaiSuccessMatch[3]);
      }
      
      const anthropicSuccessMatch = rawData.match(anthropicSuccessRegex);
      if (anthropicSuccessMatch) {
        anthropicSuccessRate = parseFloat(anthropicSuccessMatch[1]);
        anthropicCount = parseInt(anthropicSuccessMatch[3]);
      }
      
      const ollamaSuccessMatch = rawData.match(ollamaSuccessRegex);
      if (ollamaSuccessMatch) {
        ollamaSuccessRate = parseFloat(ollamaSuccessMatch[1]);
        ollamaCount = parseInt(ollamaSuccessMatch[3]);
      }
      
      const durationMatch = rawData.match(durationRegex);
      if (durationMatch) {
        const minutes = parseInt(durationMatch[1]);
        const seconds = parseInt(durationMatch[2]);
        const milliseconds = parseInt(durationMatch[3]) * 100; // k6 shows only one decimal place
        totalDuration = minutes * 60 * 1000 + seconds * 1000 + milliseconds;
      } else {
        // Find the last "running" line
        const lastRunningRegex = /running \(([0-9]+)m([0-9]+)\.([0-9]+)s\)/g;
        let lastMatch;
        let tempMatch;
        
        while ((tempMatch = lastRunningRegex.exec(rawData)) !== null) {
          lastMatch = tempMatch;
        }
        
        if (lastMatch) {
          const minutes = parseInt(lastMatch[1]);
          const seconds = parseInt(lastMatch[2]);
          const milliseconds = parseInt(lastMatch[3]) * 100; // k6 shows only one decimal place
          totalDuration = minutes * 60 * 1000 + seconds * 1000 + milliseconds;
        }
      }
      
      const vusMatch = rawData.match(vusRegex);
      if (vusMatch) {
        maxVUs = parseInt(vusMatch[1]);
      }
      
      const requestsMatch = rawData.match(requestsRegex);
      if (requestsMatch) {
        totalRequests = parseInt(requestsMatch[1]);
      }
      
      const errorRateMatch = rawData.match(errorRateRegex);
      if (errorRateMatch) {
        errorRate = parseFloat(errorRateMatch[1]);
      }
      
      const avgDurationMatch = rawData.match(avgDurationRegex);
      if (avgDurationMatch) {
        avgDuration = parseFloat(avgDurationMatch[1]);
        p95Duration = parseFloat(avgDurationMatch[2]) * 1000; // Convert seconds to milliseconds
      }
      
      console.log(`OpenAI: avg=${openaiAvg}ms, p95=${openaiP95}ms, count=${openaiCount}, success=${openaiSuccessRate}%`);
      console.log(`Anthropic: avg=${anthropicAvg}ms, p95=${anthropicP95}ms, count=${anthropicCount}, success=${anthropicSuccessRate}%`);
      console.log(`Ollama: avg=${ollamaAvg}ms, p95=${ollamaP95}ms, count=${ollamaCount}, success=${ollamaSuccessRate}%`);
      
      // Calculate the total number of requests and successful requests
      const totalModelRequests = openaiCount + anthropicCount + ollamaCount;
      const successfulRequests = totalModelRequests;
      const failedRequests = totalRequests * (errorRate / 100);
      
      // Create artificial metrics
      const metrics = {
        'openai_processing_time': {
          values: {
            avg: openaiAvg,
            p95: openaiP95,
            count: openaiCount,
            rate: openaiSuccessRate / 100
          }
        },
        'anthropic_processing_time': {
          values: {
            avg: anthropicAvg,
            p95: anthropicP95,
            count: anthropicCount,
            rate: anthropicSuccessRate / 100
          }
        },
        'ollama_processing_time': {
          values: {
            avg: ollamaAvg,
            p95: ollamaP95,
            count: ollamaCount,
            rate: ollamaSuccessRate / 100
          }
        },
        'ai_processing_time': {
          values: {
            avg: avgDuration,
            p95: p95Duration
          }
        },
        'openai_success_rate': {
          values: {
            rate: openaiSuccessRate / 100
          }
        },
        'anthropic_success_rate': {
          values: {
            rate: anthropicSuccessRate / 100
          }
        },
        'ollama_success_rate': {
          values: {
            rate: ollamaSuccessRate / 100
          }
        },
        'http_reqs': {
          values: {
            count: totalModelRequests
          }
        },
        'successful_requests': {
          values: {
            count: successfulRequests
          }
        },
        'failed_requests': {
          values: {
            count: failedRequests
          }
        },
        'error_rate': {
          values: {
            rate: errorRate / 100
          }
        },
        'timeout_errors': {
          values: {
            count: 0
          }
        }
      };
      
      // Set metrics in the data object
      data.metrics = metrics;
      
      // Set the test duration
      data.state = {
        testRunDurationMs: totalDuration,
        maxVUs: maxVUs
      };
    }
    
    // Check if there are metrics
    if (!data.metrics || Object.keys(data.metrics).length === 0) {
      console.error(`${colors.red}Error: No metrics found in the file.${colors.reset}`);
      return;
    }
    
    // Print general information
    printGeneralInfo(data);
    
    // Analyze model performance
    analyzeModelPerformance(data);
    
    // Provide recommendations
    provideRecommendations(data);
    
    // Save results to a CSV file
    const csvFilePath = saveResultsToCSV(data);
    console.log(`\nResults saved to CSV file: ${colors.green}${csvFilePath}${colors.reset}`);
    
  } catch (error) {
    console.error(`${colors.red}Error analyzing results: ${error.message}${colors.reset}`);
  }
}

/**
 * Prints general information about the test
 * @param {Object} data - k6 test results
 */
function printGeneralInfo(data) {
  const metrics = data.metrics || {};
  const state = data.state || {};
  
  console.log(`\n${colors.bright}${colors.bgBlue}${colors.white} MODEL COMPARISON RESULTS ${colors.reset}\n`);
  
  // Test information
  console.log(`${colors.bright}Test Information:${colors.reset}`);
  
  // Convert milliseconds to a readable format
  const durationMs = state.testRunDurationMs || 0;
  const minutes = Math.floor(durationMs / 60000);
  const seconds = Math.floor((durationMs % 60000) / 1000);
  const milliseconds = durationMs % 1000;
  
  const durationStr = minutes > 0 
    ? `${minutes} min ${seconds}.${String(milliseconds).padStart(3, '0')} s`
    : `${seconds}.${String(milliseconds).padStart(3, '0')} s`;
  
  console.log(`- Test duration: ${durationStr}`);
  console.log(`- Maximum virtual users: ${state.maxVUs || 0}`);
  
  // General metrics
  console.log(`\n${colors.bright}General Metrics:${colors.reset}`);
  
  const totalRequests = metrics['http_reqs']?.values?.count || 0;
  const successfulRequests = metrics['successful_requests']?.values?.count || 0;
  const failedRequests = metrics['failed_requests']?.values?.count || 0;
  const successRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0;
  
  console.log(`- Total requests: ${totalRequests}`);
  console.log(`- Successful requests: ${successfulRequests} (${successRate.toFixed(2)}%)`);
  console.log(`- Failed requests: ${failedRequests} (${(100 - successRate).toFixed(2)}%)`);
  console.log(`- Error rate: ${(metrics['error_rate']?.values?.rate * 100 || 0).toFixed(2)}%`);
  
  // Response times
  console.log(`\n${colors.bright}Response Times:${colors.reset}`);
  
  const avgTime = metrics['ai_processing_time']?.values?.avg || 0;
  const p95Time = metrics['ai_processing_time']?.values?.p95 || 0;
  
  // Format response times
  const formatTime = (timeMs) => {
    if (timeMs >= 1000) {
      return `${(timeMs / 1000).toFixed(2)} s`;
    } else {
      return `${timeMs.toFixed(2)} ms`;
    }
  };
  
  console.log(`- Average response time: ${formatTime(avgTime)}`);
  console.log(`- 95th percentile response time: ${formatTime(p95Time)}`);
}

/**
 * Analyzes model performance
 * @param {Object} data - k6 test results
 */
function analyzeModelPerformance(data) {
  const metrics = data.metrics || {};
  
  console.log(`\n${colors.bright}${colors.bgGreen}${colors.black} MODEL PERFORMANCE ${colors.reset}\n`);
  
  // Collect model data
  const models = [
    {
      name: 'OpenAI (gpt-3.5-turbo)',
      processingTime: metrics['openai_processing_time']?.values?.avg || 0,
      successRate: metrics['openai_success_rate']?.values?.rate || 0,
      count: metrics['openai_processing_time']?.values?.count || 0
    },
    {
      name: 'Anthropic (claude-instant-1)',
      processingTime: metrics['anthropic_processing_time']?.values?.avg || 0,
      successRate: metrics['anthropic_success_rate']?.values?.rate || 0,
      count: metrics['anthropic_processing_time']?.values?.count || 0
    },
    {
      name: 'Ollama (llama2)',
      processingTime: metrics['ollama_processing_time']?.values?.avg || 0,
      successRate: metrics['ollama_success_rate']?.values?.rate || 0,
      count: metrics['ollama_processing_time']?.values?.count || 0
    }
  ];
  
  // Sort models by response time (fastest first)
  const sortedBySpeed = [...models].filter(m => m.processingTime > 0).sort((a, b) => a.processingTime - b.processingTime);
  
  // Sort models by success rate (best first)
  const sortedBySuccess = [...models].filter(m => !isNaN(m.successRate)).sort((a, b) => b.successRate - a.successRate);
  
  // Print table
  console.log(`${colors.bright}Model Comparison:${colors.reset}`);
  console.log('┌─────────────────────────────┬────────────────────┬─────────────────┬─────────────────┐');
  console.log('│ Model                       │ Average Response  │ Success Rate    │ Request Count  │');
  console.log('│                             │ Time              │                 │                 │');
  console.log('├─────────────────────────────┼────────────────────┼─────────────────┼─────────────────┤');
  
  models.forEach(model => {
    const successRateFormatted = isNaN(model.successRate) ? 'N/A' : `${(model.successRate*100).toFixed(2)}%`;
    console.log(`│ ${padRight(model.name, 27)} │ ${padRight(formatDuration(model.processingTime), 18)} │ ${padRight(successRateFormatted, 15)} │ ${padRight(model.count.toString(), 15)} │`);
  });
  
  console.log('└─────────────────────────────┴────────────────────┴─────────────────┴─────────────────┘');
  
  // Print the fastest model
  if (sortedBySpeed.length > 0) {
    console.log(`\n${colors.bright}Fastest Model:${colors.reset} ${colors.green}${sortedBySpeed[0].name}${colors.reset} (${formatDuration(sortedBySpeed[0].processingTime)})`);
  }
  
  // Print the most reliable model
  if (sortedBySuccess.length > 0) {
    console.log(`${colors.bright}Most Reliable Model:${colors.reset} ${colors.green}${sortedBySuccess[0].name}${colors.reset} (${(sortedBySuccess[0].successRate*100).toFixed(2)}%)`);
  }
}

/**
 * Provides recommendations based on the results
 * @param {Object} data - k6 test results
 */
function provideRecommendations(data) {
  const metrics = data.metrics || {};
  
  // Get model response times and success rates
  const openaiTime = metrics['openai_processing_time']?.values?.avg || 0;
  const anthropicTime = metrics['anthropic_processing_time']?.values?.avg || 0;
  const ollamaTime = metrics['ollama_processing_time']?.values?.avg || 0;
  
  const openaiSuccessRate = metrics['openai_success_rate']?.values?.rate || 0;
  const anthropicSuccessRate = metrics['anthropic_success_rate']?.values?.rate || 0;
  const ollamaSuccessRate = metrics['ollama_success_rate']?.values?.rate || 0;
  
  const timeoutErrors = metrics['timeout_errors']?.values?.count || 0;
  const totalErrors = (metrics['failed_requests']?.values?.count || 0);
  
  console.log(`\n${colors.bright}${colors.bgMagenta}${colors.white} RECOMMENDATIONS ${colors.reset}\n`);
  
  // Model usage recommendations
  console.log(`${colors.bright}Model Usage Recommendations:${colors.reset}`);
  
  // Fastest model
  let fastestModel = 'OpenAI (gpt-3.5-turbo)';
  let fastestTime = openaiTime;
  
  if (anthropicTime > 0 && anthropicTime < fastestTime) {
    fastestModel = 'Anthropic (claude-instant-1)';
    fastestTime = anthropicTime;
  }
  
  if (ollamaTime > 0 && ollamaTime < fastestTime) {
    fastestModel = 'Ollama (llama2)';
    fastestTime = ollamaTime;
  }
  
  // Most reliable model
  let mostReliableModel = 'OpenAI (gpt-3.5-turbo)';
  let highestReliability = openaiSuccessRate;
  
  if (anthropicSuccessRate > highestReliability) {
    mostReliableModel = 'Anthropic (claude-instant-1)';
    highestReliability = anthropicSuccessRate;
  }
  
  if (ollamaSuccessRate > highestReliability) {
    mostReliableModel = 'Ollama (llama2)';
    highestReliability = ollamaSuccessRate;
  }
  
  // Best value model (assuming Ollama is free, Anthropic is cheaper than OpenAI)
  let bestValueModel = 'Ollama (llama2)';
  
  // If all models are equally reliable, recommend the fastest one
  if (openaiSuccessRate === anthropicSuccessRate && anthropicSuccessRate === ollamaSuccessRate) {
    console.log(`- For speed-critical tasks: ${colors.green}${fastestModel}${colors.reset}`);
    console.log(`- For reliability-critical tasks: ${colors.green}${mostReliableModel}${colors.reset}`);
    console.log(`- For cost-critical tasks: ${colors.green}${bestValueModel}${colors.reset}`);
  } else {
    // Otherwise, provide a balanced recommendation
    console.log(`- For speed-critical tasks: ${colors.green}${fastestModel}${colors.reset}`);
    console.log(`- For reliability-critical tasks: ${colors.green}${mostReliableModel}${colors.reset}`);
    console.log(`- For cost-critical tasks: ${colors.green}${bestValueModel}${colors.reset}`);
    
    // Recommend a balanced approach
    if (anthropicSuccessRate >= 0.95 && anthropicTime < openaiTime * 1.5) {
      console.log(`- For balanced usage: ${colors.green}Anthropic (claude-instant-1)${colors.reset}`);
    } else if (ollamaSuccessRate >= 0.9 && ollamaTime < anthropicTime * 0.5) {
      console.log(`- For balanced usage: ${colors.green}Ollama (llama2)${colors.reset}`);
    } else {
      console.log(`- For balanced usage: ${colors.green}OpenAI (gpt-3.5-turbo)${colors.reset}`);
    }
  }
  
  // Error handling recommendations
  console.log(`\n${colors.bright}Error Handling Recommendations:${colors.reset}`);
  
  if (totalErrors > 0) {
    if (timeoutErrors > 0) {
      console.log(`- Increase the timeout value in API calls, the current value may be too low.`);
    }
    
    console.log(`- Use a retry mechanism to retry failed requests.`);
    console.log(`- Consider implementing a circuit breaker pattern to prevent repeated calls to a faulty service.`);
  }
  
  // General recommendations
  console.log(`\n${colors.bright}General Recommendations:${colors.reset}`);
  console.log(`- Use the AIGateway class's fallback mechanism to automatically switch to another model in case of errors.`);
  console.log(`- Set models in priority order based on reliability and speed.`);
  console.log(`- Limit the number of concurrent requests to prevent overloading.`);
  console.log(`- Consider implementing a queuing system for high-load scenarios.`);
  
  // Recommendations based on test results
  if (openaiTime > 1000 && anthropicTime < 500) {
    console.log(`- Consider using Anthropic (claude-instant-1) as the primary model for speed-critical tasks.`);
  }
  
  if (ollamaTime < 100 && ollamaSuccessRate > 0.9) {
    console.log(`- Consider using Ollama (llama2) for simple tasks due to its speed.`);
  }
}

/**
 * Saves results to a CSV file
 * @param {Object} data - k6 test results
 */
function saveResultsToCSV(data) {
  const metrics = data.metrics || {};
  
  // Determine the CSV file path
  const csvFilePath = path.join(
    path.dirname(process.argv[2]),
    `model-comparison-results-${new Date().toISOString().replace(/:/g, '-')}.csv`
  );
  
  // Collect model data
  const models = [
    {
      name: 'OpenAI (gpt-3.5-turbo)',
      processingTime: metrics['openai_processing_time']?.values?.avg || 0,
      p95Time: metrics['openai_processing_time']?.values?.p95 || 0,
      successRate: metrics['openai_success_rate']?.values?.rate || 0
    },
    {
      name: 'Anthropic (claude-instant-1)',
      processingTime: metrics['anthropic_processing_time']?.values?.avg || 0,
      p95Time: metrics['anthropic_processing_time']?.values?.p95 || 0,
      successRate: metrics['anthropic_success_rate']?.values?.rate || 0
    },
    {
      name: 'Ollama (llama2)',
      processingTime: metrics['ollama_processing_time']?.values?.avg || 0,
      p95Time: metrics['ollama_processing_time']?.values?.p95 || 0,
      successRate: metrics['ollama_success_rate']?.values?.rate || 0
    }
  ];
  
  // Create CSV content
  let csvContent = 'Model,Average Response Time (ms),P95 Response Time (ms),Success Rate\n';
  
  models.forEach(model => {
    const successRateFormatted = isNaN(model.successRate) ? 'N/A' : `${(model.successRate*100).toFixed(2)}%`;
    csvContent += `${model.name},${model.processingTime.toFixed(2)},${model.p95Time.toFixed(2)},${successRateFormatted}\n`;
  });
  
  // Add general metrics
  csvContent += '\nGeneral Metrics\n';
  csvContent += `Total Requests,${(metrics['successful_requests']?.values?.count || 0) + (metrics['failed_requests']?.values?.count || 0)}\n`;
  csvContent += `Successful Requests,${metrics['successful_requests']?.values?.count || 0}\n`;
  csvContent += `Failed Requests,${metrics['failed_requests']?.values?.count || 0}\n`;
  csvContent += `Error Rate,${((metrics['error_rate']?.values?.rate || 0)*100).toFixed(2)}\n`;
  
  // Add error types
  csvContent += '\nError Types\n';
  csvContent += `Timeout Errors,${metrics['timeout_errors']?.values?.count || 0}\n`;
  csvContent += `Server Errors,${metrics['server_errors']?.values?.count || 0}\n`;
  csvContent += `Client Errors,${metrics['client_errors']?.values?.count || 0}\n`;
  
  // Save the CSV file
  try {
    fs.writeFileSync(csvFilePath, csvContent);
    return csvFilePath;
  } catch (error) {
    console.error(`${colors.red}Error saving CSV file: ${error.message}${colors.reset}`);
  }
}

/**
 * Formats time in milliseconds to a human-readable format
 * @param {number} ms - Time in milliseconds
 * @returns {string} Formatted time
 */
function formatDuration(ms) {
  if (ms < 1000) {
    return `${ms.toFixed(2)} ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(2)} s`;
  } else {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(2);
    return `${minutes} min ${seconds} s`;
  }
}

/**
 * Pads a string to the right with spaces
 * @param {string} text - Text to pad
 * @param {number} length - Desired length
 * @returns {string} Padded text
 */
function padRight(text, length) {
  return String(text).padEnd(length);
}

// Main program execution
if (process.argv.length < 3) {
  console.error(`${colors.red}Error: Provide the path to the results file as an argument.${colors.reset}`);
  console.log(`Usage: ${colors.cyan}node analyze-model-comparison.js results.json${colors.reset}`);
} else {
  analyzeResults(process.argv[2]);
}
