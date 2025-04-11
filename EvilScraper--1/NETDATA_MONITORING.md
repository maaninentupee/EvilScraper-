# Netdata Monitoring for Ollama Models

This documentation describes how to use the Netdata tool to monitor resource usage of Ollama models.

## Overview

Netdata is a powerful real-time monitoring tool that provides detailed information about system performance. We have integrated Ollama model resource usage tracking with the Netdata tool, enabling precise analysis of model performance.

## Installation

### Netdata Installation

Install Netdata using Homebrew:

```bash
brew install netdata
brew services start netdata
```

The Netdata interface is available at: [http://localhost:19999](http://localhost:19999)

## Ollama Monitoring

We have created a script that collects resource usage data from Ollama models and sends it to the Netdata service using the StatsD protocol.

### Starting Monitoring

Start Ollama monitoring by running:

```bash
npm run monitor:ollama:netdata
```

or directly:

```bash
./scripts/ollama-netdata-collector.sh
```

### Metrics Collected

The script collects the following metrics:

#### Ollama Service (Main Process)
- `ollama.main.cpu` - CPU usage in percentage
- `ollama.main.memory_percent` - Memory usage in percentage
- `ollama.main.memory_mb` - Memory usage in megabytes

#### Ollama Models (Runner Processes)
- `ollama.runners.count` - Number of active models
- `ollama.runners.cpu` - Total CPU usage of all models
- `ollama.runners.memory_percent` - Total memory usage of all models in percentage
- `ollama.runners.memory_mb` - Total memory usage of all models in megabytes

#### Model-Specific Metrics
- `ollama.model.<model_name>.cpu` - CPU usage of a specific model
- `ollama.model.<model_name>.memory_percent` - Memory usage of a specific model in percentage
- `ollama.model.<model_name>.memory_mb` - Memory usage of a specific model in megabytes

#### Total Usage
- `ollama.total.cpu` - Total CPU usage
- `ollama.total.memory_percent` - Total memory usage in percentage
- `ollama.total.memory_mb` - Total memory usage in megabytes

#### API Information
- `ollama.api.models_count` - Number of available models

## Usage Examples

### Monitoring Resource Usage During Load Tests

1. Start the Netdata service:
   ```bash
   brew services start netdata
   ```

2. Start Ollama monitoring:
   ```bash
   npm run monitor:ollama:netdata
   ```

3. Open the Netdata interface in your browser:
   [http://localhost:19999](http://localhost:19999)

4. Run load tests:
   ```bash
   npm run test:load
   ```

5. Monitor resource usage in the Netdata interface.

### Comparing Different Models

1. Start monitoring as above.
2. Warm up the models:
   ```bash
   npm run warmup:ollama
   ```
3. Compare resource usage of different models in the Netdata interface.

## Dashboards

In the Netdata interface, you can create custom dashboards that display the most important metrics for you. For example, you can create a dashboard that shows:

- CPU usage by model
- Memory usage by model
- Total usage over time

## Alerts

Netdata supports defining alerts. You can set up alerts that notify you when:

- CPU usage exceeds a certain threshold
- Memory usage exceeds a certain threshold
- The number of models changes

## Troubleshooting

If you encounter problems:

1. Make sure the Netdata service is running:
   ```bash
   brew services list | grep netdata
   ```

2. Make sure the Ollama service is running:
   ```bash
   curl -s http://localhost:11434/api/tags
   ```

3. Check that the StatsD port (8125) is available:
   ```bash
   lsof -i :8125
   ```

## Additional Information

- [Netdata Documentation](https://learn.netdata.cloud/)
- [StatsD Documentation](https://github.com/statsd/statsd)
- [Ollama Documentation](https://ollama.ai/)
