/**
 * Fallback-mekanismin testaus
 * 
 * Tämä skripti testaa AI-palvelun fallback-mekanismin toimivuutta
 * simuloimalla eri palveluntarjoajien virhetilanteita ja varmistamalla,
 * että järjestelmä siirtyy automaattisesti käyttämään vaihtoehtoisia malleja.
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Konfiguraatio
const config = {
  // API-osoite
  apiUrl: 'http://localhost:3001/ai/process',
  
  // Testien määrä per virhetyyppi
  testsPerErrorType: 5,
  
  // Virheiden simulointi
  simulateErrors: true,
  
  // Virhetyypit testausta varten
  errorTypes: ['timeout', 'service_unavailable', 'rate_limit_exceeded', 'invalid_request'],
  
  // Tehtävätyypit
  taskTypes: ['general', 'code', 'translation', 'summarization'],
  
  // Testisyötteet
  inputs: [
    'Mikä on tekoälyn tulevaisuus?',
    'Kirjoita Python-funktio, joka laskee Fibonaccin lukujonon.',
    'Translate the following text to English: "Tekoäly on muuttamassa maailmaa nopeasti."',
    'Tiivistä seuraava teksti: "Tekoäly on tietojenkäsittelytieteen osa-alue, joka pyrkii luomaan älykkäitä koneita. Se on tärkeä teknologia-ala, joka sisältää monia erilaisia menetelmiä, kuten koneoppimisen, syväoppimisen ja vahvistusoppimisen. Tekoäly on jo käytössä monissa sovelluksissa, kuten kuvantunnistuksessa, luonnollisen kielen käsittelyssä ja autonomisissa ajoneuvoissa."'
  ]
};

// Tulosten tallennuskansio
const resultsDir = path.join(__dirname, 'results');
if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir);
}

// Testitulosten tallennustiedosto
const resultsFile = path.join(resultsDir, `fallback-test-results-${new Date().toISOString().replace(/:/g, '-')}.json`);

// Testitulosten alustus
const testResults = {
  summary: {
    totalTests: 0,
    successfulTests: 0,
    failedTests: 0,
    fallbacksTriggered: 0,
    averageResponseTime: 0
  },
  providerStats: {},
  errorTypeStats: {},
  detailedResults: []
};

/**
 * Suorittaa yksittäisen testin
 * @param {string} taskType - Tehtävän tyyppi
 * @param {string} input - Syöte
 * @param {string} errorType - Simuloitava virhetyyppi
 * @returns {Promise<Object>} - Testin tulos
 */
async function runTest(taskType, input, errorType) {
  const startTime = Date.now();
  
  try {
    // Asetetaan ympäristömuuttujat virheiden simulointia varten
    process.env.SIMULATE_ERRORS = config.simulateErrors ? 'true' : 'false';
    process.env.ERROR_TYPE = errorType;
    process.env.ERROR_RATE = '0.8'; // 80% todennäköisyys virheelle
    
    // Lähetetään pyyntö API:lle
    const response = await axios.post(config.apiUrl, {
      taskType,
      input
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 sekunnin timeout
    });
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    // Palautetaan testin tulos
    return {
      success: response.data.success,
      result: response.data.result,
      provider: response.data.provider,
      model: response.data.model,
      errorType: response.data.errorType,
      error: response.data.error,
      responseTime,
      taskType,
      input,
      simulatedErrorType: errorType,
      fallbackTriggered: response.data.provider !== 'openai' // Oletetaan että OpenAI on ensisijainen palveluntarjoaja
    };
  } catch (error) {
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    // Palautetaan virhetilanne
    return {
      success: false,
      result: null,
      provider: null,
      model: null,
      errorType: error.response?.data?.errorType || 'request_error',
      error: error.response?.data?.error || error.message,
      responseTime,
      taskType,
      input,
      simulatedErrorType: errorType,
      fallbackTriggered: false
    };
  }
}

/**
 * Päivittää testitulokset
 * @param {Object} result - Yksittäisen testin tulos
 */
function updateTestResults(result) {
  // Päivitetään yhteenveto
  testResults.summary.totalTests++;
  
  if (result.success) {
    testResults.summary.successfulTests++;
  } else {
    testResults.summary.failedTests++;
  }
  
  if (result.fallbackTriggered) {
    testResults.summary.fallbacksTriggered++;
  }
  
  testResults.summary.averageResponseTime = 
    (testResults.summary.averageResponseTime * (testResults.summary.totalTests - 1) + result.responseTime) / 
    testResults.summary.totalTests;
  
  // Päivitetään palveluntarjoajatilastot
  const provider = result.provider || 'unknown';
  if (!testResults.providerStats[provider]) {
    testResults.providerStats[provider] = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      averageResponseTime: 0
    };
  }
  
  testResults.providerStats[provider].totalCalls++;
  
  if (result.success) {
    testResults.providerStats[provider].successfulCalls++;
  } else {
    testResults.providerStats[provider].failedCalls++;
  }
  
  testResults.providerStats[provider].averageResponseTime = 
    (testResults.providerStats[provider].averageResponseTime * (testResults.providerStats[provider].totalCalls - 1) + result.responseTime) / 
    testResults.providerStats[provider].totalCalls;
  
  // Päivitetään virhetyyppitilastot
  if (!result.success) {
    const errorType = result.errorType || 'unknown';
    if (!testResults.errorTypeStats[errorType]) {
      testResults.errorTypeStats[errorType] = {
        count: 0,
        fallbacksTriggered: 0
      };
    }
    
    testResults.errorTypeStats[errorType].count++;
    
    if (result.fallbackTriggered) {
      testResults.errorTypeStats[errorType].fallbacksTriggered++;
    }
  }
  
  // Lisätään yksityiskohtaiset tulokset
  testResults.detailedResults.push(result);
}

/**
 * Tallentaa testitulokset tiedostoon
 */
function saveTestResults() {
  fs.writeFileSync(resultsFile, JSON.stringify(testResults, null, 2));
  console.log(`Testitulokset tallennettu tiedostoon: ${resultsFile}`);
}

/**
 * Tulostaa yhteenvedon testituloksista
 */
function printSummary() {
  console.log('\n===== FALLBACK-TESTIEN YHTEENVETO =====');
  console.log(`Testejä yhteensä: ${testResults.summary.totalTests}`);
  console.log(`Onnistuneita testejä: ${testResults.summary.successfulTests} (${(testResults.summary.successfulTests / testResults.summary.totalTests * 100).toFixed(2)}%)`);
  console.log(`Epäonnistuneita testejä: ${testResults.summary.failedTests} (${(testResults.summary.failedTests / testResults.summary.totalTests * 100).toFixed(2)}%)`);
  console.log(`Fallback-mekanismi laukaistiin: ${testResults.summary.fallbacksTriggered} kertaa (${(testResults.summary.fallbacksTriggered / testResults.summary.totalTests * 100).toFixed(2)}%)`);
  console.log(`Keskimääräinen vasteaika: ${testResults.summary.averageResponseTime.toFixed(2)} ms`);
  
  console.log('\n----- Palveluntarjoajatilastot -----');
  for (const [provider, stats] of Object.entries(testResults.providerStats)) {
    console.log(`${provider}:`);
    console.log(`  Kutsuja yhteensä: ${stats.totalCalls}`);
    console.log(`  Onnistuneita kutsuja: ${stats.successfulCalls} (${(stats.successfulCalls / stats.totalCalls * 100).toFixed(2)}%)`);
    console.log(`  Epäonnistuneita kutsuja: ${stats.failedCalls} (${(stats.failedCalls / stats.totalCalls * 100).toFixed(2)}%)`);
    console.log(`  Keskimääräinen vasteaika: ${stats.averageResponseTime.toFixed(2)} ms`);
  }
  
  console.log('\n----- Virhetyyppitilastot -----');
  for (const [errorType, stats] of Object.entries(testResults.errorTypeStats)) {
    console.log(`${errorType}:`);
    console.log(`  Esiintymisiä: ${stats.count}`);
    console.log(`  Fallback-mekanismi laukaistiin: ${stats.fallbacksTriggered} kertaa (${(stats.fallbacksTriggered / stats.count * 100).toFixed(2)}%)`);
  }
  
  console.log('\n======================================');
}

/**
 * Pääfunktio testien suorittamiseen
 */
async function main() {
  console.log('Aloitetaan fallback-mekanismin testaus...');
  
  // Suoritetaan testit jokaiselle virhetyypille
  for (const errorType of config.errorTypes) {
    console.log(`\nTestataan virhetyyppiä: ${errorType}`);
    
    // Suoritetaan testit jokaiselle tehtävätyypille
    for (const taskType of config.taskTypes) {
      // Suoritetaan testit jokaiselle syötteelle
      for (const input of config.inputs) {
        // Suoritetaan useita testejä samalla konfiguraatiolla
        for (let i = 0; i < config.testsPerErrorType; i++) {
          console.log(`Suoritetaan testi #${i + 1} tehtävätyypille '${taskType}' virhetyypillä '${errorType}'...`);
          
          // Suoritetaan testi
          const result = await runTest(taskType, input, errorType);
          
          // Päivitetään testitulokset
          updateTestResults(result);
          
          // Tulostetaan testin tulos
          if (result.success) {
            console.log(`  Testi onnistui! Palveluntarjoaja: ${result.provider}, Malli: ${result.model}, Vasteaika: ${result.responseTime} ms`);
          } else {
            console.log(`  Testi epäonnistui! Virhe: ${result.error}, Virhetyyppi: ${result.errorType}, Vasteaika: ${result.responseTime} ms`);
          }
          
          // Pieni viive testien välillä
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }
  }
  
  // Tallennetaan testitulokset
  saveTestResults();
  
  // Tulostetaan yhteenveto
  printSummary();
}

// Suoritetaan testit
main().catch(error => {
  console.error('Virhe testien suorituksessa:', error);
  process.exit(1);
});
