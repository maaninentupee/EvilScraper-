import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Define metrics
const errorRate = new Rate('error_rate');
const aiProcessingTime = new Trend('ai_processing_time');

// Test settings - 500 concurrent requests
export const options = {
  scenarios: {
    baselevel: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 50 },  // Quickly ramp up to 50 users
        { duration: '40s', target: 50 },  // Maintain 50 users for 40 seconds
        { duration: '10s', target: 0 }    // Ramp down to 0 users
      ],
    },
  },
  thresholds: {
    'error_rate': ['rate<0.1'],       // Error rate below 10%
    'http_req_duration': ['p(95)<5000'], // 95% of requests under 5s
    'ai_processing_time': ['avg<3000'],  // Average processing time under 3s
  },
};

// Main test function
export default function() {
  const url = 'http://localhost:3001/ai/seo';
  const payload = JSON.stringify({
    title: 'Example Website',
    description: 'This is an example website for testing purposes',
    content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam euismod, nisl eget aliquam ultricies, nunc nisl aliquet nunc, quis aliquam nisl nunc eu nisl.',
  });
  
  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };
  
  const startTime = new Date().getTime();
  const response = http.post(url, payload, params);
  const endTime = new Date().getTime();
  
  // Calculate processing time in milliseconds
  const processingTime = endTime - startTime;
  aiProcessingTime.add(processingTime);
  
  // Check response success
  let success = check(response, {
    'status is 200': (r) => r.status === 200,
  });
  
  // Check response content only if status is 200
  if (success && response.body) {
    try {
      const jsonData = response.json();
      success = success && check(response, {
        'response has result': (r) => jsonData && jsonData.hasOwnProperty('result'),
      });
    } catch (e) {
      console.error(`JSON processing error: ${e.message}`);
      success = false;
    }
  } else if (response.status !== 200) {
    console.warn(`Invalid response: Status ${response.status}`);
  } else if (!response.body) {
    console.warn('Response body is empty');
  }
  
  // Update error rate
  errorRate.add(!success);
  
  // Add a small pause between requests
  sleep(1);
}
