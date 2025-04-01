/**
 * analyze-fallback-results.js
 * 
 * Tool for analyzing and visualizing the results of AI model fallback tests.
 * This script reads JSON result files produced by k6 tests and creates a summary
 * that helps understand the operation of the fallback mechanism.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { exec } = require('child_process');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

/**
 * Reads a JSON result file produced by k6
 * @param {string} filePath - Path to the result file
 * @returns {Promise<Object>} - Promise that resolves to the parsed JSON object
 */
async function readK6ResultsFile(filePath) {
  try {
    // Check the file size
    const stats = fs.statSync(filePath);
    const fileSizeMB = stats.size / (1024 * 1024);
    console.log(`File size: ${fileSizeMB.toFixed(2)} MB`);
    
    if (fileSizeMB > 10) {
      console.log(`${colors.yellow}File is large (${fileSizeMB.toFixed(2)} MB), using streaming processing${colors.reset}`);
      return await processLargeJsonFile(filePath);
    }
    
    // For smaller files, use direct reading
    const data = fs.readFileSync(filePath, 'utf8');
    
    try {
      return JSON.parse(data);
    } catch (jsonError) {
      console.log(`${colors.yellow}JSON parsing error, attempting to fix the file${colors.reset}`);
      
      // Try to fix the JSON file
      const fixedData = fixJsonData(data);
      return JSON.parse(fixedData);
    }
  } catch (error) {
    console.error(`${colors.red}Error reading file ${filePath}:${colors.reset}`, error.message);
    
    // Try to read the file using jq, if available
    try {
      return await readWithJq(filePath);
    } catch (jqError) {
      console.error(`${colors.red}jq attempt also failed:${colors.reset}`, jqError.message);
      return null;
    }
  }
}

/**
 * Fixes invalid JSON data
 * @param {string} data - Invalid JSON data
 * @returns {string} - Fixed JSON data
 */
function fixJsonData(data) {
  // Remove possible BOM characters
  let fixedData = data.replace(/^\uFEFF/, '');
  
  // Remove possible extra line breaks between JSON objects
  fixedData = fixedData.replace(/\}\s*\n\s*\{/g, '},{');
  
  // Try to fix common JSON errors
  fixedData = fixedData.replace(/,\s*\}/g, '}');
  fixedData = fixedData.replace(/,\s*\]/g, ']');
  
  // Check if this is a JSON Lines (JSONL) format
  if (fixedData.trim().startsWith('{') && !fixedData.trim().startsWith('[{')) {
    const lines = fixedData.split('\n').filter(line => line.trim().length > 0);
    if (lines.length > 1 && lines.every(line => line.trim().startsWith('{'))) {
      // This is JSONL, convert it to a JSON array
      fixedData = '[' + lines.join(',') + ']';
    }
  }
  
  return fixedData;
}

/**
 * Processes a large JSON file using streaming
 * @param {string} filePath - Path to the result file
 * @returns {Promise<Object>} - Promise that resolves to the processed data object
 */
async function processLargeJsonFile(filePath) {
  return new Promise((resolve, reject) => {
    // Create a simplified result object
    const result = {
      metrics: {},
      timestamp: new Date().toISOString(),
      vus_max: 0,
      iterations: 0,
      duration_ms: 0
    };
    
    // Look for the most important metrics
    const metricRegexes = {
      error_rate: /error_rate.*?rate":\s*([\d.]+)/,
      fallback_success_rate: /fallback_success_rate.*?rate":\s*([\d.]+)/,
      response_time: /response_time.*?avg":\s*([\d.]+).*?min":\s*([\d.]+).*?med":\s*([\d.]+).*?max":\s*([\d.]+).*?p\(95\)":\s*([\d.]+)/s,
      successful_requests: /successful_requests.*?count":\s*([\d.]+)/,
      failed_requests: /failed_requests.*?count":\s*([\d.]+)/,
      timeout_errors: /timeout_errors.*?count":\s*([\d.]+)/,
      server_errors: /server_errors.*?count":\s*([\d.]+)/,
      client_errors: /client_errors.*?count":\s*([\d.]+)/
    };
    
    // Model-specific metrics
    const models = ['openai', 'anthropic', 'ollama'];
    models.forEach(model => {
      metricRegexes[`${model}_success_rate`] = new RegExp(`${model}_success_rate.*?rate":\\s*([\\d.]+).*?passes":\\s*([\\d.]+)`, 's');
      metricRegexes[`${model}_processing_time`] = new RegExp(`${model}_processing_time.*?avg":\\s*([\\d.]+)`, 's');
    });
    
    // Read the entire file into memory
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        reject(err);
        return;
      }
      
      // Find basic information
      const vusMatch = data.match(/vus_max":\s*(\d+)/);
      if (vusMatch) result.vus_max = parseInt(vusMatch[1]);
      
      const iterationsMatch = data.match(/iterations":\s*(\d+)/);
      if (iterationsMatch) result.iterations = parseInt(iterationsMatch[1]);
      
      const durationMatch = data.match(/duration":\s*"([^"]+)"/);
      if (durationMatch) {
        const durationStr = durationMatch[1];
        // Convert duration to milliseconds
        const timeRegex = /(\d+)([hms])/g;
        let match;
        let ms = 0;
        while ((match = timeRegex.exec(durationStr)) !== null) {
          const value = parseInt(match[1]);
          const unit = match[2];
          if (unit === 'h') ms += value * 3600000;
          else if (unit === 'm') ms += value * 60000;
          else if (unit === 's') ms += value * 1000;
        }
        result.duration_ms = ms;
      }
      
      // Find metrics
      for (const [metricName, regex] of Object.entries(metricRegexes)) {
        const match = data.match(regex);
        if (match) {
          if (metricName === 'response_time') {
            result.metrics[metricName] = {
              values: {
                avg: parseFloat(match[1]),
                min: parseFloat(match[2]),
                med: parseFloat(match[3]),
                max: parseFloat(match[4]),
                'p(95)': parseFloat(match[5])
              }
            };
          } else if (metricName.endsWith('_success_rate') && match.length > 2) {
            result.metrics[metricName] = {
              values: {
                rate: parseFloat(match[1]),
                passes: parseInt(match[2])
              }
            };
          } else if (metricName.endsWith('_processing_time')) {
            result.metrics[metricName] = {
              values: {
                avg: parseFloat(match[1])
              }
            };
          } else if (metricName.endsWith('_rate')) {
            result.metrics[metricName] = {
              values: {
                rate: parseFloat(match[1])
              }
            };
          } else {
            result.metrics[metricName] = {
              values: {
                count: parseInt(match[1])
              }
            };
          }
        }
      }
      
      resolve(result);
    });
  });
}

/**
 * Reads a JSON file using jq
 * @param {string} filePath - Path to the result file
 * @returns {Promise<Object>} - Promise that resolves to the parsed JSON object
 */
async function readWithJq(filePath) {
  return new Promise((resolve, reject) => {
    exec(`jq . "${filePath}"`, { maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        console.error(`${colors.red}jq execution error:${colors.reset}`, error);
        reject(error);
        return;
      }
      
      if (stderr) {
        console.error(`${colors.yellow}jq stderr:${colors.reset}`, stderr);
      }
      
      try {
        const data = JSON.parse(stdout);
        resolve(data);
      } catch (jsonError) {
        reject(jsonError);
      }
    });
  });
}

/**
 * Creates an ASCII bar chart
 * @param {number} value - Value between 0-100
 * @param {number} width - Chart width in characters
 * @param {string} color - Color code
 * @returns {string} - ASCII bar chart
 */
function createBar(value, width = 40, color = colors.green) {
  const normalizedValue = Math.min(100, Math.max(0, value));
  const filledWidth = Math.round((normalizedValue / 100) * width);
  const emptyWidth = width - filledWidth;
  
  const filled = '█'.repeat(filledWidth);
  const empty = '░'.repeat(emptyWidth);
  
  return `${color}${filled}${colors.reset}${empty} ${normalizedValue.toFixed(1)}%`;
}

/**
 * Analyzes fallback test results
 * @param {string} filePath - Path to the result file
 */
async function analyzeFallbackResults(filePath) {
  console.log(`${colors.bright}Analyzing fallback test results from: ${filePath}${colors.reset}`);
  
  try {
    const data = await readK6ResultsFile(filePath);
    
    if (!data) {
      console.error(`${colors.red}Failed to read or parse the results file.${colors.reset}`);
      return;
    }
    
    // Extract metrics
    const metrics = data.metrics || {};
    
    // Basic test information
    console.log(`\n${colors.bright}Test Information:${colors.reset}`);
    console.log(`  Duration: ${formatDuration(data.duration_ms || 0)}`);
    console.log(`  Max VUs: ${data.vus_max || 'N/A'}`);
    console.log(`  Iterations: ${data.iterations || 'N/A'}`);
    console.log(`  Timestamp: ${data.timestamp || 'N/A'}`);
    
    // Success rates
    console.log(`\n${colors.bright}Success Rates:${colors.reset}`);
    
    // Overall success rate
    const successRate = 100 - getMetricValue(metrics, 'error_rate', 'rate', 0) * 100;
    console.log(`  Overall Success Rate: ${createBar(successRate)}`);
    
    // Fallback success rate
    const fallbackSuccessRate = getMetricValue(metrics, 'fallback_success_rate', 'rate', 0) * 100;
    console.log(`  Fallback Success Rate: ${createBar(fallbackSuccessRate, 40, colors.cyan)}`);
    
    // Model-specific success rates
    const models = ['openai', 'anthropic', 'ollama'];
    console.log(`\n${colors.bright}Model Success Rates:${colors.reset}`);
    
    models.forEach(model => {
      const modelSuccessRate = getMetricValue(metrics, `${model}_success_rate`, 'rate', 0) * 100;
      const modelPasses = getMetricValue(metrics, `${model}_success_rate`, 'passes', 0);
      const modelColor = getModelColor(model);
      console.log(`  ${model.charAt(0).toUpperCase() + model.slice(1)}: ${createBar(modelSuccessRate, 40, modelColor)} (${modelPasses} passes)`);
    });
    
    // Response times
    console.log(`\n${colors.bright}Response Times:${colors.reset}`);
    
    const avgResponseTime = getMetricValue(metrics, 'response_time', 'avg', 0);
    const minResponseTime = getMetricValue(metrics, 'response_time', 'min', 0);
    const medResponseTime = getMetricValue(metrics, 'response_time', 'med', 0);
    const maxResponseTime = getMetricValue(metrics, 'response_time', 'max', 0);
    const p95ResponseTime = getMetricValue(metrics, 'response_time', 'p(95)', 0);
    
    console.log(`  Average: ${formatTime(avgResponseTime)}`);
    console.log(`  Median: ${formatTime(medResponseTime)}`);
    console.log(`  Min: ${formatTime(minResponseTime)}`);
    console.log(`  Max: ${formatTime(maxResponseTime)}`);
    console.log(`  p(95): ${formatTime(p95ResponseTime)}`);
    
    // Model-specific processing times
    console.log(`\n${colors.bright}Model Processing Times (Average):${colors.reset}`);
    
    models.forEach(model => {
      const processingTime = getMetricValue(metrics, `${model}_processing_time`, 'avg', 0);
      const modelColor = getModelColor(model);
      console.log(`  ${model.charAt(0).toUpperCase() + model.slice(1)}: ${modelColor}${formatTime(processingTime)}${colors.reset}`);
    });
    
    // Error counts
    console.log(`\n${colors.bright}Error Counts:${colors.reset}`);
    
    const successfulRequests = getMetricValue(metrics, 'successful_requests', 'count', 0);
    const failedRequests = getMetricValue(metrics, 'failed_requests', 'count', 0);
    const timeoutErrors = getMetricValue(metrics, 'timeout_errors', 'count', 0);
    const serverErrors = getMetricValue(metrics, 'server_errors', 'count', 0);
    const clientErrors = getMetricValue(metrics, 'client_errors', 'count', 0);
    
    const totalRequests = successfulRequests + failedRequests;
    
    console.log(`  Successful Requests: ${successfulRequests} (${((successfulRequests / totalRequests) * 100).toFixed(1)}%)`);
    console.log(`  Failed Requests: ${failedRequests} (${((failedRequests / totalRequests) * 100).toFixed(1)}%)`);
    console.log(`  Timeout Errors: ${timeoutErrors}`);
    console.log(`  Server Errors: ${serverErrors}`);
    console.log(`  Client Errors: ${clientErrors}`);
    
    console.log(`\n${colors.bright}Analysis Complete${colors.reset}`);
  } catch (error) {
    console.error(`${colors.red}Error analyzing results:${colors.reset}`, error);
  }
}

/**
 * Gets a metric value from the metrics object
 * @param {Object} metrics - Metrics object
 * @param {string} metricName - Metric name
 * @param {string} valueName - Value name within the metric
 * @param {number} defaultValue - Default value if metric is not found
 * @returns {number} - Metric value
 */
function getMetricValue(metrics, metricName, valueName, defaultValue) {
  if (!metrics || !metrics[metricName] || !metrics[metricName].values || metrics[metricName].values[valueName] === undefined) {
    return defaultValue;
  }
  return metrics[metricName].values[valueName];
}

/**
 * Formats time in milliseconds to a human-readable string
 * @param {number} ms - Time in milliseconds
 * @returns {string} - Formatted time string
 */
function formatTime(ms) {
  if (ms < 1000) {
    return `${ms.toFixed(2)}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(2)}s`;
  } else {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(2);
    return `${minutes}m ${seconds}s`;
  }
}

/**
 * Formats duration in milliseconds to a human-readable string
 * @param {number} ms - Duration in milliseconds
 * @returns {string} - Formatted duration string
 */
function formatDuration(ms) {
  if (ms < 1000) {
    return `${ms}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  } else if (ms < 3600000) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  } else {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${hours}h ${minutes}m ${seconds}s`;
  }
}

/**
 * Gets the color for a specific model
 * @param {string} model - Model name ('openai', 'anthropic', or 'ollama')
 * @returns {string} - Color code for the model
 */
function getModelColor(model) {
  if (model === 'openai') {
    return colors.green;
  }
  if (model === 'anthropic') {
    return colors.magenta;
  }
  return colors.blue;
}

// Process command line arguments
const args = process.argv.slice(2);
const filePath = args[0] || 'fallback-test-results.json';

// Run the analysis
analyzeFallbackResults(filePath);
