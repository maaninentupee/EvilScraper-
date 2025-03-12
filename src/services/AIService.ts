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
     * Suorittaa SEO-analyysin annetulle sisällölle hyödyntäen fallback-mekanismia
     * @param content Analysoitava sisältö
     * @returns Analyysitulos
     */
    async analyzeSEO(content: { title: string, description?: string, content?: string }) {
        return this.processWithFallback('seo', this.buildSEOPrompt(content));
    }

    /**
     * Suorittaa koodigeneroinnin annetulle sisällölle hyödyntäen fallback-mekanismia
     * @param content Koodin generoinnin ohjeet
     * @returns Generoitu koodi
     */
    async generateCode(content: { language: string, description: string, requirements?: string[] }) {
        return this.processWithFallback('code', this.buildCodePrompt(content));
    }

    /**
     * Suorittaa päätöksentekotoiminnon annetulle tilanteelle hyödyntäen fallback-mekanismia
     * @param content Päätöksentekotilanne
     * @returns Päätöstulos
     */
    async makeDecision(content: { situation: string, options: string[] }) {
        return this.processWithFallback('decision', this.buildDecisionPrompt(content));
    }

    /**
     * Käsittelee AI-pyynnön ja yrittää käyttää eri malleja järjestyksessä, jos edelliset epäonnistuvat
     * @param taskType Tehtävätyyppi
     * @param prompt Kysely mallille
     * @returns Mallin vastaus
     */
    private async processWithFallback(taskType: string, prompt: string) {
        try {
            // Käytetään AIGateway-luokan omaa fallback-mekanismia
            const result = await this.aiGateway.processAIRequestWithFallback(taskType, prompt);
            
            if (result.success) {
                this.logger.log(`AI-pyyntö onnistui käyttäen mallia: ${result.model} (${result.provider})`);
                
                if (result.usedFallback) {
                    this.logger.log(`Käytettiin vaihtoehtoista mallia alkuperäisen sijaan`);
                }
                
                return {
                    success: true,
                    text: result.text,
                    provider: result.provider,
                    model: result.model,
                    usedFallback: result.usedFallback || false
                };
            } else {
                // Käsitellään virhetilanne
                const errorMessage = `AI-pyyntö epäonnistui: ${result.error} (${result.errorType})`;
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
            // Käsitellään odottamattomat virheet
            const errorMessage = `Odottamaton virhe AI-pyynnössä: ${error.message}`;
            this.logger.error(errorMessage);
            
            return {
                success: false,
                error: error.message || 'Tuntematon virhe',
                errorType: 'unexpected_error',
                text: '',
                provider: 'none',
                model: 'none'
            };
        }
    }

    /**
     * Rakentaa SEO-analyysin kyselyn
     */
    private buildSEOPrompt(content: { title: string, description?: string, content?: string }): string {
        return `Analysoi seuraava sisältö SEO-näkökulmasta:
Otsikko: ${content.title}
${content.description ? `Kuvaus: ${content.description}\n` : ''}
${content.content ? `Sisältö: ${content.content}\n` : ''}

Palauta SEO-analyysi kattaen seuraavat osa-alueet:
1. Avainsanojen käyttö ja optimointi
2. Otsikon ja metakuvauksen tehokkuus
3. Sisällön laatu ja relevanssi
4. Parannusehdotukset`;
    }

    /**
     * Rakentaa koodigeneroinnin kyselyn
     */
    private buildCodePrompt(content: { language: string, description: string, requirements?: string[] }): string {
        return `Generoi koodia seuraavasti:
Ohjelmointikieli: ${content.language}
Kuvaus: ${content.description}
${content.requirements ? `Vaatimukset:\n${content.requirements.map(req => `- ${req}`).join('\n')}\n` : ''}

Palauta vain toimiva koodi ilman selityksiä.`;
    }

    /**
     * Rakentaa päätöksenteon kyselyn
     */
    private buildDecisionPrompt(content: { situation: string, options: string[] }): string {
        return `Tee päätös seuraavassa tilanteessa:
Tilanne: ${content.situation}
Vaihtoehdot:
${content.options.map((option, index) => `${index + 1}. ${option}`).join('\n')}

Palauta JSON-muodossa:
{
  "action": "valittu vaihtoehto",
  "confidence": lukuarvo välillä 0-1,
  "reasoning": "lyhyt perustelu päätökselle"
}`;
    }
}
