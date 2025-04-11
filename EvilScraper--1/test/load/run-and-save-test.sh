#!/bin/bash

# This script runs a load test and saves the results in JSON format
# Usage: ./run-and-save-test.sh [test_script] [duration_in_minutes]

TEST_SCRIPT=${1:-"load-test.js"}
DURATION=${2:-2}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RESULTS_DIR="./results"
JSON_OUTPUT="${RESULTS_DIR}/test_results_${TIMESTAMP}.json"
CSV_OUTPUT="${RESULTS_DIR}/test_results_${TIMESTAMP}.csv"
SUMMARY_OUTPUT="${RESULTS_DIR}/test_summary_${TIMESTAMP}.txt"

# Ensure that the results directory exists
mkdir -p $RESULTS_DIR

echo "Running load test: $TEST_SCRIPT"
echo "Duration: $DURATION minutes"
echo "Results will be saved to file: $JSON_OUTPUT"

# Start resource monitoring in the background
./monitor-resources.sh node $((DURATION * 60)) &
MONITOR_PID=$!

# Run the load test and save the results in JSON format
k6 run --out json=$JSON_OUTPUT $TEST_SCRIPT

# Wait for the resource monitoring to finish
wait $MONITOR_PID

# Create a summary of the test results
echo "Creating a summary of the test results..."

# Convert JSON to CSV for basic metrics
echo "Converting results to CSV format..."
echo "timestamp,metric,value" > $CSV_OUTPUT
cat $JSON_OUTPUT | grep -E '"metric":"(http_req_duration|error_rate|ai_processing_time|openai_processing_time|anthropic_processing_time|ollama_processing_time|short_prompt_time|long_prompt_time)"' | grep '"type":"Point"' | jq -r '[.data.time, .metric, .data.value] | @csv' >> $CSV_OUTPUT

# Create a summary
echo "Load test summary - $(date)" > $SUMMARY_OUTPUT
echo "Test: $TEST_SCRIPT" >> $SUMMARY_OUTPUT
echo "Run time: $(date -r $JSON_OUTPUT)" >> $SUMMARY_OUTPUT
echo "Number of iterations: $(grep -c '"metric":"iterations"' $JSON_OUTPUT)" >> $SUMMARY_OUTPUT
echo "Number of virtual users: $(cat $JSON_OUTPUT | grep '"metric":"vus"' | grep '"type":"Point"' | jq -r '.data.value' | sort -nr | head -1)" >> $SUMMARY_OUTPUT
echo "" >> $SUMMARY_OUTPUT

# Add key metrics to the summary
echo "Key metrics:" >> $SUMMARY_OUTPUT
echo "=============" >> $SUMMARY_OUTPUT

# HTTP request duration
HTTP_VALUES=$(cat $JSON_OUTPUT | grep '"metric":"http_req_duration"' | grep '"type":"Point"' | jq -r '.data.value')
HTTP_AVG=$(echo "$HTTP_VALUES" | awk '{ sum += $1; n++ } END { if (n > 0) print sum / n; else print "N/A" }')
HTTP_MIN=$(echo "$HTTP_VALUES" | sort -n | head -1)
HTTP_MAX=$(echo "$HTTP_VALUES" | sort -n | tail -1)
HTTP_P95=$(echo "$HTTP_VALUES" | sort -n | awk '{ values[NR] = $1 } END { if (NR > 0) print values[int(NR * 0.95)]; else print "N/A" }')

echo "HTTP request duration (ms):" >> $SUMMARY_OUTPUT
echo "  Average: $HTTP_AVG" >> $SUMMARY_OUTPUT
echo "  Minimum: $HTTP_MIN" >> $SUMMARY_OUTPUT
echo "  Maximum: $HTTP_MAX" >> $SUMMARY_OUTPUT
echo "  95th percentile: $HTTP_P95" >> $SUMMARY_OUTPUT
echo "" >> $SUMMARY_OUTPUT

# Error rate and error details
ERROR_VALUES=$(cat $JSON_OUTPUT | grep '"metric":"error_rate"' | grep '"type":"Point"' | jq -r '.data.value')
ERROR_RATE=$(echo "$ERROR_VALUES" | awk '{ sum += $1; n++ } END { if (n > 0) print sum / n * 100; else print "N/A" }')
echo "Error rate: $ERROR_RATE%" >> $SUMMARY_OUTPUT

# Successful and failed requests
SUCCESS_COUNT=$(cat $JSON_OUTPUT | grep '"metric":"successful_requests"' | grep '"type":"Counter"' | tail -1 | jq -r '.data.value')
FAILED_COUNT=$(cat $JSON_OUTPUT | grep '"metric":"failed_requests"' | grep '"type":"Counter"' | tail -1 | jq -r '.data.value')

if [ "$SUCCESS_COUNT" != "" ] && [ "$FAILED_COUNT" != "" ]; then
  TOTAL_REQUESTS=$((SUCCESS_COUNT + FAILED_COUNT))
  SUCCESS_PERCENT=$(echo "scale=2; $SUCCESS_COUNT * 100 / $TOTAL_REQUESTS" | bc -l)
  FAILED_PERCENT=$(echo "scale=2; $FAILED_COUNT * 100 / $TOTAL_REQUESTS" | bc -l)
  
  echo "Successful requests: $SUCCESS_COUNT ($SUCCESS_PERCENT%)" >> $SUMMARY_OUTPUT
  echo "Failed requests: $FAILED_COUNT ($FAILED_PERCENT%)" >> $SUMMARY_OUTPUT
fi

# Find error messages in the log
echo "\nMost common errors:" >> $SUMMARY_OUTPUT
echo "==================" >> $SUMMARY_OUTPUT
cat $JSON_OUTPUT | grep '"Body"' | jq -r '.Body' | sort | uniq -c | sort -nr | head -5 >> $SUMMARY_OUTPUT
echo "" >> $SUMMARY_OUTPUT

# AI processing time, if available
if grep -q '"metric":"ai_processing_time"' $JSON_OUTPUT; then
  AI_VALUES=$(cat $JSON_OUTPUT | grep '"metric":"ai_processing_time"' | grep '"type":"Point"' | jq -r '.data.value')
  AI_AVG=$(echo "$AI_VALUES" | awk '{ sum += $1; n++ } END { if (n > 0) print sum / n; else print "N/A" }')
  AI_MIN=$(echo "$AI_VALUES" | sort -n | head -1)
  AI_MAX=$(echo "$AI_VALUES" | sort -n | tail -1)
  AI_P95=$(echo "$AI_VALUES" | sort -n | awk '{ values[NR] = $1 } END { if (NR > 0) print values[int(NR * 0.95)]; else print "N/A" }')

  echo "AI processing time (ms):" >> $SUMMARY_OUTPUT
  echo "  Average: $AI_AVG" >> $SUMMARY_OUTPUT
  echo "  Minimum: $AI_MIN" >> $SUMMARY_OUTPUT
  echo "  Maximum: $AI_MAX" >> $SUMMARY_OUTPUT
  echo "  95th percentile: $AI_P95" >> $SUMMARY_OUTPUT
  echo "" >> $SUMMARY_OUTPUT
fi

# Resource usage
RESOURCE_FILE=$(ls -t resource_usage_*.csv | head -1)
if [ -f "$RESOURCE_FILE" ]; then
  CPU_AVG=$(awk -F',' '{ sum += $2; n++ } END { print sum/n }' $RESOURCE_FILE)
  CPU_MAX=$(awk -F',' 'BEGIN { max=0 } { if($2>max) max=$2 } END { print max }' $RESOURCE_FILE)
  MEM_AVG=$(awk -F',' '{ sum += $3; n++ } END { print sum/n }' $RESOURCE_FILE)
  MEM_MAX=$(awk -F',' 'BEGIN { max=0 } { if($3>max) max=$3 } END { print max }' $RESOURCE_FILE)

  echo "Resource usage:" >> $SUMMARY_OUTPUT
  echo "  Average CPU usage: $CPU_AVG%" >> $SUMMARY_OUTPUT
  echo "  Maximum CPU usage: $CPU_MAX%" >> $SUMMARY_OUTPUT
  echo "  Average memory usage: $MEM_AVG MB" >> $SUMMARY_OUTPUT
  echo "  Maximum memory usage: $MEM_MAX MB" >> $SUMMARY_OUTPUT
fi

echo "Summary saved to file: $SUMMARY_OUTPUT"
echo "CSV file saved: $CSV_OUTPUT"
echo "JSON file saved: $JSON_OUTPUT"

# Create a graph of response times
echo "Creating a graph of response times..."
./create-response-time-chart.sh $CSV_OUTPUT

# Add model-specific metrics to the summary
echo "" >> $SUMMARY_OUTPUT
echo "Model-specific metrics:" >> $SUMMARY_OUTPUT
echo "=====================" >> $SUMMARY_OUTPUT

# OpenAI
if grep -q '"metric":"openai_processing_time"' $JSON_OUTPUT; then
  OPENAI_VALUES=$(cat $JSON_OUTPUT | grep '"metric":"openai_processing_time"' | grep '"type":"Point"' | jq -r '.data.value')
  OPENAI_AVG=$(echo "$OPENAI_VALUES" | awk '{ sum += $1; n++ } END { if (n > 0) print sum / n; else print "N/A" }')
  OPENAI_COUNT=$(echo "$OPENAI_VALUES" | wc -l)
  echo "OpenAI:" >> $SUMMARY_OUTPUT
  echo "  Number of requests: $OPENAI_COUNT" >> $SUMMARY_OUTPUT
  echo "  Average response time: $OPENAI_AVG ms" >> $SUMMARY_OUTPUT
fi

# Anthropic
if grep -q '"metric":"anthropic_processing_time"' $JSON_OUTPUT; then
  ANTHROPIC_VALUES=$(cat $JSON_OUTPUT | grep '"metric":"anthropic_processing_time"' | grep '"type":"Point"' | jq -r '.data.value')
  ANTHROPIC_AVG=$(echo "$ANTHROPIC_VALUES" | awk '{ sum += $1; n++ } END { if (n > 0) print sum / n; else print "N/A" }')
  ANTHROPIC_COUNT=$(echo "$ANTHROPIC_VALUES" | wc -l)
  echo "Anthropic:" >> $SUMMARY_OUTPUT
  echo "  Number of requests: $ANTHROPIC_COUNT" >> $SUMMARY_OUTPUT
  echo "  Average response time: $ANTHROPIC_AVG ms" >> $SUMMARY_OUTPUT
fi

# Ollama
if grep -q '"metric":"ollama_processing_time"' $JSON_OUTPUT; then
  OLLAMA_VALUES=$(cat $JSON_OUTPUT | grep '"metric":"ollama_processing_time"' | grep '"type":"Point"' | jq -r '.data.value')
  OLLAMA_AVG=$(echo "$OLLAMA_VALUES" | awk '{ sum += $1; n++ } END { if (n > 0) print sum / n; else print "N/A" }')
  OLLAMA_COUNT=$(echo "$OLLAMA_VALUES" | wc -l)
  echo "Ollama:" >> $SUMMARY_OUTPUT
  echo "  Number of requests: $OLLAMA_COUNT" >> $SUMMARY_OUTPUT
  echo "  Average response time: $OLLAMA_AVG ms" >> $SUMMARY_OUTPUT
fi

# Prompt-specific metrics
echo "" >> $SUMMARY_OUTPUT
echo "Prompt-specific metrics:" >> $SUMMARY_OUTPUT
echo "========================" >> $SUMMARY_OUTPUT

# Short prompt
if grep -q '"metric":"short_prompt_time"' $JSON_OUTPUT; then
  SHORT_VALUES=$(cat $JSON_OUTPUT | grep '"metric":"short_prompt_time"' | grep '"type":"Point"' | jq -r '.data.value')
  SHORT_AVG=$(echo "$SHORT_VALUES" | awk '{ sum += $1; n++ } END { if (n > 0) print sum / n; else print "N/A" }')
  SHORT_COUNT=$(echo "$SHORT_VALUES" | wc -l)
  echo "Short prompt:" >> $SUMMARY_OUTPUT
  echo "  Number of requests: $SHORT_COUNT" >> $SUMMARY_OUTPUT
  echo "  Average response time: $SHORT_AVG ms" >> $SUMMARY_OUTPUT
fi

# Long prompt
if grep -q '"metric":"long_prompt_time"' $JSON_OUTPUT; then
  LONG_VALUES=$(cat $JSON_OUTPUT | grep '"metric":"long_prompt_time"' | grep '"type":"Point"' | jq -r '.data.value')
  LONG_AVG=$(echo "$LONG_VALUES" | awk '{ sum += $1; n++ } END { if (n > 0) print sum / n; else print "N/A" }')
  LONG_COUNT=$(echo "$LONG_VALUES" | wc -l)
  echo "Long prompt:" >> $SUMMARY_OUTPUT
  echo "  Number of requests: $LONG_COUNT" >> $SUMMARY_OUTPUT
  echo "  Average response time: $LONG_AVG ms" >> $SUMMARY_OUTPUT
fi

echo "Load test and reporting complete!"
