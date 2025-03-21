# Ollama Resource Analysis

## Summary

This document analyzes the resource usage of the Ollama service in the Windsurf project. The analysis is based on the results produced by the `analyze-ollama-resources.sh` script, collected on March 3, 2025.

## Models in Use

The following models are in use in the Ollama service:

| Model | Size | Number of Parameters | Quantization Level |
|-------|------|----------------------|-------------------|
| llama2:13b | 7.0 GB | 13B | Q4_0 |
| codellama:7b-code | 3.6 GB | 7B | Q4_0 |
| mistral:latest | 3.9 GB | 7.2B | Q4_0 |

## CPU Usage Analysis

### Baseline (Before Load)

- Ollama serve process: ~22.4% CPU
- Ollama runner process: ~1.2% CPU
- System total load: 2.06, 3.42, 3.66 (1, 5, 15 min)
- CPU usage: 39.44% user, 25.92% system, 34.62% idle

### During Load

- CPU usage varied between 15-45% for user processes
- System processes CPU usage varied between 8-15%
- System total load remained fairly stable (~2.0-2.1 on one-minute average)

### After Load

- CPU usage returned to normal levels
- Ollama processes CPU usage dropped to near zero
- System total load decreased slightly: 1.94, 3.25, 3.59 (1, 5, 15 min)

## Memory Usage Analysis

### Baseline

- Ollama serve process: ~26 MB (0.2% of memory)
- Ollama runner process: ~578 MB (3.4% of memory)
- Total memory usage: 15 GB (10 GB wired, 3.1 GB compressor)
- Swap usage: 3.1 GB / 4.0 GB

### During Load

- Ollama runner process memory usage remained fairly stable (~562 MB)
- Ollama serve process memory usage decreased slightly (~24 MB)
- Total memory usage remained stable

### After Load

- Ollama processes memory usage remained almost the same as during load
- Total memory usage: 15 GB (1.4 GB wired, 2.7 GB compressor)
- Swap usage remained the same: 3.1 GB / 4.0 GB

## Observations and Conclusions

1. **CPU Usage**: 
   - Ollama service uses significant CPU resources especially during startup
   - During load, CPU usage increases but remains at a reasonable level
   - The system returns quickly to normal state after load

2. **Memory Usage**:
   - Ollama runner process uses significant memory (~560-580 MB)
   - Memory usage remains fairly stable during load
   - Swap memory is used considerably (3.1 GB), which may affect performance

3. **Models**:
   - The largest model (llama2:13b) takes up the most disk space (7.0 GB)
   - All models use Q4_0 quantization, which is a good compromise between accuracy and resource usage

## Recommendations

1. **CPU Optimization**:
   - Consider optimizing the thread count of the Ollama process (`--threads` parameter)
   - Test different batch size values (`--batch-size` parameter) to find optimal performance
   - Monitor CPU usage in long-term load situations

2. **Memory Optimization**:
   - Consider using smaller models if the 13B model is not essential
   - Ensure that the system has enough physical memory to reduce swap usage
   - Test different context size values (`--ctx-size` parameter) to optimize memory usage

3. **Load Testing**:
   - Perform longer load tests (10+ concurrent requests)
   - Test different models and compare their resource usage
   - Monitor temperatures in long-term load situations

4. **Scalability**:
   - Consider running the Ollama service on a separate server in heavy use
   - Test using parallel Ollama instances to distribute the load
   - Implement automatic scaling according to load

## Next Steps

1. Update the `analyze-ollama-resources.sh` script to collect data over a longer period
2. Implement comparative tests between different models
3. Test different configuration parameters and their impact on performance
