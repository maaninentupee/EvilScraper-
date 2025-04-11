import { Injectable } from '@nestjs/common';
import { AIGateway } from './AIGateway';

@Injectable()
export class ScrapingService {
    constructor(private readonly aiGateway: AIGateway) {}

    public async analyzeSEO(scrapedData: any): Promise<any> {
        const input = `Analyze SEO quality for the following data: ${JSON.stringify(scrapedData)}`;
        return this.aiGateway.processAIRequest("seo", input);
    }
}
