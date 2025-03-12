import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Määritellään metriikat
const errorRate = new Rate('error_rate');
const aiProcessingTime = new Trend('ai_processing_time');
const successfulRequests = new Counter('successful_requests');
const failedRequests = new Counter('failed_requests');

// Testin asetukset - 1000+ pyyntöä (massiivinen kuorma)
export const options = {
  stages: [
    { duration: '1m', target: 100 },  // 100 käyttäjää minuutissa
    { duration: '3m', target: 500 },  // 500 käyttäjää kolmen minuutin aikana
    { duration: '2m', target: 0 }     // Skaalautuminen alas
  ],
  thresholds: {
    'error_rate': ['rate<0.3'],            // Virheprosentti alle 30%
    'http_req_duration': ['p(95)<15000'],  // 95% pyynnöistä alle 15s
    'ai_processing_time': ['avg<8000'],    // Keskimääräinen käsittelyaika alle 8s
  },
};

// Testin pääfunktio
export default function() {
  const url = 'http://localhost:3001/ai/process';
  
  // Vaihdellaan tehtävätyyppejä ja syötteitä kuorman monipuolistamiseksi
  const taskTypes = ['seo', 'code', 'decision'];
  const inputs = [
    'Analyze this website: https://example.com',
    'Generate a simple React component for a login form',
    'Should I use MongoDB or PostgreSQL for a high-traffic e-commerce site?',
    'Explain the benefits of microservices architecture',
    'What are the best SEO practices for a blog in 2025?'
  ];
  
  // Valitaan satunnainen tehtävätyyppi ja syöte
  const taskType = taskTypes[Math.floor(Math.random() * taskTypes.length)];
  const input = inputs[Math.floor(Math.random() * inputs.length)];
  
  const payload = JSON.stringify({
    taskType: taskType,
    input: input,
  });
  
  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: '60s', // Pidempi timeout raskaalle kuormalle
  };
  
  const startTime = new Date().getTime();
  const response = http.post(url, payload, params);
  const endTime = new Date().getTime();
  
  // Lasketaan käsittelyaika millisekunteina
  const processingTime = endTime - startTime;
  aiProcessingTime.add(processingTime);
  
  // Tarkistetaan vastauksen onnistuminen
  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'response has result': (r) => r.json().hasOwnProperty('result'),
  });
  
  // Päivitetään metriikat
  errorRate.add(!success);
  
  if (success) {
    successfulRequests.add(1);
  } else {
    failedRequests.add(1);
    console.log(`Virhe: ${response.status}, Body: ${response.body}`);
  }
  
  // Lisätään pieni tauko pyyntöjen väliin
  sleep(Math.random() * 2);
}
