# AIService

AIService is the core service of Windsurf AI that provides an intelligent fallback mechanism between different AI service providers. It enables flexible model selection and error handling, prioritizing models in a specified order.

## Features

- **Intelligent fallback mechanism**: When one model or service provider fails, the system automatically switches to the next alternative.
- **Service provider prioritization**: Service providers are prioritized by default in the order: LM Studio, Ollama, Local, OpenAI, Anthropic.
- **Task-specific models**: Different task types (SEO, code generation, decision making) use the most suitable models for them.
- **Specialized API calls**: Easy-to-use API calls for different purposes.

## Usage

### SEO Analysis

```typescript
const result = await aiService.analyzeSEO({
  title: "Example title",
  description: "Example meta description",
  content: "Page content..."
});
```

### Code Generation

```typescript
const result = await aiService.generateCode({
  language: "typescript",
  description: "Function that checks if a given string is a palindrome",
  requirements: ["Works with special characters", "Case insensitive"]
});
```

### Decision Making

```typescript
const result = await aiService.makeDecision({
  situation: "Which technology to choose for the project?",
  options: ["React", "Angular", "Vue.js"]
});
```

## Internal Operation

1. **Prompt generation**: An appropriate prompt for the model is constructed from the user's input.
2. **Model selection**: An appropriate model is selected based on the taskType parameter and the providerPriority list.
3. **Execution with fallback strategy**: The request is attempted to be executed in order with different models until successful.
4. **Error handling**: If all models fail, a comprehensive error message is thrown.

## Model Order and Fallback Strategy

Default service provider priority order:

1. **LM Studio** (local server)
2. **Ollama** (local server)
3. **Local models** (local server)
4. **OpenAI** (cloud service)
5. **Anthropic** (cloud service)

This order can be modified as needed.

## Error Handling

- If a model fails, the system moves to the next model in order.
- If all models fail, an error message is thrown that includes the reasons for all failures.
- Errors are always logged using NestJS Logger.

## Integration with Other Services

AIService integrates:

- **ModelSelector**: Model selection and capability verification
- **AIGateway**: Actual model execution and communication
- **AIController**: Provides REST API for AIService functions

## Testing

AIService has comprehensive tests that ensure the functionality of the fallback mechanism and different scenarios.

Tests cover:
- Successful executions with primary models
- Fallback strategy with different model variations
- Error handling

## Performance Considerations

- Local service providers (LM Studio, Ollama, Local models) are prioritized to minimize latency.
- Cloud services (OpenAI, Anthropic) serve as fallback alternatives.
- To optimize performance, models are selected using the most efficient available model for each task type.

## Future Improvements

- More precise evaluation of model selection capabilities
- More comprehensive log analysis of performance
- More dynamic prioritization of service providers based on availability and performance
