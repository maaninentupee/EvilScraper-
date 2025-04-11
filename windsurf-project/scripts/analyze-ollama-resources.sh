#!/bin/bash

# Ollama Resource Analysis Script
# This script monitors Ollama's resource usage during a load test

echo "Starting Ollama resource analysis..."

# Check if Ollama is running
if ! curl -s http://localhost:11434/api/tags > /dev/null; then
  echo "Error: Ollama is not running. Please start Ollama first."
  exit 1
fi

# Check if Windsurf server is running
if ! curl -s http://localhost:3001/health > /dev/null; then
  echo "Error: Windsurf server is not running. Please start the server with 'npm run dev' first."
  exit 1
fi

# Create output directory
OUTPUT_DIR="./ollama-resource-analysis-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUTPUT_DIR"
echo "Results will be saved to $OUTPUT_DIR"

# Function to get Ollama process info
get_ollama_info() {
  local SAMPLE=$1
  local OUTPUT_FILE="$OUTPUT_DIR/sample-$SAMPLE.txt"
  
  echo "=== Ollama Process Info ===" | tee -a "$OUTPUT_FILE"
  ps aux | grep ollama | grep -v grep | tee -a "$OUTPUT_FILE"
  echo "" | tee -a "$OUTPUT_FILE"
  
  # Get Ollama process IDs
  OLLAMA_PIDS=$(pgrep ollama)
  
  # Get detailed memory info for each Ollama process
  for PID in $OLLAMA_PIDS; do
    echo "=== Process $PID Memory Info ===" | tee -a "$OUTPUT_FILE"
    ps -o pid,rss,%mem,%cpu,command -p $PID | tee -a "$OUTPUT_FILE"
  done
  
  echo "" | tee -a "$OUTPUT_FILE"
  echo "=== System Memory Status ===" | tee -a "$OUTPUT_FILE"
  vm_stat | tee -a "$OUTPUT_FILE"
  
  echo "" | tee -a "$OUTPUT_FILE"
  echo "=== System Load ===" | tee -a "$OUTPUT_FILE"
  top -l 1 | head -n 10 | tee -a "$OUTPUT_FILE"
  
  echo "" | tee -a "$OUTPUT_FILE"
  echo "=== Swap Usage ===" | tee -a "$OUTPUT_FILE"
  sysctl vm.swapusage | tee -a "$OUTPUT_FILE"
  
  echo "" | tee -a "$OUTPUT_FILE"
  echo "=== CPU Usage Per Core ===" | tee -a "$OUTPUT_FILE"
  iostat -c 2 | tee -a "$OUTPUT_FILE"
}

# Warm up Ollama first
echo "Warming up Ollama models..."
curl -s -X POST http://localhost:11434/api/generate -d '{ "model": "mistral", "prompt": "Hello", "stream": false }' > /dev/null
curl -s -X POST http://localhost:11434/api/generate -d '{ "model": "codellama:7b-code", "prompt": "Hello", "stream": false }' > /dev/null
curl -s -X POST http://localhost:11434/api/generate -d '{ "model": "llama2:13b", "prompt": "Hello", "stream": false }' > /dev/null
echo "Warmup completed."

# Get baseline resource usage
echo ""
echo "=== BASELINE RESOURCE USAGE ==="
get_ollama_info "baseline"

# Run load test
echo ""
echo "=== RUNNING LOAD TEST ==="
echo "Starting load test with 2 concurrent requests..."

# Run load test in background
curl -X POST http://localhost:3001/ai/load-test/ollama -H "Content-Type: application/json" -d '{"prompt": "Write a function to calculate fibonacci numbers", "iterations": 2}' > /dev/null &
LOAD_TEST_PID=$!

# Monitor CPU usage with top (non-interactive)
echo ""
echo "=== CPU USAGE SNAPSHOT ==="
top -l 1 | head -n 20 | tee -a "$OUTPUT_DIR/cpu-snapshot.txt"

# Monitor resource usage during load test
for i in {1..5}; do
  echo ""
  echo "=== RESOURCE USAGE DURING LOAD TEST (Sample $i) ==="
  get_ollama_info "during-$i"
  sleep 5
done

# Wait for load test to complete
wait $LOAD_TEST_PID

# Final resource check after load test
echo ""
echo "=== RESOURCE USAGE AFTER LOAD TEST ==="
get_ollama_info "after"

# Generate summary report
echo ""
echo "Generating summary report..."
{
  echo "# Ollama Resource Analysis Summary"
  echo "Date: $(date)"
  echo ""
  echo "## Models Available"
  curl -s http://localhost:11434/api/tags | jq .
  echo ""
  echo "## CPU Usage Summary"
  grep "%cpu" "$OUTPUT_DIR"/*.txt | sort
  echo ""
  echo "## Memory Usage Summary"
  grep "%mem" "$OUTPUT_DIR"/*.txt | sort
} > "$OUTPUT_DIR/summary.md"

echo ""
echo "Resource analysis completed. Results saved to $OUTPUT_DIR/summary.md"
