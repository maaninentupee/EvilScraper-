/**
 * Yksinkertainen skripti model-comparison-test.js -testin tulosten näyttämiseen
 * 
 * Käyttö: node show-test-summary.js
 */

const fs = require('fs');
const path = require('path');

// ANSI-värikoodit konsolitulosteita varten
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  red: '\x1b[31m'
};

// Etsi viimeisin model-comparison-results.json tiedosto
function findLatestResultFile() {
  const files = fs.readdirSync('.');
  const resultFiles = files.filter(file => 
    file.startsWith('model-comparison-results') && 
    (file.endsWith('.json') || file.endsWith('.txt'))
  );
  
  if (resultFiles.length === 0) {
    console.error(`${colors.red}Virhe: Tulostiedostoa ei löytynyt.${colors.reset}`);
    console.log(`Aja testi ensin komennolla: ${colors.cyan}k6 run model-comparison-test.js${colors.reset}`);
    return null;
  }
  
  // Järjestä tiedostot muokkauspäivämäärän mukaan (uusin ensin)
  resultFiles.sort((a, b) => {
    return fs.statSync(b).mtime.getTime() - fs.statSync(a).mtime.getTime();
  });
  
  return resultFiles[0];
}

// Analysoi k6:n tuottama tulostiedosto
function analyzeResults(filePath) {
  console.log(`${colors.bright}${colors.blue}Analysoidaan tiedostoa: ${filePath}${colors.reset}\n`);
  
  // Lue tiedosto
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  // Alusta laskurit
  const metrics = {
    openai: { count: 0, success: 0, totalTime: 0, times: [] },
    anthropic: { count: 0, success: 0, totalTime: 0, times: [] },
    ollama: { count: 0, success: 0, totalTime: 0, times: [] },
    total: { count: 0, success: 0, failed: 0, totalTime: 0, times: [] }
  };
  
  // Etsi metriikkatiedot
  for (const line of lines) {
    try {
      if (!line.trim()) continue;
      
      const data = JSON.parse(line);
      
      // Kerää HTTP-pyyntöjen tiedot
      if (data.metric === 'http_reqs' && data.type === 'Point') {
        metrics.total.count++;
        
        const url = data.data.tags.url || '';
        const status = data.data.tags.status || '';
        const isSuccess = status.startsWith('2');
        
        if (isSuccess) {
          metrics.total.success++;
        } else {
          metrics.total.failed++;
        }
        
        // Tunnista palveluntarjoaja URL:n perusteella
        if (url.includes('/openai')) {
          metrics.openai.count++;
          if (isSuccess) metrics.openai.success++;
        } else if (url.includes('/anthropic')) {
          metrics.anthropic.count++;
          if (isSuccess) metrics.anthropic.success++;
        } else if (url.includes('/ollama')) {
          metrics.ollama.count++;
          if (isSuccess) metrics.ollama.success++;
        }
      }
      
      // Kerää vasteaikatiedot
      if (data.metric === 'http_req_duration' && data.type === 'Point') {
        const duration = data.data.value || 0;
        metrics.total.totalTime += duration;
        metrics.total.times.push(duration);
        
        const url = data.data.tags.url || '';
        
        if (url.includes('/openai')) {
          metrics.openai.totalTime += duration;
          metrics.openai.times.push(duration);
        } else if (url.includes('/anthropic')) {
          metrics.anthropic.totalTime += duration;
          metrics.anthropic.times.push(duration);
        } else if (url.includes('/ollama')) {
          metrics.ollama.totalTime += duration;
          metrics.ollama.times.push(duration);
        }
      }
      
      // Kerää mallikohtaiset käsittelyajat
      if (data.metric === 'openai_processing_time' && data.type === 'Point') {
        metrics.openai.totalTime += data.data.value || 0;
      }
      
      if (data.metric === 'anthropic_processing_time' && data.type === 'Point') {
        metrics.anthropic.totalTime += data.data.value || 0;
      }
      
      if (data.metric === 'ollama_processing_time' && data.type === 'Point') {
        metrics.ollama.totalTime += data.data.value || 0;
      }
    } catch (e) {
      // Ohita virheelliset rivit
      continue;
    }
  }
  
  // Laske keskiarvot ja muut tilastot
  const calculateAvg = (arr) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const calculateP95 = (arr) => {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = Math.floor(sorted.length * 0.95);
    return sorted[idx] || sorted[sorted.length - 1];
  };
  
  metrics.openai.avgTime = calculateAvg(metrics.openai.times);
  metrics.anthropic.avgTime = calculateAvg(metrics.anthropic.times);
  metrics.ollama.avgTime = calculateAvg(metrics.ollama.times);
  metrics.total.avgTime = calculateAvg(metrics.total.times);
  
  metrics.openai.p95Time = calculateP95(metrics.openai.times);
  metrics.anthropic.p95Time = calculateP95(metrics.anthropic.times);
  metrics.ollama.p95Time = calculateP95(metrics.ollama.times);
  metrics.total.p95Time = calculateP95(metrics.total.times);
  
  metrics.openai.successRate = metrics.openai.count > 0 ? (metrics.openai.success / metrics.openai.count) * 100 : 0;
  metrics.anthropic.successRate = metrics.anthropic.count > 0 ? (metrics.anthropic.success / metrics.anthropic.count) * 100 : 0;
  metrics.ollama.successRate = metrics.ollama.count > 0 ? (metrics.ollama.success / metrics.ollama.count) * 100 : 0;
  metrics.total.successRate = metrics.total.count > 0 ? (metrics.total.success / metrics.total.count) * 100 : 0;
  
  return metrics;
}

// Tulosta yhteenveto
function printSummary(metrics) {
  console.log(`${colors.bright}${colors.magenta}AI-MALLIEN VERTAILUN TULOKSET${colors.reset}\n`);
  
  console.log(`${colors.bright}Yleiset metriikat:${colors.reset}`);
  console.log(`- Kokonaispyyntöjen määrä: ${metrics.total.count}`);
  console.log(`- Onnistuneet pyynnöt: ${metrics.total.success} (${metrics.total.successRate.toFixed(2)}%)`);
  console.log(`- Epäonnistuneet pyynnöt: ${metrics.total.failed} (${(100 - metrics.total.successRate).toFixed(2)}%)`);
  console.log(`- Keskimääräinen vasteaika: ${metrics.total.avgTime.toFixed(2)} ms`);
  console.log(`- 95% vasteaika: ${metrics.total.p95Time.toFixed(2)} ms\n`);
  
  console.log(`${colors.bright}${colors.cyan}MALLIEN SUORITUSKYKY${colors.reset}\n`);
  
  // Taulukko mallien vertailuun
  console.log(`${colors.bright}┌─────────────────────────────┬────────────────────┬─────────────────┬─────────────────┐${colors.reset}`);
  console.log(`${colors.bright}│ Malli                       │ Keskimääräinen     │ Onnistumis-     │ Pyyntöjen       │${colors.reset}`);
  console.log(`${colors.bright}│                             │ vasteaika          │ prosentti       │ määrä           │${colors.reset}`);
  console.log(`${colors.bright}├─────────────────────────────┼────────────────────┼─────────────────┼─────────────────┤${colors.reset}`);
  
  console.log(`│ OpenAI (gpt-3.5-turbo)      │ ${padRight(metrics.openai.avgTime.toFixed(2) + ' ms', 18)} │ ${padRight(metrics.openai.successRate.toFixed(2) + '%', 15)} │ ${padRight(metrics.openai.count.toString(), 15)} │`);
  console.log(`│ Anthropic (claude-instant-1) │ ${padRight(metrics.anthropic.avgTime.toFixed(2) + ' ms', 18)} │ ${padRight(metrics.anthropic.successRate.toFixed(2) + '%', 15)} │ ${padRight(metrics.anthropic.count.toString(), 15)} │`);
  console.log(`│ Ollama (llama2)             │ ${padRight(metrics.ollama.avgTime.toFixed(2) + ' ms', 18)} │ ${padRight(metrics.ollama.successRate.toFixed(2) + '%', 15)} │ ${padRight(metrics.ollama.count.toString(), 15)} │`);
  
  console.log(`${colors.bright}└─────────────────────────────┴────────────────────┴─────────────────┴─────────────────┘${colors.reset}`);
  
  // Määritä luotettavin malli
  let mostReliableModel = 'OpenAI (gpt-3.5-turbo)';
  let highestSuccessRate = metrics.openai.successRate;
  
  if (metrics.anthropic.successRate > highestSuccessRate) {
    mostReliableModel = 'Anthropic (claude-instant-1)';
    highestSuccessRate = metrics.anthropic.successRate;
  }
  
  if (metrics.ollama.successRate > highestSuccessRate) {
    mostReliableModel = 'Ollama (llama2)';
    highestSuccessRate = metrics.ollama.successRate;
  }
  
  // Määritä nopein malli
  let fastestModel = 'OpenAI (gpt-3.5-turbo)';
  let lowestAvgTime = metrics.openai.avgTime;
  
  if (metrics.anthropic.avgTime < lowestAvgTime && metrics.anthropic.count > 0) {
    fastestModel = 'Anthropic (claude-instant-1)';
    lowestAvgTime = metrics.anthropic.avgTime;
  }
  
  if (metrics.ollama.avgTime < lowestAvgTime && metrics.ollama.count > 0) {
    fastestModel = 'Ollama (llama2)';
    lowestAvgTime = metrics.ollama.avgTime;
  }
  
  console.log(`\n${colors.bright}Luotettavin malli: ${colors.green}${mostReliableModel}${colors.reset}${colors.bright} (${highestSuccessRate.toFixed(2)}%)${colors.reset}`);
  console.log(`${colors.bright}Nopein malli: ${colors.green}${fastestModel}${colors.reset}${colors.bright} (${lowestAvgTime.toFixed(2)} ms)${colors.reset}\n`);
  
  console.log(`${colors.bright}${colors.yellow}SUOSITUKSET FALLBACK-MEKANISMILLE${colors.reset}\n`);
  
  console.log(`${colors.bright}Suositeltu prioriteettijärjestys:${colors.reset}`);
  
  // Määritä suositeltu prioriteettijärjestys (painotus: 70% luotettavuus, 30% nopeus)
  const modelScores = [
    { 
      name: 'OpenAI (gpt-3.5-turbo)', 
      score: metrics.openai.successRate * 0.7 + (metrics.openai.avgTime > 0 ? (1000 / metrics.openai.avgTime) * 0.3 : 0)
    },
    { 
      name: 'Anthropic (claude-instant-1)', 
      score: metrics.anthropic.successRate * 0.7 + (metrics.anthropic.avgTime > 0 ? (1000 / metrics.anthropic.avgTime) * 0.3 : 0)
    },
    { 
      name: 'Ollama (llama2)', 
      score: metrics.ollama.successRate * 0.7 + (metrics.ollama.avgTime > 0 ? (1000 / metrics.ollama.avgTime) * 0.3 : 0)
    }
  ];
  
  // Järjestä mallit pisteiden mukaan
  modelScores.sort((a, b) => b.score - a.score);
  
  // Tulosta suositeltu prioriteettijärjestys
  modelScores.forEach((model, index) => {
    console.log(`${index + 1}. ${model.name}`);
  });
  
  console.log(`\n${colors.bright}Suositukset fallback-mekanismin parantamiseksi:${colors.reset}`);
  console.log(`1. Käytä AIGateway-luokan processAIRequestWithFallback-metodia, joka vaihtaa automaattisesti toiseen malliin virhetilanteissa.`);
  console.log(`2. Aseta mallit prioriteettijärjestykseen yllä olevan suosituksen mukaisesti.`);
  console.log(`3. Lisää virheidenkäsittelyyn eri virhetyyppien tunnistus (timeout, rate_limit_exceeded, service_unavailable).`);
  console.log(`4. Toteuta viiveen lisääminen ennen uudelleenyritystä, erityisesti rate_limit_exceeded-virheille.`);
  console.log(`5. Lisää metriikkojen kerääminen eri mallien suorituskyvystä ja virhetilanteista.`);
  
  console.log(`\n${colors.bright}Huomioitavaa:${colors.reset}`);
  console.log(`- Fallback-mekanismin tulisi palauttaa strukturoitu virheobjekti virheiden heittämisen sijaan.`);
  console.log(`- Varmista, että järjestelmä pystyy toipumaan tilanteesta, jossa kaikki palveluntarjoajat epäonnistuvat.`);
  console.log(`- Harkitse jonojärjestelmän käyttöönottoa korkean kuormituksen aikana.`);
}

// Apufunktio tekstin tasaamiseen
function padRight(text, length) {
  return text + ' '.repeat(Math.max(0, length - text.length));
}

// Pääohjelma
const resultFile = findLatestResultFile();
if (resultFile) {
  const metrics = analyzeResults(resultFile);
  printSummary(metrics);
}
