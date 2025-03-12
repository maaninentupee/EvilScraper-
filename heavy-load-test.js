import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Yleiset metriikat
const errorRate = new Rate('error_rate');
const responseTime = new Trend('response_time');
const successfulRequests = new Counter('successful_requests');
const failedRequests = new Counter('failed_requests');

// Mallikohtaiset metriikat
const openaiTime = new Trend('openai_processing_time');
const anthropicTime = new Trend('anthropic_processing_time');
const ollamaTime = new Trend('ollama_processing_time');

// Mallikohtaiset onnistumisprosentit
const openaiSuccessRate = new Rate('openai_success_rate');
const anthropicSuccessRate = new Rate('anthropic_success_rate');
const ollamaSuccessRate = new Rate('ollama_success_rate');

// Virhetyyppien laskurit
const timeoutErrors = new Counter('timeout_errors');
const serverErrors = new Counter('server_errors');
const clientErrors = new Counter('client_errors');

// Testin asetukset
export const options = {
  stages: [
    { duration: '10s', target: 10 },   // Lämmittelyvaihe
    { duration: '30s', target: 100 },  // Keskitason kuorma
    { duration: '10s', target: 0 },    // Jäähdyttelyvaihe
  ],
  thresholds: {
    'error_rate': ['rate<0.5'],          // Virheprosentti alle 50%
    'response_time': ['p(95)<30000'],    // 95% pyynnöistä alle 30s
  },
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

// Testattavat mallit ja niiden painotukset
const providers = [
  { name: 'openai', weight: 0.4, models: ['gpt-3.5-turbo'] },
  { name: 'anthropic', weight: 0.4, models: ['claude-instant-1'] },
  { name: 'ollama', weight: 0.2, models: ['llama2'] }
];

// Kirjoita lokiin
function log(message, model, status, duration) {
  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp} | Model: ${model} | Status: ${status} | Duration: ${duration}ms | ${message}`;
  console.log(logEntry);
}

// Valitse palveluntarjoaja painotusten mukaan
function selectProvider() {
  const random = Math.random();
  let cumulativeWeight = 0;
  
  for (const provider of providers) {
    cumulativeWeight += provider.weight;
    if (random < cumulativeWeight) {
      return provider;
    }
  }
  
  // Varmuuden vuoksi palautetaan ensimmäinen
  return providers[0];
}

export default function () {
  // Valitaan palveluntarjoaja painotusten mukaan
  const provider = selectProvider();
  const model = provider.models[Math.floor(Math.random() * provider.models.length)];
  const prompt = prompts[Math.floor(Math.random() * prompts.length)];
  
  // Käytetään /ai/process-endpointia, joka hyödyntää AIGateway-luokan fallback-mekanismia
  const url = 'http://localhost:3001/ai/process';
  
  const payload = JSON.stringify({
    taskType: 'seo',
    input: prompt,
    primaryModel: provider.name,  // Määritetään ensisijainen malli
  });
  
  const params = {
    headers: {
      'Content-Type': 'application/json'
    },
    timeout: 30000  // 30 sekunnin timeout
  };

  // Mitataan vasteaika
  const startTime = Date.now();
  const response = http.post(url, payload, params);
  const duration = Date.now() - startTime;
  
  // Lisätään vasteaika yleiseen metriikkaan
  responseTime.add(duration);

  // Tarkistetaan vastauksen status
  const success = response.status === 200;
  
  if (success) {
    successfulRequests.add(1);
    
    try {
      const data = response.json();
      
      // Lokitus
      log(`Pyyntö onnistui, käytettiin mallia: ${data.model || provider.name}`, 
          data.model || provider.name, 'success', duration);
      
      // Päivitetään mallikohtaiset metriikat
      if (data.model === 'openai' || data.provider === 'openai' || provider.name === 'openai') {
        openaiTime.add(duration);
        openaiSuccessRate.add(1);
      } else if (data.model === 'anthropic' || data.provider === 'anthropic' || provider.name === 'anthropic') {
        anthropicTime.add(duration);
        anthropicSuccessRate.add(1);
      } else if (data.model === 'ollama' || data.provider === 'ollama' || provider.name === 'ollama') {
        ollamaTime.add(duration);
        ollamaSuccessRate.add(1);
      }
      
    } catch (e) {
      // JSON-jäsennysvirhe
      log(`Vastauksen jäsennysvirhe: ${e.message}`, provider.name, 'error', duration);
    }
  } else {
    failedRequests.add(1);
    errorRate.add(1);
    
    // Luokitellaan virhetyyppi
    if (response.error_code === 'ETIMEDOUT' || response.error_code === 'ESOCKETTIMEDOUT') {
      timeoutErrors.add(1);
      log(`Timeout-virhe`, provider.name, 'timeout', duration);
    } else if (response.status >= 500) {
      serverErrors.add(1);
      log(`Palvelinvirhe: ${response.status}`, provider.name, 'server_error', duration);
    } else if (response.status >= 400) {
      clientErrors.add(1);
      log(`Asiakasvirhe: ${response.status}`, provider.name, 'client_error', duration);
    } else {
      log(`Muu virhe: ${response.status}`, provider.name, 'other_error', duration);
    }
    
    // Päivitetään mallikohtaiset virheet
    if (provider.name === 'openai') {
      openaiSuccessRate.add(0);
    } else if (provider.name === 'anthropic') {
      anthropicSuccessRate.add(0);
    } else if (provider.name === 'ollama') {
      ollamaSuccessRate.add(0);
    }
  }

  // Satunnainen viive pyyntöjen välillä (100-500ms)
  sleep(Math.random() * 0.4 + 0.1);
}

// Testin lopussa tulostetaan yhteenveto
export function handleSummary(data) {
  // Lasketaan mallikohtaiset metriikat
  const openaiAvg = data.metrics.openai_processing_time ? data.metrics.openai_processing_time.values.avg : 0;
  const openaiP95 = data.metrics.openai_processing_time ? data.metrics.openai_processing_time.values['p(95)'] : 0;
  const openaiCount = data.metrics.openai_success_rate ? data.metrics.openai_success_rate.values.passes : 0;
  const openaiSuccess = data.metrics.openai_success_rate ? (data.metrics.openai_success_rate.values.rate * 100) : 0;
  
  const anthropicAvg = data.metrics.anthropic_processing_time ? data.metrics.anthropic_processing_time.values.avg : 0;
  const anthropicP95 = data.metrics.anthropic_processing_time ? data.metrics.anthropic_processing_time.values['p(95)'] : 0;
  const anthropicCount = data.metrics.anthropic_success_rate ? data.metrics.anthropic_success_rate.values.passes : 0;
  const anthropicSuccess = data.metrics.anthropic_success_rate ? (data.metrics.anthropic_success_rate.values.rate * 100) : 0;
  
  const ollamaAvg = data.metrics.ollama_processing_time ? data.metrics.ollama_processing_time.values.avg : 0;
  const ollamaP95 = data.metrics.ollama_processing_time ? data.metrics.ollama_processing_time.values['p(95)'] : 0;
  const ollamaCount = data.metrics.ollama_success_rate ? data.metrics.ollama_success_rate.values.passes : 0;
  const ollamaSuccess = data.metrics.ollama_success_rate ? (data.metrics.ollama_success_rate.values.rate * 100) : 0;
  
  // Tulostetaan yhteenveto
  console.log(`OpenAI: avg=${openaiAvg}ms, p95=${openaiP95}ms, count=${openaiCount}, success=${openaiSuccess}%`);
  console.log(`Anthropic: avg=${anthropicAvg}ms, p95=${anthropicP95}ms, count=${anthropicCount}, success=${anthropicSuccess}%`);
  console.log(`Ollama: avg=${ollamaAvg}ms, p95=${ollamaP95}ms, count=${ollamaCount}, success=${ollamaSuccess}%`);
  
  return {
    'stdout': JSON.stringify({
      timestamp: new Date().toISOString(),
      metrics: {
        openai: { avg: openaiAvg, p95: openaiP95, count: openaiCount, success: openaiSuccess },
        anthropic: { avg: anthropicAvg, p95: anthropicP95, count: anthropicCount, success: anthropicSuccess },
        ollama: { avg: ollamaAvg, p95: ollamaP95, count: ollamaCount, success: ollamaSuccess },
        total: {
          count: openaiCount + anthropicCount + ollamaCount,
          success: (openaiCount + anthropicCount + ollamaCount > 0) ? 
            ((openaiSuccess * openaiCount + anthropicSuccess * anthropicCount + ollamaSuccess * ollamaCount) / 
             (openaiCount + anthropicCount + ollamaCount)) : 0
        }
      }
    }),
    'model-comparison-log.txt': data.metrics.openai_processing_time ? 
      `OpenAI: avg=${openaiAvg}ms, p95=${openaiP95}ms, count=${openaiCount}, success=${openaiSuccess}%\n` +
      `Anthropic: avg=${anthropicAvg}ms, p95=${anthropicP95}ms, count=${anthropicCount}, success=${anthropicSuccess}%\n` +
      `Ollama: avg=${ollamaAvg}ms, p95=${ollamaP95}ms, count=${ollamaCount}, success=${ollamaSuccess}%\n` : 
      'Ei tuloksia saatavilla'
  };
}
