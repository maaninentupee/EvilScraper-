# AI Service Load Tests

This directory contains load tests for testing the performance and reliability of the AI service with large request volumes.

## Requirements

- [k6](https://k6.io/) - Modern load testing tool
- Bash-compatible command shell for resource monitoring

## Test Installation

1. Install k6:
   ```
   brew install k6  # macOS
   ```

2. Make the monitoring script executable:
   ```
   chmod +x monitor-resources.sh
   ```

## Running the Tests

### Basic Load Test

This test simulates moderate load on the AI service:

```bash
k6 run load-test.js
```

### Heavy Load Test (500 concurrent requests)

This test simulates heavy load on the AI service:

```bash
k6 run heavy-load-test.js
```

### Resource Monitoring During the Test

Run resource monitoring in a separate terminal while running the load test:

```bash
./monitor-resources.sh node 180  # Monitor the 'node' process for 3 minutes
```

## Configuring the Tests

You can modify the test settings by editing the JavaScript files:

- `options.stages`: Defines the test stages and duration
- `options.thresholds`: Defines the acceptable threshold values
- Request parameters: URL, payload, headers, etc.

## Interpreting the Results

K6 displays the test results in the console, including:

- Number and speed of requests
- Error percentage
- Response time distributions (min, max, average, median, p90, p95)
- Custom metrics (AI processing time, success rate)

Resource monitoring produces a CSV file and a summary of CPU and memory usage.

## Customizing the Tests

You can customize the tests by modifying:

- Task types and inputs
- Load volume and distribution
- Success criteria
- Monitored metrics

## Troubleshooting

If the tests fail:

1. Ensure that the AI service is running at `http://localhost:3000`
2. Check that all required API keys are set
3. Check the service logs for errors
4. Adjust the test parameters if the service is overloaded
