#!/bin/bash

# Ollama resource monitoring script
# This script monitors system resources while Ollama is running

# Default settings
INTERVAL=5  # seconds between measurements
DURATION=300  # total monitoring duration in seconds (default: 5 minutes)
OUTPUT_DIR="./logs/monitoring"
CHART_OUTPUT=true

# Parse command line arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        -i|--interval) INTERVAL="$2"; shift ;;
        -d|--duration) DURATION="$2"; shift ;;
        -o|--output-dir) OUTPUT_DIR="$2"; shift ;;
        -n|--no-charts) CHART_OUTPUT=false ;;
        *) echo "Unknown parameter: $1"; exit 1 ;;
    esac
    shift
done

# Create output directory
mkdir -p "$OUTPUT_DIR"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
LOG_FILE="$OUTPUT_DIR/ollama-monitoring-$TIMESTAMP.log"
CSV_FILE="$OUTPUT_DIR/ollama-monitoring-$TIMESTAMP.csv"

# Check if Ollama is running - macOS compatible
if ! ps aux | grep "[o]llama serve" > /dev/null; then
    echo "Error: Ollama is not running. Please start Ollama first."
    exit 1
fi

# Function to get Ollama process info
get_ollama_process_info() {
    # Get main Ollama process - macOS compatible version
    OLLAMA_MAIN_PID=$(pgrep -x "ollama")
    if [ -z "$OLLAMA_MAIN_PID" ]; then
        # Try to find Ollama in a different way if pgrep -x doesn't work
        OLLAMA_MAIN_PID=$(ps aux | grep "[o]llama serve" | awk '{print $2}')
    fi
    
    if [ -n "$OLLAMA_MAIN_PID" ]; then
        # macOS compatible ps command format
        OLLAMA_MAIN_CPU=$(ps -p $OLLAMA_MAIN_PID -o %cpu | tail -1 | tr -d ' ')
        OLLAMA_MAIN_MEM=$(ps -p $OLLAMA_MAIN_PID -o %mem | tail -1 | tr -d ' ')
        OLLAMA_MAIN_RSS=$(ps -p $OLLAMA_MAIN_PID -o rss | tail -1 | tr -d ' ')
        OLLAMA_MAIN_RSS_MB=$(echo "scale=2; $OLLAMA_MAIN_RSS / 1024" | bc)
    else
        OLLAMA_MAIN_CPU=0
        OLLAMA_MAIN_MEM=0
        OLLAMA_MAIN_RSS_MB=0
        echo "Warning: Could not find main Ollama process"
    fi
    
    # Get Ollama runner processes (model runners) - macOS compatible
    OLLAMA_RUNNER_PIDS=$(ps aux | grep "[o]llama.*runner" | awk '{print $2}')
    OLLAMA_RUNNER_CPU=0
    OLLAMA_RUNNER_MEM=0
    OLLAMA_RUNNER_RSS=0
    
    if [ -n "$OLLAMA_RUNNER_PIDS" ]; then
        for PID in $OLLAMA_RUNNER_PIDS; do
            CPU=$(ps -p $PID -o %cpu | tail -1 | tr -d ' ')
            MEM=$(ps -p $PID -o %mem | tail -1 | tr -d ' ')
            RSS=$(ps -p $PID -o rss | tail -1 | tr -d ' ')
            
            OLLAMA_RUNNER_CPU=$(echo "$OLLAMA_RUNNER_CPU + $CPU" | bc)
            OLLAMA_RUNNER_MEM=$(echo "$OLLAMA_RUNNER_MEM + $MEM" | bc)
            OLLAMA_RUNNER_RSS=$(echo "$OLLAMA_RUNNER_RSS + $RSS" | bc)
        done
    fi
    
    OLLAMA_RUNNER_RSS_MB=$(echo "scale=2; $OLLAMA_RUNNER_RSS / 1024" | bc)
    
    # Total Ollama resource usage
    OLLAMA_TOTAL_CPU=$(echo "$OLLAMA_MAIN_CPU + $OLLAMA_RUNNER_CPU" | bc)
    OLLAMA_TOTAL_MEM=$(echo "$OLLAMA_MAIN_MEM + $OLLAMA_RUNNER_MEM" | bc)
    OLLAMA_TOTAL_RSS_MB=$(echo "$OLLAMA_MAIN_RSS_MB + $OLLAMA_RUNNER_RSS_MB" | bc)
}

# Function to get system info
get_system_info() {
    # Get CPU load
    CPU_LOAD=$(sysctl -n vm.loadavg | awk '{print $2}')
    
    # Get memory info - improved for macOS
    TOTAL_MEM=$(sysctl -n hw.memsize)
    TOTAL_MEM_GB=$(echo "scale=2; $TOTAL_MEM/1024/1024/1024" | bc)
    
    # Extract page size (removing trailing period if present)
    PAGE_SIZE=$(vm_stat | head -1 | awk '{print $8}' | tr -d '.')
    
    # Extract free pages (removing trailing period if present)
    FREE_PAGES=$(vm_stat | grep "Pages free" | awk '{print $3}' | tr -d '.')
    
    # Calculate free memory in MB
    FREE_MEM_MB=$(echo "scale=2; $FREE_PAGES * $PAGE_SIZE / 1024 / 1024" | bc || echo "0")
    
    # Calculate memory usage percentage
    MEM_USAGE_PERCENT=$(echo "scale=2; 100 - ($FREE_MEM_MB * 100 / ($TOTAL_MEM_GB * 1024))" | bc)
    
    # Get swap usage
    SWAP_INFO=$(sysctl vm.swapusage)
    SWAP_USED=$(echo $SWAP_INFO | awk '{print $4}' | sed 's/M//')
    SWAP_TOTAL=$(echo $SWAP_INFO | awk '{print $10}' | sed 's/M//')
    SWAP_PERCENT=$(echo "scale=2; $SWAP_USED * 100 / $SWAP_TOTAL" | bc)
}

# Function to get network info
get_network_info() {
    # Get network stats
    NETWORK_IN=$(netstat -ib | grep -m 1 "en0" | awk '{print $7}')
    NETWORK_OUT=$(netstat -ib | grep -m 1 "en0" | awk '{print $10}')
    
    # Calculate rates if previous values exist
    if [ -n "$PREV_NETWORK_IN" ] && [ -n "$PREV_NETWORK_OUT" ]; then
        NETWORK_IN_RATE=$(echo "scale=2; ($NETWORK_IN - $PREV_NETWORK_IN) / $INTERVAL / 1024" | bc)
        NETWORK_OUT_RATE=$(echo "scale=2; ($NETWORK_OUT - $PREV_NETWORK_OUT) / $INTERVAL / 1024" | bc)
    else
        NETWORK_IN_RATE=0
        NETWORK_OUT_RATE=0
    fi
    
    PREV_NETWORK_IN=$NETWORK_IN
    PREV_NETWORK_OUT=$NETWORK_OUT
}

# Function to get disk I/O info
get_disk_info() {
    # Get disk I/O stats - more robust for macOS
    if iostat -d disk0 &>/dev/null; then
        DISK_READ=$(iostat -d disk0 | tail -1 | awk '{print $3}')
        DISK_WRITE=$(iostat -d disk0 | tail -1 | awk '{print $4}')
    else
        # Try alternative disk name
        if iostat -d diskN &>/dev/null; then
            DISK_READ=$(iostat -d diskN | tail -1 | awk '{print $3}')
            DISK_WRITE=$(iostat -d diskN | tail -1 | awk '{print $4}')
        else
            DISK_READ=0
            DISK_WRITE=0
        fi
    fi
}

# Function to get Ollama API stats
get_ollama_api_stats() {
    # Get Ollama API stats if available
    if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        # Check if jq is installed
        if command -v jq >/dev/null 2>&1; then
            OLLAMA_MODELS=$(curl -s http://localhost:11434/api/tags | jq -r '.models | length')
            # Get list of available models
            MODEL_LIST=$(curl -s http://localhost:11434/api/tags | jq -r '.models[].name' | tr '\n' ', ' | sed 's/,$//')
        else
            OLLAMA_MODELS="N/A (jq not installed)"
            MODEL_LIST="N/A (jq not installed)"
        fi
    else
        OLLAMA_MODELS="N/A"
        MODEL_LIST="N/A"
    fi
}

# Function to check GPU usage if available
get_gpu_info() {
    # Initialize GPU variables
    GPU_USAGE="N/A"
    GPU_MEMORY="N/A"
    GPU_AVAILABLE=false
    
    # Check if we have access to GPU info via system_profiler
    if command -v system_profiler >/dev/null 2>&1; then
        if system_profiler SPDisplaysDataType | grep -i "Metal" >/dev/null 2>&1; then
            GPU_AVAILABLE=true
            # On macOS, we can't easily get real-time GPU usage without additional tools
            # Just note that GPU is available
            GPU_INFO=$(system_profiler SPDisplaysDataType | grep -A 10 "Metal:" | grep -E "Vendor|Device")
            GPU_VENDOR=$(echo "$GPU_INFO" | grep "Vendor" | awk -F": " '{print $2}')
            GPU_DEVICE=$(echo "$GPU_INFO" | grep "Device" | awk -F": " '{print $2}')
            GPU_USAGE="Available ($GPU_VENDOR $GPU_DEVICE)"
        fi
    fi
}

# Write CSV header
echo "Timestamp,CPU Load,Memory Usage %,Free Memory MB,Swap Usage %,Ollama CPU %,Ollama Memory %,Ollama Memory MB,Network In KB/s,Network Out KB/s,GPU Usage,Available Models" > "$CSV_FILE"

# Display header
echo "Ollama Resource Monitoring"
echo "============================"
echo "Monitoring interval: ${INTERVAL}s"
echo "Total duration: ${DURATION}s"
echo "Log file: $LOG_FILE"
echo "CSV file: $CSV_FILE"
echo "============================"
echo "Press Ctrl+C to stop monitoring"
echo ""
echo "Time | CPU Load | Mem % | Free Mem | Swap % | Ollama CPU % | Ollama Mem % | Ollama Mem MB | Net In | Net Out"
echo "---------------------------------------------------------------------------------------------"

# Create visualization script if charts are enabled
if [ "$CHART_OUTPUT" = true ]; then
    CHART_SCRIPT="$OUTPUT_DIR/generate_charts_$TIMESTAMP.py"
    
    cat > "$CHART_SCRIPT" << 'EOL'
#!/usr/bin/env python3
import sys
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from datetime import datetime

# Get CSV file path from command line argument
if len(sys.argv) < 2:
    print("Usage: python3 generate_charts.py <csv_file>")
    sys.exit(1)

csv_file = sys.argv[1]

# Read the CSV file
df = pd.read_csv(csv_file)

# Convert timestamp to datetime
df['Datetime'] = pd.to_datetime(df['Timestamp'], unit='s')

# Create a figure with subplots
fig, axs = plt.subplots(3, 1, figsize=(12, 15))

# Plot CPU and Memory usage
axs[0].plot(df['Datetime'], df['CPU Load'], label='System CPU Load')
axs[0].plot(df['Datetime'], df['Ollama CPU %'], label='Ollama CPU %')
axs[0].set_title('CPU Usage Over Time')
axs[0].set_ylabel('CPU Usage')
axs[0].legend()
axs[0].grid(True)

# Plot Memory usage
axs[1].plot(df['Datetime'], df['Memory Usage %'], label='System Memory %')
axs[1].plot(df['Datetime'], df['Ollama Memory %'], label='Ollama Memory %')
axs[1].plot(df['Datetime'], df['Ollama Memory MB'], label='Ollama Memory MB')
axs[1].set_title('Memory Usage Over Time')
axs[1].set_ylabel('Memory Usage')
axs[1].legend()
axs[1].grid(True)

# Plot Network usage
axs[2].plot(df['Datetime'], df['Network In KB/s'], label='Network In (KB/s)')
axs[2].plot(df['Datetime'], df['Network Out KB/s'], label='Network Out (KB/s)')
axs[2].set_title('Network Usage Over Time')
axs[2].set_ylabel('KB/s')
axs[2].legend()
axs[2].grid(True)

# Format x-axis to show time
for ax in axs:
    ax.xaxis.set_major_formatter(mdates.DateFormatter('%H:%M:%S'))
    plt.setp(ax.xaxis.get_majorticklabels(), rotation=45)

plt.tight_layout()
plt.savefig(csv_file.replace('.csv', '.png'))
plt.close()

print(f"Charts saved to {csv_file.replace('.csv', '.png')}")
EOL
    
    chmod +x "$CHART_SCRIPT"
    echo "Chart generation script created at $CHART_SCRIPT"
fi

# Start monitoring
START_TIME=$(date +%s)
END_TIME=$((START_TIME + DURATION))

# Trap Ctrl+C to perform cleanup
trap cleanup INT

cleanup() {
    echo ""
    echo "Monitoring stopped by user."
    if [ "$CHART_OUTPUT" = true ] && command -v python3 >/dev/null 2>&1; then
        echo "Generating charts..."
        python3 "$CHART_SCRIPT" "$CSV_FILE" || echo "Failed to generate charts. Make sure Python with pandas and matplotlib is installed."
    fi
    exit 0
}

while [ $(date +%s) -lt $END_TIME ]; do
    CURRENT_TIME=$(date +"%H:%M:%S")
    
    # Get all metrics
    get_ollama_process_info
    get_system_info
    get_network_info
    get_disk_info
    get_ollama_api_stats
    get_gpu_info
    
    # Display current stats
    echo "$CURRENT_TIME | $CPU_LOAD | $MEM_USAGE_PERCENT% | $FREE_MEM_MB MB | $SWAP_PERCENT% | $OLLAMA_TOTAL_CPU% | $OLLAMA_TOTAL_MEM% | $OLLAMA_TOTAL_RSS_MB MB | $NETWORK_IN_RATE KB/s | $NETWORK_OUT_RATE KB/s | $GPU_USAGE"
    
    # Log to CSV
    echo "$(date +%s),$CPU_LOAD,$MEM_USAGE_PERCENT,$FREE_MEM_MB,$SWAP_PERCENT,$OLLAMA_TOTAL_CPU,$OLLAMA_TOTAL_MEM,$OLLAMA_TOTAL_RSS_MB,$NETWORK_IN_RATE,$NETWORK_OUT_RATE,$GPU_USAGE,\"$MODEL_LIST\"" >> "$CSV_FILE"
    
    # Detailed log
    {
        echo "======== $(date) ========"
        echo "System:"
        echo "  CPU Load: $CPU_LOAD"
        echo "  Memory Usage: $MEM_USAGE_PERCENT%"
        echo "  Free Memory: $FREE_MEM_MB MB"
        echo "  Swap Usage: $SWAP_PERCENT%"
        echo ""
        echo "Ollama:"
        echo "  Total CPU Usage: $OLLAMA_TOTAL_CPU%"
        echo "  Total Memory Usage: $OLLAMA_TOTAL_MEM%"
        echo "  Total Memory: $OLLAMA_TOTAL_RSS_MB MB"
        echo "  Main Process CPU: $OLLAMA_MAIN_CPU%"
        echo "  Main Process Memory: $OLLAMA_MAIN_MEM%"
        echo "  Runner Processes CPU: $OLLAMA_RUNNER_CPU%"
        echo "  Runner Processes Memory: $OLLAMA_RUNNER_MEM%"
        echo "  Available Models: $OLLAMA_MODELS"
        echo "  Model List: $MODEL_LIST"
        echo ""
        echo "Network:"
        echo "  In: $NETWORK_IN_RATE KB/s"
        echo "  Out: $NETWORK_OUT_RATE KB/s"
        echo ""
        echo "GPU:"
        echo "  Status: $GPU_USAGE"
        echo ""
        echo "Disk:"
        echo "  Read: $DISK_READ KB/s"
        echo "  Write: $DISK_WRITE KB/s"
        echo ""
    } >> "$LOG_FILE"
    
    sleep $INTERVAL
done

# Generate charts if enabled
if [ "$CHART_OUTPUT" = true ] && command -v python3 >/dev/null 2>&1; then
    echo ""
    echo "Monitoring complete. Generating charts..."
    python3 "$CHART_SCRIPT" "$CSV_FILE" || echo "Failed to generate charts. Make sure Python with pandas and matplotlib is installed."
    echo "Charts saved to ${CSV_FILE/.csv/.png}"
else
    echo ""
    echo "Monitoring complete. CSV data saved to $CSV_FILE"
fi

echo ""
echo "Monitoring completed. Results saved to:"
echo "- Log: $LOG_FILE"
echo "- CSV: $CSV_FILE"
if [ "$CHART_OUTPUT" = true ]; then
    echo "- Chart: ${CSV_FILE/.csv/.png} (if Python dependencies were available)"
fi
echo ""
echo "Summary:"
echo "--------"
echo "Average CPU Load: $(awk -F, '{sum+=$2} END {print sum/NR}' "$CSV_FILE" | bc)"
echo "Average Memory Usage: $(awk -F, '{sum+=$3} END {print sum/NR}' "$CSV_FILE" | bc)%"
echo "Average Ollama CPU Usage: $(awk -F, '{sum+=$6} END {print sum/NR}' "$CSV_FILE" | bc)%"
echo "Average Ollama Memory Usage: $(awk -F, '{sum+=$7} END {print sum/NR}' "$CSV_FILE" | bc)%"
echo "Peak Ollama Memory Usage: $(awk -F, '{if($8>max) max=$8} END {print max}' "$CSV_FILE") MB"
echo "--------"
