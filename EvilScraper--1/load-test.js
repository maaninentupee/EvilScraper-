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
  const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];
  const randomModel = models[Math.floor(Math.random() * models.length)];
  
  const payload = JSON.stringify({
    taskType: "seo",
    input: randomPrompt,
    maxTokens: 25,
    timeout: 25000,
    model: randomModel,
    isLoadTest: true
  });
  
  const params = {
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
  const res = http.post('http://localhost:3001/ai/process', payload, params);
  
  // Simplified checks without try-catch
  const checks = check(res, {
    'status was 201 or 200': (r) => r.status === 201 || r.status === 200,
    'response time < 30s': (r) => r.timings.duration < 30000,
    'has valid JSON response': (r) => {
      const data = r.json();
      return data && (data.result || data.error);
    }
  });

  // Simplified logging without try-catch
  if (checks) {
    const data = res.json();
    console.log(
      `OK [${res.timings.duration}ms]` +
      `${data.model ? ` Model: ${data.model},` : ''}` +
      `${data.provider ? ` Provider: ${data.provider},` : ''}` +
      ` Fallback: ${data.wasFailover || false},` +
      ` Length: ${data.result ? data.result.length : 0}`
    );
  } else {
    console.error(
      `ERROR [${res.status}] Body: ${res.body || 'no content'}`
    );
  }
  
  // Optimized delay between requests - varies according to load
  const currentVUs = __VU || 1;
  const baseDelay = Math.max(0.5, 3 - (currentVUs * 0.3));
  sleep(baseDelay + Math.random() * 2);
}
