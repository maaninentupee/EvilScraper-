#!/bin/bash

# This script creates a response time chart based on a CSV file
# Usage: ./create-response-time-chart.sh [csv-file]

CSV_FILE=$1
OUTPUT_DIR="./results/charts"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
PNG_OUTPUT="${OUTPUT_DIR}/response_time_chart_${TIMESTAMP}.png"
HTML_OUTPUT="${OUTPUT_DIR}/response_time_chart_${TIMESTAMP}.html"

# Ensure that the output directory exists
mkdir -p $OUTPUT_DIR

if [ -z "$CSV_FILE" ]; then
  echo "Error: CSV file not specified."
  echo "Usage: ./create-response-time-chart.sh [csv-file]"
  exit 1
fi

if [ ! -f "$CSV_FILE" ]; then
  echo "Error: CSV file $CSV_FILE not found."
  exit 1
fi

echo "Creating chart from file: $CSV_FILE"
echo "Chart will be saved to file: $PNG_OUTPUT"

# Check if gnuplot is installed
if ! command -v gnuplot &> /dev/null; then
  echo "Warning: gnuplot is not installed. Creating HTML chart as an alternative."
  
  # Create a simple HTML chart using Chart.js
  echo "<!DOCTYPE html>
<html>
<head>
  <title>Load Test Results</title>
  <script src=\"https://cdn.jsdelivr.net/npm/chart.js\"></script>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .container { max-width: 1200px; margin: 0 auto; }
    .chart-container { height: 400px; margin-bottom: 30px; }
  </style>
</head>
<body>
  <div class=\"container\">
    <h1>Load Test Results</h1>
    <p>Test results: $(basename $CSV_FILE)</p>
    <p>Generated: $(date)</p>
    
    <h2>HTTP Request Duration</h2>
    <div class=\"chart-container\">
      <canvas id=\"httpDurationChart\"></canvas>
    </div>
    
    <h2>AI Processing Time</h2>
    <div class=\"chart-container\">
      <canvas id=\"aiProcessingChart\"></canvas>
    </div>
    
    <h2>Error Rate</h2>
    <div class=\"chart-container\">
      <canvas id=\"errorRateChart\"></canvas>
    </div>
  </div>

  <script>
    // Load CSV file
    fetch('$(basename $CSV_FILE)')
      .then(response => response.text())
      .then(csvData => {
        // Parse CSV data
        const lines = csvData.split('\\n');
        const headers = lines[0].split(',');
        const data = [];
        
        for (let i = 1; i < lines.length; i++) {
          if (lines[i].trim() === '') continue;
          const values = lines[i].split(',');
          data.push({
            timestamp: values[0],
            metric: values[1],
            value: parseFloat(values[2])
          });
        }
        
        // Sort data by timestamp
        data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        // Separate different metrics
        const httpDuration = data.filter(item => item.metric.includes('http_req_duration'));
        const aiProcessing = data.filter(item => item.metric.includes('ai_processing_time'));
        const errorRate = data.filter(item => item.metric.includes('error_rate'));
        
        // Create charts
        createChart('httpDurationChart', httpDuration, 'HTTP Request Duration (ms)', 'blue');
        createChart('aiProcessingChart', aiProcessing, 'AI Processing Time (ms)', 'green');
        createChart('errorRateChart', errorRate, 'Error Rate (%)', 'red');
      });
    
    function createChart(canvasId, data, label, color) {
      if (data.length === 0) return;
      
      const ctx = document.getElementById(canvasId).getContext('2d');
      
      const timestamps = data.map(item => new Date(item.timestamp).toLocaleTimeString());
      const values = data.map(item => item.value);
      
      new Chart(ctx, {
        type: 'line',
        data: {
          labels: timestamps,
          datasets: [{
            label: label,
            data: values,
            borderColor: color,
            backgroundColor: color + '20',
            tension: 0.1,
            fill: true
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true
            }
          }
        }
      });
    }
  </script>
</body>
</html>" > $HTML_OUTPUT
  
  echo "HTML chart created: $HTML_OUTPUT"
  exit 0
fi

# Create gnuplot script
GNUPLOT_SCRIPT=$(mktemp)

echo "set terminal png size 1200,800
set output '$PNG_OUTPUT'
set title 'Load Test Results'
set xlabel 'Time'
set ylabel 'Value'
set grid
set key outside right top
set datafile separator ','

# Format timestamp
set xdata time
set timefmt '%Y-%m-%dT%H:%M:%S'
set format x '%H:%M:%S'

# Plot HTTP request duration
plot '$CSV_FILE' using 1:3 with lines title 'HTTP Request Duration (ms)' lc rgb 'blue' smooth bezier,\\
     '$CSV_FILE' using 1:3 with points title '' lc rgb 'blue' pt 7 ps 0.5

# Plot AI processing time, if available
if (system('grep ai_processing_time $CSV_FILE > /dev/null') == 0) {
  set output '${PNG_OUTPUT%.png}_ai.png'
  plot '$CSV_FILE' using 1:(\$2 eq 'ai_processing_time' ? \$3 : 1/0) with lines title 'AI Processing Time (ms)' lc rgb 'green' smooth bezier,\\
       '$CSV_FILE' using 1:(\$2 eq 'ai_processing_time' ? \$3 : 1/0) with points title '' lc rgb 'green' pt 7 ps 0.5
}

# Plot error rate
set output '${PNG_OUTPUT%.png}_error.png'
plot '$CSV_FILE' using 1:(\$2 eq 'error_rate' ? \$3*100 : 1/0) with lines title 'Error Rate (%)' lc rgb 'red' smooth bezier,\\
     '$CSV_FILE' using 1:(\$2 eq 'error_rate' ? \$3*100 : 1/0) with points title '' lc rgb 'red' pt 7 ps 0.5" > $GNUPLOT_SCRIPT

# Run gnuplot
gnuplot $GNUPLOT_SCRIPT

# Clean up temporary files
rm $GNUPLOT_SCRIPT

echo "Chart created successfully!"
echo "Files:"
echo "- ${PNG_OUTPUT}"
echo "- ${PNG_OUTPUT%.png}_ai.png"
echo "- ${PNG_OUTPUT%.png}_error.png"
