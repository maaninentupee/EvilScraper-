#!/bin/bash

# Resource monitoring during load tests
# Usage: ./monitor-resources.sh [duration in seconds] [sampling interval in seconds]

DURATION=${1:-60}  # Default duration 60 seconds
INTERVAL=${2:-1}   # Default sampling interval 1 second
OUTPUT_FILE="resource-usage-$(date +%Y%m%d-%H%M%S).csv"

echo "Starting resource monitoring for ${DURATION} seconds, sampling interval ${INTERVAL} second(s)"
echo "Results will be saved to file: ${OUTPUT_FILE}"

# Find Node.js process listening on port 3001
NODE_PID=$(lsof -i :3001 | grep node | awk '{print $2}' | head -1)
if [ -z "$NODE_PID" ]; then
    echo "WARNING: Node.js process on port 3001 not found!"
else
    echo "Monitoring Node.js process PID: $NODE_PID"
fi

# Create CSV file header row
echo "Timestamp,CPU_Usage_Percent,Memory_Usage_MB,Memory_Usage_Percent,Load_Avg_1m,Load_Avg_5m,Load_Avg_15m,Node_Process_CPU_Percent,Node_Process_Memory_MB" > "$OUTPUT_FILE"

# Monitor resources for the specified duration
end_time=$(($(date +%s) + DURATION))

while [ $(date +%s) -lt $end_time ]; do
    timestamp=$(date +"%Y-%m-%d %H:%M:%S")
    
    # Total CPU usage
    cpu_usage=$(top -l 1 | grep "CPU usage" | awk '{print $3}' | tr -d '%')
    
    # Total memory usage
    mem_info=$(top -l 1 | grep PhysMem)
    # Parse numeric value from memory usage
    mem_used=$(echo "$mem_info" | awk '{print $2}' | tr -d 'G')
    mem_used=$(echo "scale=2; $mem_used * 1024" | bc)  # Convert GB -> MB
    
    # Total memory
    total_mem=$(sysctl hw.memsize | awk '{print $2}')
    total_mem=$((total_mem / 1024 / 1024))  # Convert to MB
    
    # Memory usage percentage
    mem_percent=$(echo "scale=2; $mem_used * 100 / $total_mem" | bc)
    
    # Load average values
    load_avg=$(sysctl -n vm.loadavg | awk '{print $2, $3, $4}')
    load_1m=$(echo $load_avg | cut -d' ' -f1)
    load_5m=$(echo $load_avg | cut -d' ' -f2)
    load_15m=$(echo $load_avg | cut -d' ' -f3)
    
    # Node process resource usage
    if [ -n "$NODE_PID" ] && ps -p $NODE_PID > /dev/null; then
        node_cpu=$(ps -p $NODE_PID -o %cpu | tail -1 | tr -d ' ')
        node_mem=$(ps -p $NODE_PID -o rss | tail -1 | tr -d ' ')
        node_mem_mb=$(echo "scale=2; $node_mem / 1024" | bc)
    else
        # If the process is no longer running, try to find it again
        NODE_PID=$(lsof -i :3001 | grep node | awk '{print $2}' | head -1)
        if [ -n "$NODE_PID" ]; then
            echo "Found new Node.js process PID: $NODE_PID"
            node_cpu=$(ps -p $NODE_PID -o %cpu | tail -1 | tr -d ' ')
            node_mem=$(ps -p $NODE_PID -o rss | tail -1 | tr -d ' ')
            node_mem_mb=$(echo "scale=2; $node_mem / 1024" | bc)
        else
            node_cpu="0.0"
            node_mem_mb="0.0"
        fi
    fi
    
    # Save data to CSV file
    echo "$timestamp,$cpu_usage,$mem_used,$mem_percent,$load_1m,$load_5m,$load_15m,$node_cpu,$node_mem_mb" >> "$OUTPUT_FILE"
    
    # Print data to console
    echo "$timestamp - CPU: ${cpu_usage}%, Memory: ${mem_used}MB (${mem_percent}%), Node CPU: ${node_cpu}%, Node Memory: ${node_mem_mb}MB"
    
    sleep $INTERVAL
done

echo "Monitoring complete. Results saved to file: ${OUTPUT_FILE}"
echo "Summary:"

# Calculate averages and maximums
awk -F, 'NR>1 {
    cpu_sum += $2; 
    mem_sum += $3; 
    mem_percent_sum += $4;
    node_cpu_sum += $8;
    node_mem_sum += $9;
    if($2 > max_cpu) max_cpu = $2;
    if($3 > max_mem) max_mem = $3;
    if($4 > max_mem_percent) max_mem_percent = $4;
    if($8 > max_node_cpu) max_node_cpu = $8;
    if($9 > max_node_mem) max_node_mem = $9;
    count++;
} 
END {
    printf "Average CPU usage: %.2f%% (Maximum: %.2f%%)\n", cpu_sum/count, max_cpu;
    printf "Average memory usage: %.2f MB (Maximum: %.2f MB)\n", mem_sum/count, max_mem;
    printf "Average memory usage: %.2f%% (Maximum: %.2f%%)\n", mem_percent_sum/count, max_mem_percent;
    printf "Node process average CPU usage: %.2f%% (Maximum: %.2f%%)\n", node_cpu_sum/count, max_node_cpu;
    printf "Node process average memory usage: %.2f MB (Maximum: %.2f MB)\n", node_mem_sum/count, max_node_mem;
}' "$OUTPUT_FILE"

echo ""
echo "You can visualize the results by opening visualize-resources.html in a browser and selecting the CSV file."
