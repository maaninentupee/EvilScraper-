import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Define metrics
const errorRate = new Rate('error_rate');
const aiProcessingTime = new Trend('ai_processing_time');
const successfulRequests = new Counter('successful_requests');
const failedRequests = new Counter('failed_requests');

// Define metrics for different models
const openaiTime = new Trend('openai_processing_time');
const anthropicTime = new Trend('anthropic_processing_time');
const ollamaTime = new Trend('ollama_processing_time');
const lmstudioTime = new Trend('lmstudio_processing_time');

// Define metrics for different prompts
const shortPromptTime = new Trend('short_prompt_time');
const longPromptTime = new Trend('long_prompt_time');

// Test settings
export const options = {
  stages: [
    { duration: '30s', target: 10 },  // Warm-up phase
    { duration: '1m', target: 30 },   // Medium load
    { duration: '30s', target: 0 }    // Cool-down phase
  ],
  thresholds: {
    'error_rate': ['rate<0.3'],            // Error rate below 30%
    'http_req_duration': ['p(95)<30000'],  // 95% of requests under 30s
    'ai_processing_time': ['avg<15000'],   // Average processing time under 15s
  },
};

// Define different prompts
const prompts = [
  {
    name: 'short',
    taskType: 'seo',
    input: 'Analyze this website: https://example.com'
  },
  {
    name: 'long',
    taskType: 'seo',
    input: 'Analyze this website comprehensively: https://example.com. I need a detailed analysis of all SEO aspects including meta tags, heading structure, content quality, keyword density, mobile responsiveness, page speed, internal linking structure, external links, image optimization, schema markup, URL structure, navigation, and social media integration. Please provide specific recommendations for each area and prioritize them based on potential impact. Also include a competitive analysis comparing this site to at least three major competitors in the same industry. Evaluate the website\'s content strategy and suggest improvements for content creation, updating frequency, and topic clusters. Analyze the site\'s backlink profile and suggest strategies for link building. Consider international SEO aspects if applicable. Finally, provide a roadmap for implementing all recommendations over the next 6 months with specific milestones.'
  }
];

// Define different AI models
const models = [
  { name: 'openai', forceProvider: 'openai' },
  { name: 'anthropic', forceProvider: 'anthropic' },
  { name: 'ollama', forceProvider: 'ollama' }
];

// Main test function
export default function() {
  // Select a random prompt
  const promptIndex = Math.floor(Math.random() * prompts.length);
  const prompt = prompts[promptIndex];
  
  // Select a random model
  const modelIndex = Math.floor(Math.random() * models.length);
  const model = models[modelIndex];
  
  const url = 'http://localhost:3001/ai/process';
  
  const payload = JSON.stringify({
    taskType: prompt.taskType,
    input: prompt.input,
    forceProvider: model.forceProvider
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
  
  // Add model-specific metric
  if (model.name === 'openai') {
    openaiTime.add(processingTime);
  } else if (model.name === 'anthropic') {
    anthropicTime.add(processingTime);
  } else if (model.name === 'ollama') {
    ollamaTime.add(processingTime);
  }
  
  // Add prompt-specific metric
  if (prompt.name === 'short') {
    shortPromptTime.add(processingTime);
  } else if (prompt.name === 'long') {
    longPromptTime.add(processingTime);
  }
  
  // Check response success
  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'response has result': (r) => {
      try {
        return r.json().hasOwnProperty('result');
      } catch (e) {
        return false;
      }
    },
  });
  
  // Update metrics
  errorRate.add(!success);
  
  if (success) {
    successfulRequests.add(1);
    
    // Log used model
    try {
      const responseData = response.json();
      if (responseData.provider) {
        console.log(`Provider: ${responseData.provider}, Time: ${processingTime}ms, Prompt: ${prompt.name}`);
      }
    } catch (e) {
      // Continue, even if JSON parsing fails
    }
  } else {
    failedRequests.add(1);
    console.log(`Error: ${response.status}, Body: ${response.body}, Provider: ${model.name}, Prompt: ${prompt.name}`);
  }
  
  // Add a small delay between requests
  sleep(Math.random() * 3 + 1); // 1-4 second delay
}
