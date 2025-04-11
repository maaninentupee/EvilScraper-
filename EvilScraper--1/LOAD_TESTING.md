# Windsurf Project Load Testing

This document describes load testing for the Windsurf project and provides instructions for using various load testing tools.

## Load Testing Tools

Several load testing tools are available in the project:

1. **Apache Benchmark (ab)** - Simple command-line tool for HTTP load testing
2. **k6** - Versatile JavaScript-based load testing tool
3. **Autocannon** - Node.js-based HTTP/HTTPS load testing tool

## 1. Apache Benchmark (ab)

Apache Benchmark is a simple tool that is usually pre-installed on most Unix/Linux systems.

### Usage

```bash
# Basic command: 1000 requests, 50 concurrent connections
ab -n 1000 -c 50 http://localhost:3000/scraper

# Test AI service
ab -n 100 -c 10 http://localhost:3000/ai/models

# Test evil-bot service with POST request
ab -n 100 -c 10 -p post_data.json -T application/json http://localhost:3000/evil-bot/decide
```

### Parameters

- `-n` - Total number of requests
- `-c` - Number of concurrent connections
- `-p` - File containing POST data
- `-T` - Content-Type header

### Ready-made Script

The project includes a ready-made script `load-test.sh` that performs load tests on multiple endpoints:

```bash
# Run with default settings
./load-test.sh

# Modify parameters
./load-test.sh -n 500 -c 20 -h localhost -p 3000
```

## 2. k6 Load Testing

k6 is a versatile JavaScript-based load testing tool that enables creating more complex test scenarios.

### Installation

```bash
# macOS
brew install k6

# Linux
sudo apt-get install k6

# Windows
choco install k6
```

### Usage

The project includes a ready-made k6 script `load-test.js`:

```bash
# Run the test
k6 run load-test.js

# Run the test only for Ollama provider
k6 run -e PROVIDER=ollama load-test.js

# Run the test only for LM Studio provider
k6 run -e PROVIDER=lmstudio load-test.js
```

### Script Features

- Tests different AI service providers (Ollama, LM Studio)
- Simulates load increase and decrease
- Measures response times and error rates
- Uses different prompts for variety

## 3. Autocannon

Autocannon is a Node.js-based HTTP/HTTPS load testing tool that is particularly useful for testing Node.js applications.

### Installation

```bash
# Installed in the project as a devDependency
npm install

# Or install globally
npm install -g autocannon
```

### Usage

The project includes a ready-made Autocannon script `autocannon-load-test.js`:

```bash
# Run the test with default settings
node autocannon-load-test.js

# Modify parameters
node autocannon-load-test.js --connections 100 --duration 30
```

### Parameters

- `--connections, -c` - Number of concurrent connections (default: 50)
- `--duration, -d` - Test duration in seconds (default: 10)
- `--pipelining, -p` - Number of pipelined requests (default: 1)
- `--timeout, -t` - Timeout in seconds (default: 20)

## 4. AI Services Load Testing

The project has a special endpoint for load testing AI services:

```
POST /ai/load-test/:provider
```

### Parameters

- `provider` - Name of the service provider to test (ollama, lmstudio, openai, anthropic, local)
- `prompt` - Prompt to use
- `model` - Model to use (default: "default")
- `iterations` - Number of iterations to perform (default: 1)

### Example

```bash
curl -X POST http://localhost:3000/ai/load-test/ollama \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Write a short story about artificial intelligence", "model":"llama2", "iterations":5}'
```

## Results Analysis

Load test results can be analyzed using the following metrics:

1. **Throughput** - Number of requests per second
2. **Latency** - Average, minimum, maximum, and p99 response time
3. **Error Rate** - Percentage of failed requests
4. **Concurrency** - System's ability to handle concurrent requests

The Autocannon script saves results in the `load-test-results` directory in JSON format for further processing.

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
