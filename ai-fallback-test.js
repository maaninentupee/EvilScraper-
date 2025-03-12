import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Yleiset metriikat
const errorRate = new Rate('error_rate');
const fallbackSuccessRate = new Rate('fallback_success_rate');
const responseTime = new Trend('response_time');
const successfulRequests = new Counter('successful_requests');
const failedRequests = new Counter('failed_requests');

// Mallikohtaiset metriikat
const openaiSuccessRate = new Rate('openai_success_rate');
const anthropicSuccessRate = new Rate('anthropic_success_rate');
const ollamaSuccessRate = new Rate('ollama_success_rate');

// Virhetyyppien laskurit
const timeoutErrors = new Counter('timeout_errors');
const serverErrors = new Counter('server_errors');
const clientErrors = new Counter('client_errors');

export const options = {
  stages: [
    { duration: '5s', target: 5 },   // Lämmittelyvaihe
    { duration: '10s', target: 20 }, // Keskitason kuorma
    { duration: '5s', target: 0 },   // Jäähdyttelyvaihe
  ],
  thresholds: {
    'error_rate': ['rate<0.5'],               // Virheprosentti alle 50%
    'fallback_success_rate': ['rate>0.5'],    // Fallback onnistuu vähintään 50% ajasta
    'response_time': ['avg<30000'],           // Keskimääräinen vasteaika alle 30s
  },
};

// Testattavat promptit
const prompts = [
  "Miten tekoäly toimii?",
  "Kirjoita lyhyt runo",
  "Selitä mitä on koneoppiminen",
  "Anna kolme SEO-vinkkiä"
];

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

export default function () {
  // Käytetään /ai/process-endpointia, joka tukee fallback-mekanismia
  const url = 'http://localhost:3001/ai/process';
  
  // Valitaan satunnainen prompt
  const prompt = prompts[Math.floor(Math.random() * prompts.length)];
  
  // Simuloidaan virhetilanne asettamalla ensisijainen malli, joka todennäköisesti epäonnistuu
  // Tämä testaa AIGateway-luokan fallback-mekanismia
  const primaryModel = Math.random() < 0.5 ? 'openai' : 'ollama';
  
  const payload = JSON.stringify({
    taskType: 'seo',
    input: prompt,
    primaryModel: primaryModel,  // Määritetään ensisijainen malli
    forceError: Math.random() < 0.3,  // 30% todennäköisyydellä simuloidaan virhe
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
  
  // Lisätään vasteaika metriikkaan
  responseTime.add(duration);

  // Tarkistetaan vastauksen status
  const success = response.status === 200;
  
  if (success) {
    successfulRequests.add(1);
    
    try {
      const data = response.json();
      
      // Tarkistetaan, käytettiinkö fallbackia
      const usedFallback = data.usedFallback === true;
      
      if (usedFallback) {
        fallbackSuccessRate.add(1);
        log(`Fallback onnistui, käytettiin mallia: ${data.model || 'tuntematon'}`, 
            data.model || primaryModel, 'success', duration);
      } else {
        log(`Ensisijainen malli onnistui: ${data.model || primaryModel}`, 
            data.model || primaryModel, 'success', duration);
      }
      
      // Päivitetään mallikohtaiset metriikat
      if (data.model === 'openai' || data.provider === 'openai') {
        openaiSuccessRate.add(1);
      } else if (data.model === 'anthropic' || data.provider === 'anthropic') {
        anthropicSuccessRate.add(1);
      } else if (data.model === 'ollama' || data.provider === 'ollama') {
        ollamaSuccessRate.add(1);
      }
      
    } catch (e) {
      // JSON-jäsennysvirhe
      log(`Vastauksen jäsennysvirhe: ${e.message}`, primaryModel, 'error', duration);
    }
  } else {
    failedRequests.add(1);
    errorRate.add(1);
    
    // Luokitellaan virhetyyppi
    if (response.error_code === 'ETIMEDOUT' || response.error_code === 'ESOCKETTIMEDOUT') {
      timeoutErrors.add(1);
      log(`Timeout-virhe`, primaryModel, 'timeout', duration);
    } else if (response.status >= 500) {
      serverErrors.add(1);
      log(`Palvelinvirhe: ${response.status}`, primaryModel, 'server_error', duration);
    } else if (response.status >= 400) {
      clientErrors.add(1);
      log(`Asiakasvirhe: ${response.status}`, primaryModel, 'client_error', duration);
    } else {
      log(`Muu virhe: ${response.status}`, primaryModel, 'other_error', duration);
    }
  }

  // Pieni viive pyyntöjen välillä
  sleep(Math.random() * 0.5 + 0.5); // 0.5-1s viive
}

// Testin lopussa tulostetaan yhteenveto
export function handleSummary(data) {
  // Lasketaan mallikohtaiset metriikat
  const openaiSuccessRateValue = data.metrics.openai_success_rate ? data.metrics.openai_success_rate.values.rate * 100 : 0;
  const anthropicSuccessRateValue = data.metrics.anthropic_success_rate ? data.metrics.anthropic_success_rate.values.rate * 100 : 0;
  const ollamaSuccessRateValue = data.metrics.ollama_success_rate ? data.metrics.ollama_success_rate.values.rate * 100 : 0;
  
  // Lasketaan yleiset metriikat
  const errorRateValue = data.metrics.error_rate ? data.metrics.error_rate.values.rate * 100 : 0;
  const fallbackSuccessRateValue = data.metrics.fallback_success_rate ? data.metrics.fallback_success_rate.values.rate * 100 : 0;
  const responseTimeAvg = data.metrics.response_time ? data.metrics.response_time.values.avg : 0;
  const responseTimeP95 = data.metrics.response_time ? data.metrics.response_time.values['p(95)'] : 0;
  
  // Lasketaan pyyntöjen määrät
  const successfulRequestsCount = data.metrics.successful_requests ? data.metrics.successful_requests.values.count : 0;
  const failedRequestsCount = data.metrics.failed_requests ? data.metrics.failed_requests.values.count : 0;
  const totalRequests = successfulRequestsCount + failedRequestsCount;
  
  // Lasketaan virhetyypit
  const timeoutErrorsCount = data.metrics.timeout_errors ? data.metrics.timeout_errors.values.count : 0;
  const serverErrorsCount = data.metrics.server_errors ? data.metrics.server_errors.values.count : 0;
  const clientErrorsCount = data.metrics.client_errors ? data.metrics.client_errors.values.count : 0;
  
  // Luodaan yhteenveto
  const summary = {
    timestamp: new Date().toISOString(),
    duration: data.state.testRunDurationMs,
    iterations: data.metrics.iterations.values.count,
    vus: data.state.maxVUs,
    metrics: {
      error_rate: errorRateValue,
      fallback_success_rate: fallbackSuccessRateValue,
      response_time: {
        avg: responseTimeAvg,
        p95: responseTimeP95
      },
      requests: {
        successful: successfulRequestsCount,
        failed: failedRequestsCount,
        total: totalRequests
      },
      errors: {
        timeout: timeoutErrorsCount,
        server: serverErrorsCount,
        client: clientErrorsCount,
        other: failedRequestsCount - timeoutErrorsCount - serverErrorsCount - clientErrorsCount
      },
      models: {
        openai: {
          success_rate: openaiSuccessRateValue
        },
        anthropic: {
          success_rate: anthropicSuccessRateValue
        },
        ollama: {
          success_rate: ollamaSuccessRateValue
        }
      }
    },
    logs: logs
  };
  
  // Tulostetaan yhteenveto konsoliin
  console.log('=== Fallback-testin yhteenveto ===');
  console.log(`Virheprosentti: ${errorRateValue.toFixed(2)}%`);
  console.log(`Fallback-onnistumisprosentti: ${fallbackSuccessRateValue.toFixed(2)}%`);
  console.log(`Vasteaika (keskiarvo): ${(responseTimeAvg / 1000).toFixed(2)} s`);
  console.log(`Vasteaika (P95): ${(responseTimeP95 / 1000).toFixed(2)} s`);
  console.log(`Onnistuneet pyynnöt: ${successfulRequestsCount}`);
  console.log(`Epäonnistuneet pyynnöt: ${failedRequestsCount}`);
  console.log(`Yhteensä: ${totalRequests}`);
  
  // Palautetaan yhteenveto tiedostoina
  return {
    'stdout': JSON.stringify(summary, null, 2),
    'fallback-test-summary.json': JSON.stringify(summary, null, 2),
    'fallback-test-log.txt': logs.map(entry => 
      `${entry.timestamp} | Model: ${entry.model} | Status: ${entry.status} | Duration: ${entry.duration}ms | ${entry.message}`
    ).join('\n')
  };
}
