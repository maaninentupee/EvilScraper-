/**
 * analyze-fallback-results.js
 * 
 * Työkalu AI-mallien fallback-testien tulosten analysointiin ja visualisointiin.
 * Tämä skripti lukee k6-testien tuottamat JSON-tulostiedostot ja luo niistä
 * yhteenvedon, joka auttaa ymmärtämään fallback-mekanismin toimintaa.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { exec } = require('child_process');

// Värit konsolitulosteisiin
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

/**
 * Lukee k6:n tuottaman JSON-tulostiedoston
 * @param {string} filePath - Polku tulostiedostoon
 * @returns {Promise<Object>} - Lupaus, joka resolvoituu jäsennettyyn JSON-objektiin
 */
async function readK6ResultsFile(filePath) {
  try {
    // Tarkistetaan tiedoston koko
    const stats = fs.statSync(filePath);
    const fileSizeMB = stats.size / (1024 * 1024);
    console.log(`Tiedoston koko: ${fileSizeMB.toFixed(2)} MB`);
    
    if (fileSizeMB > 10) {
      console.log(`${colors.yellow}Tiedosto on suuri (${fileSizeMB.toFixed(2)} MB), käytetään virtaavaa käsittelyä${colors.reset}`);
      return await processLargeJsonFile(filePath);
    }
    
    // Pienemmille tiedostoille käytetään suoraa lukua
    const data = fs.readFileSync(filePath, 'utf8');
    
    try {
      return JSON.parse(data);
    } catch (jsonError) {
      console.log(`${colors.yellow}JSON-jäsennysvirhe, yritetään korjata tiedostoa${colors.reset}`);
      
      // Yritetään korjata JSON-tiedosto
      const fixedData = fixJsonData(data);
      return JSON.parse(fixedData);
    }
  } catch (error) {
    console.error(`${colors.red}Virhe luettaessa tiedostoa ${filePath}:${colors.reset}`, error.message);
    
    // Yritetään lukea tiedosto jq:n avulla, jos se on saatavilla
    try {
      return await readWithJq(filePath);
    } catch (jqError) {
      console.error(`${colors.red}Myös jq-yritys epäonnistui:${colors.reset}`, jqError.message);
      return null;
    }
  }
}

/**
 * Korjaa virheellisen JSON-datan
 * @param {string} data - Virheellinen JSON-data
 * @returns {string} - Korjattu JSON-data
 */
function fixJsonData(data) {
  // Poistetaan mahdolliset BOM-merkit
  let fixedData = data.replace(/^\uFEFF/, '');
  
  // Poistetaan mahdolliset ylimääräiset rivinvaihdot JSON-objektien välillä
  fixedData = fixedData.replace(/\}\s*\n\s*\{/g, '},{');
  
  // Yritetään korjata yleisiä JSON-virheitä
  fixedData = fixedData.replace(/,\s*\}/g, '}');
  fixedData = fixedData.replace(/,\s*\]/g, ']');
  
  // Tarkistetaan, onko kyseessä JSON-rivit (JSONL) -muoto
  if (fixedData.trim().startsWith('{') && !fixedData.trim().startsWith('[{')) {
    const lines = fixedData.split('\n').filter(line => line.trim().length > 0);
    if (lines.length > 1 && lines.every(line => line.trim().startsWith('{'))) {
      // Kyseessä on JSONL, muutetaan se JSON-arrayksi
      fixedData = '[' + lines.join(',') + ']';
    }
  }
  
  return fixedData;
}

/**
 * Käsittelee suuren JSON-tiedoston virtaavasti
 * @param {string} filePath - Polku tulostiedostoon
 * @returns {Promise<Object>} - Lupaus, joka resolvoituu käsiteltyyn dataobjektiin
 */
async function processLargeJsonFile(filePath) {
  return new Promise((resolve, reject) => {
    // Luodaan yksinkertaistettu tulosobjekti
    const result = {
      metrics: {},
      timestamp: new Date().toISOString(),
      vus_max: 0,
      iterations: 0,
      duration_ms: 0
    };
    
    // Etsitään tärkeimmät metriikat
    const metricRegexes = {
      error_rate: /error_rate.*?rate":\s*([\d.]+)/,
      fallback_success_rate: /fallback_success_rate.*?rate":\s*([\d.]+)/,
      response_time: /response_time.*?avg":\s*([\d.]+).*?min":\s*([\d.]+).*?med":\s*([\d.]+).*?max":\s*([\d.]+).*?p\(95\)":\s*([\d.]+)/s,
      successful_requests: /successful_requests.*?count":\s*([\d.]+)/,
      failed_requests: /failed_requests.*?count":\s*([\d.]+)/,
      timeout_errors: /timeout_errors.*?count":\s*([\d.]+)/,
      server_errors: /server_errors.*?count":\s*([\d.]+)/,
      client_errors: /client_errors.*?count":\s*([\d.]+)/
    };
    
    // Mallikohtaiset metriikat
    const models = ['openai', 'anthropic', 'ollama'];
    models.forEach(model => {
      metricRegexes[`${model}_success_rate`] = new RegExp(`${model}_success_rate.*?rate":\\s*([\\d.]+).*?passes":\\s*([\\d.]+)`, 's');
      metricRegexes[`${model}_processing_time`] = new RegExp(`${model}_processing_time.*?avg":\\s*([\\d.]+)`, 's');
    });
    
    // Luetaan tiedosto kokonaisuudessaan muistiin
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        reject(err);
        return;
      }
      
      // Etsitään perustiedot
      const vusMatch = data.match(/vus_max":\s*(\d+)/);
      if (vusMatch) result.vus_max = parseInt(vusMatch[1]);
      
      const iterationsMatch = data.match(/iterations":\s*(\d+)/);
      if (iterationsMatch) result.iterations = parseInt(iterationsMatch[1]);
      
      const durationMatch = data.match(/duration":\s*"([^"]+)"/);
      if (durationMatch) {
        const durationStr = durationMatch[1];
        // Muunnetaan kesto millisekunneiksi
        const timeRegex = /(\d+)([hms])/g;
        let match;
        let ms = 0;
        while ((match = timeRegex.exec(durationStr)) !== null) {
          const value = parseInt(match[1]);
          const unit = match[2];
          if (unit === 'h') ms += value * 3600000;
          else if (unit === 'm') ms += value * 60000;
          else if (unit === 's') ms += value * 1000;
        }
        result.duration_ms = ms;
      }
      
      // Etsitään metriikat
      for (const [metricName, regex] of Object.entries(metricRegexes)) {
        const match = data.match(regex);
        if (match) {
          if (metricName === 'response_time') {
            result.metrics[metricName] = {
              values: {
                avg: parseFloat(match[1]),
                min: parseFloat(match[2]),
                med: parseFloat(match[3]),
                max: parseFloat(match[4]),
                'p(95)': parseFloat(match[5])
              }
            };
          } else if (metricName.endsWith('_success_rate') && match.length > 2) {
            result.metrics[metricName] = {
              values: {
                rate: parseFloat(match[1]),
                passes: parseInt(match[2])
              }
            };
          } else if (metricName.endsWith('_processing_time')) {
            result.metrics[metricName] = {
              values: {
                avg: parseFloat(match[1])
              }
            };
          } else if (metricName.endsWith('_rate')) {
            result.metrics[metricName] = {
              values: {
                rate: parseFloat(match[1])
              }
            };
          } else {
            result.metrics[metricName] = {
              values: {
                count: parseInt(match[1])
              }
            };
          }
        }
      }
      
      resolve(result);
    });
  });
}

/**
 * Lukee JSON-tiedoston jq:n avulla
 * @param {string} filePath - Polku tulostiedostoon
 * @returns {Promise<Object>} - Lupaus, joka resolvoituu jäsennettyyn JSON-objektiin
 */
function readWithJq(filePath) {
  return new Promise((resolve, reject) => {
    exec(`jq . "${filePath}"`, { maxBuffer: 100 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`jq virhe: ${error.message}`));
        return;
      }
      
      try {
        const result = JSON.parse(stdout);
        resolve(result);
      } catch (jsonError) {
        reject(new Error(`jq tuloste ei ole validia JSON:ia: ${jsonError.message}`));
      }
    });
  });
}

/**
 * Luo ASCII-pylväskaavion
 * @param {number} value - Arvo välillä 0-100
 * @param {number} width - Kaavion leveys merkkeinä
 * @param {string} color - Värikoodi
 * @returns {string} - ASCII-pylväskaavio
 */
function createBar(value, width = 40, color = colors.green) {
  const barWidth = Math.floor((value / 100) * width);
  const bar = '█'.repeat(barWidth) + ' '.repeat(width - barWidth);
  return `${color}${bar}${colors.reset} ${value.toFixed(2)}%`;
}

/**
 * Analysoi fallback-testien tulokset
 * @param {string} filePath - Polku tulostiedostoon
 */
async function analyzeFallbackResults(filePath) {
  console.log(`\n${colors.bright}${colors.cyan}=== AI Fallback -testitulosten analyysi ===${colors.reset}\n`);
  
  const results = await readK6ResultsFile(filePath);
  if (!results) {
    console.log(`${colors.red}Tulostiedostoa ei löytynyt tai se on virheellinen.${colors.reset}`);
    return;
  }
  
  // Yleiskatsaus
  console.log(`${colors.bright}Testin ajankohta:${colors.reset} ${new Date(results.timestamp).toLocaleString()}`);
  console.log(`${colors.bright}Testin kesto:${colors.reset} ${results.duration_ms / 1000} sekuntia`);
  console.log(`${colors.bright}Virtuaalisia käyttäjiä (VU):${colors.reset} ${results.vus_max}`);
  console.log(`${colors.bright}Iteraatioita:${colors.reset} ${results.iterations}\n`);
  
  // Virheprosentti
  const errorRate = results.metrics.error_rate ? results.metrics.error_rate.values.rate * 100 : 0;
  const errorColor = errorRate > 30 ? colors.red : errorRate > 10 ? colors.yellow : colors.green;
  console.log(`${colors.bright}Virheprosentti:${colors.reset}`);
  console.log(`  ${createBar(errorRate, 40, errorColor)}`);
  
  // Fallback-onnistumisprosentti
  const fallbackSuccessRate = results.metrics.fallback_success_rate ? 
    results.metrics.fallback_success_rate.values.rate * 100 : 0;
  const fallbackColor = fallbackSuccessRate < 50 ? colors.red : 
    fallbackSuccessRate < 70 ? colors.yellow : colors.green;
  console.log(`\n${colors.bright}Fallback-onnistumisprosentti:${colors.reset}`);
  console.log(`  ${createBar(fallbackSuccessRate, 40, fallbackColor)}`);
  
  // Vasteajat
  const responseTime = results.metrics.response_time ? results.metrics.response_time.values : null;
  if (responseTime) {
    console.log(`\n${colors.bright}Vasteajat:${colors.reset}`);
    console.log(`  Keskiarvo: ${(responseTime.avg / 1000).toFixed(2)} s`);
    console.log(`  Mediaani: ${(responseTime.med / 1000).toFixed(2)} s`);
    console.log(`  P95: ${(responseTime['p(95)'] / 1000).toFixed(2)} s`);
    console.log(`  Min: ${(responseTime.min / 1000).toFixed(2)} s`);
    console.log(`  Max: ${(responseTime.max / 1000).toFixed(2)} s`);
  }
  
  // Onnistuneet ja epäonnistuneet pyynnöt
  const successful = results.metrics.successful_requests ? 
    results.metrics.successful_requests.values.count : 0;
  const failed = results.metrics.failed_requests ? 
    results.metrics.failed_requests.values.count : 0;
  const total = successful + failed;
  
  console.log(`\n${colors.bright}Pyynnöt:${colors.reset}`);
  console.log(`  Onnistuneet: ${successful} (${((successful / total) * 100).toFixed(2)}%)`);
  console.log(`  Epäonnistuneet: ${failed} (${((failed / total) * 100).toFixed(2)}%)`);
  console.log(`  Yhteensä: ${total}`);
  
  // Virhetyypit
  const timeoutErrors = results.metrics.timeout_errors ? 
    results.metrics.timeout_errors.values.count : 0;
  const serverErrors = results.metrics.server_errors ? 
    results.metrics.server_errors.values.count : 0;
  const clientErrors = results.metrics.client_errors ? 
    results.metrics.client_errors.values.count : 0;
  
  if (failed > 0) {
    console.log(`\n${colors.bright}Virhetyypit:${colors.reset}`);
    console.log(`  Timeout-virheet: ${timeoutErrors} (${((timeoutErrors / failed) * 100).toFixed(2)}%)`);
    console.log(`  Palvelinvirheet: ${serverErrors} (${((serverErrors / failed) * 100).toFixed(2)}%)`);
    console.log(`  Asiakasvirheet: ${clientErrors} (${((clientErrors / failed) * 100).toFixed(2)}%)`);
    console.log(`  Muut virheet: ${failed - timeoutErrors - serverErrors - clientErrors} (${(((failed - timeoutErrors - serverErrors - clientErrors) / failed) * 100).toFixed(2)}%)`);
  }
  
  // Mallikohtaiset metriikat
  const models = ['openai', 'anthropic', 'ollama'];
  const modelData = {};
  
  models.forEach(model => {
    const successRate = results.metrics[`${model}_success_rate`] ? 
      results.metrics[`${model}_success_rate`].values.rate * 100 : 0;
    const count = results.metrics[`${model}_success_rate`] ? 
      results.metrics[`${model}_success_rate`].values.passes : 0;
    const time = results.metrics[`${model}_processing_time`] ? 
      results.metrics[`${model}_processing_time`].values.avg : 0;
    
    modelData[model] = { successRate, count, time };
  });
  
  console.log(`\n${colors.bright}Mallikohtaiset metriikat:${colors.reset}`);
  models.forEach(model => {
    const data = modelData[model];
    if (data.count > 0) {
      const rateColor = data.successRate < 50 ? colors.red : 
        data.successRate < 70 ? colors.yellow : colors.green;
      
      console.log(`\n  ${colors.bright}${model.toUpperCase()}:${colors.reset}`);
      console.log(`    Onnistumisprosentti: ${createBar(data.successRate, 30, rateColor)}`);
      console.log(`    Pyyntöjen määrä: ${data.count}`);
      console.log(`    Keskimääräinen vasteaika: ${(data.time / 1000).toFixed(2)} s`);
    }
  });
  
  // Johtopäätökset
  console.log(`\n${colors.bright}${colors.cyan}=== Johtopäätökset ===${colors.reset}\n`);
  
  if (fallbackSuccessRate >= 70) {
    console.log(`${colors.green}✓ Fallback-mekanismi toimii hyvin (${fallbackSuccessRate.toFixed(2)}% onnistumisprosentti)${colors.reset}`);
  } else if (fallbackSuccessRate >= 50) {
    console.log(`${colors.yellow}⚠ Fallback-mekanismi toimii kohtalaisesti (${fallbackSuccessRate.toFixed(2)}% onnistumisprosentti), mutta parannettavaa on${colors.reset}`);
  } else {
    console.log(`${colors.red}✗ Fallback-mekanismi ei toimi luotettavasti (${fallbackSuccessRate.toFixed(2)}% onnistumisprosentti)${colors.reset}`);
  }
  
  if (errorRate > 30) {
    console.log(`${colors.red}✗ Virheprosentti on korkea (${errorRate.toFixed(2)}%)${colors.reset}`);
  } else if (errorRate > 10) {
    console.log(`${colors.yellow}⚠ Virheprosentti on kohtuullinen (${errorRate.toFixed(2)}%)${colors.reset}`);
  } else {
    console.log(`${colors.green}✓ Virheprosentti on alhainen (${errorRate.toFixed(2)}%)${colors.reset}`);
  }
  
  // Suositukset
  console.log(`\n${colors.bright}${colors.cyan}=== Suositukset ===${colors.reset}\n`);
  
  if (fallbackSuccessRate < 70) {
    console.log(`${colors.yellow}1. Paranna fallback-mekanismia tunnistamaan virhetilanteet paremmin${colors.reset}`);
  }
  
  if (timeoutErrors > 0 && timeoutErrors / failed > 0.3) {
    console.log(`${colors.yellow}2. Tarkista timeout-asetukset ja harkitse niiden kasvattamista${colors.reset}`);
  }
  
  if (serverErrors > 0 && serverErrors / failed > 0.3) {
    console.log(`${colors.yellow}3. Tutki palvelinvirheitä ja korjaa taustalla olevat ongelmat${colors.reset}`);
  }
  
  const worstModel = Object.entries(modelData)
    .filter(([_, data]) => data.count > 0)
    .sort(([_, a], [__, b]) => a.successRate - b.successRate)[0];
  
  if (worstModel && worstModel[1].successRate < 60) {
    console.log(`${colors.yellow}4. Tarkista ${worstModel[0]}-mallin asetukset, sillä sen onnistumisprosentti on alhainen${colors.reset}`);
  }
  
  console.log('\n');
}

// Käsitellään komentoriviparametrit
const args = process.argv.slice(2);
const filePath = args[0] || 'fallback-test-results.json';

// Suorita analyysi
analyzeFallbackResults(filePath);
