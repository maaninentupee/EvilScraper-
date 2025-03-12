const axios = require('axios');

// Konfiguraatio
const config = {
  baseUrl: 'http://localhost:3001',
  concurrentRequests: 10,
  totalRequests: 50,
  delayBetweenBatches: 500, // ms
};

// Testattavat promptit
const prompts = [
  "Miten tekoäly toimii?",
  "Kirjoita lyhyt runo",
  "Selitä mitä on koneoppiminen",
  "Anna kolme SEO-vinkkiä",
  "Mikä on paras ohjelmointikieli aloittelijalle?",
  "Kirjoita esimerkki REST API:sta",
  "Miten voin parantaa verkkosivuni suorituskykyä?",
  "Selitä mitä on kvanttilaskenta",
  "Miten tekoäly voi auttaa liiketoiminnassa?",
  "Kirjoita lyhyt tarina robotista"
];

// Metriikat
const metrics = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  totalLatency: 0,
  providerUsage: {
    openai: { count: 0, success: 0, totalLatency: 0 },
    anthropic: { count: 0, success: 0, totalLatency: 0 },
    ollama: { count: 0, success: 0, totalLatency: 0 },
    lmstudio: { count: 0, success: 0, totalLatency: 0 },
    local: { count: 0, success: 0, totalLatency: 0 }
  },
  errors: {
    timeout: 0,
    server: 0,
    client: 0,
    unknown: 0
  }
};

// Lokitus
const logs = [];
function log(message, model, status, duration) {
  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp} | Model: ${model} | Status: ${status} | Duration: ${duration}ms | ${message}`;
  console.log(logEntry);
  logs.push({
    timestamp,
    model,
    status,
    duration,
    message
  });
}

// Lähettää yhden AI-pyynnön
async function sendRequest(prompt, index) {
  const startTime = Date.now();
  let status = 'failed';
  let model = 'unknown';
  let provider = 'unknown';
  
  try {
    metrics.totalRequests++;
    
    const response = await axios.post(`${config.baseUrl}/ai/process`, {
      taskType: 'seo',
      input: prompt
    }, {
      timeout: 30000 // 30s timeout
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Tarkistetaan vastauksen rakenne
    if (response.data && response.data.success) {
      status = 'success';
      metrics.successfulRequests++;
      metrics.totalLatency += duration;
      
      // Tallenna käytetty malli ja palveluntarjoaja
      if (response.data.result && typeof response.data.result === 'object') {
        // Uusi vastausmuoto, jossa result on objekti
        model = response.data.result.model || 'unknown';
        provider = response.data.result.provider || 'unknown';
      } else {
        // Vanha vastausmuoto, jossa result on suoraan tekstiä
        model = 'unknown';
        provider = 'unknown';
      }
      
      // Päivitä palveluntarjoajan metriikat
      if (metrics.providerUsage[provider]) {
        metrics.providerUsage[provider].count++;
        metrics.providerUsage[provider].success++;
        metrics.providerUsage[provider].totalLatency += duration;
      }
      
      log(`Request ${index} successful`, model, status, duration);
    } else {
      status = 'failed';
      metrics.failedRequests++;
      
      // Tarkistetaan onko vastauksessa virheviesti
      const errorMessage = response.data.error || 'Unknown error';
      
      // Tunnistetaan virhetyyppi viestistä
      if (errorMessage.includes('Kaikki AI-palvelut epäonnistuivat')) {
        log(`Request ${index} failed with all providers: ${errorMessage}`, model, 'all_providers_failed', duration);
      } else {
        log(`Request ${index} failed with response: ${JSON.stringify(response.data)}`, model, status, duration);
      }
    }
    
    return { success: response.data.success, duration, model, provider };
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    metrics.failedRequests++;
    
    // Luokittele virhe
    if (error.code === 'ECONNABORTED') {
      metrics.errors.timeout++;
      log(`Request ${index} timed out after ${duration}ms`, model, 'timeout', duration);
    } else if (error.response) {
      // HTTP-virheet
      if (error.response.status >= 500) {
        metrics.errors.server++;
        
        // Tarkistetaan, onko kyseessä fallback-virhe
        const errorMessage = error.response.data && error.response.data.message 
          ? error.response.data.message 
          : error.message;
          
        if (errorMessage.includes('Kaikki AI-palvelut epäonnistuivat')) {
          log(`Request ${index} failed with fallback error: ${errorMessage}`, model, 'fallback_error', duration);
        } else {
          log(`Request ${index} failed with server error ${error.response.status}: ${errorMessage}`, model, 'server_error', duration);
        }
      } else if (error.response.status >= 400) {
        metrics.errors.client++;
        log(`Request ${index} failed with client error ${error.response.status}: ${error.response.data.message || error.message}`, model, 'client_error', duration);
      } else {
        metrics.errors.unknown++;
        log(`Request ${index} failed with unknown status ${error.response.status}`, model, 'unknown_error', duration);
      }
    } else if (error.request) {
      // Pyyntö tehtiin mutta vastausta ei saatu
      metrics.errors.server++;
      log(`Request ${index} failed: no response received`, model, 'no_response', duration);
    } else {
      // Virhe pyynnön valmistelussa
      metrics.errors.unknown++;
      log(`Request ${index} failed with error: ${error.message}`, model, 'unknown_error', duration);
    }
    
    return { success: false, duration, error: error.message };
  }
}

// Lähettää useita pyyntöjä samanaikaisesti
async function sendBatch(startIndex, batchSize) {
  const batch = [];
  for (let i = 0; i < batchSize; i++) {
    const index = startIndex + i;
    if (index < config.totalRequests) {
      const promptIndex = index % prompts.length;
      batch.push(sendRequest(prompts[promptIndex], index));
    }
  }
  
  return Promise.all(batch);
}

// Suorittaa testin
async function runTest() {
  console.log(`Starting fallback test with ${config.totalRequests} total requests, ${config.concurrentRequests} concurrent`);
  console.log(`Server URL: ${config.baseUrl}`);
  console.log('---------------------------------------------------');
  
  const startTime = Date.now();
  
  for (let i = 0; i < config.totalRequests; i += config.concurrentRequests) {
    await sendBatch(i, config.concurrentRequests);
    
    // Pieni viive erien välillä
    if (i + config.concurrentRequests < config.totalRequests) {
      await new Promise(resolve => setTimeout(resolve, config.delayBetweenBatches));
    }
  }
  
  const endTime = Date.now();
  const totalDuration = endTime - startTime;
  
  // Tulosta yhteenveto
  printSummary(totalDuration);
}

// Tulostaa testin yhteenvedon
function printSummary(totalDuration) {
  console.log('\n---------------------------------------------------');
  console.log('FALLBACK TEST SUMMARY');
  console.log('---------------------------------------------------');
  console.log(`Total test duration: ${totalDuration}ms (${(totalDuration / 1000).toFixed(2)}s)`);
  console.log(`Total requests: ${metrics.totalRequests}`);
  console.log(`Successful requests: ${metrics.successfulRequests} (${((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(2)}%)`);
  console.log(`Failed requests: ${metrics.failedRequests} (${((metrics.failedRequests / metrics.totalRequests) * 100).toFixed(2)}%)`);
  
  if (metrics.successfulRequests > 0) {
    console.log(`Average response time: ${(metrics.totalLatency / metrics.successfulRequests).toFixed(2)}ms`);
  }
  
  console.log('\nPROVIDER USAGE:');
  for (const [provider, data] of Object.entries(metrics.providerUsage)) {
    if (data.count > 0) {
      console.log(`  ${provider}: ${data.count} requests, ${data.success} successful (${((data.success / data.count) * 100).toFixed(2)}%), avg time: ${(data.totalLatency / data.count).toFixed(2)}ms`);
    }
  }
  
  console.log('\nERROR BREAKDOWN:');
  console.log(`  Timeout errors: ${metrics.errors.timeout}`);
  console.log(`  Server errors: ${metrics.errors.server}`);
  console.log(`  Client errors: ${metrics.errors.client}`);
  console.log(`  Unknown errors: ${metrics.errors.unknown}`);
  console.log('---------------------------------------------------');
}

// Suorita testi
runTest().catch(error => {
  console.error('Test failed with error:', error);
  process.exit(1);
});
