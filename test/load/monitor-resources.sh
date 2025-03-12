#!/bin/bash

# Tämä skripti monitoroi järjestelmän resurssien käyttöä kuormitustestin aikana
# Käyttö: ./monitor-resources.sh [prosessin_nimi] [kesto_sekunteina]

PROCESS_NAME=${1:-"node"}
DURATION=${2:-180}
INTERVAL=5  # Mittausväli sekunteina
OUTPUT_FILE="resource_usage_$(date +%Y%m%d_%H%M%S).csv"

# Luodaan CSV-tiedosto ja otsikkorivi
echo "Timestamp,CPU_Usage_Percent,Memory_Usage_MB,Load_Avg_1m,Load_Avg_5m,Load_Avg_15m" > $OUTPUT_FILE

echo "Monitoroidaan resurssien käyttöä prosessille '$PROCESS_NAME' $DURATION sekunnin ajan..."
echo "Tulokset tallennetaan tiedostoon: $OUTPUT_FILE"

start_time=$(date +%s)
end_time=$((start_time + DURATION))

while [ $(date +%s) -lt $end_time ]; do
    # Haetaan prosessin PID
    PID=$(pgrep -f $PROCESS_NAME | head -1)
    
    if [ -z "$PID" ]; then
        echo "Prosessia '$PROCESS_NAME' ei löydy. Yritetään uudelleen..."
        sleep $INTERVAL
        continue
    fi
    
    # Haetaan CPU-käyttö prosentteina - macOS-yhteensopiva versio
    CPU_USAGE=$(ps -p $PID -o pcpu | tail -1 | sed 's/ //g')
    
    # Haetaan muistinkäyttö megatavuina - macOS-yhteensopiva versio
    MEM_USAGE=$(ps -p $PID -o rss | tail -1 | sed 's/ //g')
    MEM_USAGE_MB=$(echo "scale=2; $MEM_USAGE / 1024" | bc 2>/dev/null || echo "0")
    
    # Haetaan järjestelmän kuormitus
    LOAD_AVG=$(uptime | awk -F'load average:' '{ print $2 }' | sed 's/,//g')
    LOAD_1M=$(echo $LOAD_AVG | awk '{ print $1 }')
    LOAD_5M=$(echo $LOAD_AVG | awk '{ print $2 }')
    LOAD_15M=$(echo $LOAD_AVG | awk '{ print $3 }')
    
    # Tallennetaan tiedot CSV-tiedostoon
    TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
    echo "$TIMESTAMP,$CPU_USAGE,$MEM_USAGE_MB,$LOAD_1M,$LOAD_5M,$LOAD_15M" >> $OUTPUT_FILE
    
    # Näytetään tiedot myös konsolissa
    echo "[$TIMESTAMP] CPU: ${CPU_USAGE}%, Muisti: ${MEM_USAGE_MB}MB, Kuormitus: $LOAD_1M, $LOAD_5M, $LOAD_15M"
    
    sleep $INTERVAL
done

echo "Monitorointi valmis. Tulokset tallennettu tiedostoon: $OUTPUT_FILE"

# Luodaan yhteenveto
echo -e "\nYhteenveto:"
echo "------------"
echo "Keskimääräinen CPU-käyttö: $(awk -F',' '{ sum += $2; n++ } END { print sum/n "%" }' $OUTPUT_FILE)"
echo "Maksimi CPU-käyttö: $(awk -F',' 'BEGIN { max=0 } { if($2>max) max=$2 } END { print max "%" }' $OUTPUT_FILE)"
echo "Keskimääräinen muistinkäyttö: $(awk -F',' '{ sum += $3; n++ } END { print sum/n "MB" }' $OUTPUT_FILE)"
echo "Maksimi muistinkäyttö: $(awk -F',' 'BEGIN { max=0 } { if($3>max) max=$3 } END { print max "MB" }' $OUTPUT_FILE)"
