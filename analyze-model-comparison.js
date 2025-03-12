/**
 * Työkalu model-comparison-test.js -testin tulosten analysointiin
 * 
 * Käyttö:
 * 1. Aja testi: k6 run model-comparison-test.js --out json=results.json
 * 2. Analysoi tulokset: node analyze-model-comparison.js results.json
 */

const fs = require('fs');
const path = require('path');

// ANSI-värikoodit konsolitulosteita varten
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',
  
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m'
};

/**
 * Pääfunktio, joka analysoi k6:n tuottamat testitulokset
 * @param {string} filePath - Polku k6:n tuottamaan JSON-tiedostoon
 */
async function analyzeResults(filePath) {
  try {
    // Tarkistetaan, onko tiedosto olemassa
    if (!fs.existsSync(filePath)) {
      console.error(`${colors.red}Virhe: Tiedostoa ${filePath} ei löydy.${colors.reset}`);
      console.log(`Aja testi ensin komennolla: ${colors.cyan}k6 run model-comparison-test.js --out json=results.json${colors.reset}`);
      return;
    }

    // Luetaan tiedosto
    const rawData = fs.readFileSync(filePath, 'utf8');
    
    // Tarkistetaan, onko kyseessä JSON-tiedosto vai lokitiedosto
    let data = { metrics: {} };
    let isLogFile = false;
    
    if (filePath.endsWith('.json')) {
      try {
        // Yritä jäsentää JSON-tiedosto
        data = JSON.parse(rawData);
      } catch (e) {
        // Jos se ei onnistu, käsittele tiedosto kuten aiemmin
        console.log(`${colors.yellow}Varoitus: JSON-tiedoston jäsentäminen epäonnistui: ${e.message}${colors.reset}`);
        console.log(`${colors.yellow}Yritetään käsitellä tiedostoa lokitiedostona...${colors.reset}`);
        isLogFile = true;
      }
    } else {
      // Kyseessä on todennäköisesti lokitiedosto
      isLogFile = true;
    }
    
    if (isLogFile) {
      // Laske keskiarvot
      const calculateAvg = (arr) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
      
      // Laske p95 (95. persentiili)
      const calculateP95 = (arr) => {
        if (arr.length === 0) return 0;
        const sorted = [...arr].sort((a, b) => a - b);
        const idx = Math.floor(sorted.length * 0.95);
        return sorted[idx] || sorted[sorted.length - 1];
      };
      
      // Etsi mallien metriikat yhteenvedosta
      const openaiTimeRegex = /openai_processing_time[.\s]*: avg=([0-9.]+).*?p\(95\)=([0-9.]+)/;
      const anthropicTimeRegex = /anthropic_processing_time[.\s]*: avg=([0-9.]+).*?p\(95\)=([0-9.]+)/;
      const ollamaTimeRegex = /ollama_processing_time[.\s]*: avg=([0-9.]+).*?p\(95\)=([0-9.]+)/;
      
      const openaiSuccessRegex = /openai_success_rate[.\s]*: ([0-9.]+)% ([0-9]+) out of ([0-9]+)/;
      const anthropicSuccessRegex = /anthropic_success_rate[.\s]*: ([0-9.]+)% ([0-9]+) out of ([0-9]+)/;
      const ollamaSuccessRegex = /ollama_success_rate[.\s]*: ([0-9.]+)% ([0-9]+) out of ([0-9]+)/;
      
      // Etsi testin kokonaiskesto
      const durationRegex = /running \(([0-9]+)m([0-9]+)\.([0-9]+)s\)/;
      
      // Etsi virtuaalikäyttäjien määrä
      const vusRegex = /vus_max[.\s]*: ([0-9]+)/;
      
      // Etsi kokonaispyyntöjen määrä
      const requestsRegex = /http_reqs[.\s]*: ([0-9]+)/;
      
      // Etsi virheprosentti
      const errorRateRegex = /error_rate[.\s]*: ([0-9.]+)%/;
      
      // Etsi keskimääräinen vasteaika
      const avgDurationRegex = /http_req_duration[.\s]*: avg=([0-9.]+)ms.*?p\(95\)=([0-9.]+)s/;
      
      // Alusta muuttujat
      let openaiAvg = 0;
      let openaiP95 = 0;
      let openaiCount = 0;
      let openaiSuccessRate = 0;
      
      let anthropicAvg = 0;
      let anthropicP95 = 0;
      let anthropicCount = 0;
      let anthropicSuccessRate = 0;
      
      let ollamaAvg = 0;
      let ollamaP95 = 0;
      let ollamaCount = 0;
      let ollamaSuccessRate = 0;
      
      let totalDuration = 0;
      let maxVUs = 0;
      let totalRequests = 0;
      let errorRate = 0;
      let avgDuration = 0;
      let p95Duration = 0;
      
      // Etsi tiedot lokista
      const openaiTimeMatch = rawData.match(openaiTimeRegex);
      if (openaiTimeMatch) {
        openaiAvg = parseFloat(openaiTimeMatch[1]);
        openaiP95 = parseFloat(openaiTimeMatch[2]);
      }
      
      const anthropicTimeMatch = rawData.match(anthropicTimeRegex);
      if (anthropicTimeMatch) {
        anthropicAvg = parseFloat(anthropicTimeMatch[1]);
        anthropicP95 = parseFloat(anthropicTimeMatch[2]);
      }
      
      const ollamaTimeMatch = rawData.match(ollamaTimeRegex);
      if (ollamaTimeMatch) {
        ollamaAvg = parseFloat(ollamaTimeMatch[1]);
        ollamaP95 = parseFloat(ollamaTimeMatch[2]);
      }
      
      const openaiSuccessMatch = rawData.match(openaiSuccessRegex);
      if (openaiSuccessMatch) {
        openaiSuccessRate = parseFloat(openaiSuccessMatch[1]);
        openaiCount = parseInt(openaiSuccessMatch[3]);
      }
      
      const anthropicSuccessMatch = rawData.match(anthropicSuccessRegex);
      if (anthropicSuccessMatch) {
        anthropicSuccessRate = parseFloat(anthropicSuccessMatch[1]);
        anthropicCount = parseInt(anthropicSuccessMatch[3]);
      }
      
      const ollamaSuccessMatch = rawData.match(ollamaSuccessRegex);
      if (ollamaSuccessMatch) {
        ollamaSuccessRate = parseFloat(ollamaSuccessMatch[1]);
        ollamaCount = parseInt(ollamaSuccessMatch[3]);
      }
      
      const durationMatch = rawData.match(durationRegex);
      if (durationMatch) {
        const minutes = parseInt(durationMatch[1]);
        const seconds = parseInt(durationMatch[2]);
        const milliseconds = parseInt(durationMatch[3]) * 100; // k6 näyttää vain yhden desimaalin
        totalDuration = minutes * 60 * 1000 + seconds * 1000 + milliseconds;
      } else {
        // Etsi viimeinen "running" rivi
        const lastRunningRegex = /running \(([0-9]+)m([0-9]+)\.([0-9]+)s\)/g;
        let lastMatch;
        let tempMatch;
        
        while ((tempMatch = lastRunningRegex.exec(rawData)) !== null) {
          lastMatch = tempMatch;
        }
        
        if (lastMatch) {
          const minutes = parseInt(lastMatch[1]);
          const seconds = parseInt(lastMatch[2]);
          const milliseconds = parseInt(lastMatch[3]) * 100; // k6 näyttää vain yhden desimaalin
          totalDuration = minutes * 60 * 1000 + seconds * 1000 + milliseconds;
        }
      }
      
      const vusMatch = rawData.match(vusRegex);
      if (vusMatch) {
        maxVUs = parseInt(vusMatch[1]);
      }
      
      const requestsMatch = rawData.match(requestsRegex);
      if (requestsMatch) {
        totalRequests = parseInt(requestsMatch[1]);
      }
      
      const errorRateMatch = rawData.match(errorRateRegex);
      if (errorRateMatch) {
        errorRate = parseFloat(errorRateMatch[1]);
      }
      
      const avgDurationMatch = rawData.match(avgDurationRegex);
      if (avgDurationMatch) {
        avgDuration = parseFloat(avgDurationMatch[1]);
        p95Duration = parseFloat(avgDurationMatch[2]) * 1000; // Muunna sekunnit millisekunneiksi
      }
      
      console.log(`OpenAI: avg=${openaiAvg}ms, p95=${openaiP95}ms, count=${openaiCount}, success=${openaiSuccessRate}%`);
      console.log(`Anthropic: avg=${anthropicAvg}ms, p95=${anthropicP95}ms, count=${anthropicCount}, success=${anthropicSuccessRate}%`);
      console.log(`Ollama: avg=${ollamaAvg}ms, p95=${ollamaP95}ms, count=${ollamaCount}, success=${ollamaSuccessRate}%`);
      
      // Laske kokonaispyyntöjen määrä ja onnistuneiden pyyntöjen määrä
      const totalModelRequests = openaiCount + anthropicCount + ollamaCount;
      const successfulRequests = totalModelRequests;
      const failedRequests = totalRequests * (errorRate / 100);
      
      // Luo keinotekoiset metriikat
      const metrics = {
        'openai_processing_time': {
          values: {
            avg: openaiAvg,
            p95: openaiP95,
            count: openaiCount,
            rate: openaiSuccessRate / 100
          }
        },
        'anthropic_processing_time': {
          values: {
            avg: anthropicAvg,
            p95: anthropicP95,
            count: anthropicCount,
            rate: anthropicSuccessRate / 100
          }
        },
        'ollama_processing_time': {
          values: {
            avg: ollamaAvg,
            p95: ollamaP95,
            count: ollamaCount,
            rate: ollamaSuccessRate / 100
          }
        },
        'ai_processing_time': {
          values: {
            avg: avgDuration,
            p95: p95Duration
          }
        },
        'openai_success_rate': {
          values: {
            rate: openaiSuccessRate / 100
          }
        },
        'anthropic_success_rate': {
          values: {
            rate: anthropicSuccessRate / 100
          }
        },
        'ollama_success_rate': {
          values: {
            rate: ollamaSuccessRate / 100
          }
        },
        'http_reqs': {
          values: {
            count: totalModelRequests
          }
        },
        'successful_requests': {
          values: {
            count: successfulRequests
          }
        },
        'failed_requests': {
          values: {
            count: failedRequests
          }
        },
        'error_rate': {
          values: {
            rate: errorRate / 100
          }
        },
        'timeout_errors': {
          values: {
            count: 0
          }
        }
      };
      
      // Aseta metriikat data-objektiin
      data.metrics = metrics;
      
      // Aseta testin kesto
      data.state = {
        testRunDurationMs: totalDuration,
        maxVUs: maxVUs
      };
    }
    
    // Tarkista, onko metriikoita
    if (!data.metrics || Object.keys(data.metrics).length === 0) {
      console.error(`${colors.red}Virhe: Metriikoita ei löytynyt tiedostosta.${colors.reset}`);
      return;
    }
    
    // Tulostetaan yleiset tiedot
    printGeneralInfo(data);
    
    // Analysoidaan eri mallien suorituskykyä
    analyzeModelPerformance(data);
    
    // Annetaan suosituksia
    provideRecommendations(data);
    
    // Tallennetaan tulokset CSV-tiedostoon
    const csvFilePath = saveResultsToCSV(data);
    console.log(`\nTulokset tallennettu CSV-tiedostoon: ${colors.green}${csvFilePath}${colors.reset}`);
    
  } catch (error) {
    console.error(`${colors.red}Virhe tulosten analysoinnissa: ${error.message}${colors.reset}`);
  }
}

/**
 * Tulostaa yleiset tiedot testistä
 * @param {Object} data - k6:n tuottama JSON-data
 */
function printGeneralInfo(data) {
  const metrics = data.metrics || {};
  const state = data.state || {};
  
  console.log(`\n${colors.bright}${colors.bgBlue}${colors.white} AI-MALLIEN VERTAILUN TULOKSET ${colors.reset}\n`);
  
  // Testin tiedot
  console.log(`${colors.bright}Testin tiedot:${colors.reset}`);
  
  // Muunna millisekunnit luettavaan muotoon
  const durationMs = state.testRunDurationMs || 0;
  const minutes = Math.floor(durationMs / 60000);
  const seconds = Math.floor((durationMs % 60000) / 1000);
  const milliseconds = durationMs % 1000;
  
  const durationStr = minutes > 0 
    ? `${minutes} min ${seconds}.${String(milliseconds).padStart(3, '0')} s`
    : `${seconds}.${String(milliseconds).padStart(3, '0')} s`;
  
  console.log(`- Testin kesto: ${durationStr}`);
  console.log(`- Virtuaalikäyttäjien maksimimäärä: ${state.maxVUs || 0}`);
  
  // Yleiset metriikat
  console.log(`\n${colors.bright}Yleiset metriikat:${colors.reset}`);
  
  const totalRequests = metrics['http_reqs']?.values?.count || 0;
  const successfulRequests = metrics['successful_requests']?.values?.count || 0;
  const failedRequests = metrics['failed_requests']?.values?.count || 0;
  const successRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0;
  
  console.log(`- Kokonaispyyntöjen määrä: ${totalRequests}`);
  console.log(`- Onnistuneet pyynnöt: ${successfulRequests} (${successRate.toFixed(2)}%)`);
  console.log(`- Epäonnistuneet pyynnöt: ${failedRequests} (${(100 - successRate).toFixed(2)}%)`);
  console.log(`- Virheprosentti: ${(metrics['error_rate']?.values?.rate * 100 || 0).toFixed(2)}%`);
  
  // Vasteajat
  console.log(`\n${colors.bright}Vasteajat:${colors.reset}`);
  
  const avgTime = metrics['ai_processing_time']?.values?.avg || 0;
  const p95Time = metrics['ai_processing_time']?.values?.p95 || 0;
  
  // Muotoile vasteajat luettavaan muotoon
  const formatTime = (timeMs) => {
    if (timeMs >= 1000) {
      return `${(timeMs / 1000).toFixed(2)} s`;
    } else {
      return `${timeMs.toFixed(2)} ms`;
    }
  };
  
  console.log(`- Keskimääräinen käsittelyaika: ${formatTime(avgTime)}`);
  console.log(`- 95% käsittelyaika: ${formatTime(p95Time)}`);
}

/**
 * Analysoi eri mallien suorituskykyä
 * @param {Object} data - k6:n tuottama JSON-data
 */
function analyzeModelPerformance(data) {
  const metrics = data.metrics || {};
  
  console.log(`\n${colors.bright}${colors.bgGreen}${colors.black} MALLIEN SUORITUSKYKY ${colors.reset}\n`);
  
  // Kerätään mallien tiedot
  const models = [
    {
      name: 'OpenAI (gpt-3.5-turbo)',
      processingTime: metrics['openai_processing_time']?.values?.avg || 0,
      successRate: metrics['openai_success_rate']?.values?.rate || 0,
      count: metrics['openai_processing_time']?.values?.count || 0
    },
    {
      name: 'Anthropic (claude-instant-1)',
      processingTime: metrics['anthropic_processing_time']?.values?.avg || 0,
      successRate: metrics['anthropic_success_rate']?.values?.rate || 0,
      count: metrics['anthropic_processing_time']?.values?.count || 0
    },
    {
      name: 'Ollama (llama2)',
      processingTime: metrics['ollama_processing_time']?.values?.avg || 0,
      successRate: metrics['ollama_success_rate']?.values?.rate || 0,
      count: metrics['ollama_processing_time']?.values?.count || 0
    }
  ];
  
  // Järjestetään mallit vasteajan mukaan (nopein ensin)
  const sortedBySpeed = [...models].filter(m => m.processingTime > 0).sort((a, b) => a.processingTime - b.processingTime);
  
  // Järjestetään mallit onnistumisprosentin mukaan (paras ensin)
  const sortedBySuccess = [...models].filter(m => !isNaN(m.successRate)).sort((a, b) => b.successRate - a.successRate);
  
  // Tulostetaan taulukko
  console.log(`${colors.bright}Mallien vertailu:${colors.reset}`);
  console.log('┌─────────────────────────────┬────────────────────┬─────────────────┬─────────────────┐');
  console.log('│ Malli                       │ Keskimääräinen     │ Onnistumis-     │ Pyyntöjen       │');
  console.log('│                             │ vasteaika          │ prosentti       │ määrä           │');
  console.log('├─────────────────────────────┼────────────────────┼─────────────────┼─────────────────┤');
  
  models.forEach(model => {
    const successRateFormatted = isNaN(model.successRate) ? 'Ei tietoa' : `${(model.successRate*100).toFixed(2)}%`;
    console.log(`│ ${padRight(model.name, 27)} │ ${padRight(formatDuration(model.processingTime), 18)} │ ${padRight(successRateFormatted, 15)} │ ${padRight(model.count.toString(), 15)} │`);
  });
  
  console.log('└─────────────────────────────┴────────────────────┴─────────────────┴─────────────────┘');
  
  // Tulostetaan nopein malli
  if (sortedBySpeed.length > 0) {
    console.log(`\n${colors.bright}Nopein malli:${colors.reset} ${colors.green}${sortedBySpeed[0].name}${colors.reset} (${formatDuration(sortedBySpeed[0].processingTime)})`);
  }
  
  // Tulostetaan luotettavin malli
  if (sortedBySuccess.length > 0) {
    console.log(`${colors.bright}Luotettavin malli:${colors.reset} ${colors.green}${sortedBySuccess[0].name}${colors.reset} (${(sortedBySuccess[0].successRate*100).toFixed(2)}%)`);
  }
}

/**
 * Antaa suosituksia tulosten perusteella
 * @param {Object} data - k6:n tuottama JSON-data
 */
function provideRecommendations(data) {
  const metrics = data.metrics || {};
  
  // Haetaan mallien vasteajat ja onnistumisprosentit
  const openaiTime = metrics['openai_processing_time']?.values?.avg || 0;
  const anthropicTime = metrics['anthropic_processing_time']?.values?.avg || 0;
  const ollamaTime = metrics['ollama_processing_time']?.values?.avg || 0;
  
  const openaiSuccessRate = metrics['openai_success_rate']?.values?.rate || 0;
  const anthropicSuccessRate = metrics['anthropic_success_rate']?.values?.rate || 0;
  const ollamaSuccessRate = metrics['ollama_success_rate']?.values?.rate || 0;
  
  const timeoutErrors = metrics['timeout_errors']?.values?.count || 0;
  const totalErrors = (metrics['failed_requests']?.values?.count || 0);
  
  console.log(`\n${colors.bright}${colors.bgMagenta}${colors.white} SUOSITUKSET ${colors.reset}\n`);
  
  // Suositukset mallien käytöstä
  console.log(`${colors.bright}Mallien käyttösuositukset:${colors.reset}`);
  
  // Nopein malli
  let fastestModel = 'OpenAI (gpt-3.5-turbo)';
  let fastestTime = openaiTime;
  
  if (anthropicTime > 0 && anthropicTime < fastestTime) {
    fastestModel = 'Anthropic (claude-instant-1)';
    fastestTime = anthropicTime;
  }
  
  if (ollamaTime > 0 && ollamaTime < fastestTime) {
    fastestModel = 'Ollama (llama2)';
    fastestTime = ollamaTime;
  }
  
  // Luotettavin malli
  let mostReliableModel = 'OpenAI (gpt-3.5-turbo)';
  let highestReliability = openaiSuccessRate;
  
  if (anthropicSuccessRate > highestReliability) {
    mostReliableModel = 'Anthropic (claude-instant-1)';
    highestReliability = anthropicSuccessRate;
  }
  
  if (ollamaSuccessRate > highestReliability) {
    mostReliableModel = 'Ollama (llama2)';
    highestReliability = ollamaSuccessRate;
  }
  
  // Paras hinta-laatusuhde (oletetaan, että Ollama on ilmainen, Anthropic halvempi kuin OpenAI)
  let bestValueModel = 'Ollama (llama2)';
  
  // Jos kaikki mallit ovat yhtä luotettavia, suositellaan nopeinta
  if (openaiSuccessRate === anthropicSuccessRate && anthropicSuccessRate === ollamaSuccessRate) {
    console.log(`- Nopeutta vaativiin tehtäviin: ${colors.green}${fastestModel}${colors.reset}`);
    console.log(`- Luotettavuutta vaativiin tehtäviin: ${colors.green}${mostReliableModel}${colors.reset}`);
    console.log(`- Kustannustehokkuutta vaativiin tehtäviin: ${colors.green}${bestValueModel}${colors.reset}`);
  } else {
    // Muuten tehdään tasapainotettu suositus
    console.log(`- Nopeutta vaativiin tehtäviin: ${colors.green}${fastestModel}${colors.reset}`);
    console.log(`- Luotettavuutta vaativiin tehtäviin: ${colors.green}${mostReliableModel}${colors.reset}`);
    console.log(`- Kustannustehokkuutta vaativiin tehtäviin: ${colors.green}${bestValueModel}${colors.reset}`);
    
    // Suositellaan tasapainotettua lähestymistapaa
    if (anthropicSuccessRate >= 0.95 && anthropicTime < openaiTime * 1.5) {
      console.log(`- Tasapainotettuun käyttöön: ${colors.green}Anthropic (claude-instant-1)${colors.reset}`);
    } else if (ollamaSuccessRate >= 0.9 && ollamaTime < anthropicTime * 0.5) {
      console.log(`- Tasapainotettuun käyttöön: ${colors.green}Ollama (llama2)${colors.reset}`);
    } else {
      console.log(`- Tasapainotettuun käyttöön: ${colors.green}OpenAI (gpt-3.5-turbo)${colors.reset}`);
    }
  }
  
  // Suositukset virhetilanteiden käsittelyyn
  console.log(`\n${colors.bright}Suositukset virhetilanteiden käsittelyyn:${colors.reset}`);
  
  if (totalErrors > 0) {
    if (timeoutErrors > 0) {
      console.log(`- Lisää timeout-arvoa API-kutsuissa, nykyinen arvo saattaa olla liian alhainen.`);
    }
    
    console.log(`- Käytä retry-mekanismia, joka yrittää uudelleen epäonnistuneiden pyyntöjen kohdalla.`);
    console.log(`- Harkitse circuit breaker -mallin käyttöönottoa, joka estää toistuvat kutsut vikaantuneeseen palveluun.`);
  }
  
  // Yleiset suositukset
  console.log(`\n${colors.bright}Yleiset suositukset:${colors.reset}`);
  console.log(`- Käytä AIGateway-luokan fallback-mekanismia, joka vaihtaa automaattisesti toiseen malliin virhetilanteissa.`);
  console.log(`- Aseta mallit prioriteettijärjestykseen luotettavuuden ja nopeuden perusteella.`);
  console.log(`- Rajoita samanaikaisten pyyntöjen määrää palvelimella, jotta vältytään ylikuormitukselta.`);
  console.log(`- Harkitse jonojärjestelmän käyttöönottoa korkean kuormituksen aikana.`);
  
  // Suositukset testien perusteella
  if (openaiTime > 1000 && anthropicTime < 500) {
    console.log(`- Harkitse Anthropic-mallin käyttöä ensisijaisena vaihtoehtona nopeutta vaativissa tehtävissä.`);
  }
  
  if (ollamaTime < 100 && ollamaSuccessRate > 0.9) {
    console.log(`- Harkitse Ollama-mallin käyttöä yksinkertaisissa tehtävissä sen nopeuden vuoksi.`);
  }
}

/**
 * Tallentaa tulokset CSV-tiedostoon
 * @param {Object} data - k6:n tuottama JSON-data
 */
function saveResultsToCSV(data) {
  const metrics = data.metrics || {};
  
  // Määritetään CSV-tiedoston polku
  const csvFilePath = path.join(
    path.dirname(process.argv[2]),
    `model-comparison-results-${new Date().toISOString().replace(/:/g, '-')}.csv`
  );
  
  // Kerätään mallien tiedot
  const models = [
    {
      name: 'OpenAI (gpt-3.5-turbo)',
      processingTime: metrics['openai_processing_time']?.values?.avg || 0,
      p95Time: metrics['openai_processing_time']?.values?.p95 || 0,
      successRate: metrics['openai_success_rate']?.values?.rate || 0
    },
    {
      name: 'Anthropic (claude-instant-1)',
      processingTime: metrics['anthropic_processing_time']?.values?.avg || 0,
      p95Time: metrics['anthropic_processing_time']?.values?.p95 || 0,
      successRate: metrics['anthropic_success_rate']?.values?.rate || 0
    },
    {
      name: 'Ollama (llama2)',
      processingTime: metrics['ollama_processing_time']?.values?.avg || 0,
      p95Time: metrics['ollama_processing_time']?.values?.p95 || 0,
      successRate: metrics['ollama_success_rate']?.values?.rate || 0
    }
  ];
  
  // Luodaan CSV-sisältö
  let csvContent = 'Malli,Keskimääräinen vasteaika (ms),P95 vasteaika (ms),Onnistumisprosentti\n';
  
  models.forEach(model => {
    const successRateFormatted = isNaN(model.successRate) ? 'N/A' : `${(model.successRate*100).toFixed(2)}%`;
    csvContent += `${model.name},${model.processingTime.toFixed(2)},${model.p95Time.toFixed(2)},${successRateFormatted}\n`;
  });
  
  // Lisätään yleiset metriikat
  csvContent += '\nYleiset metriikat\n';
  csvContent += `Kokonaispyyntöjen määrä,${(metrics['successful_requests']?.values?.count || 0) + (metrics['failed_requests']?.values?.count || 0)}\n`;
  csvContent += `Onnistuneet pyynnöt,${metrics['successful_requests']?.values?.count || 0}\n`;
  csvContent += `Epäonnistuneet pyynnöt,${metrics['failed_requests']?.values?.count || 0}\n`;
  csvContent += `Virheprosentti,${((metrics['error_rate']?.values?.rate || 0)*100).toFixed(2)}\n`;
  
  // Lisätään virhetyypit
  csvContent += '\nVirhetyypit\n';
  csvContent += `Timeout-virheet,${metrics['timeout_errors']?.values?.count || 0}\n`;
  csvContent += `Palvelinvirheet,${metrics['server_errors']?.values?.count || 0}\n`;
  csvContent += `Asiakasvirheet,${metrics['client_errors']?.values?.count || 0}\n`;
  
  // Tallennetaan CSV-tiedosto
  try {
    fs.writeFileSync(csvFilePath, csvContent);
    return csvFilePath;
  } catch (error) {
    console.error(`${colors.red}Virhe CSV-tiedoston tallennuksessa: ${error.message}${colors.reset}`);
  }
}

/**
 * Apufunktio ajan muotoiluun
 * @param {number} ms - Aika millisekunteina
 * @returns {string} Muotoiltu aika
 */
function formatDuration(ms) {
  if (ms < 1000) {
    return `${ms.toFixed(2)} ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(2)} s`;
  } else {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(2);
    return `${minutes} min ${seconds} s`;
  }
}

/**
 * Apufunktio tekstin tasaamiseen oikealle
 * @param {string} text - Teksti
 * @param {number} length - Haluttu pituus
 * @returns {string} Tasattu teksti
 */
function padRight(text, length) {
  return String(text).padEnd(length);
}

// Pääohjelman suoritus
if (process.argv.length < 3) {
  console.error(`${colors.red}Virhe: Anna tulostiedoston polku parametrina.${colors.reset}`);
  console.log(`Käyttö: ${colors.cyan}node analyze-model-comparison.js results.json${colors.reset}`);
} else {
  analyzeResults(process.argv[2]);
}
