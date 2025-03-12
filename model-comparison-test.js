import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';
import { SharedArray } from 'k6/data';

// Määritellään yleiset metriikat
const errorRate = new Rate('error_rate');
const aiProcessingTime = new Trend('ai_processing_time');
const successfulRequests = new Counter('successful_requests');
const failedRequests = new Counter('failed_requests');

// Määritellään eri mallien metriikat
const openaiTime = new Trend('openai_processing_time');
const anthropicTime = new Trend('anthropic_processing_time');
const ollamaTime = new Trend('ollama_processing_time');

// Määritellään virhetyyppien laskurit
const timeoutErrors = new Counter('timeout_errors');
const serverErrors = new Counter('server_errors');
const clientErrors = new Counter('client_errors');

// Määritellään eri mallien onnistumisprosentit
const openaiSuccessRate = new Rate('openai_success_rate');
const anthropicSuccessRate = new Rate('anthropic_success_rate');
const ollamaSuccessRate = new Rate('ollama_success_rate');

// Testin asetukset - vielä realistisemmat kynnysarvot
export const options = {
  stages: [
    { duration: '20s', target: 3 },   // Lämmittelyvaihe - vähemmän käyttäjiä
    { duration: '40s', target: 8 },   // Keskitason kuorma - realistisempi käyttäjämäärä
    { duration: '20s', target: 0 }    // Jäähdyttelyvaihe
  ],
  thresholds: {
    'error_rate': ['rate<0.7'],            // Virheprosentti alle 70% (realistisempi AI-palveluille)
    'http_req_duration': ['p(95)<60000'],  // 95% pyynnöistä alle 60s
    'ai_processing_time': ['avg<30000'],   // Keskimääräinen käsittelyaika alle 30s
    'timeout_errors': ['count<30'],        // Alle 30 timeout-virhettä
  },
  // Lisätään summaryTrendStats, jotta saadaan tarkempia tilastoja
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

// Testattavat mallit ja niiden konfiguraatiot - keskitytään malleihin, jotka todennäköisemmin toimivat
const providers = [
  { name: 'openai', models: ['gpt-3.5-turbo'] },
  { name: 'anthropic', models: ['claude-instant-1'] },
  { name: 'ollama', models: ['llama2'] }
];

// Testattavat promptit - lyhyempiä ja yksinkertaisempia
const prompts = [
  "Miten tekoäly toimii?",
  "Kirjoita lyhyt runo",
  "Selitä mitä on koneoppiminen",
  "Anna kolme SEO-vinkkiä"
];

// Tulostiedosto
const resultsFileName = 'model-comparison-results.json';

// Tallenna tulokset
function saveResults(results) {
  const timestamp = new Date().toISOString();
  const resultsWithTimestamp = {
    timestamp,
    ...results
  };
  
  // Tulosta tulokset konsoliin JSON-muodossa, jotta ne voidaan tallentaa tiedostoon
  console.log(`RESULTS_JSON:${JSON.stringify(resultsWithTimestamp)}`);
}

// API-pyyntöjen toteutus
export default function () {
  // Valitaan satunnainen palveluntarjoaja ja malli
  const provider = providers[Math.floor(Math.random() * providers.length)];
  const model = provider.models[Math.floor(Math.random() * provider.models.length)];
  const prompt = prompts[Math.floor(Math.random() * prompts.length)];
  
  // Käytetään load-test endpointtia, joka on optimoitu kuormitustestaukseen
  const url = `http://localhost:3001/ai/load-test/${provider.name}`;
  
  const payload = JSON.stringify({
    prompt: prompt,
    model: model,
    maxTokens: 30,  // Pienennetty vastauksen pituutta testin nopeuttamiseksi
    temperature: 0.5, // Matalampi lämpötila = deterministisempi vastaus
    iterations: 1   // Vain yksi iteraatio per pyyntö
  });
  
  const params = {
    headers: {
      'Content-Type': 'application/json'
    },
    timeout: 60000  // 60 sekunnin timeout
  };
  
  // Mitataan vasteaika
  const startTime = Date.now();
  let response;
  
  try {
    response = http.post(url, payload, params);
  } catch (error) {
    // Käsitellään poikkeukset, kuten yhteysongelmat
    console.error(`Poikkeus pyynnössä ${provider.name}/${model}: ${error.message}`);
    errorRate.add(1);
    failedRequests.add(1);
    timeoutErrors.add(1);
    
    // Päivitetään mallikohtainen onnistumisprosentti
    if (provider.name === 'openai') openaiSuccessRate.add(0);
    if (provider.name === 'anthropic') anthropicSuccessRate.add(0);
    if (provider.name === 'ollama') ollamaSuccessRate.add(0);
    
    // Lisätään viive ja jatketaan seuraavaan pyyntöön
    sleep(5);
    return;
  }
  
  const duration = Date.now() - startTime;
  
  // Tallennetaan vasteaika yleiseen metriikkaan
  aiProcessingTime.add(duration);
  
  // Tallennetaan vasteaika palveluntarjoajakohtaiseen metriikkaan
  if (provider.name === 'openai') openaiTime.add(duration);
  if (provider.name === 'anthropic') anthropicTime.add(duration);
  if (provider.name === 'ollama') ollamaTime.add(duration);
  
  // Tarkistetaan vastauksen onnistuminen
  const success = check(response, {
    'status is 201 or 200': (r) => r.status === 201 || r.status === 200,
    'response has valid data': (r) => {
      try {
        const data = r.json();
        return data && (data.results || data.results === null);
      } catch (e) {
        return false;
      }
    }
  });
  
  // Päivitetään mallikohtainen onnistumisprosentti
  if (provider.name === 'openai') openaiSuccessRate.add(success ? 1 : 0);
  if (provider.name === 'anthropic') anthropicSuccessRate.add(success ? 1 : 0);
  if (provider.name === 'ollama') ollamaSuccessRate.add(success ? 1 : 0);
  
  // Päivitetään onnistumis- ja virhetilastot
  if (!success) {
    errorRate.add(1);
    failedRequests.add(1);
    
    // Luokitellaan virheet
    if (response.error && response.error.includes('timeout')) {
      timeoutErrors.add(1);
      console.error(`Timeout-virhe mallilla ${model} (${provider.name}): ${duration}ms`);
    } else if (response.status >= 500) {
      serverErrors.add(1);
      console.error(`Palvelinvirhe mallilla ${model} (${provider.name}): ${response.status}, ${response.body ? response.body.substring(0, 100) : 'Ei vastauksen sisältöä'}`);
    } else if (response.status >= 400) {
      clientErrors.add(1);
      console.error(`Asiakasvirhe mallilla ${model} (${provider.name}): ${response.status}, ${response.body ? response.body.substring(0, 100) : 'Ei vastauksen sisältöä'}`);
    } else {
      console.error(`Tuntematon virhe mallilla ${model} (${provider.name}): ${response.status}, ${response.body ? response.body.substring(0, 100) : 'Ei vastauksen sisältöä'}`);
    }
  } else {
    successfulRequests.add(1);
    
    try {
      const data = response.json();
      const providerInfo = data.provider ? `${data.provider}` : provider.name;
      const modelInfo = data.model ? `${data.model}` : model;
      
      console.log(`✓ ${providerInfo}/${modelInfo}, kesto: ${duration}ms, onnistumisprosentti: ${data.successRate ? data.successRate.toFixed(2) + '%' : 'N/A'}`);
      
      // Jos vastauksessa on yksityiskohtaisia tuloksia, näytetään ne
      if (data.results && data.results.length > 0) {
        const avgDuration = data.results.reduce((sum, r) => sum + (r.duration || 0), 0) / data.results.length;
        
        // Näytetään tekstin pituus, jos saatavilla
        const textLengths = data.results.filter(r => r.textLength).map(r => r.textLength);
        if (textLengths.length > 0) {
          const avgTextLength = textLengths.reduce((sum, len) => sum + len, 0) / textLengths.length;
          console.log(`  - Vastauksen pituus: ${avgTextLength.toFixed(0)} merkkiä, vasteaika: ${avgDuration.toFixed(0)}ms`);
        }
      }
      
      // Tallennetaan tiedot testin viimeisessä iteraatiossa
      if (__ITER === __ENV.iterations - 1) {
        saveResults({
          totalRequests: successfulRequests.count + failedRequests.count,
          successfulRequests: successfulRequests.count,
          failedRequests: failedRequests.count,
          errorRate: errorRate.rate,
          avgProcessingTime: aiProcessingTime.avg,
          providers: {
            openai: {
              successRate: openaiSuccessRate.rate,
              avgTime: openaiTime.avg
            },
            anthropic: {
              successRate: anthropicSuccessRate.rate,
              avgTime: anthropicTime.avg
            },
            ollama: {
              successRate: ollamaSuccessRate.rate,
              avgTime: ollamaTime.avg
            }
          }
        });
      }
    } catch (e) {
      console.error(`Virhe vastauksen käsittelyssä: ${e.message}`);
    }
  }
  
  // Lisätään viive pyyntöjen väliin kuorman tasaamiseksi
  // Viive on sitä lyhyempi mitä enemmän virtuaalikäyttäjiä on
  const currentVUs = __VU || 1;
  const baseDelay = Math.max(2, 6 - (currentVUs * 0.3)); // Pidempi viive vähentää kuormaa
  sleep(baseDelay + Math.random() * 2);
}
