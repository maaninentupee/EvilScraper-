#!/bin/bash

# Ollama Resource Analysis Script (Extended Version)
# This script performs a more comprehensive analysis of Ollama's resource usage
# during various load scenarios and with different models

echo "Starting Extended Ollama Resource Analysis..."

# Create output directory with timestamp
OUTPUT_DIR="./ollama-resource-analysis-extended-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUTPUT_DIR"
echo "Results will be saved to $OUTPUT_DIR"

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

# Function to get available models
get_available_models() {
  echo "Fetching available Ollama models..."
  curl -s http://localhost:11434/api/tags | jq -r '.models[].name' > "$OUTPUT_DIR/available_models.txt"
  echo "Available models:"
  cat "$OUTPUT_DIR/available_models.txt"
}

# Function to get system specs
get_system_specs() {
  echo "Collecting system specifications..."
  {
    echo "## System Specifications"
    echo ""
    echo "### CPU Information"
    sysctl -n machdep.cpu.brand_string
    echo "Cores: $(sysctl -n hw.physicalcpu)"
    echo "Logical CPUs: $(sysctl -n hw.logicalcpu)"
    echo ""
    echo "### Memory Information"
    echo "Physical Memory: $(sysctl -n hw.memsize | awk '{print $1/1024/1024/1024 " GB"}')"
    echo "Swap: $(sysctl vm.swapusage | awk '{print $4}')"
    echo ""
    echo "### Operating System"
    sw_vers
  } > "$OUTPUT_DIR/system_specs.md"
}

# Function to get Ollama process info
get_ollama_info() {
  local SAMPLE=$1
  local MODEL=$2
  local CONCURRENCY=$3
  local OUTPUT_FILE="$OUTPUT_DIR/${MODEL}_concurrency_${CONCURRENCY}_sample_${SAMPLE}.txt"
  
  echo "=== Ollama Process Info ===" | tee -a "$OUTPUT_FILE"
  ps aux | grep ollama | grep -v grep | tee -a "$OUTPUT_FILE"
  echo "" | tee -a "$OUTPUT_FILE"
  
  # Get Ollama process IDs
  OLLAMA_PIDS=$(pgrep ollama)
  
  # Get detailed memory info for each Ollama process
  for PID in $OLLAMA_PIDS; do
    echo "=== Process $PID Memory Info ===" | tee -a "$OUTPUT_FILE"
    ps -o pid,rss,%mem,%cpu,command -p $PID | tee -a "$OUTPUT_FILE"
    
    # Get memory map for the process (macOS)
    echo "=== Process $PID Memory Map ===" | tee -a "$OUTPUT_FILE"
    vmmap -summary $PID 2>/dev/null | head -n 20 | tee -a "$OUTPUT_FILE"
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
  
  echo "" | tee -a "$OUTPUT_FILE"
  echo "=== Network Activity ===" | tee -a "$OUTPUT_FILE"
  netstat -i | head -n 10 | tee -a "$OUTPUT_FILE"
  
  echo "" | tee -a "$OUTPUT_FILE"
  echo "=== Disk Activity ===" | tee -a "$OUTPUT_FILE"
  iostat -d 2 | head -n 10 | tee -a "$OUTPUT_FILE"
}

# Function to run load test with specific model and concurrency
run_load_test() {
  local MODEL=$1
  local CONCURRENCY=$2
  local ITERATIONS=$3
  local PROMPT=$4
  
  echo ""
  echo "=== RUNNING LOAD TEST ==="
  echo "Model: $MODEL"
  echo "Concurrency: $CONCURRENCY"
  echo "Iterations: $ITERATIONS"
  echo "Prompt: $PROMPT"
  
  # Warm up model first
  echo "Warming up $MODEL model..."
  curl -s -X POST http://localhost:11434/api/generate -d "{ \"model\": \"$MODEL\", \"prompt\": \"Hello\", \"stream\": false }" > /dev/null
  
  # Get baseline resource usage
  echo ""
  echo "=== BASELINE RESOURCE USAGE FOR $MODEL ==="
  get_ollama_info "baseline" "$MODEL" "$CONCURRENCY"
  
  # Run load test
  echo ""
  echo "Starting load test with $CONCURRENCY concurrent requests..."
  
  # Run load test in background
  curl -X POST "http://localhost:3001/ai/load-test/ollama" \
    -H "Content-Type: application/json" \
    -d "{\"prompt\": \"$PROMPT\", \"iterations\": $ITERATIONS, \"model\": \"$MODEL\", \"concurrency\": $CONCURRENCY}" > "$OUTPUT_DIR/${MODEL}_concurrency_${CONCURRENCY}_response.json" &
  LOAD_TEST_PID=$!
  
  # Monitor resource usage during load test
  for i in {1..5}; do
    echo ""
    echo "=== RESOURCE USAGE DURING LOAD TEST (Sample $i) ==="
    get_ollama_info "during_$i" "$MODEL" "$CONCURRENCY"
    sleep 5
  done
  
  # Wait for load test to complete
  wait $LOAD_TEST_PID
  
  # Final resource check after load test
  echo ""
  echo "=== RESOURCE USAGE AFTER LOAD TEST ==="
  get_ollama_info "after" "$MODEL" "$CONCURRENCY"
  
  # Sleep to allow system to stabilize
  sleep 5
}

# Function to generate summary report
generate_summary_report() {
  echo ""
  echo "Generating summary report..."
  
  {
    echo "# Ollama Extended Resource Analysis Summary"
    echo "Date: $(date)"
    echo ""
    echo "## Models Tested"
    cat "$OUTPUT_DIR/available_models.txt" | while read MODEL; do
      echo "- $MODEL"
    done
    echo ""
    
    echo "## System Specifications"
    cat "$OUTPUT_DIR/system_specs.md"
    echo ""
    
    echo "## CPU Usage Summary"
    echo "### CPU Usage by Model and Concurrency"
    echo "| Model | Concurrency | Min CPU % | Max CPU % | Avg CPU % |"
    echo "|-------|-------------|-----------|-----------|-----------|"
    
    # Process each model's CPU usage
    cat "$OUTPUT_DIR/available_models.txt" | while read MODEL; do
      for CONCURRENCY in 1 2 5; do
        if ls "$OUTPUT_DIR/${MODEL}_concurrency_${CONCURRENCY}"* 1> /dev/null 2>&1; then
          MIN_CPU=$(grep "%cpu" "$OUTPUT_DIR/${MODEL}_concurrency_${CONCURRENCY}"*.txt | awk '{print $4}' | sort -n | head -n 1)
          MAX_CPU=$(grep "%cpu" "$OUTPUT_DIR/${MODEL}_concurrency_${CONCURRENCY}"*.txt | awk '{print $4}' | sort -n | tail -n 1)
          AVG_CPU=$(grep "%cpu" "$OUTPUT_DIR/${MODEL}_concurrency_${CONCURRENCY}"*.txt | awk '{sum+=$4; count++} END {print sum/count}')
          echo "| $MODEL | $CONCURRENCY | $MIN_CPU | $MAX_CPU | $AVG_CPU |"
        fi
      done
    done
    
    echo ""
    echo "## Memory Usage Summary"
    echo "### Memory Usage by Model and Concurrency"
    echo "| Model | Concurrency | Min Mem % | Max Mem % | Avg Mem % |"
    echo "|-------|-------------|-----------|-----------|-----------|"
    
    # Process each model's memory usage
    cat "$OUTPUT_DIR/available_models.txt" | while read MODEL; do
      for CONCURRENCY in 1 2 5; do
        if ls "$OUTPUT_DIR/${MODEL}_concurrency_${CONCURRENCY}"* 1> /dev/null 2>&1; then
          MIN_MEM=$(grep "%mem" "$OUTPUT_DIR/${MODEL}_concurrency_${CONCURRENCY}"*.txt | awk '{print $3}' | sort -n | head -n 1)
          MAX_MEM=$(grep "%mem" "$OUTPUT_DIR/${MODEL}_concurrency_${CONCURRENCY}"*.txt | awk '{print $3}' | sort -n | tail -n 1)
          AVG_MEM=$(grep "%mem" "$OUTPUT_DIR/${MODEL}_concurrency_${CONCURRENCY}"*.txt | awk '{sum+=$3; count++} END {print sum/count}')
          echo "| $MODEL | $CONCURRENCY | $MIN_MEM | $MAX_MEM | $AVG_MEM |"
        fi
      done
    done
    
    echo ""
    echo "## Response Time Analysis"
    echo "### Average Response Time by Model and Concurrency"
    echo "| Model | Concurrency | Avg Response Time (ms) |"
    echo "|-------|-------------|------------------------|"
    
    # Process each model's response time
    cat "$OUTPUT_DIR/available_models.txt" | while read MODEL; do
      for CONCURRENCY in 1 2 5; do
        if [ -f "$OUTPUT_DIR/${MODEL}_concurrency_${CONCURRENCY}_response.json" ]; then
          RESPONSE_TIME=$(cat "$OUTPUT_DIR/${MODEL}_concurrency_${CONCURRENCY}_response.json" | jq '.averageResponseTime // "N/A"')
          echo "| $MODEL | $CONCURRENCY | $RESPONSE_TIME |"
        fi
      done
    done
    
  } > "$OUTPUT_DIR/extended_summary.md"
  
  echo "Extended summary report generated: $OUTPUT_DIR/extended_summary.md"
}

# Main execution
get_system_specs
get_available_models

# Test each model with different concurrency levels
cat "$OUTPUT_DIR/available_models.txt" | while read MODEL; do
  # Test with single request
  run_load_test "$MODEL" 1 1 "Write a function to calculate fibonacci numbers"
  
  # Test with 2 concurrent requests
  run_load_test "$MODEL" 2 2 "Write a function to calculate fibonacci numbers"
  
  # Test with 5 concurrent requests (if system can handle it)
  run_load_test "$MODEL" 5 5 "Write a function to calculate fibonacci numbers"
done

# Generate summary report
generate_summary_report

echo ""
echo "Extended resource analysis completed. Results saved to $OUTPUT_DIR/extended_summary.md"
