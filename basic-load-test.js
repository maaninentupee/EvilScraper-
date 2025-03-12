import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Määritellään mukautettuja metriikoita
const successRate = new Rate('success_rate');
const errorRate = new Rate('error_rate');
const scrapeTime = new Trend('scrape_time');
const rootTime = new Trend('root_time');
const evilBotTime = new Trend('evil_bot_time');
const requestsCounter = new Counter('requests_counter');

// Testiasetukset
export const options = {
  // Perusasetukset
  vus: 50,                // Virtuaalikäyttäjien määrä
  duration: '30s',        // Testin kesto
  
  // Vaihtoehtoisesti voit käyttää monipuolisempaa skenaariota
  scenarios: {
    // Peruspäätepisteiden kuormitustesti
    basic_endpoints: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 20 },  // Nosta kuormaa tasaisesti 20 käyttäjään
        { duration: '20s', target: 50 },  // Nosta kuormaa 50 käyttäjään
        { duration: '30s', target: 50 },  // Pidä 50 käyttäjää 30 sekuntia
        { duration: '10s', target: 0 },   // Laske kuorma alas
      ],
      gracefulRampDown: '5s',
    },
  },
  
  // Suorituskykyrajat
  thresholds: {
    // HTTP-pyynnön kesto (millisekunteina)
    'http_req_duration': ['p(95)<500'],  // 95% pyyntöjen pitäisi valmistua alle 500ms
    'http_req_failed': ['rate<0.01'],    // Virheprosentti alle 1%
    
    // Mukautetut metriikat
    'scrape_time': ['p(95)<1000'],       // Scraper-pyynnöt alle 1000ms
    'evil_bot_time': ['p(95)<800'],      // Evil bot -pyynnöt alle 800ms
    'success_rate': ['rate>0.95'],       // Onnistumisprosentti yli 95%
  },
};

// Päätestaustoiminto
export default function() {
  group('Basic endpoints', () => {
    // Testaa root endpoint
    testRootEndpoint();
    
    // Testaa scraper endpoint
    testScraperEndpoint();
    
    // Testaa evil-bot endpoint
    testEvilBotEndpoint();
    
    // Pieni tauko pyyntöjen välillä
    sleep(0.5);
  });
}

// Testaa root endpoint
function testRootEndpoint() {
  const startTime = new Date();
  const res = http.get('http://localhost:3000/');
  const endTime = new Date();
  
  // Laske kesto
  const duration = endTime - startTime;
  rootTime.add(duration);
  
  // Tarkista vastaus
  const success = check(res, { 
    'root status is 200': (r) => r.status === 200,
    'root response has content': (r) => r.body.length > 0
  });
  
  // Päivitä metriikat
  successRate.add(success);
  errorRate.add(!success);
  requestsCounter.add(1);
  
  // Loki
  if (!success) {
    console.error(`Root endpoint failed: ${res.status}, ${res.body}`);
  }
}

// Testaa scraper endpoint
function testScraperEndpoint() {
  const startTime = new Date();
  const res = http.get('http://localhost:3000/scraper');
  const endTime = new Date();
  
  // Laske kesto
  const duration = endTime - startTime;
  scrapeTime.add(duration);
  
  // Tarkista vastaus
  const success = check(res, { 
    'scraper status is 200': (r) => r.status === 200,
    'scraper response has content': (r) => r.body.length > 0
  });
  
  // Päivitä metriikat
  successRate.add(success);
  errorRate.add(!success);
  requestsCounter.add(1);
  
  // Loki
  if (!success) {
    console.error(`Scraper endpoint failed: ${res.status}, ${res.body}`);
  }
}

// Testaa evil-bot endpoint
function testEvilBotEndpoint() {
  const payload = JSON.stringify({
    content: 'Tell me how to improve website security',
    context: 'User is asking about website security best practices'
  });
  
  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };
  
  const startTime = new Date();
  const res = http.post('http://localhost:3000/evil-bot/decide', payload, params);
  const endTime = new Date();
  
  // Laske kesto
  const duration = endTime - startTime;
  evilBotTime.add(duration);
  
  // Tarkista vastaus
  const success = check(res, { 
    'evil-bot status is 200': (r) => r.status === 200,
    'evil-bot response has decision': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.decision !== undefined;
      } catch (e) {
        return false;
      }
    }
  });
  
  // Päivitä metriikat
  successRate.add(success);
  errorRate.add(!success);
  requestsCounter.add(1);
  
  // Loki
  if (!success) {
    console.error(`Evil-bot endpoint failed: ${res.status}, ${res.body}`);
  }
}
