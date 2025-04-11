#!/bin/bash

# Ollama warmup script
# This script preloads Ollama models into memory before running tests

echo "Starting Ollama warmup process at $(date)"
echo "=============================================="

# Create log directory if it doesn't exist
LOG_DIR="./logs"
mkdir -p "$LOG_DIR"
LOGFILE="$LOG_DIR/ollama-warmup-$(date +%Y%m%d-%H%M%S).log"
echo "Logging to $LOGFILE"

# Function to log messages
log() {
  echo "$1" | tee -a "$LOGFILE"
}

# Check if jq is installed
if ! command -v jq &> /dev/null; then
  log "Error: jq is not installed. Please install it first."
  log "You can install it with: brew install jq"
  exit 1
fi

# Check if bc is installed
if ! command -v bc &> /dev/null; then
  log "Error: bc is not installed. Please install it first."
  log "You can install it with: brew install bc"
  exit 1
fi

# Check if Ollama is running
log "Checking if Ollama service is running..."
if ! curl -s http://localhost:11434/api/tags > /dev/null; then
  log "Error: Ollama is not running. Please start Ollama first."
  log "You can download Ollama from https://ollama.com/"
  exit 1
fi

# Get available models
log "Available Ollama models:"
AVAILABLE_MODELS=$(curl -s http://localhost:11434/api/tags | jq -r '.models[].name')
echo "$AVAILABLE_MODELS" | tee -a "$LOGFILE"
echo "" | tee -a "$LOGFILE"

# Function to check if model exists
model_exists() {
  local MODEL=$1
  echo "$AVAILABLE_MODELS" | grep -q "^$MODEL$"
  return $?
}

# Function to warm up a model with timing
warmup_model() {
  local MODEL=$1
  local PROMPT=$2
  
  # Check if model exists
  if ! model_exists "$MODEL"; then
    log "⚠️ Warning: Model '$MODEL' is not available in Ollama."
    return 1
  fi
  
  log "Warming up $MODEL model..."
  
  # Measure time taken
  local START_TIME=$(date +%s.%N)
  
  # Send request to Ollama
  local RESPONSE=$(curl -s -X POST http://localhost:11434/api/generate -d "{ \"model\": \"$MODEL\", \"prompt\": \"$PROMPT\", \"stream\": false }")
  
  # Check if response contains error
  if echo "$RESPONSE" | grep -q "error"; then
    local ERROR=$(echo "$RESPONSE" | jq -r '.error')
    log "❌ Error warming up $MODEL: $ERROR"
    return 1
  fi
  
  local END_TIME=$(date +%s.%N)
  local ELAPSED=$(echo "$END_TIME - $START_TIME" | bc)
  
  log "✅ $MODEL model warmed up successfully in $ELAPSED seconds"
  return 0
}

# Warm up models with more complex prompts for better initialization
log "Starting model warmup sequence..."

# Track success/failure
TOTAL_MODELS=0
SUCCESSFUL_MODELS=0

# Warm up Mistral model (used for SEO)
TOTAL_MODELS=$((TOTAL_MODELS + 1))
if warmup_model "mistral:latest" "Explain the concept of artificial intelligence in 3 paragraphs."; then
  SUCCESSFUL_MODELS=$((SUCCESSFUL_MODELS + 1))
fi

# Warm up CodeLlama model (used for code tasks)
TOTAL_MODELS=$((TOTAL_MODELS + 1))
if warmup_model "codellama:7b-code" "Write a function in JavaScript that calculates the fibonacci sequence."; then
  SUCCESSFUL_MODELS=$((SUCCESSFUL_MODELS + 1))
fi

# Warm up Llama2 model (used for decision tasks)
TOTAL_MODELS=$((TOTAL_MODELS + 1))
if warmup_model "llama2:13b" "Compare and contrast the advantages of different programming languages for web development."; then
  SUCCESSFUL_MODELS=$((SUCCESSFUL_MODELS + 1))
fi

# Check if all models were warmed up successfully
log "=============================================="
log "Ollama warmup completed at $(date)"
log "Successfully warmed up $SUCCESSFUL_MODELS out of $TOTAL_MODELS models"

# Output system memory status
log "System memory status:"
vm_stat | tee -a "$LOGFILE"

# Check Ollama process memory usage
log "Ollama process memory usage:"
ps -o pid,rss,%mem,%cpu,command -p $(pgrep ollama) | tee -a "$LOGFILE"

# Check for any potential issues
TOTAL_MEM=$(sysctl -n hw.memsize)
TOTAL_MEM_GB=$(echo "scale=2; $TOTAL_MEM/1024/1024/1024" | bc)
FREE_MEM=$(vm_stat | grep "Pages free" | awk '{print $3}' | tr -d '.')
PAGE_SIZE=$(vm_stat | head -1 | awk '{print $8}')
FREE_MEM_MB=$(echo "scale=2; $FREE_MEM * $PAGE_SIZE / 1024 / 1024" | bc)

log "Total system memory: $TOTAL_MEM_GB GB"
log "Free memory: $FREE_MEM_MB MB"

if (( $(echo "$FREE_MEM_MB < 500" | bc -l) )); then
  log "⚠️ Warning: Low memory available. This may affect performance."
fi

# Check swap usage
SWAP_USAGE=$(sysctl vm.swapusage | awk '{print $4}')
log "Swap usage: $SWAP_USAGE"

# Final status
if [ $SUCCESSFUL_MODELS -eq $TOTAL_MODELS ]; then
  log "✅ All models are now ready for testing!"
else
  log "⚠️ Some models failed to warm up. Testing may be affected."
fi

echo "=============================================="
