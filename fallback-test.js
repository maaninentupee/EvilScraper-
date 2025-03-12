/**
 * Fallback-mekanismin testaukseen tarkoitettu skripti
 * Testaa välimuistia, rate limitingiä ja älykästä mallin valintaa
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Yleiset metriikat
const errorRate = new Rate('error_rate');
const responseTime = new Trend('response_time');
const successfulRequests = new Counter('successful_requests');
const failedRequests = new Counter('failed_requests');
const fallbackUsed = new Counter('fallback_used');
const cacheHits = new Counter('cache_hits');

// Virhetyyppien metriikat
const serviceUnavailableErrors = new Counter('service_unavailable_errors');
const modelNotFoundErrors = new Counter('model_not_found_errors');
const timeoutErrors = new Counter('timeout_errors');
const rateLimitErrors = new Counter('rate_limit_errors');
const unexpectedErrors = new Counter('unexpected_errors');

// Palveluntarjoajakohtaiset metriikat
const openaiSuccessRate = new Rate('openai_success_rate');
const anthropicSuccessRate = new Rate('anthropic_success_rate');
const ollamaSuccessRate = new Rate('ollama_success_rate');
const localSuccessRate = new Rate('local_success_rate');

// Testin asetukset
export const options = {
  stages: [
    { duration: '5s', target: 5 },    // Lämmittelyvaihe
    { duration: '15s', target: 30 },  // Keskitason kuorma
    { duration: '5s', target: 0 },    // Jäähdyttelyvaihe
  ],
  thresholds: {
    'error_rate': ['rate<0.5'],        // Virheprosentti alle 50%
    'response_time': ['p(95)<15000'],  // 95% pyynnöistä alle 15s
  },
};

// Testattavat promptit - käytetään samaa promptia useaan kertaan välimuistin testaamiseksi
const prompts = [
  "Miten tekoäly toimii?",
  "Miten tekoäly toimii?", // Sama prompti välimuistin testaamiseksi
  "Kirjoita lyhyt runo",
  "Kirjoita lyhyt runo", // Sama prompti välimuistin testaamiseksi
  "Selitä mitä on koneoppiminen",
  "Selitä mitä on koneoppiminen", // Sama prompti välimuistin testaamiseksi
  "Anna kolme SEO-vinkkiä",
  "Mikä on paras ohjelmointikieli aloittelijalle?",
  "Kirjoita esimerkki REST API:sta",
  "Miten voin parantaa verkkosivuni suorituskykyä?"
];

// Testattavat palveluntarjoajat
const providers = ['openai', 'anthropic', 'ollama', 'local'];

// Virhetilanteiden simulointi
const errorSimulations = [
  { type: 'none', weight: 0.7 },                  // Ei simuloitua virhettä (70%)
  { type: 'service_unavailable', weight: 0.1 },   // Palvelu ei saatavilla (10%)
  { type: 'model_not_found', weight: 0.05 },      // Mallia ei löydy (5%)
  { type: 'timeout', weight: 0.1 },               // Aikakatkaisu (10%)
  { type: 'rate_limit', weight: 0.05 }            // Rate limit (5%)
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

// Testaa fallback-mekanismia
export default function () {
  // Valitaan satunnainen prompti
  const promptIndex = Math.floor(Math.random() * prompts.length);
  const prompt = prompts[promptIndex];
  
  // Valitaan satunnainen palveluntarjoaja
  const providerIndex = Math.floor(Math.random() * providers.length);
  const provider = providers[providerIndex];
  
  // Valitaan satunnainen virhetilanne
  const errorType = selectErrorSimulation();
  
  // Luodaan pyyntö
  const url = 'http://localhost:3001/ai/process';
  
  const payload = JSON.stringify({
    taskType: 'seo',
    input: prompt,
    primaryModel: provider,
    testMode: errorType !== 'none' ? true : false,
    testError: errorType !== 'none' ? errorType : undefined
  });
  
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'X-Test-Mode': errorType !== 'none' ? 'true' : 'false',
      'X-Test-Error': errorType !== 'none' ? errorType : ''
    },
    timeout: 15000 // 15 sekunnin timeout
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
      
      // Tarkistetaan, käytettiinkö fallbackia
      if (data.usedFallback) {
        fallbackUsed.add(1);
        console.log(`Fallback käytössä: ${data.provider} (alkuperäinen: ${provider})`);
      }
      
      // Tarkistetaan, käytettiinkö välimuistia
      if (data.fromCache) {
        cacheHits.add(1);
        console.log(`Välimuistiosuma: ${prompt.substring(0, 20)}...`);
      }
      
      // Päivitetään palveluntarjoajakohtaiset metriikat
      if (data.provider === 'openai') {
        openaiSuccessRate.add(1);
      } else if (data.provider === 'anthropic') {
        anthropicSuccessRate.add(1);
      } else if (data.provider === 'ollama') {
        ollamaSuccessRate.add(1);
      } else if (data.provider === 'local') {
        localSuccessRate.add(1);
      }
      
      console.log(`Onnistunut pyyntö: ${data.provider} | ${duration}ms | ${prompt.substring(0, 20)}... | Simuloitu virhe: ${errorType}`);
      
    } catch (e) {
      console.log(`Vastauksen jäsennysvirhe: ${e.message}`);
    }
  } else {
    failedRequests.add(1);
    errorRate.add(1);
    
    // Päivitetään palveluntarjoajakohtaiset virheet
    if (provider === 'openai') {
      openaiSuccessRate.add(0);
    } else if (provider === 'anthropic') {
      anthropicSuccessRate.add(0);
    } else if (provider === 'ollama') {
      ollamaSuccessRate.add(0);
    } else if (provider === 'local') {
      localSuccessRate.add(0);
    }
    
    console.log(`Epäonnistunut pyyntö: ${response.status} | ${duration}ms | ${prompt.substring(0, 20)}... | Simuloitu virhe: ${errorType}`);
    
    try {
      const errorData = response.json();
      
      // Luokitellaan virhetyyppi
      if (errorData.errorType === 'service_unavailable') {
        serviceUnavailableErrors.add(1);
        console.log(`Palvelu ei ole saatavilla: ${errorData.error}`);
      } else if (errorData.errorType === 'model_not_found') {
        modelNotFoundErrors.add(1);
        console.log(`Mallia ei löydy: ${errorData.error}`);
      } else if (errorData.errorType === 'timeout') {
        timeoutErrors.add(1);
        console.log(`Aikakatkaisu: ${errorData.error}`);
      } else if (errorData.errorType === 'rate_limit') {
        rateLimitErrors.add(1);
        console.log(`Rate limit ylitetty: ${errorData.error}`);
      } else {
        unexpectedErrors.add(1);
        console.log(`Odottamaton virhe: ${errorData.error}`);
      }
    } catch (e) {
      // Jos vastaus ei ole JSON-muodossa
      if (response.status === 429) {
        rateLimitErrors.add(1);
        console.log('Rate limit ylitetty');
      } else if (response.status === 504) {
        timeoutErrors.add(1);
        console.log('Aikakatkaisu');
      } else if (response.status >= 500) {
        serviceUnavailableErrors.add(1);
        console.log('Palvelinvirhe');
      } else {
        unexpectedErrors.add(1);
        console.log(`Muu virhe: ${response.status}`);
      }
    }
  }

  // Satunnainen viive pyyntöjen välillä (100-500ms)
  sleep(Math.random() * 0.4 + 0.1);
}

// Testin lopussa tulostetaan yhteenveto
export function handleSummary(data) {
  // Lasketaan yleiset metriikat
  const totalRequests = data.metrics.successful_requests ? data.metrics.successful_requests.values.count : 0;
  const failedCount = data.metrics.failed_requests ? data.metrics.failed_requests.values.count : 0;
  const fallbackCount = data.metrics.fallback_used ? data.metrics.fallback_used.values.count : 0;
  const cacheHitCount = data.metrics.cache_hits ? data.metrics.cache_hits.values.count : 0;
  
  const avgResponseTime = data.metrics.response_time ? data.metrics.response_time.values.avg : 0;
  const p95ResponseTime = data.metrics.response_time ? data.metrics.response_time.values['p(95)'] : 0;
  
  const errorRateValue = data.metrics.error_rate ? data.metrics.error_rate.values.rate * 100 : 0;
  
  // Lasketaan virhetyyppien määrät
  const serviceUnavailableCount = data.metrics.service_unavailable_errors ? data.metrics.service_unavailable_errors.values.count : 0;
  const modelNotFoundCount = data.metrics.model_not_found_errors ? data.metrics.model_not_found_errors.values.count : 0;
  const timeoutCount = data.metrics.timeout_errors ? data.metrics.timeout_errors.values.count : 0;
  const rateLimitCount = data.metrics.rate_limit_errors ? data.metrics.rate_limit_errors.values.count : 0;
  const unexpectedCount = data.metrics.unexpected_errors ? data.metrics.unexpected_errors.values.count : 0;
  
  // Lasketaan palveluntarjoajakohtaiset metriikat
  const openaiSuccess = data.metrics.openai_success_rate ? data.metrics.openai_success_rate.values.rate * 100 : 0;
  const anthropicSuccess = data.metrics.anthropic_success_rate ? data.metrics.anthropic_success_rate.values.rate * 100 : 0;
  const ollamaSuccess = data.metrics.ollama_success_rate ? data.metrics.ollama_success_rate.values.rate * 100 : 0;
  const localSuccess = data.metrics.local_success_rate ? data.metrics.local_success_rate.values.rate * 100 : 0;
  
  // Lasketaan prosentit
  const fallbackRate = totalRequests > 0 ? (fallbackCount / totalRequests) * 100 : 0;
  const cacheHitRate = totalRequests > 0 ? (cacheHitCount / totalRequests) * 100 : 0;
  
  // Tulostetaan yhteenveto
  console.log(`Yhteenveto:`);
  console.log(`- Yhteensä pyyntöjä: ${totalRequests + failedCount}`);
  console.log(`- Onnistuneet pyynnöt: ${totalRequests} (${100 - errorRateValue}%)`);
  console.log(`- Epäonnistuneet pyynnöt: ${failedCount} (${errorRateValue}%)`);
  console.log(`- Fallback käytössä: ${fallbackCount} (${fallbackRate.toFixed(2)}% onnistuneista)`);
  console.log(`- Välimuistiosumat: ${cacheHitCount} (${cacheHitRate.toFixed(2)}% onnistuneista)`);
  console.log(`- Keskimääräinen vasteaika: ${avgResponseTime.toFixed(2)}ms`);
  console.log(`- 95% vasteaika: ${p95ResponseTime.toFixed(2)}ms`);
  
  console.log(`\nVirhetyypit:`);
  console.log(`- Palvelu ei saatavilla: ${serviceUnavailableCount}`);
  console.log(`- Mallia ei löydy: ${modelNotFoundCount}`);
  console.log(`- Aikakatkaisu: ${timeoutCount}`);
  console.log(`- Rate limit: ${rateLimitCount}`);
  console.log(`- Odottamattomat virheet: ${unexpectedCount}`);
  
  console.log(`\nPalveluntarjoajien onnistumisprosentit:`);
  console.log(`- OpenAI: ${openaiSuccess.toFixed(2)}%`);
  console.log(`- Anthropic: ${anthropicSuccess.toFixed(2)}%`);
  console.log(`- Ollama: ${ollamaSuccess.toFixed(2)}%`);
  console.log(`- Local: ${localSuccess.toFixed(2)}%`);
  
  return {
    'stdout': JSON.stringify({
      timestamp: new Date().toISOString(),
      metrics: {
        totalRequests: totalRequests + failedCount,
        successfulRequests: totalRequests,
        failedRequests: failedCount,
        fallbackUsed: fallbackCount,
        cacheHits: cacheHitCount,
        avgResponseTime: avgResponseTime,
        p95ResponseTime: p95ResponseTime,
        errorRate: errorRateValue,
        fallbackRate: fallbackRate,
        cacheHitRate: cacheHitRate,
        errorTypes: {
          serviceUnavailable: serviceUnavailableCount,
          modelNotFound: modelNotFoundCount,
          timeout: timeoutCount,
          rateLimit: rateLimitCount,
          unexpected: unexpectedCount
        },
        providerSuccess: {
          openai: openaiSuccess,
          anthropic: anthropicSuccess,
          ollama: ollamaSuccess,
          local: localSuccess
        }
      }
    }, null, 2),
    'fallback-test-results.json': JSON.stringify({
      timestamp: new Date().toISOString(),
      metrics: {
        totalRequests: totalRequests + failedCount,
        successfulRequests: totalRequests,
        failedRequests: failedCount,
        fallbackUsed: fallbackCount,
        cacheHits: cacheHitCount,
        avgResponseTime: avgResponseTime,
        p95ResponseTime: p95ResponseTime,
        errorRate: errorRateValue,
        fallbackRate: fallbackRate,
        cacheHitRate: cacheHitRate,
        errorTypes: {
          serviceUnavailable: serviceUnavailableCount,
          modelNotFound: modelNotFoundCount,
          timeout: timeoutCount,
          rateLimit: rateLimitCount,
          unexpected: unexpectedCount
        },
        providerSuccess: {
          openai: openaiSuccess,
          anthropic: anthropicSuccess,
          ollama: ollamaSuccess,
          local: localSuccess
        }
      }
    }, null, 2)
  };
}
