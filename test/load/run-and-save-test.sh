#!/bin/bash

# Tämä skripti suorittaa kuormitustestin ja tallentaa tulokset JSON-muodossa
# Käyttö: ./run-and-save-test.sh [testiskripti] [kesto_minuutteina]

TEST_SCRIPT=${1:-"load-test.js"}
DURATION=${2:-2}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RESULTS_DIR="./results"
JSON_OUTPUT="${RESULTS_DIR}/test_results_${TIMESTAMP}.json"
CSV_OUTPUT="${RESULTS_DIR}/test_results_${TIMESTAMP}.csv"
SUMMARY_OUTPUT="${RESULTS_DIR}/test_summary_${TIMESTAMP}.txt"

# Varmistetaan, että tulostentallennus-hakemisto on olemassa
mkdir -p $RESULTS_DIR

echo "Suoritetaan kuormitustesti: $TEST_SCRIPT"
echo "Kesto: $DURATION minuuttia"
echo "Tulokset tallennetaan tiedostoon: $JSON_OUTPUT"

# Käynnistetään resurssien monitorointi taustalle
./monitor-resources.sh node $((DURATION * 60)) &
MONITOR_PID=$!

# Suoritetaan kuormitustesti ja tallennetaan tulokset JSON-muodossa
k6 run --out json=$JSON_OUTPUT $TEST_SCRIPT

# Odotetaan, että monitorointi valmistuu
wait $MONITOR_PID

# Luodaan yhteenveto testituloksista
echo "Luodaan yhteenveto testituloksista..."

# Muunnetaan JSON CSV-muotoon perusmetriikoille
echo "Muunnetaan tulokset CSV-muotoon..."
echo "timestamp,metric,value" > $CSV_OUTPUT
cat $JSON_OUTPUT | grep -E '"metric":"(http_req_duration|error_rate|ai_processing_time|openai_processing_time|anthropic_processing_time|ollama_processing_time|short_prompt_time|long_prompt_time)"' | grep '"type":"Point"' | jq -r '[.data.time, .metric, .data.value] | @csv' >> $CSV_OUTPUT

# Luodaan yhteenveto
echo "Kuormitustestin yhteenveto - $(date)" > $SUMMARY_OUTPUT
echo "Testi: $TEST_SCRIPT" >> $SUMMARY_OUTPUT
echo "Suoritusaika: $(date -r $JSON_OUTPUT)" >> $SUMMARY_OUTPUT
echo "Iteraatioiden määrä: $(grep -c '"metric":"iterations"' $JSON_OUTPUT)" >> $SUMMARY_OUTPUT
echo "Virtuaalisten käyttäjien määrä: $(cat $JSON_OUTPUT | grep '"metric":"vus"' | grep '"type":"Point"' | jq -r '.data.value' | sort -nr | head -1)" >> $SUMMARY_OUTPUT
echo "" >> $SUMMARY_OUTPUT

# Lisätään keskeiset metriikat yhteenvetoon
echo "Keskeiset metriikat:" >> $SUMMARY_OUTPUT
echo "===================" >> $SUMMARY_OUTPUT

# HTTP-pyyntöjen kesto
HTTP_VALUES=$(cat $JSON_OUTPUT | grep '"metric":"http_req_duration"' | grep '"type":"Point"' | jq -r '.data.value')
HTTP_AVG=$(echo "$HTTP_VALUES" | awk '{ sum += $1; n++ } END { if (n > 0) print sum / n; else print "N/A" }')
HTTP_MIN=$(echo "$HTTP_VALUES" | sort -n | head -1)
HTTP_MAX=$(echo "$HTTP_VALUES" | sort -n | tail -1)
HTTP_P95=$(echo "$HTTP_VALUES" | sort -n | awk '{ values[NR] = $1 } END { if (NR > 0) print values[int(NR * 0.95)]; else print "N/A" }')

echo "HTTP-pyyntöjen kesto (ms):" >> $SUMMARY_OUTPUT
echo "  Keskiarvo: $HTTP_AVG" >> $SUMMARY_OUTPUT
echo "  Minimi: $HTTP_MIN" >> $SUMMARY_OUTPUT
echo "  Maksimi: $HTTP_MAX" >> $SUMMARY_OUTPUT
echo "  95. persentiili: $HTTP_P95" >> $SUMMARY_OUTPUT
echo "" >> $SUMMARY_OUTPUT

# Virheprosentti ja virhetiedot
ERROR_VALUES=$(cat $JSON_OUTPUT | grep '"metric":"error_rate"' | grep '"type":"Point"' | jq -r '.data.value')
ERROR_RATE=$(echo "$ERROR_VALUES" | awk '{ sum += $1; n++ } END { if (n > 0) print sum / n * 100; else print "N/A" }')
echo "Virheprosentti: $ERROR_RATE%" >> $SUMMARY_OUTPUT

# Onnistuneet ja epäonnistuneet pyyntöt
SUCCESS_COUNT=$(cat $JSON_OUTPUT | grep '"metric":"successful_requests"' | grep '"type":"Counter"' | tail -1 | jq -r '.data.value')
FAILED_COUNT=$(cat $JSON_OUTPUT | grep '"metric":"failed_requests"' | grep '"type":"Counter"' | tail -1 | jq -r '.data.value')

if [ "$SUCCESS_COUNT" != "" ] && [ "$FAILED_COUNT" != "" ]; then
  TOTAL_REQUESTS=$((SUCCESS_COUNT + FAILED_COUNT))
  SUCCESS_PERCENT=$(echo "scale=2; $SUCCESS_COUNT * 100 / $TOTAL_REQUESTS" | bc -l)
  FAILED_PERCENT=$(echo "scale=2; $FAILED_COUNT * 100 / $TOTAL_REQUESTS" | bc -l)
  
  echo "Onnistuneet pyyntöt: $SUCCESS_COUNT ($SUCCESS_PERCENT%)" >> $SUMMARY_OUTPUT
  echo "Epäonnistuneet pyyntöt: $FAILED_COUNT ($FAILED_PERCENT%)" >> $SUMMARY_OUTPUT
fi

# Etsitään virheviestit lokista
echo "\nYleisimmät virheet:" >> $SUMMARY_OUTPUT
echo "===================" >> $SUMMARY_OUTPUT
cat $JSON_OUTPUT | grep '"Body"' | jq -r '.Body' | sort | uniq -c | sort -nr | head -5 >> $SUMMARY_OUTPUT
echo "" >> $SUMMARY_OUTPUT

# AI-käsittelyaika, jos saatavilla
if grep -q '"metric":"ai_processing_time"' $JSON_OUTPUT; then
  AI_VALUES=$(cat $JSON_OUTPUT | grep '"metric":"ai_processing_time"' | grep '"type":"Point"' | jq -r '.data.value')
  AI_AVG=$(echo "$AI_VALUES" | awk '{ sum += $1; n++ } END { if (n > 0) print sum / n; else print "N/A" }')
  AI_MIN=$(echo "$AI_VALUES" | sort -n | head -1)
  AI_MAX=$(echo "$AI_VALUES" | sort -n | tail -1)
  AI_P95=$(echo "$AI_VALUES" | sort -n | awk '{ values[NR] = $1 } END { if (NR > 0) print values[int(NR * 0.95)]; else print "N/A" }')

  echo "AI-käsittelyaika (ms):" >> $SUMMARY_OUTPUT
  echo "  Keskiarvo: $AI_AVG" >> $SUMMARY_OUTPUT
  echo "  Minimi: $AI_MIN" >> $SUMMARY_OUTPUT
  echo "  Maksimi: $AI_MAX" >> $SUMMARY_OUTPUT
  echo "  95. persentiili: $AI_P95" >> $SUMMARY_OUTPUT
  echo "" >> $SUMMARY_OUTPUT
fi

# Resurssien käyttö
RESOURCE_FILE=$(ls -t resource_usage_*.csv | head -1)
if [ -f "$RESOURCE_FILE" ]; then
  CPU_AVG=$(awk -F',' '{ sum += $2; n++ } END { print sum/n }' $RESOURCE_FILE)
  CPU_MAX=$(awk -F',' 'BEGIN { max=0 } { if($2>max) max=$2 } END { print max }' $RESOURCE_FILE)
  MEM_AVG=$(awk -F',' '{ sum += $3; n++ } END { print sum/n }' $RESOURCE_FILE)
  MEM_MAX=$(awk -F',' 'BEGIN { max=0 } { if($3>max) max=$3 } END { print max }' $RESOURCE_FILE)

  echo "Resurssien käyttö:" >> $SUMMARY_OUTPUT
  echo "  Keskimääräinen CPU-käyttö: $CPU_AVG%" >> $SUMMARY_OUTPUT
  echo "  Maksimi CPU-käyttö: $CPU_MAX%" >> $SUMMARY_OUTPUT
  echo "  Keskimääräinen muistinkäyttö: $MEM_AVG MB" >> $SUMMARY_OUTPUT
  echo "  Maksimi muistinkäyttö: $MEM_MAX MB" >> $SUMMARY_OUTPUT
fi

echo "Yhteenveto tallennettu tiedostoon: $SUMMARY_OUTPUT"
echo "CSV-tiedosto tallennettu: $CSV_OUTPUT"
echo "JSON-tiedosto tallennettu: $JSON_OUTPUT"

# Luodaan grafiikka vasteajoista
echo "Luodaan grafiikka vasteajoista..."
./create-response-time-chart.sh $CSV_OUTPUT

# Lisätään mallikohtaiset metriikat yhteenvetoon
echo "" >> $SUMMARY_OUTPUT
echo "Mallikohtaiset metriikat:" >> $SUMMARY_OUTPUT
echo "=====================" >> $SUMMARY_OUTPUT

# OpenAI
if grep -q '"metric":"openai_processing_time"' $JSON_OUTPUT; then
  OPENAI_VALUES=$(cat $JSON_OUTPUT | grep '"metric":"openai_processing_time"' | grep '"type":"Point"' | jq -r '.data.value')
  OPENAI_AVG=$(echo "$OPENAI_VALUES" | awk '{ sum += $1; n++ } END { if (n > 0) print sum / n; else print "N/A" }')
  OPENAI_COUNT=$(echo "$OPENAI_VALUES" | wc -l)
  echo "OpenAI:" >> $SUMMARY_OUTPUT
  echo "  Pyyntöjen määrä: $OPENAI_COUNT" >> $SUMMARY_OUTPUT
  echo "  Keskimääräinen vasteaika: $OPENAI_AVG ms" >> $SUMMARY_OUTPUT
fi

# Anthropic
if grep -q '"metric":"anthropic_processing_time"' $JSON_OUTPUT; then
  ANTHROPIC_VALUES=$(cat $JSON_OUTPUT | grep '"metric":"anthropic_processing_time"' | grep '"type":"Point"' | jq -r '.data.value')
  ANTHROPIC_AVG=$(echo "$ANTHROPIC_VALUES" | awk '{ sum += $1; n++ } END { if (n > 0) print sum / n; else print "N/A" }')
  ANTHROPIC_COUNT=$(echo "$ANTHROPIC_VALUES" | wc -l)
  echo "Anthropic:" >> $SUMMARY_OUTPUT
  echo "  Pyyntöjen määrä: $ANTHROPIC_COUNT" >> $SUMMARY_OUTPUT
  echo "  Keskimääräinen vasteaika: $ANTHROPIC_AVG ms" >> $SUMMARY_OUTPUT
fi

# Ollama
if grep -q '"metric":"ollama_processing_time"' $JSON_OUTPUT; then
  OLLAMA_VALUES=$(cat $JSON_OUTPUT | grep '"metric":"ollama_processing_time"' | grep '"type":"Point"' | jq -r '.data.value')
  OLLAMA_AVG=$(echo "$OLLAMA_VALUES" | awk '{ sum += $1; n++ } END { if (n > 0) print sum / n; else print "N/A" }')
  OLLAMA_COUNT=$(echo "$OLLAMA_VALUES" | wc -l)
  echo "Ollama:" >> $SUMMARY_OUTPUT
  echo "  Pyyntöjen määrä: $OLLAMA_COUNT" >> $SUMMARY_OUTPUT
  echo "  Keskimääräinen vasteaika: $OLLAMA_AVG ms" >> $SUMMARY_OUTPUT
fi

# Promptikohtaiset metriikat
echo "" >> $SUMMARY_OUTPUT
echo "Promptikohtaiset metriikat:" >> $SUMMARY_OUTPUT
echo "========================" >> $SUMMARY_OUTPUT

# Lyhyt prompti
if grep -q '"metric":"short_prompt_time"' $JSON_OUTPUT; then
  SHORT_VALUES=$(cat $JSON_OUTPUT | grep '"metric":"short_prompt_time"' | grep '"type":"Point"' | jq -r '.data.value')
  SHORT_AVG=$(echo "$SHORT_VALUES" | awk '{ sum += $1; n++ } END { if (n > 0) print sum / n; else print "N/A" }')
  SHORT_COUNT=$(echo "$SHORT_VALUES" | wc -l)
  echo "Lyhyt prompti:" >> $SUMMARY_OUTPUT
  echo "  Pyyntöjen määrä: $SHORT_COUNT" >> $SUMMARY_OUTPUT
  echo "  Keskimääräinen vasteaika: $SHORT_AVG ms" >> $SUMMARY_OUTPUT
fi

# Pitkä prompti
if grep -q '"metric":"long_prompt_time"' $JSON_OUTPUT; then
  LONG_VALUES=$(cat $JSON_OUTPUT | grep '"metric":"long_prompt_time"' | grep '"type":"Point"' | jq -r '.data.value')
  LONG_AVG=$(echo "$LONG_VALUES" | awk '{ sum += $1; n++ } END { if (n > 0) print sum / n; else print "N/A" }')
  LONG_COUNT=$(echo "$LONG_VALUES" | wc -l)
  echo "Pitkä prompti:" >> $SUMMARY_OUTPUT
  echo "  Pyyntöjen määrä: $LONG_COUNT" >> $SUMMARY_OUTPUT
  echo "  Keskimääräinen vasteaika: $LONG_AVG ms" >> $SUMMARY_OUTPUT
fi

echo "Kuormitustesti ja raportointi valmis!"
