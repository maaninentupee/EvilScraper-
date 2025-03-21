import { Injectable } from '@nestjs/common';
import { AIGateway } from './AIGateway';

@Injectable()
export class BotService {
    constructor(private readonly aiGateway: AIGateway) {}

    public async decideNextAction(userInput: string): Promise<any> {
        const input = `Analyze the user's message and decide the next step: ${userInput}`;
        return this.aiGateway.processAIRequest("decision", input);
    }
}
