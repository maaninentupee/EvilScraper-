/**
 * Yksinkertainen testi AI-fallback-mekanismille
 * Tämä skripti ei vaadi oikeita LLM-malleja
 */

const axios = require('axios');
const fs = require('fs');

// Asetukset
const BASE_URL = 'http://localhost:3001';
const TOTAL_REQUESTS = 30;
const UNIQUE_PROMPTS = 5;
const DELAY_BETWEEN_REQUESTS = 200; // ms

// Tilastot
let successCount = 0;
let errorCount = 0;
let fallbackCount = 0;
let cacheHitCount = 0;

// Virhetyyppien tilastot
let serviceUnavailableCount = 0;
let modelNotFoundCount = 0;
let timeoutCount = 0;
let rateLimitCount = 0;
let unexpectedErrorCount = 0;

// Palveluntarjoajakohtaiset tilastot
const providerStats = {
  openai: { success: 0, failure: 0, fallback: 0 },
  anthropic: { success: 0, failure: 0, fallback: 0 },
  ollama: { success: 0, failure: 0, fallback: 0 },
  local: { success: 0, failure: 0, fallback: 0 }
};

// Vasteajat
const responseTimes = [];

// Promptit
const prompts = [
  "Miten tekoäly toimii?",
  "Kirjoita lyhyt runo",
  "Selitä mitä on koneoppiminen",
  "Anna kolme SEO-vinkkiä",
  "Mikä on paras ohjelmointikieli aloittelijalle?"
];

// Palveluntarjoajat
const providers = ['openai', 'anthropic', 'ollama', 'local'];

// Virhetilanteiden simulointi
const errorSimulations = [
  { type: 'none', weight: 0.6 },                  // Ei simuloitua virhettä (60%)
  { type: 'service_unavailable', weight: 0.1 },   // Palvelu ei saatavilla (10%)
  { type: 'model_not_found', weight: 0.1 },       // Mallia ei löydy (10%)
  { type: 'timeout', weight: 0.1 },               // Aikakatkaisu (10%)
  { type: 'rate_limit', weight: 0.1 }             // Rate limit (10%)
];

// Valitse virhetilanne painotusten mukaan
function selectErrorSimulation() {
  const random = Math.random();
  let cumulativeWeight = 0;
  
  for (const error of errorSimulations) {
    cumulativeWeight += error.weight;
    if (random < cumulativeWeight) {
      return error.type;
    }
  }
  
  return 'none';
}

// Apufunktiot
async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendRequest(prompt, provider, errorType = 'none') {
  const startTime = Date.now();
  
  try {
    const response = await axios.post(`${BASE_URL}/ai/process`, {
      taskType: 'seo',
      input: prompt,
      primaryModel: provider,
      testMode: errorType !== 'none' ? true : false,
      testError: errorType !== 'none' ? errorType : undefined
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-Test-Mode': errorType !== 'none' ? 'true' : 'false',
        'X-Test-Error': errorType !== 'none' ? errorType : ''
      },
      timeout: 10000 // 10 sekunnin timeout
    });

    const duration = Date.now() - startTime;
    responseTimes.push(duration);
    
    successCount++;
    const data = response.data;

    // Tarkistetaan, käytettiinkö fallbackia
    if (data.usedFallback) {
      fallbackCount++;
      
      // Päivitetään palveluntarjoajakohtaiset tilastot
      if (data.provider && providerStats[data.provider]) {
        providerStats[data.provider].fallback++;
      }
      
      console.log(`Fallback käytössä: ${data.provider} (alkuperäinen: ${provider}) | ${duration}ms`);
    }

    // Tarkistetaan, käytettiinkö välimuistia
    if (data.fromCache) {
      cacheHitCount++;
      console.log(`Välimuistiosuma: ${prompt.substring(0, 20)}... | ${duration}ms`);
    }
    
    // Päivitetään palveluntarjoajakohtaiset tilastot
    if (data.provider && providerStats[data.provider]) {
      providerStats[data.provider].success++;
    }

    console.log(`Onnistunut pyyntö: ${data.provider || 'unknown'} | ${prompt.substring(0, 20)}... | ${duration}ms | Simuloitu virhe: ${errorType}`);
    return { success: true, data, duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    responseTimes.push(duration);
    
    // Päivitetään palveluntarjoajakohtaiset tilastot
    if (providerStats[provider]) {
      providerStats[provider].failure++;
    }
    
    if (error.response) {
      // Palvelin vastasi virheellä
      try {
        const errorData = error.response.data;
        
        // Luokitellaan virhetyyppi
        if (errorData.errorType === 'service_unavailable') {
          serviceUnavailableCount++;
          console.log(`Palvelu ei ole saatavilla: ${errorData.error} | ${duration}ms`);
        } else if (errorData.errorType === 'model_not_found') {
          modelNotFoundCount++;
          console.log(`Mallia ei löydy: ${errorData.error} | ${duration}ms`);
        } else if (errorData.errorType === 'timeout') {
          timeoutCount++;
          console.log(`Aikakatkaisu: ${errorData.error} | ${duration}ms`);
        } else if (errorData.errorType === 'rate_limit') {
          rateLimitCount++;
          console.log(`Rate limit ylitetty: ${errorData.error} | ${duration}ms`);
        } else {
          unexpectedErrorCount++;
          console.log(`Odottamaton virhe: ${errorData.error} | ${duration}ms`);
        }
      } catch (e) {
        // Jos vastaus ei ole JSON-muodossa tai ei sisällä errorType-kenttää
        if (error.response.status === 429) {
          rateLimitCount++;
          console.log(`Rate limit ylitetty: ${error.response.statusText} | ${duration}ms`);
        } else if (error.response.status === 504) {
          timeoutCount++;
          console.log(`Aikakatkaisu: ${error.response.statusText} | ${duration}ms`);
        } else if (error.response.status >= 500) {
          serviceUnavailableCount++;
          console.log(`Palvelinvirhe: ${error.response.status} - ${error.response.statusText} | ${duration}ms`);
        } else {
          unexpectedErrorCount++;
          console.log(`Muu virhe: ${error.response.status} - ${error.response.statusText} | ${duration}ms`);
        }
      }
    } else if (error.code === 'ECONNABORTED') {
      timeoutCount++;
      console.log(`Pyyntö aikakatkaistiin: ${error.message} | ${duration}ms`);
    } else if (error.code === 'ECONNREFUSED') {
      serviceUnavailableCount++;
      console.log(`Palvelin ei vastaa: ${error.message} | ${duration}ms`);
    } else {
      unexpectedErrorCount++;
      console.log(`Virhe pyynnössä: ${error.message} | ${duration}ms`);
    }
    
    errorCount++;
    return { success: false, error: error.message, duration };
  }
}

// Pääfunktio
async function runTest() {
  console.log(`Aloitetaan testi: ${TOTAL_REQUESTS} pyyntöä`);
  
  const startTime = Date.now();
  
  // Lähetetään pyynnöt
  for (let i = 0; i < TOTAL_REQUESTS; i++) {
    // Valitaan satunnainen prompti
    const promptIndex = i % UNIQUE_PROMPTS; // Varmistetaan, että samoja prompteja käytetään uudelleen
    const prompt = prompts[promptIndex];
    
    // Valitaan satunnainen palveluntarjoaja
    const providerIndex = Math.floor(Math.random() * providers.length);
    const provider = providers[providerIndex];
    
    // Valitaan satunnainen virhetilanne
    const errorType = selectErrorSimulation();
    
    console.log(`Pyyntö ${i+1}/${TOTAL_REQUESTS}: ${provider} - ${prompt.substring(0, 20)}... - Simuloitu virhe: ${errorType}`);
    
    await sendRequest(prompt, provider, errorType);
    
    // Odotetaan hetki pyyntöjen välillä
    await sleep(DELAY_BETWEEN_REQUESTS);
  }
  
  const totalDuration = Date.now() - startTime;
  
  // Lasketaan tilastot
  const avgResponseTime = responseTimes.length > 0 
    ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
    : 0;
  
  // Lasketaan p95 vasteaika
  let p95ResponseTime = 0;
  if (responseTimes.length > 0) {
    const sortedTimes = [...responseTimes].sort((a, b) => a - b);
    const p95Index = Math.floor(sortedTimes.length * 0.95);
    p95ResponseTime = sortedTimes[p95Index];
  }
  
  // Tulostetaan yhteenveto
  console.log("\n--- Testin yhteenveto ---");
  console.log(`Yhteensä pyyntöjä: ${TOTAL_REQUESTS}`);
  console.log(`Onnistuneet pyynnöt: ${successCount} (${(successCount/TOTAL_REQUESTS*100).toFixed(2)}%)`);
  console.log(`Epäonnistuneet pyynnöt: ${errorCount} (${(errorCount/TOTAL_REQUESTS*100).toFixed(2)}%)`);
  
  if (successCount > 0) {
    console.log(`Fallback käytössä: ${fallbackCount} (${(fallbackCount/successCount*100).toFixed(2)}% onnistuneista)`);
    console.log(`Välimuistiosumat: ${cacheHitCount} (${(cacheHitCount/successCount*100).toFixed(2)}% onnistuneista)`);
  } else {
    console.log(`Fallback käytössä: ${fallbackCount} (0% onnistuneista)`);
    console.log(`Välimuistiosumat: ${cacheHitCount} (0% onnistuneista)`);
  }
  
  console.log(`\nVirhetyypit:`);
  console.log(`- Palvelu ei saatavilla: ${serviceUnavailableCount} (${(serviceUnavailableCount/TOTAL_REQUESTS*100).toFixed(2)}%)`);
  console.log(`- Mallia ei löydy: ${modelNotFoundCount} (${(modelNotFoundCount/TOTAL_REQUESTS*100).toFixed(2)}%)`);
  console.log(`- Aikakatkaisu: ${timeoutCount} (${(timeoutCount/TOTAL_REQUESTS*100).toFixed(2)}%)`);
  console.log(`- Rate limit: ${rateLimitCount} (${(rateLimitCount/TOTAL_REQUESTS*100).toFixed(2)}%)`);
  console.log(`- Odottamattomat virheet: ${unexpectedErrorCount} (${(unexpectedErrorCount/TOTAL_REQUESTS*100).toFixed(2)}%)`);
  
  console.log(`\nPalveluntarjoajien tilastot:`);
  for (const [provider, stats] of Object.entries(providerStats)) {
    const total = stats.success + stats.failure;
    const successRate = total > 0 ? (stats.success / total * 100).toFixed(2) : '0.00';
    const fallbackRate = stats.success > 0 ? (stats.fallback / stats.success * 100).toFixed(2) : '0.00';
    
    console.log(`- ${provider}: ${stats.success} onnistunutta (${successRate}%), ${stats.failure} epäonnistunutta, ${stats.fallback} fallback (${fallbackRate}%)`);
  }
  
  console.log(`\nVasteajat:`);
  console.log(`- Keskimääräinen: ${avgResponseTime.toFixed(2)}ms`);
  console.log(`- P95: ${p95ResponseTime.toFixed(2)}ms`);
  console.log(`- Testin kokonaiskesto: ${totalDuration}ms`);
  
  // Tallennetaan tulokset JSON-tiedostoon
  const results = {
    timestamp: new Date().toISOString(),
    metrics: {
      totalRequests: TOTAL_REQUESTS,
      successfulRequests: successCount,
      failedRequests: errorCount,
      fallbackUsed: fallbackCount,
      cacheHits: cacheHitCount,
      avgResponseTime: avgResponseTime,
      p95ResponseTime: p95ResponseTime,
      totalDuration: totalDuration,
      errorTypes: {
        serviceUnavailable: serviceUnavailableCount,
        modelNotFound: modelNotFoundCount,
        timeout: timeoutCount,
        rateLimit: rateLimitCount,
        unexpected: unexpectedErrorCount
      },
      providerStats: providerStats
    }
  };
  
  fs.writeFileSync('simple-fallback-test-results.json', JSON.stringify(results, null, 2));
  console.log('\nTulokset tallennettu tiedostoon: simple-fallback-test-results.json');
}

// Suoritetaan testi
runTest().catch(error => {
  console.error(`Testin suoritus epäonnistui: ${error.message}`);
});
