# Windsurf Project - Test Automation Guide

This document provides a comprehensive overview of the test automation setup for the Windsurf Project.

## Overview

The Windsurf Project implements a multi-layered testing strategy to ensure application reliability:

1. **Unit Tests**: Verify individual components and functions
2. **Integration Tests**: Test interactions between components
3. **E2E Tests**: Validate complete application workflows
4. **Load Tests**: Measure performance under various load conditions
5. **Resource Monitoring**: Track system resource usage during tests

## Test Commands

### All-in-One Testing

Run all tests with a single command:

```bash
npm run test:all
```

This command:
1. Warms up Ollama models
2. Runs all unit tests
3. Runs all E2E tests
4. Executes load tests

### Individual Test Commands

| Command | Description |
|---------|-------------|
| `npm test` | Run all unit tests |
| `npm run test:e2e` | Run end-to-end tests |
| `npm run test:e2e:fast` | Run only basic E2E tests |
| `npm run test:e2e:all` | Run all E2E tests using a shell script |
| `npm run test:integration` | Run integration tests |
| `npm run test:load` | Run load tests using k6 |
| `npm run test:network-delay` | Test network delay handling |
| `npm run test:with-warmup` | Run unit tests with Ollama model warm-up |
| `npm run test:e2e:with-warmup` | Run E2E tests with Ollama model warm-up |

### Resource Monitoring Commands

| Command | Description |
|---------|-------------|
| `npm run analyze:ollama` | Analyze Ollama resource usage |
| `npm run analyze:ollama:extended` | Run extended Ollama resource analysis |
| `npm run monitor:ollama` | Monitor Ollama resource usage |
| `npm run monitor:ollama:short` | Monitor Ollama for 60 seconds |
| `npm run monitor:ollama:netdata` | Send Ollama metrics to Netdata |
| `npm run warmup:ollama` | Pre-warm Ollama models |

## Test Coverage

### Provider Tests

The test suite includes comprehensive coverage for AI model providers:

- **OllamaProvider**: 100% line coverage
- **LMStudioProvider**: 100% line coverage
- **OpenAIProvider**: High coverage for API interactions
- **AnthropicProvider**: Complete API validation
- **LocalProvider**: 34.28% line coverage (limited by child_process mocking complexity)

Overall provider coverage: 73.17% statements, 56.12% branches, 74.07% functions, 70.94% lines.

### Load Testing Tools

The project uses multiple load testing tools:

- **Apache Benchmark (ab)**: Command-line HTTP load testing
- **k6**: JavaScript-based comprehensive load testing
- **Autocannon**: Node.js-based HTTP/HTTPS load testing

## Test Configuration

### Jest Configuration

Unit and integration tests use Jest with TypeScript support. Configuration is in:
- `jest.config.js` - Main configuration
- `test/jest-e2e.json` - E2E test configuration

### Load Test Configuration

Load tests are configured in:
- `load-test.js` - k6 test script
- `load-test.sh` - Apache Benchmark script
- `autocannon-load-test.js` - Autocannon test script

## Resource Monitoring

During tests, you can monitor system resources:

1. **Standard Monitoring**:
   ```bash
   npm run monitor:ollama
   ```

2. **Netdata Integration**:
   ```bash
   npm run monitor:ollama:netdata
   ```
   
   Then view metrics at: http://localhost:19999

## Best Practices

1. **Always warm up models before testing**:
   ```bash
   npm run warmup:ollama
   ```

2. **Monitor resources during load tests**:
   ```bash
   # In terminal 1
   npm run monitor:ollama:netdata
   
   # In terminal 2
   npm run test:load
   ```

3. **Check test coverage regularly**:
   ```bash
   npx jest --coverage
   ```

## Continuous Integration

The test automation is designed to work in CI/CD pipelines:

1. Run unit tests
2. Run E2E tests if unit tests pass
3. Run load tests if E2E tests pass
4. Generate and store test reports

## Troubleshooting

### Common Issues

1. **Ollama model not available**:
   - Ensure Ollama is running: `curl http://localhost:11434/api/tags`
   - Warm up models: `npm run warmup:ollama`

2. **Load tests failing**:
   - Check server is running: `curl http://localhost:3000/health`
   - Verify network connectivity

3. **Resource monitoring issues**:
   - For Netdata: Check service is running with `brew services list | grep netdata`
   - For standard monitoring: Ensure proper permissions

## Future Improvements

1. Implement GPU resource tracking
2. Add machine learning-based optimization suggestions
3. Enhance cross-platform support
4. Add more granular resource allocation controls

## References

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [k6 Documentation](https://k6.io/docs/)
- [Netdata Documentation](https://learn.netdata.cloud/)
- [Ollama Documentation](https://ollama.ai/)
