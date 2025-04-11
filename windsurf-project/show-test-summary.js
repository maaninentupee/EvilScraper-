/**
 * Simple script for displaying model-comparison-test.js test results
 * 
 * Usage: node show-test-summary.js
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  red: '\x1b[31m'
};

// Find the latest model-comparison-results.json file
function findLatestResultFile() {
  const files = fs.readdirSync('.');
  const resultFiles = files.filter(file => 
    file.startsWith('model-comparison-results') && 
    (file.endsWith('.json') || file.endsWith('.txt'))
  );
  
  if (resultFiles.length === 0) {
    console.error(`${colors.red}Error: Result file not found.${colors.reset}`);
    console.log(`Run the test first with command: ${colors.cyan}k6 run model-comparison-test.js${colors.reset}`);
    return null;
  }
  
  // Sort files by modification date (newest first)
  resultFiles.sort((a, b) => {
    return fs.statSync(b).mtime.getTime() - fs.statSync(a).mtime.getTime();
  });
  
  return resultFiles[0];
}

// Analyze the results file produced by k6
function analyzeResults(filePath) {
  console.log(`${colors.bright}${colors.blue}Analyzing file: ${filePath}${colors.reset}\n`);
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const metrics = {
    openai: { count: 0, success: 0, totalTime: 0, times: [] },
    anthropic: { count: 0, success: 0, totalTime: 0, times: [] },
    ollama: { count: 0, success: 0, totalTime: 0, times: [] },
    total: { count: 0, success: 0, failed: 0, totalTime: 0, times: [] }
  };

  // Helper functions to process each metric type
  const processHttpReq = (data) => {
    if (data.metric !== 'http_reqs' || data.type !== 'Point') return;
    const url = data.data.tags.url || '';
    const status = data.data.tags.status || '';
    const isSuccess = status.startsWith('2');
    metrics.total.count++;
    if (isSuccess) {
      metrics.total.success++;
    } else {
      metrics.total.failed++;
    }
    if (url.includes('/openai')) {
      metrics.openai.count++;
      if (isSuccess) metrics.openai.success++;
    } else if (url.includes('/anthropic')) {
      metrics.anthropic.count++;
      if (isSuccess) metrics.anthropic.success++;
    } else if (url.includes('/ollama')) {
      metrics.ollama.count++;
      if (isSuccess) metrics.ollama.success++;
    }
  };

  const processHttpReqDuration = (data) => {
    if (data.metric !== 'http_req_duration' || data.type !== 'Point') return;
    const duration = data.data.value || 0;
    metrics.total.totalTime += duration;
    metrics.total.times.push(duration);
    const url = data.data.tags.url || '';
    if (url.includes('/openai')) {
      metrics.openai.totalTime += duration;
      metrics.openai.times.push(duration);
    } else if (url.includes('/anthropic')) {
      metrics.anthropic.totalTime += duration;
      metrics.anthropic.times.push(duration);
    } else if (url.includes('/ollama')) {
      metrics.ollama.totalTime += duration;
      metrics.ollama.times.push(duration);
    }
  };

  const processProcessingTime = (data) => {
    const procMap = {
      'openai_processing_time': 'openai',
      'anthropic_processing_time': 'anthropic',
      'ollama_processing_time': 'ollama'
    };
    if (!(data.metric in procMap) || data.type !== 'Point') return;
    const provider = procMap[data.metric];
    metrics[provider].totalTime += data.data.value || 0;
  };

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const data = JSON.parse(line);
      processHttpReq(data);
      processHttpReqDuration(data);
      processProcessingTime(data);
    } catch (e) {
      continue;
    }
  }

  const calculateAvg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const calculateP95 = (arr) => {
    if (!arr.length) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = Math.floor(sorted.length * 0.95);
    return sorted[idx] || sorted[sorted.length - 1];
  };

  metrics.openai.avgTime = calculateAvg(metrics.openai.times);
  metrics.anthropic.avgTime = calculateAvg(metrics.anthropic.times);
  metrics.ollama.avgTime = calculateAvg(metrics.ollama.times);
  metrics.total.avgTime = calculateAvg(metrics.total.times);

  metrics.openai.p95Time = calculateP95(metrics.openai.times);
  metrics.anthropic.p95Time = calculateP95(metrics.anthropic.times);
  metrics.ollama.p95Time = calculateP95(metrics.ollama.times);
  metrics.total.p95Time = calculateP95(metrics.total.times);

  metrics.openai.successRate = metrics.openai.count ? (metrics.openai.success / metrics.openai.count) * 100 : 0;
  metrics.anthropic.successRate = metrics.anthropic.count ? (metrics.anthropic.success / metrics.anthropic.count) * 100 : 0;
  metrics.ollama.successRate = metrics.ollama.count ? (metrics.ollama.success / metrics.ollama.count) * 100 : 0;
  metrics.total.successRate = metrics.total.count ? (metrics.total.success / metrics.total.count) * 100 : 0;

  return metrics;
}

// Print summary
function printSummary(metrics) {
  console.log(`${colors.bright}${colors.magenta}AI MODEL COMPARISON RESULTS${colors.reset}\n`);
  
  console.log(`${colors.bright}General metrics:${colors.reset}`);
  console.log(`- Total number of requests: ${metrics.total.count}`);
  console.log(`- Successful requests: ${metrics.total.success} (${metrics.total.successRate.toFixed(2)}%)`);
  console.log(`- Failed requests: ${metrics.total.failed} (${(100 - metrics.total.successRate).toFixed(2)}%)`);
  console.log(`- Average response time: ${metrics.total.avgTime.toFixed(2)} ms`);
  console.log(`- 95% response time: ${metrics.total.p95Time.toFixed(2)} ms\n`);
  
  console.log(`${colors.bright}${colors.cyan}MODEL PERFORMANCE${colors.reset}\n`);
  
  // Table for model comparison
  console.log(`${colors.bright}┌─────────────────────────────┬────────────────────┬─────────────────┬─────────────────┐${colors.reset}`);
  console.log(`${colors.bright}│ Model                       │ Average            │ Success         │ Number of       │${colors.reset}`);
  console.log(`${colors.bright}│                             │ response time      │ rate            │ requests        │${colors.reset}`);
  console.log(`${colors.bright}├─────────────────────────────┼────────────────────┼─────────────────┼─────────────────┤${colors.reset}`);
  
  console.log(`│ OpenAI (gpt-3.5-turbo)      │ ${padRight(metrics.openai.avgTime.toFixed(2) + ' ms', 18)} │ ${padRight(metrics.openai.successRate.toFixed(2) + '%', 15)} │ ${padRight(metrics.openai.count.toString(), 15)} │`);
  console.log(`│ Anthropic (claude-instant-1) │ ${padRight(metrics.anthropic.avgTime.toFixed(2) + ' ms', 18)} │ ${padRight(metrics.anthropic.successRate.toFixed(2) + '%', 15)} │ ${padRight(metrics.anthropic.count.toString(), 15)} │`);
  console.log(`│ Ollama (llama2)             │ ${padRight(metrics.ollama.avgTime.toFixed(2) + ' ms', 18)} │ ${padRight(metrics.ollama.successRate.toFixed(2) + '%', 15)} │ ${padRight(metrics.ollama.count.toString(), 15)} │`);
  
  console.log(`${colors.bright}└─────────────────────────────┴────────────────────┴─────────────────┴─────────────────┘${colors.reset}`);
  
  // Determine the most reliable model
  let mostReliableModel = 'OpenAI (gpt-3.5-turbo)';
  let highestSuccessRate = metrics.openai.successRate;
  
  if (metrics.anthropic.successRate > highestSuccessRate) {
    mostReliableModel = 'Anthropic (claude-instant-1)';
    highestSuccessRate = metrics.anthropic.successRate;
  }
  
  if (metrics.ollama.successRate > highestSuccessRate) {
    mostReliableModel = 'Ollama (llama2)';
    highestSuccessRate = metrics.ollama.successRate;
  }
  
  // Determine the fastest model
  let fastestModel = 'OpenAI (gpt-3.5-turbo)';
  let lowestAvgTime = metrics.openai.avgTime;
  
  if (metrics.anthropic.avgTime < lowestAvgTime && metrics.anthropic.count > 0) {
    fastestModel = 'Anthropic (claude-instant-1)';
    lowestAvgTime = metrics.anthropic.avgTime;
  }
  
  if (metrics.ollama.avgTime < lowestAvgTime && metrics.ollama.count > 0) {
    fastestModel = 'Ollama (llama2)';
    lowestAvgTime = metrics.ollama.avgTime;
  }
  
  console.log(`\n${colors.bright}Most reliable model: ${colors.green}${mostReliableModel}${colors.reset}${colors.bright} (${highestSuccessRate.toFixed(2)}%)${colors.reset}`);
  console.log(`${colors.bright}Fastest model: ${colors.green}${fastestModel}${colors.reset}${colors.bright} (${lowestAvgTime.toFixed(2)} ms)${colors.reset}\n`);
  
  console.log(`${colors.bright}${colors.yellow}RECOMMENDATIONS FOR FALLBACK MECHANISM${colors.reset}\n`);
  
  console.log(`${colors.bright}Recommended priority order:${colors.reset}`);
  
  // Determine recommended priority order (weighting: 70% reliability, 30% speed)
  const modelScores = [
    { 
      name: 'OpenAI (gpt-3.5-turbo)', 
      score: metrics.openai.successRate * 0.7 + (metrics.openai.avgTime > 0 ? (1000 / metrics.openai.avgTime) * 0.3 : 0)
    },
    { 
      name: 'Anthropic (claude-instant-1)', 
      score: metrics.anthropic.successRate * 0.7 + (metrics.anthropic.avgTime > 0 ? (1000 / metrics.anthropic.avgTime) * 0.3 : 0)
    },
    { 
      name: 'Ollama (llama2)', 
      score: metrics.ollama.successRate * 0.7 + (metrics.ollama.avgTime > 0 ? (1000 / metrics.ollama.avgTime) * 0.3 : 0)
    }
  ];
  
  // Sort models by score
  modelScores.sort((a, b) => b.score - a.score);
  
  // Print recommended priority order
  modelScores.forEach((model, index) => {
    console.log(`${index + 1}. ${model.name}`);
  });
  
  console.log(`\n${colors.bright}Recommendations for improving the fallback mechanism:${colors.reset}`);
  console.log(`1. Use the AIGateway class's processAIRequestWithFallback method, which automatically switches to another model in error situations.`);
  console.log(`2. Set models in priority order according to the recommendation above.`);
  console.log(`3. Add different error type detection to error handling (timeout, rate_limit_exceeded, service_unavailable).`);
  console.log(`4. Implement adding a delay before retrying, especially for rate_limit_exceeded errors.`);
  console.log(`5. Add metrics collection for different models' performance and error situations.`);
  
  console.log(`\n${colors.bright}Notes:${colors.reset}`);
  console.log(`- The fallback mechanism should return a structured error object instead of throwing errors.`);
  console.log(`- Ensure that the system can recover from a situation where all service providers fail.`);
  console.log(`- Consider implementing a queue system during high load.`);
}

// Helper function for text alignment
function padRight(text, length) {
  return text + ' '.repeat(Math.max(0, length - text.length));
}

// Main program
const resultFile = findLatestResultFile();
if (resultFile) {
  const metrics = analyzeResults(resultFile);
  printSummary(metrics);
}
