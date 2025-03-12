import { Injectable } from '@nestjs/common';
import { AIGateway } from './AIGateway';

@Injectable()
export class ScrapingService {
    constructor(private readonly aiGateway: AIGateway) {}

    public async analyzeSEO(scrapedData: any): Promise<any> {
        const input = `Analysoi SEO-laatu seuraaville tiedoille: ${JSON.stringify(scrapedData)}`;
        return this.aiGateway.processAIRequest("seo", input);
    }
}
