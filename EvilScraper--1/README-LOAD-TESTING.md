# Windsurf Project Load Testing

## Overview

This document provides a summary of load testing for the Windsurf project. The purpose of load testing is to simulate how well the system can handle a large number of requests and identify potential bottlenecks.

## Load Testing Tools

Several load testing tools are used in the project:

1. **Apache Benchmark (ab)** - A simple command-line tool for HTTP load testing
2. **k6** - A versatile JavaScript-based load testing tool
3. **Autocannon** - A Node.js-based HTTP/HTTPS load testing tool

## Endpoints to Test

Load testing focuses on the following endpoints:

1. **/** - Response time of the basic endpoint
2. **/scraper** - Performance of the web page parsing endpoint
3. **/evil-bot/decide** - Performance of the AI decision-making process
4. **/ai/load-test/:provider** - Load testing of AI services

## Running Load Tests

### Starting the Server for Testing

```bash
# Start the server for testing
./start-server-for-testing.sh
```

### Apache Benchmark (ab)

```bash
# Basic command: 1000 requests, 50 concurrent connections
ab -n 1000 -c 50 http://localhost:3000/scraper

# Test the evil-bot service with a POST request
ab -n 100 -c 10 -p post_data.json -T application/json http://localhost:3000/evil-bot/decide
```

### k6

```bash
# Run the test
k6 run load-test.js

# Run the test only for the Ollama provider
k6 run -e PROVIDER=ollama load-test.js
```

### Autocannon

```bash
# Run the test with default settings
node autocannon-load-test.js

# Modify parameters
node autocannon-load-test.js --connections 100 --duration 30
```

## Analyzing Results

Load test results are saved in the `load-test-results` directory. You can visualize the results by running:

```bash
node visualize-load-test-results.js
```

This creates a `load-test-report.html` file that contains a visual report of the load test results.

## Unit and Integration Tests

The project also has unit and integration tests for load testing endpoints:

```bash
# Run unit tests
npm test -- test/unit/controllers/ai-controller-load-test.spec.ts

# Run integration tests
npm test -- test/integration/load-test-integration.spec.ts
```

## Load Testing Parameters

### Apache Benchmark (ab)

- `-n` - Total number of requests
- `-c` - Number of concurrent connections
- `-p` - File containing POST data
- `-T` - Content-Type header

### k6

- `vus` - Number of virtual users
- `duration` - Test duration
- `stages` - Load phases (ramp-up, steady, ramp-down)

### Autocannon

- `--connections, -c` - Number of concurrent connections
- `--duration, -d` - Test duration in seconds
- `--pipelining, -p` - Number of pipelined requests
- `--timeout, -t` - Timeout in seconds

## Tips for Load Testing

1. **Start with a small load** and increase it gradually
2. **Test different endpoints** separately and together
3. **Monitor system resources** (CPU, memory, network) during testing
4. **Test regularly** as part of the CI/CD pipeline
5. **Compare results** with previous tests as development progresses

## Known Limitations

- AI models can be slow, so set a sufficiently long timeout
- Local AI services (Ollama, LM Studio) may be limited by hardware performance
- OpenAI and Anthropic services have API limitations that can affect load tests

## Additional Information

See more detailed instructions in [LOAD_TESTING.md](./LOAD_TESTING.md).
