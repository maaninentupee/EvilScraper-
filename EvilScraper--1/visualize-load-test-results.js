const fs = require('fs');
const path = require('path');

// Configuration
const resultsDir = path.join(__dirname, 'load-test-results');
const outputFile = path.join(__dirname, 'load-test-report.html');

// Check if results directory exists
if (!fs.existsSync(resultsDir)) {
  console.error(`Results directory not found: ${resultsDir}`);
  console.error('Run load tests first to generate results.');
  process.exit(1);
}

// Get all result files
const resultFiles = fs.readdirSync(resultsDir)
  .filter(file => file.endsWith('.json'))
  .map(file => path.join(resultsDir, file));

if (resultFiles.length === 0) {
  console.error('No result files found. Run load tests first to generate results.');
  process.exit(1);
}

// Parse result files
const allResults = [];
resultFiles.forEach(file => {
  try {
    const content = fs.readFileSync(file, 'utf8');
    const result = JSON.parse(content);
    
    // Add filename and timestamp
    const filename = path.basename(file);
    const match = filename.match(/load-test-(.+)\.json/);
    const timestamp = match ? match[1] : 'unknown';
    
    allResults.push({
      timestamp,
      filename,
      data: result
    });
  } catch (error) {
    console.error(`Error parsing ${file}: ${error.message}`);
  }
});

// Sort results by timestamp (newest first)
allResults.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

// Generate HTML report
function generateHtml() {
  // Helper function to format numbers
  const formatNumber = (num) => {
    if (typeof num !== 'number') return 'N/A';
    return num.toFixed(2);
  };
  
  // Generate endpoint summary table
  const generateEndpointSummary = (result) => {
    let html = '<table class="table table-striped">';
    html += '<thead><tr><th>Endpoint</th><th>Requests/sec</th><th>Avg Latency (ms)</th><th>P99 Latency (ms)</th><th>Errors</th></tr></thead>';
    html += '<tbody>';
    
    for (const [endpoint, data] of Object.entries(result.data)) {
      const requests = data.requests ? data.requests.average : 'N/A';
      const avgLatency = data.latency ? data.latency.average : 'N/A';
      const p99Latency = data.latency ? data.latency.p99 : 'N/A';
      const errors = data.errors || 0;
      
      html += `<tr>
        <td>${endpoint}</td>
        <td>${formatNumber(requests)}</td>
        <td>${formatNumber(avgLatency)}</td>
        <td>${formatNumber(p99Latency)}</td>
        <td>${errors}</td>
      </tr>`;
    }
    
    html += '</tbody></table>';
    return html;
  };
  
  // Generate AI provider summary table
  const generateProviderSummary = (result) => {
    if (!result.data.provider) return '<p>No AI provider data available</p>';
    
    const data = result.data;
    let html = '<table class="table table-striped">';
    html += '<thead><tr><th>Provider</th><th>Model</th><th>Success Rate</th><th>Avg Duration (ms)</th><th>Total Duration (ms)</th><th>Iterations</th></tr></thead>';
    html += '<tbody>';
    
    html += `<tr>
      <td>${data.provider}</td>
      <td>${data.model || 'N/A'}</td>
      <td>${formatNumber(data.successRate)}%</td>
      <td>${formatNumber(data.averageDuration)}</td>
      <td>${formatNumber(data.totalDuration)}</td>
      <td>${data.iterations}</td>
    </tr>`;
    
    html += '</tbody></table>';
    
    // Add detailed results if available
    if (data.results && data.results.length > 0) {
      html += '<h5>Detailed Results</h5>';
      html += '<table class="table table-sm">';
      html += '<thead><tr><th>Request ID</th><th>Success</th><th>Duration (ms)</th><th>Text Length</th><th>Error</th></tr></thead>';
      html += '<tbody>';
      
      data.results.forEach(result => {
        html += `<tr class="${result.success ? 'table-success' : 'table-danger'}">
          <td>${result.requestId}</td>
          <td>${result.success ? '✅' : '❌'}</td>
          <td>${result.duration || 'N/A'}</td>
          <td>${result.textLength || 'N/A'}</td>
          <td>${result.error || ''}</td>
        </tr>`;
      });
      
      html += '</tbody></table>';
    }
    
    return html;
  };
  
  // Generate charts data
  const generateChartData = () => {
    // Extract data for charts
    const timestamps = [];
    const throughputData = [];
    const latencyData = [];
    const successRateData = [];
    
    allResults.forEach(result => {
      const timestamp = result.timestamp.replace('T', ' ').substring(0, 19);
      timestamps.push(timestamp);
      
      // For autocannon results
      if (result.data.Root && result.data.Root.requests) {
        throughputData.push(result.data.Root.requests.average);
        latencyData.push(result.data.Root.latency.average);
        successRateData.push(100 - (result.data.Root.non2xx / result.data.Root.requests.total * 100));
      } 
      // For AI provider results
      else if (result.data.provider) {
        throughputData.push(result.data.iterations / (result.data.totalDuration / 1000));
        latencyData.push(result.data.averageDuration);
        successRateData.push(result.data.successRate);
      }
    });
    
    return {
      timestamps: JSON.stringify(timestamps.reverse()),
      throughputData: JSON.stringify(throughputData.reverse()),
      latencyData: JSON.stringify(latencyData.reverse()),
      successRateData: JSON.stringify(successRateData.reverse())
    };
  };
  
  const chartData = generateChartData();
  
  // Generate full HTML
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Windsurf Load Test Results</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    body { padding: 20px; }
    .result-card { margin-bottom: 20px; }
    .chart-container { height: 300px; margin-bottom: 30px; }
  </style>
</head>
<body>
  <div class="container">
    <h1 class="mb-4">Windsurf Load Test Results</h1>
    
    <div class="row">
      <div class="col-md-12">
        <div class="card mb-4">
          <div class="card-header">
            <h3>Performance Trends</h3>
          </div>
          <div class="card-body">
            <div class="row">
              <div class="col-md-6">
                <div class="chart-container">
                  <canvas id="throughputChart"></canvas>
                </div>
              </div>
              <div class="col-md-6">
                <div class="chart-container">
                  <canvas id="latencyChart"></canvas>
                </div>
              </div>
            </div>
            <div class="row">
              <div class="col-md-6">
                <div class="chart-container">
                  <canvas id="successRateChart"></canvas>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <h2>Test Results</h2>
    <div class="row">
      ${allResults.map((result, index) => `
        <div class="col-md-12">
          <div class="card result-card">
            <div class="card-header">
              <h4>Test Run: ${result.timestamp.replace('T', ' ')}</h4>
            </div>
            <div class="card-body">
              ${result.data.Root ? generateEndpointSummary(result) : generateProviderSummary(result)}
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  </div>
  
  <script>
    // Chart data
    const timestamps = ${chartData.timestamps};
    const throughputData = ${chartData.throughputData};
    const latencyData = ${chartData.latencyData};
    const successRateData = ${chartData.successRateData};
    
    // Create charts
    const throughputChart = new Chart(
      document.getElementById('throughputChart'),
      {
        type: 'line',
        data: {
          labels: timestamps,
          datasets: [{
            label: 'Throughput (req/sec)',
            data: throughputData,
            borderColor: 'rgb(75, 192, 192)',
            tension: 0.1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Requests per second'
              }
            }
          }
        }
      }
    );
    
    const latencyChart = new Chart(
      document.getElementById('latencyChart'),
      {
        type: 'line',
        data: {
          labels: timestamps,
          datasets: [{
            label: 'Average Latency (ms)',
            data: latencyData,
            borderColor: 'rgb(255, 99, 132)',
            tension: 0.1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Milliseconds'
              }
            }
          }
        }
      }
    );
    
    const successRateChart = new Chart(
      document.getElementById('successRateChart'),
      {
        type: 'line',
        data: {
          labels: timestamps,
          datasets: [{
            label: 'Success Rate (%)',
            data: successRateData,
            borderColor: 'rgb(54, 162, 235)',
            tension: 0.1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              min: 0,
              max: 100,
              title: {
                display: true,
                text: 'Success Rate (%)'
              }
            }
          }
        }
      }
    );
  </script>
</body>
</html>`;
}

// Write HTML report
const html = generateHtml();
fs.writeFileSync(outputFile, html);

console.log(`Load test report generated: ${outputFile}`);
console.log(`Open this file in your browser to view the report.`);
