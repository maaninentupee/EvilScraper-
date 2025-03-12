#!/bin/bash

# Resurssien monitorointi kuormitustestien aikana
# Käyttö: ./monitor-resources.sh [kesto sekunteina] [näytteenottoväli sekunteina]

DURATION=${1:-60}  # Oletuskesto 60 sekuntia
INTERVAL=${2:-1}   # Oletusnäytteenottoväli 1 sekunti
OUTPUT_FILE="resource-usage-$(date +%Y%m%d-%H%M%S).csv"

echo "Aloitetaan resurssien monitorointi ${DURATION} sekunnin ajan, näytteenottoväli ${INTERVAL} sekunti(a)"
echo "Tulokset tallennetaan tiedostoon: ${OUTPUT_FILE}"

# Haetaan Node.js prosessi, joka kuuntelee porttia 3001
NODE_PID=$(lsof -i :3001 | grep node | awk '{print $2}' | head -1)
if [ -z "$NODE_PID" ]; then
    echo "VAROITUS: Node.js prosessia portissa 3001 ei löytynyt!"
else
    echo "Monitoroidaan Node.js prosessia PID: $NODE_PID"
fi

# Luodaan CSV-tiedoston otsikkorivi
echo "Timestamp,CPU_Usage_Percent,Memory_Usage_MB,Memory_Usage_Percent,Load_Avg_1m,Load_Avg_5m,Load_Avg_15m,Node_Process_CPU_Percent,Node_Process_Memory_MB" > "$OUTPUT_FILE"

# Monitoroidaan resursseja määritetyn ajan
end_time=$(($(date +%s) + DURATION))

while [ $(date +%s) -lt $end_time ]; do
    timestamp=$(date +"%Y-%m-%d %H:%M:%S")
    
    # Kokonais-CPU-käyttö
    cpu_usage=$(top -l 1 | grep "CPU usage" | awk '{print $3}' | tr -d '%')
    
    # Kokonaismuistinkäyttö
    mem_info=$(top -l 1 | grep PhysMem)
    # Parsitaan numeerinen arvo muistinkäytöstä
    mem_used=$(echo "$mem_info" | awk '{print $2}' | tr -d 'G')
    mem_used=$(echo "scale=2; $mem_used * 1024" | bc)  # Muunnetaan GB -> MB
    
    # Kokonaismuisti
    total_mem=$(sysctl hw.memsize | awk '{print $2}')
    total_mem=$((total_mem / 1024 / 1024))  # Muunnetaan MB:ksi
    
    # Muistinkäyttöprosentti
    mem_percent=$(echo "scale=2; $mem_used * 100 / $total_mem" | bc)
    
    # Kuormitusarvot
    load_avg=$(sysctl -n vm.loadavg | awk '{print $2, $3, $4}')
    load_1m=$(echo $load_avg | cut -d' ' -f1)
    load_5m=$(echo $load_avg | cut -d' ' -f2)
    load_15m=$(echo $load_avg | cut -d' ' -f3)
    
    # Node-prosessien resurssien käyttö
    if [ -n "$NODE_PID" ] && ps -p $NODE_PID > /dev/null; then
        node_cpu=$(ps -p $NODE_PID -o %cpu | tail -1 | tr -d ' ')
        node_mem=$(ps -p $NODE_PID -o rss | tail -1 | tr -d ' ')
        node_mem_mb=$(echo "scale=2; $node_mem / 1024" | bc)
    else
        # Jos prosessi ei ole enää käynnissä, yritetään löytää se uudelleen
        NODE_PID=$(lsof -i :3001 | grep node | awk '{print $2}' | head -1)
        if [ -n "$NODE_PID" ]; then
            echo "Löydettiin uusi Node.js prosessi PID: $NODE_PID"
            node_cpu=$(ps -p $NODE_PID -o %cpu | tail -1 | tr -d ' ')
            node_mem=$(ps -p $NODE_PID -o rss | tail -1 | tr -d ' ')
            node_mem_mb=$(echo "scale=2; $node_mem / 1024" | bc)
        else
            node_cpu="0.0"
            node_mem_mb="0.0"
        fi
    fi
    
    # Tallennetaan tiedot CSV-tiedostoon
    echo "$timestamp,$cpu_usage,$mem_used,$mem_percent,$load_1m,$load_5m,$load_15m,$node_cpu,$node_mem_mb" >> "$OUTPUT_FILE"
    
    # Tulostetaan tiedot myös konsoliin
    echo "$timestamp - CPU: ${cpu_usage}%, Muisti: ${mem_used}MB (${mem_percent}%), Node CPU: ${node_cpu}%, Node Muisti: ${node_mem_mb}MB"
    
    sleep $INTERVAL
done

echo "Monitorointi valmis. Tulokset tallennettu tiedostoon: ${OUTPUT_FILE}"
echo "Yhteenveto:"

# Lasketaan keskiarvot ja maksimit
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
    printf "Keskimääräinen CPU-käyttö: %.2f%% (Maksimi: %.2f%%)\n", cpu_sum/count, max_cpu;
    printf "Keskimääräinen muistinkäyttö: %.2f MB (Maksimi: %.2f MB)\n", mem_sum/count, max_mem;
    printf "Keskimääräinen muistinkäyttö: %.2f%% (Maksimi: %.2f%%)\n", mem_percent_sum/count, max_mem_percent;
    printf "Node-prosessin keskimääräinen CPU-käyttö: %.2f%% (Maksimi: %.2f%%)\n", node_cpu_sum/count, max_node_cpu;
    printf "Node-prosessin keskimääräinen muistinkäyttö: %.2f MB (Maksimi: %.2f MB)\n", node_mem_sum/count, max_node_mem;
}' "$OUTPUT_FILE"

echo ""
echo "Voit visualisoida tulokset avaamalla visualize-resources.html selaimessa ja valitsemalla CSV-tiedoston."
