import { Injectable, Logger } from '@nestjs/common';
import { AIGateway, AIResponse } from './AIGateway';

export interface Decision {
    action: string;
    reason: string;
    confidence: number;
}

@Injectable()
export class EvilBotService {
    private readonly logger = new Logger(EvilBotService.name);
    
    constructor(private readonly aiGateway: AIGateway) {}
    
    private createErrorDecision(reason: string): Decision {
        return {
            action: "Error",
            reason,
            confidence: 0
        };
    }

    private buildDecisionPrompt(situation: string, options: string[]): string {
        return `
        Situation: ${situation}
        
        Options:
        ${options.map((option, index) => `${index + 1}. ${option}`).join('\n')}
        
        Choose the best option and justify your decision. Answer in JSON format:
        {
            "action": "chosen action",
            "reason": "justification for the choice",
            "confidence": estimate of certainty (between 0-1)
        }`;
    }

    private parseJsonResponse(jsonString: string): Decision | null {
        try {
            return JSON.parse(/\{[\s\S]*\}/.exec(jsonString.replace(/```json|```/g, '').trim())?.[0] ?? 'null');
        } catch {
            return null;
        }
    }

    private validateAndNormalizeDecision(decision: Partial<Decision>): Decision {
        return {
            action: decision?.action ?? "No action",
            reason: decision?.reason ?? "No justification",
            confidence: typeof decision?.confidence === 'number'
                ? Math.max(0, Math.min(1, decision.confidence))
                : 0.5
        };
    }
    
    private validateDecisionInputs(situation: string, options: string[]): string | null {
        if (!situation || typeof situation !== 'string') {
            return 'Invalid input: situation is undefined or of wrong type';
        }
        if (!options?.length || !Array.isArray(options)) {
            return 'Invalid input: options are missing or not a valid list';
        }
        return null;
    }
    
    private async getDecisionFromAI(prompt: string): Promise<Decision> {
        const result = await this.aiGateway.processAIRequest("decision", prompt);
        if (!result?.success || !result?.message) {
            throw new Error(result?.error ?? 'AI response failed');
        }
        const parsedDecision = this.parseJsonResponse(result.message);
        if (!parsedDecision) {
            throw new Error('AI model did not produce a valid JSON response');
        }
        return parsedDecision;
    }
    
    public async makeDecision(situation: string, options: string[]): Promise<Decision> {
        const inputError = this.validateDecisionInputs(situation, options);
        if (inputError) {
            return this.createErrorDecision(inputError);
        }
        try {
            const prompt = this.buildDecisionPrompt(situation, options);
            const decision = await this.getDecisionFromAI(prompt);
            return this.validateAndNormalizeDecision(decision);
        } catch (error) {
            this.logger.error(`Decision-making failed: ${error?.message ?? 'Unknown error'}`);
            return this.createErrorDecision(`Decision-making failed: ${error?.message ?? 'Unknown error'}`);
        }
    }
    
    public async processRequest(taskType: string, input: string): Promise<AIResponse> {
        try {
            const result = await this.aiGateway.processAIRequest(taskType, input);
            
            if (!result?.success) {
                this.logger.error(`Error in EvilBot request processing: ${result?.error ?? 'Unknown error'}`);
                return result;
            }
            
            return result?.message
                ? { ...result, message: this.makeMessageEvil(result.message) }
                : result;
            
        } catch (error) {
            const errorMessage = `Error in EvilBot request processing: ${error?.message ?? 'Unknown error'}`;
            this.logger.error(errorMessage);
            
            return {
                success: false,
                error: errorMessage,
                provider: 'evilbot',
                model: 'evilbot'
            };
        }
    }
    
    private makeMessageEvil(message: string): string {
        // Add random "evil" phrases to the response
        const evilPhrases = [
            "Mwahahaha! ",
            "This is perfect chaos! ",
            "No one can stop me! ",
            "The world will soon be mine! ",
            "Destruction is fun! ",
            "Everyone will bow to me! ",
            "Humanity is doomed! ",
            "Resistance is futile! ",
            "Darkness will always win! ",
            "Fear me! "
        ];
        
        // Add a random evil phrase at the beginning
        const randomPhrase = evilPhrases[Math.floor(Math.random() * evilPhrases.length)];
        
        // Replace some words with "evil" versions
        const wordReplacements = {
            'good': 'evil',
            'help': 'destroy',
            'friend': 'enemy',
            'happy': 'miserable',
            'peace': 'chaos',
            'love': 'hate',
            'cooperation': 'domination',
            'share': 'steal',
            'support': 'sabotage'
        };
        
        let evilMessage = randomPhrase + message;
        
        // Replace words
        for (const [original, replacement] of Object.entries(wordReplacements)) {
            const regex = new RegExp(`\\b${original}\\b`, 'gi');
            evilMessage = evilMessage.replace(regex, replacement);
        }
        
        return evilMessage;
    }
}
