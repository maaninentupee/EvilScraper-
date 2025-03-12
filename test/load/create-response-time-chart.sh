#!/bin/bash

# Tämä skripti luo grafiikan vasteajoista CSV-tiedoston perusteella
# Käyttö: ./create-response-time-chart.sh [csv-tiedosto]

CSV_FILE=$1
OUTPUT_DIR="./results/charts"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
PNG_OUTPUT="${OUTPUT_DIR}/response_time_chart_${TIMESTAMP}.png"
HTML_OUTPUT="${OUTPUT_DIR}/response_time_chart_${TIMESTAMP}.html"

# Varmistetaan, että tulostenhakemisto on olemassa
mkdir -p $OUTPUT_DIR

if [ -z "$CSV_FILE" ]; then
  echo "Virhe: CSV-tiedostoa ei määritelty."
  echo "Käyttö: ./create-response-time-chart.sh [csv-tiedosto]"
  exit 1
fi

if [ ! -f "$CSV_FILE" ]; then
  echo "Virhe: CSV-tiedostoa $CSV_FILE ei löydy."
  exit 1
fi

echo "Luodaan grafiikka tiedostosta: $CSV_FILE"
echo "Grafiikka tallennetaan tiedostoon: $PNG_OUTPUT"

# Tarkistetaan, onko gnuplot asennettu
if ! command -v gnuplot &> /dev/null; then
  echo "Varoitus: gnuplot ei ole asennettu. Luodaan HTML-grafiikka vaihtoehtoisesti."
  
  # Luodaan yksinkertainen HTML-grafiikka Chart.js:llä
  echo "<!DOCTYPE html>
<html>
<head>
  <title>Kuormitustestin tulokset</title>
  <script src=\"https://cdn.jsdelivr.net/npm/chart.js\"></script>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .container { max-width: 1200px; margin: 0 auto; }
    .chart-container { height: 400px; margin-bottom: 30px; }
  </style>
</head>
<body>
  <div class=\"container\">
    <h1>Kuormitustestin tulokset</h1>
    <p>Testitulokset: $(basename $CSV_FILE)</p>
    <p>Luotu: $(date)</p>
    
    <h2>HTTP-pyyntöjen kesto</h2>
    <div class=\"chart-container\">
      <canvas id=\"httpDurationChart\"></canvas>
    </div>
    
    <h2>AI-käsittelyaika</h2>
    <div class=\"chart-container\">
      <canvas id=\"aiProcessingChart\"></canvas>
    </div>
    
    <h2>Virheprosentti</h2>
    <div class=\"chart-container\">
      <canvas id=\"errorRateChart\"></canvas>
    </div>
  </div>

  <script>
    // Ladataan CSV-tiedosto
    fetch('$(basename $CSV_FILE)')
      .then(response => response.text())
      .then(csvData => {
        // Parsitaan CSV-data
        const lines = csvData.split('\\n');
        const headers = lines[0].split(',');
        const data = [];
        
        for (let i = 1; i < lines.length; i++) {
          if (lines[i].trim() === '') continue;
          const values = lines[i].split(',');
          data.push({
            timestamp: values[0],
            metric: values[1],
            value: parseFloat(values[2])
          });
        }
        
        // Järjestetään data aikajärjestykseen
        data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        // Erotellaan eri metriikat
        const httpDuration = data.filter(item => item.metric.includes('http_req_duration'));
        const aiProcessing = data.filter(item => item.metric.includes('ai_processing_time'));
        const errorRate = data.filter(item => item.metric.includes('error_rate'));
        
        // Luodaan kuvaajat
        createChart('httpDurationChart', httpDuration, 'HTTP-pyyntöjen kesto (ms)', 'blue');
        createChart('aiProcessingChart', aiProcessing, 'AI-käsittelyaika (ms)', 'green');
        createChart('errorRateChart', errorRate, 'Virheprosentti (%)', 'red');
      });
    
    function createChart(canvasId, data, label, color) {
      if (data.length === 0) return;
      
      const ctx = document.getElementById(canvasId).getContext('2d');
      
      const timestamps = data.map(item => new Date(item.timestamp).toLocaleTimeString());
      const values = data.map(item => item.value);
      
      new Chart(ctx, {
        type: 'line',
        data: {
          labels: timestamps,
          datasets: [{
            label: label,
            data: values,
            borderColor: color,
            backgroundColor: color + '20',
            tension: 0.1,
            fill: true
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true
            }
          }
        }
      });
    }
  </script>
</body>
</html>" > $HTML_OUTPUT
  
  echo "HTML-grafiikka luotu: $HTML_OUTPUT"
  exit 0
fi

# Luodaan gnuplot-skripti
GNUPLOT_SCRIPT=$(mktemp)

echo "set terminal png size 1200,800
set output '$PNG_OUTPUT'
set title 'Kuormitustestin tulokset'
set xlabel 'Aika'
set ylabel 'Arvo'
set grid
set key outside right top
set datafile separator ','

# Muotoillaan aikaleima
set xdata time
set timefmt '%Y-%m-%dT%H:%M:%S'
set format x '%H:%M:%S'

# Piirretään HTTP-pyyntöjen kesto
plot '$CSV_FILE' using 1:3 with lines title 'HTTP-pyyntöjen kesto (ms)' lc rgb 'blue' smooth bezier,\\
     '$CSV_FILE' using 1:3 with points title '' lc rgb 'blue' pt 7 ps 0.5

# Piirretään AI-käsittelyaika, jos saatavilla
if (system('grep ai_processing_time $CSV_FILE > /dev/null') == 0) {
  set output '${PNG_OUTPUT%.png}_ai.png'
  plot '$CSV_FILE' using 1:(\$2 eq 'ai_processing_time' ? \$3 : 1/0) with lines title 'AI-käsittelyaika (ms)' lc rgb 'green' smooth bezier,\\
       '$CSV_FILE' using 1:(\$2 eq 'ai_processing_time' ? \$3 : 1/0) with points title '' lc rgb 'green' pt 7 ps 0.5
}

# Piirretään virheprosentti
set output '${PNG_OUTPUT%.png}_error.png'
plot '$CSV_FILE' using 1:(\$2 eq 'error_rate' ? \$3*100 : 1/0) with lines title 'Virheprosentti (%)' lc rgb 'red' smooth bezier,\\
     '$CSV_FILE' using 1:(\$2 eq 'error_rate' ? \$3*100 : 1/0) with points title '' lc rgb 'red' pt 7 ps 0.5" > $GNUPLOT_SCRIPT

# Suoritetaan gnuplot
gnuplot $GNUPLOT_SCRIPT

# Siivotaan väliaikaistiedostot
rm $GNUPLOT_SCRIPT

echo "Grafiikka luotu onnistuneesti!"
echo "Tiedostot:"
echo "- ${PNG_OUTPUT}"
echo "- ${PNG_OUTPUT%.png}_ai.png"
echo "- ${PNG_OUTPUT%.png}_error.png"
