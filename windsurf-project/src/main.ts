import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { environment } from './config/environment';

async function bootstrap() {
  const logger = new Logger('Main');
  const app = await NestFactory.create(AppModule);
  
  logger.log(`Application environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Initialize
  await app.listen(3001);
  
  logger.log(`Application started on port 3001`);
  
  // Log environment configuration (without sensitive data)
  logger.log(`Using local models: ${environment.useLocalModels}`);
  logger.log(`Default model type: ${environment.defaultModelType}`);
  logger.log(`Fallback threshold: ${environment.fallbackThreshold}`);
  
  // Log API keys status (not the actual keys)
  logger.log(`OpenAI API key configured: ${!!environment.openaiApiKey}`);
  logger.log(`Anthropic API key configured: ${!!environment.anthropicApiKey}`);
}

bootstrap().catch(err => {
  Logger.error(`Failed to start application: ${err.message}`, err.stack, 'Bootstrap');
  process.exit(1);
});
