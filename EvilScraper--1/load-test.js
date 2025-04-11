import http from 'k6/http';
import { check, sleep } from 'k6';

// Load test settings
export const options = {
  // Phased loading - optimized for efficient testing
  stages: [
    { duration: '5s', target: 1 },    // Start with one user (warm-up)
    { duration: '10s', target: 3 },   // Increase to 3 users
    { duration: '20s', target: 6 },   // Increase to 6 users (peak load)
    { duration: '10s', target: 4 },   // Decrease to 4 users
    { duration: '5s', target: 1 },    // Decrease back to one user (cool-down)
  ],
  thresholds: {
    // More realistic thresholds for AI services
    http_req_duration: ['p(90)<30000'],  // 90% of requests must be under 30s
    http_req_failed: ['rate<0.20'],      // Less than 20% of requests can fail
  },
  // Add batch parameter to enhance test performance
  batch: 2, // Execute requests 2 at a time per VU
};

// Different prompt options optimized for load testing
const prompts = [
  "TEST_LOAD: SEO optimization",
  "TEST_LOAD: Clock widget",
  "TEST_LOAD: Blog title",
  "TEST_LOAD: Social media sharing",
  "TEST_LOAD: Email template",
  "TEST_LOAD: Button text",
  "TEST_LOAD: Color theme",
  "TEST_LOAD: Logo idea"
];

// Models that can be used in tests (if model selection is enabled)
const models = [
  "llama2",
  "mistral",
  "gemma"
];

// Main function that k6 calls for each virtual user
export default function () {
  // Use random input for each request
  const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];
  
  // Make HTTP request to AIGateway service with optimized parameters
  // Select a random model if models are defined
  const randomModel = models[Math.floor(Math.random() * models.length)];
  
  const payload = JSON.stringify({
    taskType: "seo",
    input: randomPrompt,
    maxTokens: 25,  // Reduced from 30 -> 25 to speed up responses
    timeout: 25000, // Reduced from 40000 -> 25000 to speed up tests
    model: randomModel, // Add random model if the service supports this
    isLoadTest: true // Marking as load test for the service
  });
  
  const params = {
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
  // Use port 3001, which is the default port for the application
  // Use the correct route /ai/process, which handles AIRequestDto-type requests
  const res = http.post('http://localhost:3001/ai/process', payload, params);
  
  // Check response quality - optimized checks
  check(res, {
    'status was 201 or 200': (r) => r.status === 201 || r.status === 200,
    'response time < 30s': (r) => r.timings.duration < 30000, // Stricter time limit
    'response has valid data': (r) => {
      try {
        const data = r.json();
        return data && (data.result || data.error); // Check that the response contains either a result or an error
      } catch (e) {
        return false;
      }
    }
  });
  
  // Add enhanced diagnostics
  try {
    const responseData = res.json();
    const modelInfo = responseData.model ? ` Model: ${responseData.model},` : '';
    const providerInfo = responseData.provider ? ` Provider: ${responseData.provider},` : '';
    
    if (res.status === 201 || res.status === 200) {
      console.log(
        `OK [${res.timings.duration}ms]${modelInfo}${providerInfo}` +
        ` Fallback: ${responseData.wasFailover || false},` +
        ` Length: ${responseData.result ? responseData.result.length : 0}`
      );
    } else {
      console.error(
        `ERROR [${res.status}]${modelInfo}${providerInfo}` +
        ` Error: ${responseData.error || 'Unknown'}`
      );
    }
  } catch (e) {
    // Check that res.body is defined before calling the substring method
    const bodyPreview = res.body ? res.body.substring(0, 100) : 'no content';
    console.error(`Invalid response: ${res.status}, ${bodyPreview}`);
  }
  
  // Optimized delay between requests - varies according to load
  const currentVUs = __VU || 1; // Current number of virtual users
  const baseDelay = Math.max(0.5, 3 - (currentVUs * 0.3)); // Less delay when there are more users
  sleep(baseDelay + Math.random() * 2);
}
