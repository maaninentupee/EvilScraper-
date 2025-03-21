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
    
    public async makeDecision(situation: string, options: string[]): Promise<Decision> {
        if (!situation || typeof situation !== 'string') {
            this.logger.error('Invalid input: situation is undefined or of wrong type');
            return {
                action: "Error",
                reason: "Invalid input: situation is undefined or of wrong type",
                confidence: 0
            };
        }

        if (!options || !Array.isArray(options) || options.length === 0) {
            this.logger.error('Invalid input: options are missing or not a valid list');
            return {
                action: "Error",
                reason: "Invalid input: options are missing or not a valid list",
                confidence: 0
            };
        }

        try {
            const input = `
            Situation: ${situation}
            
            Options:
            ${options.map((option, index) => `${index + 1}. ${option}`).join('\n')}
            
            Choose the best option and justify your decision. Answer in JSON format:
            {
                "action": "chosen action",
                "reason": "justification for the choice",
                "confidence": estimate of certainty (between 0-1)
            }`;
            
            const result = await this.aiGateway.processAIRequest("decision", input);
            
            // Try to parse the response in JSON format
            try {
                let jsonResult: Decision;
                
                if (result.success && result.message) {
                    // First, try to parse the entire response as JSON
                    const cleanJson = result.message.replace(/```json|```/g, '').trim();
                    // Careful JSON parsing: if this fails, use an alternative decision
                    try {
                        jsonResult = JSON.parse(cleanJson);
                    } catch (jsonError) {
                        this.logger.warn(`JSON parsing failed: ${jsonError.message}, trying to find JSON string`);
                        // Try to find JSON object in the text
                        const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
                        if (jsonMatch) {
                            try {
                                jsonResult = JSON.parse(jsonMatch[0]);
                            } catch (e) {
                                throw new Error(`JSON object parsing failed: ${e.message}`);
                            }
                        } else {
                            throw new Error('JSON object not found in response');
                        }
                    }
                } else {
                    throw new Error(result.error || 'AI response failed');
                }
                
                // Ensure required fields are present
                return {
                    action: jsonResult && jsonResult.action ? jsonResult.action : "No action",
                    reason: jsonResult && jsonResult.reason ? jsonResult.reason : "No justification",
                    confidence: jsonResult && typeof jsonResult.confidence === 'number' ? 
                        Math.max(0, Math.min(1, jsonResult.confidence)) : 0.5 // Limit to range 0-1
                };
            } catch (parseError) {
                this.logger.error(`Response parsing failed: ${parseError.message}`);
                return {
                    action: "Error in decision-making", 
                    reason: "AI model did not produce a valid JSON response", 
                    confidence: 0
                };
            }
        } catch (error) {
            this.logger.error(`Decision-making failed: ${error.message}`);
            return {
                action: "Error", 
                reason: `Decision-making failed: ${error.message}`, 
                confidence: 0
            };
        }
    }
    
    public async processRequest(taskType: string, input: string): Promise<AIResponse> {
        try {
            // Process the request using the AIGateway
            const result = await this.aiGateway.processAIRequest(taskType, input);
            
            // Check the result
            if (!result.success) {
                this.logger.error(`Error in EvilBot request processing: ${result.error}`);
                return result;
            }
            
            // Modify the response to be "evil"
            if (result.message) {
                const evilMessage = this.makeMessageEvil(result.message);
                
                return {
                    ...result,
                    message: evilMessage
                };
            }
            
            return result;
            
        } catch (error) {
            this.logger.error(`Error in EvilBot request processing: ${error.message}`);
            
            return {
                success: false,
                error: `Error in EvilBot request processing: ${error.message}`,
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
