#!/bin/bash

# Ollama Netdata Collector
# This script collects Ollama resource usage metrics and sends them to Netdata

# Configuration
INTERVAL=1  # seconds between measurements
NETDATA_PORT=19999
STATSD_PORT=8125

# Check if netdata is running
if ! curl -s http://localhost:$NETDATA_PORT > /dev/null; then
    echo "Error: Netdata is not running. Please start Netdata first."
    echo "Run: brew services start netdata"
    exit 1
fi

# Function to send metrics to netdata via StatsD
send_metric() {
    local metric_name=$1
    local metric_value=$2
    local metric_type=$3  # gauge, counter, etc.
    
    echo "$metric_name:$metric_value|$metric_type" | nc -u -w0 127.0.0.1 $STATSD_PORT
}

# Function to get Ollama process info
get_ollama_metrics() {
    # Get main Ollama process
    OLLAMA_MAIN_PID=$(pgrep -x "ollama" || echo "0")
    
    if [ "$OLLAMA_MAIN_PID" != "0" ]; then
        OLLAMA_MAIN_CPU=$(ps -p $OLLAMA_MAIN_PID -o %cpu | tail -1 | tr -d ' ')
        OLLAMA_MAIN_MEM=$(ps -p $OLLAMA_MAIN_PID -o %mem | tail -1 | tr -d ' ')
        OLLAMA_MAIN_RSS=$(ps -p $OLLAMA_MAIN_PID -o rss | tail -1 | tr -d ' ')
        OLLAMA_MAIN_RSS_MB=$(echo "scale=2; $OLLAMA_MAIN_RSS / 1024" | bc)
        
        # Send metrics to netdata
        send_metric "ollama.main.cpu" "$OLLAMA_MAIN_CPU" "g"
        send_metric "ollama.main.memory_percent" "$OLLAMA_MAIN_MEM" "g"
        send_metric "ollama.main.memory_mb" "$OLLAMA_MAIN_RSS_MB" "g"
    else
        # Ollama is not running
        send_metric "ollama.main.cpu" "0" "g"
        send_metric "ollama.main.memory_percent" "0" "g"
        send_metric "ollama.main.memory_mb" "0" "g"
    fi
    
    # Get Ollama runner processes (model runners)
    OLLAMA_RUNNER_PIDS=$(pgrep -f "ollama runner" || echo "")
    OLLAMA_RUNNER_COUNT=$(echo "$OLLAMA_RUNNER_PIDS" | wc -l | tr -d ' ')
    
    # If there are no runners, set count to 0
    if [ -z "$OLLAMA_RUNNER_PIDS" ]; then
        OLLAMA_RUNNER_COUNT=0
    fi
    
    send_metric "ollama.runners.count" "$OLLAMA_RUNNER_COUNT" "g"
    
    OLLAMA_RUNNER_CPU=0
    OLLAMA_RUNNER_MEM=0
    OLLAMA_RUNNER_RSS=0
    
    if [ -n "$OLLAMA_RUNNER_PIDS" ]; then
        for PID in $OLLAMA_RUNNER_PIDS; do
            # Skip empty lines
            if [ -z "$PID" ]; then
                continue
            fi
            
            CPU=$(ps -p $PID -o %cpu | tail -1 | tr -d ' ')
            MEM=$(ps -p $PID -o %mem | tail -1 | tr -d ' ')
            RSS=$(ps -p $PID -o rss | tail -1 | tr -d ' ')
            
            OLLAMA_RUNNER_CPU=$(echo "$OLLAMA_RUNNER_CPU + $CPU" | bc)
            OLLAMA_RUNNER_MEM=$(echo "$OLLAMA_RUNNER_MEM + $MEM" | bc)
            OLLAMA_RUNNER_RSS=$(echo "$OLLAMA_RUNNER_RSS + $RSS" | bc)
            
            # Get model name if possible
            MODEL_INFO=$(ps -p $PID -o command | tail -1 | grep -o "model [^ ]*" | cut -d' ' -f2 || echo "unknown")
            MODEL_NAME=$(basename "$MODEL_INFO" | cut -d'-' -f1 || echo "unknown")
            
            # Send per-model metrics
            send_metric "ollama.model.$MODEL_NAME.cpu" "$CPU" "g"
            send_metric "ollama.model.$MODEL_NAME.memory_percent" "$MEM" "g"
            send_metric "ollama.model.$MODEL_NAME.memory_mb" "$(echo "scale=2; $RSS / 1024" | bc)" "g"
        done
    fi
    
    OLLAMA_RUNNER_RSS_MB=$(echo "scale=2; $OLLAMA_RUNNER_RSS / 1024" | bc)
    
    # Send runner metrics to netdata
    send_metric "ollama.runners.cpu" "$OLLAMA_RUNNER_CPU" "g"
    send_metric "ollama.runners.memory_percent" "$OLLAMA_RUNNER_MEM" "g"
    send_metric "ollama.runners.memory_mb" "$OLLAMA_RUNNER_RSS_MB" "g"
    
    # Total Ollama resource usage
    OLLAMA_TOTAL_CPU=$(echo "$OLLAMA_MAIN_CPU + $OLLAMA_RUNNER_CPU" | bc)
    OLLAMA_TOTAL_MEM=$(echo "$OLLAMA_MAIN_MEM + $OLLAMA_RUNNER_MEM" | bc)
    OLLAMA_TOTAL_RSS_MB=$(echo "scale=2; ${OLLAMA_MAIN_RSS_MB:-0} + ${OLLAMA_RUNNER_RSS_MB:-0}" | bc)
    
    # Send total metrics to netdata
    send_metric "ollama.total.cpu" "$OLLAMA_TOTAL_CPU" "g"
    send_metric "ollama.total.memory_percent" "$OLLAMA_TOTAL_MEM" "g"
    send_metric "ollama.total.memory_mb" "$OLLAMA_TOTAL_RSS_MB" "g"
    
    # Get Ollama API stats if available
    if curl -s http://localhost:11434/api/tags > /dev/null; then
        OLLAMA_MODELS=$(curl -s http://localhost:11434/api/tags | jq -r '.models | length')
        send_metric "ollama.api.models_count" "$OLLAMA_MODELS" "g"
    else
        send_metric "ollama.api.models_count" "0" "g"
    fi
}

echo "Starting Ollama Netdata collector..."
echo "Sending metrics to StatsD on port $STATSD_PORT"
echo "Press Ctrl+C to stop"

# Main loop
while true; do
    get_ollama_metrics
    sleep $INTERVAL
done
