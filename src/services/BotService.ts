import { Injectable } from '@nestjs/common';
import { AIGateway } from './AIGateway';

@Injectable()
export class BotService {
    constructor(private readonly aiGateway: AIGateway) {}

    public async decideNextAction(userInput: string): Promise<any> {
        const input = `Analysoi käyttäjän viesti ja päätä seuraava askel: ${userInput}`;
        return this.aiGateway.processAIRequest("decision", input);
    }
}
