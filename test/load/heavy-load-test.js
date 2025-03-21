import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Define metrics
const errorRate = new Rate('error_rate');
const aiProcessingTime = new Trend('ai_processing_time');
const successfulRequests = new Counter('successful_requests');
const failedRequests = new Counter('failed_requests');

// Test settings - 1000+ requests (massive load)
export const options = {
  stages: [
    { duration: '1m', target: 100 },  // 100 users in one minute
    { duration: '3m', target: 500 },  // 500 users over three minutes
    { duration: '2m', target: 0 }     // Scale down
  ],
  thresholds: {
    'error_rate': ['rate<0.3'],            // Error rate below 30%
    'http_req_duration': ['p(95)<15000'],  // 95% of requests under 15s
    'ai_processing_time': ['avg<8000'],    // Average processing time under 8s
  },
};

// Main test function
export default function() {
  const url = 'http://localhost:3001/ai/process';
  
  // Vary task types and inputs to diversify the load
  const taskTypes = ['seo', 'code', 'decision'];
  const inputs = [
    'Analyze this website: https://example.com',
    'Generate a simple React component for a login form',
    'Should I use MongoDB or PostgreSQL for a high-traffic e-commerce site?',
    'Explain the benefits of microservices architecture',
    'What are the best SEO practices for a blog in 2025?'
  ];
  
  // Select a random task type and input
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
    timeout: '60s', // Longer timeout for heavy load
  };
  
  const startTime = new Date().getTime();
  const response = http.post(url, payload, params);
  const endTime = new Date().getTime();
  
  // Calculate processing time in milliseconds
  const processingTime = endTime - startTime;
  aiProcessingTime.add(processingTime);
  
  // Check response success
  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'response has result': (r) => r.json().hasOwnProperty('result'),
  });
  
  // Update metrics
  errorRate.add(!success);
  
  if (success) {
    successfulRequests.add(1);
  } else {
    failedRequests.add(1);
    console.log(`Error: ${response.status}, Body: ${response.body}`);
  }
  
  // Add a small pause between requests
  sleep(Math.random() * 2);
}
