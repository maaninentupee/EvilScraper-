# Load Testing of AI Service Providers

This document contains instructions for load testing of AI service providers (Ollama, LM Studio) in the Windsurf project.

## Purpose of Load Testing

The purpose of load testing is to:
1. Ensure that AI service providers can handle multiple concurrent requests
2. Investigate the optimal number of concurrent requests for each service provider
3. Identify and fix potential performance bottlenecks
4. Test the functionality of error handling logic in load situations

## Implemented Improvements

We have implemented the following improvements to enable load testing:

### 1. OllamaProvider and LMStudioProvider

The following improvements have been made to both providers:
- Added request queuing mechanism
- Limited the maximum number of concurrent requests (20)
- Improved error handling
- Created a dedicated axios instance with better settings (timeout 30s)

### 2. ProviderRegistry

Created a new ProviderRegistry class that:
- Provides access to all registered service providers
- Enables searching for service providers by name
- Offers a method to check available service providers

### 3. Load Testing Endpoint

Created a new REST API endpoint for load testing:
- URL: `POST /ai/load-test/:provider`
- Parameters:
  - `provider`: service provider name (ollama, lmstudio)
  - Request body:
    ```json
    {
      "prompt": "Write an example about AI",
      "model": "llama2",
      "iterations": 10
    }
    ```
- Returns detailed information about load test results

### 4. k6 Test Script

The updated k6 test script includes:
- Ollama and LM Studio test scenarios with different phases
- Thresholds for measuring performance
- Diverse test prompts
- Support for both using the load-test API and calling service providers' APIs directly

## Conducting Load Testing

### Prerequisites

1. Install the [k6](https://k6.io/docs/getting-started/installation/) load testing tool
2. Make sure the Windsurf server is running (`npm run start`)
3. Make sure Ollama and/or LM Studio is running

### Running Tests

1. Run testing with k6:

```bash
# Run all test scenarios
k6 run load-test.js

# Run only Ollama scenarios
k6 run -e PROVIDER=ollama --tag testType=ollama -o scenario=ollama_load load-test.js

# Run only LM Studio scenarios
k6 run -e PROVIDER=lmstudio --tag testType=lmstudio -o scenario=lmstudio_load load-test.js
```

2. Alternatively, you can use direct API testing:

```bash
# Test Ollama API directly
k6 run -e PROVIDER=ollama --tag testType=direct_api load-test.js -f directAPITest

# Test LM Studio API directly
k6 run -e PROVIDER=lmstudio --tag testType=direct_api load-test.js -f directAPITest
```

## Interpreting Results

K6 provides detailed performance reports, such as:
- Number of requests per second
- Response time distributions (p90, p95, p99)
- Error rates
- HTTP status code distributions

In addition, the load-test API endpoint provides detailed information about individual requests:
- Success rate
- Average duration
- Error messages
- Number of tokens in responses

## Future Development

Future development possibilities:
1. Visualization tools for examining results (e.g., Grafana)
2. Automatic scalability testing with different server configurations
3. Generation of comparison reports between different service providers
4. Monitoring memory usage and CPU load during tests
