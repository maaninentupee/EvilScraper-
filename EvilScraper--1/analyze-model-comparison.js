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
// Regex patterns for log parsing
const REGEX_PATTERNS = {
  openaiTime: /openai_processing_time[.\s]*: avg=(\d+\.?\d*).*?p\(95\)=(\d+\.?\d*)/,
  anthropicTime: /anthropic_processing_time[.\s]*: avg=(\d+\.?\d*).*?p\(95\)=(\d+\.?\d*)/,
  ollamaTime: /ollama_processing_time[.\s]*: avg=(\d+\.?\d*).*?p\(95\)=(\d+\.?\d*)/,
  openaiSuccess: /openai_success_rate[.\s]*: (\d+\.?\d*)% (\d+) out of (\d+)/,
  anthropicSuccess: /anthropic_success_rate[.\s]*: (\d+\.?\d*)% (\d+) out of (\d+)/,
  ollamaSuccess: /ollama_success_rate[.\s]*: (\d+\.?\d*)% (\d+) out of (\d+)/,
  duration: /running \((\d+)m(\d+)\.(\d+)s\)/,
  vus: /vus_max[.\s]*: (\d+)/,
  requests: /http_reqs[.\s]*: (\d+)/,
  errorRate: /error_rate[.\s]*: (\d+\.?\d*)%/,
  avgDuration: /http_req_duration[.\s]*: avg=(\d+\.?\d*)ms.*?p\(95\)=(\d+\.?\d*)s/
};
function extractModelMetrics(rawData) {
  const metrics = {
    openai: { avg: 0, p95: 0, count: 0, successRate: 0 },
    anthropic: { avg: 0, p95: 0, count: 0, successRate: 0 },
    ollama: { avg: 0, p95: 0, count: 0, successRate: 0 }
  };
  // Extract time metrics
  const openaiTime = rawData.match(REGEX_PATTERNS.openaiTime);
  const anthropicTime = rawData.match(REGEX_PATTERNS.anthropicTime);
  const ollamaTime = rawData.match(REGEX_PATTERNS.ollamaTime);
  if (openaiTime) {
    metrics.openai.avg = parseFloat(openaiTime[1]);
    metrics.openai.p95 = parseFloat(openaiTime[2]);
  }
  if (anthropicTime) {
    metrics.anthropic.avg = parseFloat(anthropicTime[1]);
    metrics.anthropic.p95 = parseFloat(anthropicTime[2]);
  }
  if (ollamaTime) {
    metrics.ollama.avg = parseFloat(ollamaTime[1]);
    metrics.ollama.p95 = parseFloat(ollamaTime[2]);
  }
  // Extract success rates
  const openaiSuccess = rawData.match(REGEX_PATTERNS.openaiSuccess);
  const anthropicSuccess = rawData.match(REGEX_PATTERNS.anthropicSuccess);
  const ollamaSuccess = rawData.match(REGEX_PATTERNS.ollamaSuccess);
  if (openaiSuccess) {
    metrics.openai.successRate = parseFloat(openaiSuccess[1]);
    metrics.openai.count = parseInt(openaiSuccess[3]);
  }
  if (anthropicSuccess) {
    metrics.anthropic.successRate = parseFloat(anthropicSuccess[1]);
    metrics.anthropic.count = parseInt(anthropicSuccess[3]);
  }
  if (ollamaSuccess) {
    metrics.ollama.successRate = parseFloat(ollamaSuccess[1]);
    metrics.ollama.count = parseInt(ollamaSuccess[3]);
  }
  return metrics;
}
function extractGeneralMetrics(rawData) {
  const metrics = {
    totalDuration: 0,
    maxVUs: 0,
    totalRequests: 0,
    errorRate: 0,
    avgDuration: 0,
    p95Duration: 0
  };
  const durationMatch = rawData.match(REGEX_PATTERNS.duration) ||
                       findLastDurationMatch(rawData);
  const vusMatch = rawData.match(REGEX_PATTERNS.vus);
  const requestsMatch = rawData.match(REGEX_PATTERNS.requests);
  const errorRateMatch = rawData.match(REGEX_PATTERNS.errorRate);
  const avgDurationMatch = rawData.match(REGEX_PATTERNS.avgDuration);
  if (durationMatch) {
    const [minutes, seconds, milliseconds] = durationMatch.slice(1).map(Number);
    metrics.totalDuration = minutes * 60 * 1000 + seconds * 1000 + milliseconds * 100;
  }
  if (vusMatch) metrics.maxVUs = parseInt(vusMatch[1]);
  if (requestsMatch) metrics.totalRequests = parseInt(requestsMatch[1]);
  if (errorRateMatch) metrics.errorRate = parseFloat(errorRateMatch[1]);
  if (avgDurationMatch) {
    metrics.avgDuration = parseFloat(avgDurationMatch[1]);
    metrics.p95Duration = parseFloat(avgDurationMatch[2]) * 1000;
  }
  return metrics;
}
function findLastDurationMatch(rawData) {
  const lastRunningRegex = new RegExp(REGEX_PATTERNS.duration.source, 'g');
  let lastMatch;
  let match;
  
  while ((match = lastRunningRegex.exec(rawData)) !== null) {
    lastMatch = match;
  }
  
  return lastMatch;
}
function createMetricsObject(modelMetrics, generalMetrics) {
  const totalModelRequests = modelMetrics.openai.count + modelMetrics.anthropic.count + modelMetrics.ollama.count;
  const failedRequests = generalMetrics.totalRequests * (generalMetrics.errorRate / 100);
  return {
    'openai_processing_time': {
      values: {
        avg: modelMetrics.openai.avg,
        p95: modelMetrics.openai.p95,
        count: modelMetrics.openai.count,
        rate: modelMetrics.openai.successRate / 100
      }
    },
    'anthropic_processing_time': {
      values: {
        avg: modelMetrics.anthropic.avg,
        p95: modelMetrics.anthropic.p95,
        count: modelMetrics.anthropic.count,
        rate: modelMetrics.anthropic.successRate / 100
      }
    },
    'ollama_processing_time': {
      values: {
        avg: modelMetrics.ollama.avg,
        p95: modelMetrics.ollama.p95,
        count: modelMetrics.ollama.count,
        rate: modelMetrics.ollama.successRate / 100
      }
    },
    'ai_processing_time': {
      values: {
        avg: generalMetrics.avgDuration,
        p95: generalMetrics.p95Duration
      }
    },
    'openai_success_rate': { values: { rate: modelMetrics.openai.successRate / 100 } },
    'anthropic_success_rate': { values: { rate: modelMetrics.anthropic.successRate / 100 } },
    'ollama_success_rate': { values: { rate: modelMetrics.ollama.successRate / 100 } },
    'http_reqs': { values: { count: totalModelRequests } },
    'successful_requests': { values: { count: totalModelRequests } },
    'failed_requests': { values: { count: failedRequests } },
    'error_rate': { values: { rate: generalMetrics.errorRate / 100 } },
    'timeout_errors': { values: { count: 0 } }
  };
}
async function analyzeResults(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.error(`${colors.red}Error: File ${filePath} not found.${colors.reset}`);
      console.log(`Run the test first with command: ${colors.cyan}k6 run model-comparison-test.js --out json=results.json${colors.reset}`);
      return;
    }

    const rawData = fs.readFileSync(filePath, 'utf8');
    let data;

    if (filePath.endsWith('.json')) {
      try {
        data = JSON.parse(rawData);
      } catch (e) {
        console.log(`${colors.yellow}Warning: JSON parsing failed, processing as log file${colors.reset}`);
        data = processLogFile(rawData);
      }
    } else {
      data = processLogFile(rawData);
    }
    
    if (!data.metrics || Object.keys(data.metrics).length === 0) {
      console.error(`${colors.red}Error: No metrics found in the file.${colors.reset}`);
      return;
    }
    printGeneralInfo(data);
    analyzeModelPerformance(data);
    provideRecommendations(data);
    
    const csvFilePath = saveResultsToCSV(data);
    console.log(`\nResults saved to CSV file: ${colors.green}${csvFilePath}${colors.reset}`);
    
  } catch (error) {
    console.error(`${colors.red}Error analyzing results: ${error.message}${colors.reset}`);
  }
}
function processLogFile(rawData) {
  const modelMetrics = extractModelMetrics(rawData);
  const generalMetrics = extractGeneralMetrics(rawData);
  
  // Log extracted metrics
  console.log(`OpenAI: avg=${modelMetrics.openai.avg}ms, p95=${modelMetrics.openai.p95}ms, count=${modelMetrics.openai.count}, success=${modelMetrics.openai.successRate}%`);
  console.log(`Anthropic: avg=${modelMetrics.anthropic.avg}ms, p95=${modelMetrics.anthropic.p95}ms, count=${modelMetrics.anthropic.count}, success=${modelMetrics.anthropic.successRate}%`);
  console.log(`Ollama: avg=${modelMetrics.ollama.avg}ms, p95=${modelMetrics.ollama.p95}ms, count=${modelMetrics.ollama.count}, success=${modelMetrics.ollama.successRate}%`);
  return {
    metrics: createMetricsObject(modelMetrics, generalMetrics),
    state: {
      testRunDurationMs: generalMetrics.totalDuration,
      maxVUs: generalMetrics.maxVUs
    }
  };
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
function findFastestModel(modelTimes) {
  return [
    { name: 'OpenAI (gpt-3.5-turbo)', time: modelTimes.openai },
    { name: 'Anthropic (claude-instant-1)', time: modelTimes.anthropic },
    { name: 'Ollama (llama2)', time: modelTimes.ollama }
  ].filter(model => model.time > 0)
    .reduce((fastest, current) =>
      current.time < fastest.time ? current : fastest,
      { name: 'OpenAI (gpt-3.5-turbo)', time: Infinity }  // Initial value
    );
}
function findMostReliableModel(successRates) {
  return [
    { name: 'OpenAI (gpt-3.5-turbo)', rate: successRates.openai },
    { name: 'Anthropic (claude-instant-1)', rate: successRates.anthropic },
    { name: 'Ollama (llama2)', rate: successRates.ollama }
  ].reduce((mostReliable, current) =>
    current.rate > mostReliable.rate ? current : mostReliable
  );
}
function getBalancedRecommendation(modelTimes, successRates) {
  if (successRates.anthropic >= 0.95 && modelTimes.anthropic < modelTimes.openai * 1.5) {
    return 'Anthropic (claude-instant-1)';
  }
  if (successRates.ollama >= 0.9 && modelTimes.ollama < modelTimes.anthropic * 0.5) {
    return 'Ollama (llama2)';
  }
  return 'OpenAI (gpt-3.5-turbo)';
}
function printModelRecommendations(fastestModel, mostReliableModel, balancedModel) {
  console.log(`- For speed-critical tasks: ${colors.green}${fastestModel}${colors.reset}`);
  console.log(`- For reliability-critical tasks: ${colors.green}${mostReliableModel}${colors.reset}`);
  console.log(`- For cost-critical tasks: ${colors.green}Ollama (llama2)${colors.reset}`);
  console.log(`- For balanced usage: ${colors.green}${balancedModel}${colors.reset}`);
}
function printErrorHandlingRecommendations(timeoutErrors, totalErrors) {
  console.log(`\n${colors.bright}Error Handling Recommendations:${colors.reset}`);
  
  if (totalErrors > 0) {
    if (timeoutErrors > 0) {
      console.log('- Increase the timeout value in API calls, the current value may be too low.');
    }
    console.log('- Use a retry mechanism to retry failed requests.');
    console.log('- Consider implementing a circuit breaker pattern to prevent repeated calls to a faulty service.');
  }
}
function printGeneralRecommendations(modelTimes, successRates) {
  console.log(`\n${colors.bright}General Recommendations:${colors.reset}`);
  console.log('- Use the AIGateway class\'s fallback mechanism to automatically switch to another model in case of errors.');
  console.log('- Set models in priority order based on reliability and speed.');
  console.log('- Limit the number of concurrent requests to prevent overloading.');
  console.log('- Consider implementing a queuing system for high-load scenarios.');
  if (modelTimes.openai > 1000 && modelTimes.anthropic < 500) {
    console.log('- Consider using Anthropic (claude-instant-1) as the primary model for speed-critical tasks.');
  }
  if (modelTimes.ollama < 100 && successRates.ollama > 0.9) {
    console.log('- Consider using Ollama (llama2) for simple tasks due to its speed.');
  }
}
function provideRecommendations(data) {
  const metrics = data.metrics || {};
  
  const modelTimes = {
    openai: metrics['openai_processing_time']?.values?.avg || 0,
    anthropic: metrics['anthropic_processing_time']?.values?.avg || 0,
    ollama: metrics['ollama_processing_time']?.values?.avg || 0
  };
  
  const successRates = {
    openai: metrics['openai_success_rate']?.values?.rate || 0,
    anthropic: metrics['anthropic_success_rate']?.values?.rate || 0,
    ollama: metrics['ollama_success_rate']?.values?.rate || 0
  };
  
  const timeoutErrors = metrics['timeout_errors']?.values?.count || 0;
  const totalErrors = metrics['failed_requests']?.values?.count || 0;
  
  console.log(`\n${colors.bright}${colors.bgMagenta}${colors.white} RECOMMENDATIONS ${colors.reset}\n`);
  console.log(`${colors.bright}Model Usage Recommendations:${colors.reset}`);
  
  const fastestModel = findFastestModel(modelTimes).name;
  const mostReliableModel = findMostReliableModel(successRates).name;
  const balancedModel = getBalancedRecommendation(modelTimes, successRates);
  
  printModelRecommendations(fastestModel, mostReliableModel, balancedModel);
  printErrorHandlingRecommendations(timeoutErrors, totalErrors);
  printGeneralRecommendations(modelTimes, successRates);
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