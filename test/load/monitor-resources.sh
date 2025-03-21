#!/bin/bash

# This script monitors system resource usage during load testing
# Usage: ./monitor-resources.sh [process_name] [duration_in_seconds]

PROCESS_NAME=${1:-"node"}
DURATION=${2:-180}
INTERVAL=5  # Measurement interval in seconds
OUTPUT_FILE="resource_usage_$(date +%Y%m%d_%H%M%S).csv"

# Create CSV file and header row
echo "Timestamp,CPU_Usage_Percent,Memory_Usage_MB,Load_Avg_1m,Load_Avg_5m,Load_Avg_15m" > $OUTPUT_FILE

echo "Monitoring resource usage for process '$PROCESS_NAME' for $DURATION seconds..."
echo "Results will be saved to file: $OUTPUT_FILE"

start_time=$(date +%s)
end_time=$((start_time + DURATION))

while [ $(date +%s) -lt $end_time ]; do
    # Get process PID
    PID=$(pgrep -f $PROCESS_NAME | head -1)
    
    if [ -z "$PID" ]; then
        echo "Process '$PROCESS_NAME' not found. Trying again..."
        sleep $INTERVAL
        continue
    fi
    
    # Get CPU usage in percent - macOS compatible version
    CPU_USAGE=$(ps -p $PID -o pcpu | tail -1 | sed 's/ //g')
    
    # Get memory usage in megabytes - macOS compatible version
    MEM_USAGE=$(ps -p $PID -o rss | tail -1 | sed 's/ //g')
    MEM_USAGE_MB=$(echo "scale=2; $MEM_USAGE / 1024" | bc 2>/dev/null || echo "0")
    
    # Get system load
    LOAD_AVG=$(uptime | awk -F'load average:' '{ print $2 }' | sed 's/,//g')
    LOAD_1M=$(echo $LOAD_AVG | awk '{ print $1 }')
    LOAD_5M=$(echo $LOAD_AVG | awk '{ print $2 }')
    LOAD_15M=$(echo $LOAD_AVG | awk '{ print $3 }')
    
    # Save data to CSV file
    TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
    echo "$TIMESTAMP,$CPU_USAGE,$MEM_USAGE_MB,$LOAD_1M,$LOAD_5M,$LOAD_15M" >> $OUTPUT_FILE
    
    # Display data on console
    echo "[$TIMESTAMP] CPU: ${CPU_USAGE}%, Memory: ${MEM_USAGE_MB}MB, Load: $LOAD_1M, $LOAD_5M, $LOAD_15M"
    
    sleep $INTERVAL
done

echo "Monitoring complete. Results saved to file: $OUTPUT_FILE"

# Create summary
echo -e "\nSummary:"
echo "------------"
echo "Average CPU usage: $(awk -F',' '{ sum += $2; n++ } END { print sum/n "%" }' $OUTPUT_FILE)"
echo "Maximum CPU usage: $(awk -F',' 'BEGIN { max=0 } { if($2>max) max=$2 } END { print max "%" }' $OUTPUT_FILE)"
echo "Average memory usage: $(awk -F',' '{ sum += $3; n++ } END { print sum/n "MB" }' $OUTPUT_FILE)"
echo "Maximum memory usage: $(awk -F',' 'BEGIN { max=0 } { if($3>max) max=$3 } END { print max "MB" }' $OUTPUT_FILE)"
