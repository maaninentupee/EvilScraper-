/**
 * Paranneltu fallback-mekanismin testaukseen tarkoitettu skripti
 * Testaa älykkäämpää fallback-mekanismia, virheiden luokittelua ja palveluntarjoajien valintastrategioita
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { SharedArray } from 'k6/data';
import { htmlReport } from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.1/index.js";

// Yleiset metriikat
const errorRate = new Rate('error_rate');
const responseTime = new Trend('response_time');
const successfulRequests = new Counter('successful_requests');
const failedRequests = new Counter('failed_requests');
const fallbackUsed = new Counter('fallback_used');
const cacheHits = new Counter('cache_hits');
const totalRequests = new Counter('total_requests');

// Virhetyyppien metriikat
const serviceUnavailableErrors = new Counter('service_unavailable_errors');
const modelNotFoundErrors = new Counter('model_not_found_errors');
const timeoutErrors = new Counter('timeout_errors');
const rateLimitErrors = new Counter('rate_limit_errors');
const invalidRequestErrors = new Counter('invalid_request_errors');
const unexpectedErrors = new Counter('unexpected_errors');

// Palveluntarjoajakohtaiset metriikat
const openaiSuccessRate = new Rate('openai_success_rate');
const anthropicSuccessRate = new Rate('anthropic_success_rate');
const ollamaSuccessRate = new Rate('ollama_success_rate');
const localSuccessRate = new Rate('local_success_rate');

// Strategiakohtaiset metriikat
const performanceStrategyTime = new Trend('performance_strategy_time');
const costStrategyTime = new Trend('cost_strategy_time');
const qualityStrategyTime = new Trend('quality_strategy_time');
const fallbackStrategyTime = new Trend('fallback_strategy_time');

// Testin asetukset
export const options = {
  stages: [
    { duration: '10s', target: 5 },   // Lämmittelyvaihe
    { duration: '30s', target: 20 },  // Keskitason kuorma
    { duration: '20s', target: 40 },  // Korkea kuorma
    { duration: '10s', target: 0 },   // Jäähdyttelyvaihe
  ],
  thresholds: {
    'error_rate': ['rate<0.4'],        // Virheprosentti alle 40%
    'response_time': ['p(95)<10000'],  // 95% pyynnöistä alle 10s
    'fallback_used': ['count>10'],     // Vähintään 10 fallback-käyttöä
  },
};

// Testattavat promptit - monipuolisempia prompteja eri tehtävätyypeille
const prompts = [
  { text: "Miten tekoäly toimii?", taskType: "general" },
  { text: "Miten tekoäly toimii?", taskType: "general" }, // Sama prompti välimuistin testaamiseksi
  { text: "Kirjoita lyhyt runo", taskType: "creative" },
  { text: "Kirjoita lyhyt runo", taskType: "creative" }, // Sama prompti välimuistin testaamiseksi
  { text: "Selitä mitä on koneoppiminen", taskType: "educational" },
  { text: "Selitä mitä on koneoppiminen", taskType: "educational" }, // Sama prompti välimuistin testaamiseksi
  { text: "Anna kolme SEO-vinkkiä", taskType: "seo" },
  { text: "Mikä on paras ohjelmointikieli aloittelijalle?", taskType: "programming" },
  { text: "Kirjoita esimerkki REST API:sta", taskType: "programming" },
  { text: "Miten voin parantaa verkkosivuni suorituskykyä?", taskType: "seo" },
  { text: "Kirjoita tuotekuvaus älykellosta", taskType: "marketing" },
  { text: "Analysoi tämän koodin tehokkuutta: for(let i=0; i<arr.length; i++) { console.log(arr[i]); }", taskType: "code_review" },
  { text: "Miten voin optimoida PostgreSQL-tietokannan kyselyjä?", taskType: "database" },
  { text: "Selitä mikropalveluarkkitehtuurin edut ja haitat", taskType: "architecture" },
  { text: "Kirjoita yksinkertainen React-komponentti, joka näyttää laskurin", taskType: "programming" }
];

// Testattavat palveluntarjoajat
const providers = ['openai', 'anthropic', 'ollama', 'local'];

// Testattavat strategiat
const strategies = ['performance', 'cost', 'quality', 'fallback'];

// Virhetilanteiden simulointi
const errorSimulations = [
  { type: 'none', weight: 0.6 },                  // Ei simuloitua virhettä (60%)
  { type: 'service_unavailable', weight: 0.1 },   // Palvelu ei saatavilla (10%)
  { type: 'model_not_found', weight: 0.05 },      // Mallia ei löydy (5%)
  { type: 'timeout', weight: 0.1 },               // Aikakatkaisu (10%)
  { type: 'rate_limit', weight: 0.05 },           // Rate limit (5%)
  { type: 'invalid_request', weight: 0.05 },      // Virheellinen pyyntö (5%)
  { type: 'all', weight: 0.05 }                   // Kaikki palveluntarjoajat epäonnistuvat (5%)
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

// Testaa paranneltua fallback-mekanismia
export default function () {
  // Valitaan satunnainen prompti
  const promptIndex = Math.floor(Math.random() * prompts.length);
  const promptObj = prompts[promptIndex];
  
  // Valitaan satunnainen palveluntarjoaja
  const providerIndex = Math.floor(Math.random() * providers.length);
  const provider = providers[providerIndex];
  
  // Valitaan satunnainen strategia
  const strategyIndex = Math.floor(Math.random() * strategies.length);
  const strategy = strategies[strategyIndex];
  
  // Valitaan satunnainen virhetilanne
  const errorType = selectErrorSimulation();
  
  // Luodaan pyyntö
  const url = 'http://localhost:3001/ai-enhanced/process';
  
  const payload = JSON.stringify({
    taskType: promptObj.taskType,
    input: promptObj.text,
    preferredProvider: provider,
    strategy: strategy,
    testMode: errorType !== 'none',
    testError: errorType !== 'none' ? errorType : undefined
  });
  
  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: 15000 // 15 sekunnin timeout
  };

  // Mitataan vasteaika
  const startTime = Date.now();
  const response = http.post(url, payload, params);
  const duration = Date.now() - startTime;
  
  // Lisätään vasteaika yleiseen metriikkaan
  responseTime.add(duration);
  totalRequests.add(1);
  
  // Lisätään vasteaika strategiakohtaiseen metriikkaan
  if (strategy === 'performance') {
    performanceStrategyTime.add(duration);
  } else if (strategy === 'cost') {
    costStrategyTime.add(duration);
  } else if (strategy === 'quality') {
    qualityStrategyTime.add(duration);
  } else if (strategy === 'fallback') {
    fallbackStrategyTime.add(duration);
  }

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
        console.log(`Välimuistiosuma: ${promptObj.text.substring(0, 20)}...`);
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
      
      console.log(`Onnistunut pyyntö: ${data.provider} | ${duration}ms | ${promptObj.text.substring(0, 20)}... | Strategia: ${strategy} | Simuloitu virhe: ${errorType}`);
      
      // Tarkistetaan vastauksen oikeellisuus
      check(data, {
        'Vastaus sisältää tekstin': (r) => r.text && r.text.length > 0,
        'Vastaus sisältää palveluntarjoajan': (r) => r.provider && r.provider.length > 0,
        'Vastaus sisältää mallin': (r) => r.model && r.model.length > 0,
        'Vastaus sisältää käsittelyajan': (r) => r.processingTime && r.processingTime > 0
      });
      
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
    
    console.log(`Epäonnistunut pyyntö: ${response.status} | ${duration}ms | ${promptObj.text.substring(0, 20)}... | Strategia: ${strategy} | Simuloitu virhe: ${errorType}`);
    
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
      } else if (errorData.errorType === 'invalid_request') {
        invalidRequestErrors.add(1);
        console.log(`Virheellinen pyyntö: ${errorData.error}`);
      } else {
        unexpectedErrors.add(1);
        console.log(`Odottamaton virhe: ${errorData.error}`);
      }
    } catch (e) {
      // Jos vastaus ei ole JSON-muodossa
      console.log(`Virheellinen vastaus: ${response.body}`);
    }
  }
  
  // Pieni viive pyyntöjen välillä
  sleep(Math.random() * 0.5 + 0.2); // 200-700ms
}

// Testin lopussa tulostetaan yhteenveto
export function handleSummary(data) {
  // Lasketaan onnistumisprosentit
  const totalSuccess = data.metrics.successful_requests.values.count;
  const totalFailed = data.metrics.failed_requests.values.count;
  const total = totalSuccess + totalFailed;
  
  const successPercentage = (totalSuccess / total * 100).toFixed(2);
  const fallbackPercentage = (data.metrics.fallback_used.values.count / total * 100).toFixed(2);
  const cacheHitPercentage = (data.metrics.cache_hits.values.count / total * 100).toFixed(2);
  
  // Palveluntarjoajakohtaiset tilastot
  const openaiSuccess = data.metrics.openai_success_rate ? data.metrics.openai_success_rate.values.rate * 100 : 0;
  const anthropicSuccess = data.metrics.anthropic_success_rate ? data.metrics.anthropic_success_rate.values.rate * 100 : 0;
  const ollamaSuccess = data.metrics.ollama_success_rate ? data.metrics.ollama_success_rate.values.rate * 100 : 0;
  const localSuccess = data.metrics.local_success_rate ? data.metrics.local_success_rate.values.rate * 100 : 0;
  
  // Virhetilastot
  const serviceUnavailable = data.metrics.service_unavailable_errors ? data.metrics.service_unavailable_errors.values.count : 0;
  const modelNotFound = data.metrics.model_not_found_errors ? data.metrics.model_not_found_errors.values.count : 0;
  const timeout = data.metrics.timeout_errors ? data.metrics.timeout_errors.values.count : 0;
  const rateLimit = data.metrics.rate_limit_errors ? data.metrics.rate_limit_errors.values.count : 0;
  const invalidRequest = data.metrics.invalid_request_errors ? data.metrics.invalid_request_errors.values.count : 0;
  const unexpected = data.metrics.unexpected_errors ? data.metrics.unexpected_errors.values.count : 0;
  
  // Strategiakohtaiset tilastot
  const performanceAvg = data.metrics.performance_strategy_time ? data.metrics.performance_strategy_time.values.avg : 0;
  const costAvg = data.metrics.cost_strategy_time ? data.metrics.cost_strategy_time.values.avg : 0;
  const qualityAvg = data.metrics.quality_strategy_time ? data.metrics.quality_strategy_time.values.avg : 0;
  const fallbackAvg = data.metrics.fallback_strategy_time ? data.metrics.fallback_strategy_time.values.avg : 0;
  
  // Luodaan yhteenvetotiedosto
  const summaryData = {
    timestamp: new Date().toISOString(),
    duration: data.state.testRunDurationMs,
    totalRequests: total,
    successfulRequests: totalSuccess,
    failedRequests: totalFailed,
    successPercentage: parseFloat(successPercentage),
    fallbackUsed: data.metrics.fallback_used.values.count,
    fallbackPercentage: parseFloat(fallbackPercentage),
    cacheHits: data.metrics.cache_hits.values.count,
    cacheHitPercentage: parseFloat(cacheHitPercentage),
    responseTime: {
      avg: data.metrics.response_time.values.avg,
      min: data.metrics.response_time.values.min,
      max: data.metrics.response_time.values.max,
      p90: data.metrics.response_time.values["p(90)"],
      p95: data.metrics.response_time.values["p(95)"],
      p99: data.metrics.response_time.values["p(99)"]
    },
    providerStats: {
      openai: {
        successRate: openaiSuccess.toFixed(2)
      },
      anthropic: {
        successRate: anthropicSuccess.toFixed(2)
      },
      ollama: {
        successRate: ollamaSuccess.toFixed(2)
      },
      local: {
        successRate: localSuccess.toFixed(2)
      }
    },
    errorStats: {
      serviceUnavailable,
      modelNotFound,
      timeout,
      rateLimit,
      invalidRequest,
      unexpected
    },
    strategyStats: {
      performance: {
        avgResponseTime: performanceAvg.toFixed(2)
      },
      cost: {
        avgResponseTime: costAvg.toFixed(2)
      },
      quality: {
        avgResponseTime: qualityAvg.toFixed(2)
      },
      fallback: {
        avgResponseTime: fallbackAvg.toFixed(2)
      }
    }
  };
  
  // Tallennetaan tulokset
  return {
    "summary.json": JSON.stringify(summaryData, null, 2),
    "summary.html": htmlReport(data),
    "stdout": textSummary(data, { indent: " ", enableColors: true })
  };
}
