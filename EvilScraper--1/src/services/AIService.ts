import { Injectable, Logger } from '@nestjs/common';
import { ModelSelector } from './ModelSelector';
import { AIGateway } from './AIGateway';

@Injectable()
export class AIService {
    private readonly logger = new Logger(AIService.name);
    private readonly providerPriority = ['lmstudio', 'ollama', 'local', 'openai', 'anthropic'];

    constructor(
        private readonly modelSelector: ModelSelector,
        private readonly aiGateway: AIGateway
    ) {}

    /**
     * Performs SEO analysis for the given content using fallback mechanism
     * @param content Content to be analyzed
     * @returns Analysis result
     */
    async analyzeSEO(content: { title: string, description?: string, content?: string }) {
        return this.processWithFallback('seo', this.buildSEOPrompt(content));
    }

    /**
     * Performs code generation for the given content using fallback mechanism
     * @param content Code generation instructions
     * @returns Generated code
     */
    async generateCode(content: { language: string, description: string, requirements?: string[] }) {
        return this.processWithFallback('code', this.buildCodePrompt(content));
    }

    /**
     * Performs decision-making function for the given situation using fallback mechanism
     * @param content Decision-making situation
     * @returns Decision result
     */
    async makeDecision(content: { situation: string, options: string[] }) {
        return this.processWithFallback('decision', this.buildDecisionPrompt(content));
    }

    /**
     * Processes AI request and tries to use different models in sequence if previous ones fail
     * @param taskType Task type
     * @param prompt Query for the model
     * @returns Model response
     */
    private async processWithFallback(taskType: string, prompt: string) {
        try {
            // Use AIGateway class's own fallback mechanism
            const result = await this.aiGateway.processAIRequestWithFallback(taskType, prompt);
            
            if (result.success) {
                this.logger.log(`AI request was successful using model: ${result.model} (${result.provider})`);
                
                if (result.usedFallback) {
                    this.logger.log(`A fallback model was used instead of the original one`);
                }
                
                return {
                    success: true,
                    text: result.text,
                    provider: result.provider,
                    model: result.model,
                    usedFallback: result.usedFallback || false
                };
            } else {
                // Handle error situation
                const errorMessage = `AI request failed: ${result.error} (${result.errorType})`;
                this.logger.error(errorMessage);
                
                return {
                    success: false,
                    error: result.error,
                    errorType: result.errorType || 'unknown_error',
                    text: '',
                    provider: result.provider || 'none',
                    model: result.model || 'none'
                };
            }
        } catch (error) {
            // Handle unexpected errors
            const errorMessage = `An unexpected error occurred during AI request: ${error.message}`;
            this.logger.error(errorMessage);
            
            return {
                success: false,
                error: error.message || 'Unknown error',
                errorType: 'unexpected_error',
                text: '',
                provider: 'none',
                model: 'none'
            };
        }
    }

    /**
     * Builds a prompt for SEO analysis
     * @param content Content to be analyzed
     * @returns Formatted prompt
     */
    private buildSEOPrompt(content: { title: string, description?: string, content?: string }): string {
        const promptParts = [
            'Analyze the following content for SEO optimization:\n',
            `TITLE: ${content.title}`
        ];

        if (content.description) {
            promptParts.push(`DESCRIPTION: ${content.description}`);
        }

        if (content.content) {
            promptParts.push(`CONTENT: ${content.content}`);
        }

        promptParts.push(
            '\nProvide a comprehensive SEO analysis including:',
            '1. Keyword analysis',
            '2. Title optimization suggestions',
            '3. Meta description evaluation',
            '4. Content structure recommendations',
            '5. Overall SEO score (0-100)',
            '\nFormat your response in a structured way with clear sections.'
        );

        return promptParts.join('\n');
    }

    /**
     * Builds a prompt for code generation
     * @param content Code generation instructions
     * @returns Formatted prompt
     */
    private buildCodePrompt(content: { language: string, description: string, requirements?: string[] }): string {
        const promptParts = [
            `Generate code in ${content.language} based on the following requirements:\n`,
            `DESCRIPTION: ${content.description}`
        ];

        if (content.requirements?.length) {
            promptParts.push(
                'REQUIREMENTS:',
                ...content.requirements.map(req => `- ${req}`)
            );
        }

        promptParts.push(
            '\nProvide clean, well-documented, and efficient code. Include comments explaining complex parts.'
        );

        return promptParts.join('\n');
    }

    /**
     * Builds a prompt for decision making
     * @param content Decision-making situation
     * @returns Formatted prompt
     */
    private buildDecisionPrompt(content: { situation: string, options: string[] }): string {
        const promptParts = [
            'Help make a decision for the following situation:\n',
            `SITUATION: ${content.situation}\n`,
            'OPTIONS:'
        ];

        // Add numbered options
        const numberedOptions = content.options.map((option, index) =>
            `${index + 1}. ${option}`
        );
        promptParts.push(...numberedOptions);

        promptParts.push(
            '\nAnalyze each option considering pros and cons. Recommend the best option and explain your reasoning.'
        );

        return promptParts.join('\n');
    }
}
