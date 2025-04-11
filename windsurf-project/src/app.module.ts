import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ModelSelector } from './services/ModelSelector';
import { AIGateway } from './services/AIGateway';
import { AIService } from './services/AIService';
import { ScrapingService } from './services/ScrapingService';
import { EvilBotService } from './services/EvilBotService';
import { BotService } from './services/BotService';
import { AIController } from './controllers/ai.controller';
import { ScrapingController } from './controllers/scraping.controller';
import { EvilBotController } from './controllers/evil-bot.controller';
import { BotController } from './controllers/bot.controller';
import { ProvidersModule } from './services/providers/providers.module';
import { AIGatewayEnhancer } from './services/AIGatewayEnhancer';
import { AIControllerEnhanced } from './controllers/AIControllerEnhanced';
import { ProviderHealthMonitor } from './services/ProviderHealthMonitor';
import { ProviderCapabilityDetector } from './services/utils/ProviderCapabilityDetector';
import { ProviderSelectionStrategy } from './services/utils/ProviderSelectionStrategy';
import { ErrorClassifier } from './services/utils/ErrorClassifier';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ProvidersModule,
  ],
  controllers: [
    AIController,
    ScrapingController,
    EvilBotController,
    BotController,
    AIControllerEnhanced
  ],
  providers: [
    ModelSelector,
    AIGateway,
    AIService,
    ScrapingService,
    EvilBotService,
    BotService,
    AIGatewayEnhancer,
    ProviderHealthMonitor,
    ProviderCapabilityDetector,
    ProviderSelectionStrategy,
    ErrorClassifier
  ],
})
export class AppModule {}
