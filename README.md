# Windsurf Project - AI Fallback System

This project implements an intelligent fallback system that primarily utilizes local AI models, but when necessary, switches to using OpenAI's or Anthropic's API models.

## Features

- **ModelSelector**: Selects an appropriate model based on the use case
- **AIGateway**: Manages the use of local and cloud service models
- **AIGatewayEnhancer**: Enhanced version of the AIGateway class that provides an intelligent fallback mechanism and caching
- **AIControllerEnhanced**: New controller that utilizes the AIGatewayEnhancer class offering more versatile processing capabilities
- **ProviderHealthMonitor**: Monitors the performance and availability of service providers
- **Fallback mechanism**: Automatically switches to OpenAI and if necessary to Anthropic
- **ScrapingService**: SEO analysis of web pages using AI
- **EvilBotService**: AI-based decision-making system
- **BotService**: Analysis of user messages and deciding the next action
- **RESTful API**: NestJS-based interface for AI functionalities
- **Internationalization**: All code comments and messages are in English for better accessibility

## Installation

1. Clone the repo:
```
git clone https://github.com/maaninentupee/EvilScraper-.git
cd windsurf-project
```

2. Install dependencies:
```
npm install
```

3. Copy environment variables:
```
cp .env.example .env
```

4. Edit the .env file by adding API keys:
```
OPENAI_API_KEY=your-api-key
ANTHROPIC_API_KEY=your-api-key
```

5. Start the application:
```
npm run start
```

## Testing

The project includes comprehensive tests that ensure the functionality of the fallback mechanism in different situations:

```
# Run unit tests
npm run test

# Run e2e tests
npm run test:e2e

# Run fallback tests
node test/fallback-test.js

# Run enhanced fallback tests
node test/enhanced-fallback-test.js

# Run controller tests
node test/enhanced-controller-test.js
```

## Load Testing

The project includes tools for load testing that help evaluate the system's performance under heavy use:

```
# Run basic load test
node test/load/load-test.js

# Run heavy load test
node test/load/heavy-load-test.js

# Run model comparison test
node test/load/model-comparison-test.js
```

## Resource Monitoring

The project includes a tool for analyzing Ollama resource usage. This helps optimize the performance of Ollama models and identify potential bottlenecks:

```bash
# Run Ollama resource analysis
./scripts/analyze-ollama-resources.sh
```

## Latest Improvements

1. Fallback mechanism improvements:
   - Completing the ErrorClassifier class with Injectable decorator
   - Fixing the isRetryable method in AIGateway and AIGatewayEnhancer classes
   - More comprehensive error handling

2. Cache optimization:
   - Batch processing average response time only 0.68ms

3. Health monitoring:
   - ProviderHealthMonitor tracks service provider performance

## Future Development Areas

1. Rate limiting mechanisms (high priority)
2. Llama binary installation (medium priority)
3. Response time optimization (medium priority)
4. Error reporting expansion (low priority)

## License

MIT
