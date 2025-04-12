import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Define custom metrics
const successRate = new Rate('success_rate');
const errorRate = new Rate('error_rate');
const scrapeTime = new Trend('scrape_time');
const rootTime = new Trend('root_time');
const evilBotTime = new Trend('evil_bot_time');
const requestsCounter = new Counter('requests_counter');

// Test settings
export const options = {
  // Basic settings
  vus: 50,                // Number of virtual users
  duration: '30s',        // Test duration
  
  // Alternatively, you can use a more versatile scenario
  scenarios: {
    // Load test for basic endpoints
    basic_endpoints: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 20 },  // Gradually increase load to 20 users
        { duration: '20s', target: 50 },  // Increase load to 50 users
        { duration: '30s', target: 50 },  // Maintain 50 users for 30 seconds
        { duration: '10s', target: 0 },   // Decrease load
      ],
      gracefulRampDown: '5s',
    }
  },
  
  // Thresholds for metrics
  thresholds: {
    'http_req_duration': ['p(95)<500'], // 95% of requests must complete below 500ms
    'http_req_failed': ['rate<0.01'],    // Error rate must be less than 1%
    'success_rate': ['rate>0.95'],       // Success rate must be above 95%
    'scrape_time': ['p(95)<1000'],       // 95% of scrape requests must complete below 1000ms
    'evil_bot_time': ['p(95)<800'],      // 95% of evil bot requests must complete below 800ms
  }
};

// Main test function
export default function() {
  group('Basic Endpoints', () => {
    // Test each endpoint
    testRootEndpoint();
    testScraperEndpoint();
    testEvilBotEndpoint();
    
    // Wait between requests
    sleep(0.5);
  });
}

// Test root endpoint
function testRootEndpoint() {
  const startTime = new Date();
  const res = http.get('http://localhost:3000/');
  const endTime = new Date();
  
  // Calculate duration
  const duration = endTime - startTime;
  rootTime.add(duration);
  
  // Check the response
  const success = check(res, { 
    'root status is 200': (r) => r.status === 200,
    'root response has content': (r) => r.body.length > 0
  });
  
  // Update metrics
  successRate.add(success);
  errorRate.add(!success);
  requestsCounter.add(1);
  
  // Log error
  if (!success) {
    console.error(`Root endpoint failed: ${res.status}, ${res.body}`);
  }
}

// Test scraper endpoint
function testScraperEndpoint() {
  const startTime = new Date();
  const res = http.get('http://localhost:3000/scraper');
  const endTime = new Date();
  
  // Calculate duration
  const duration = endTime - startTime;
  scrapeTime.add(duration);
  
  // Check the response
  const success = check(res, { 
    'scraper status is 200': (r) => r.status === 200,
    'scraper response has content': (r) => r.body.length > 0
  });
  
  // Update metrics
  successRate.add(success);
  errorRate.add(!success);
  requestsCounter.add(1);
  
  // Log error
  if (!success) {
    console.error(`Scraper endpoint failed: ${res.status}, ${res.body}`);
  }
}

// Test evil-bot endpoint
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
  
  // Calculate duration
  const duration = endTime - startTime;
  evilBotTime.add(duration);
  
  // Check the response
  const success = check(res, { 
    'evil-bot status is 200': (r) => r.status === 200,
    'evil-bot response has decision': (r) => r.body && JSON.parse(r.body).decision !== undefined
  });
  
  // Update metrics
  successRate.add(success);
  errorRate.add(!success);
  requestsCounter.add(1);
  
  // Log error
  if (!success) {
    console.error(`Evil-bot endpoint failed: ${res.status}, ${res.body}`);
  }
}
