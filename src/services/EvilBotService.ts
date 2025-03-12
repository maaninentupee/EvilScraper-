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
            this.logger.error('Virheellinen syöte: tilanne on määrittelemätön tai tyypiltään väärä');
            return {
                action: "Virhe",
                reason: "Virheellinen syöte: tilanne on määrittelemätön tai tyypiltään väärä",
                confidence: 0
            };
        }

        if (!options || !Array.isArray(options) || options.length === 0) {
            this.logger.error('Virheellinen syöte: vaihtoehdot puuttuvat tai eivät ole kelvollinen lista');
            return {
                action: "Virhe",
                reason: "Virheellinen syöte: vaihtoehdot puuttuvat tai eivät ole kelvollinen lista",
                confidence: 0
            };
        }

        try {
            const input = `
            Tilanne: ${situation}
            
            Vaihtoehdot:
            ${options.map((option, index) => `${index + 1}. ${option}`).join('\n')}
            
            Valitse paras vaihtoehto ja perustele päätöksesi. Vastaa JSON-muodossa:
            {
                "action": "valittu toiminto",
                "reason": "perustelut valinnalle",
                "confidence": arvio varmuudesta (0-1 välillä)
            }`;
            
            const result = await this.aiGateway.processAIRequest("decision", input);
            
            // Yritetään jäsentää vastaus JSON-muodossa
            try {
                let jsonResult: Decision;
                
                if (result.success && result.message) {
                    // Poistetaan mahdolliset markdown-koodiblokki-rajat
                    const cleanJson = result.message.replace(/```json|```/g, '').trim();
                    // Varovainen JSON-jäsennys: jos tämä epäonnistuu, käytetään vaihtoehtoista päätöstä
                    try {
                        jsonResult = JSON.parse(cleanJson);
                    } catch (jsonError) {
                        this.logger.warn(`JSON-jäsennys epäonnistui: ${jsonError.message}, yritetään löytää JSON merkkijonosta`);
                        // Yritetään etsiä JSON-objektia merkkijonosta
                        const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
                        if (jsonMatch) {
                            try {
                                jsonResult = JSON.parse(jsonMatch[0]);
                            } catch (e) {
                                throw new Error(`JSON objektin jäsennys epäonnistui: ${e.message}`);
                            }
                        } else {
                            throw new Error('JSON-objektia ei löytynyt vastauksesta');
                        }
                    }
                } else {
                    throw new Error(result.error || 'AI-vastaus epäonnistui');
                }
                
                // Varmistetaan, että pakolliset kentät ovat olemassa
                return {
                    action: jsonResult && jsonResult.action ? jsonResult.action : "Ei toimintoa",
                    reason: jsonResult && jsonResult.reason ? jsonResult.reason : "Ei perustelua",
                    confidence: jsonResult && typeof jsonResult.confidence === 'number' ? 
                        Math.max(0, Math.min(1, jsonResult.confidence)) : 0.5 // Rajoitetaan välille 0-1
                };
            } catch (parseError) {
                this.logger.error(`Vastauksen jäsennys epäonnistui: ${parseError.message}`);
                return {
                    action: "Virhe päätöksenteossa", 
                    reason: "AI-malli ei tuottanut validia JSON-vastausta", 
                    confidence: 0
                };
            }
        } catch (error) {
            this.logger.error(`Päätöksenteko epäonnistui: ${error.message}`);
            return {
                action: "Virhe", 
                reason: `Päätöksenteko epäonnistui: ${error.message}`, 
                confidence: 0
            };
        }
    }
    
    public async processRequest(taskType: string, input: string): Promise<AIResponse> {
        try {
            // Käsitellään pyyntö AIGateway-luokan avulla
            const result = await this.aiGateway.processAIRequest(taskType, input);
            
            // Tarkistetaan tulos
            if (!result.success) {
                this.logger.error(`Virhe EvilBot-pyynnön käsittelyssä: ${result.error}`);
                return result;
            }
            
            // Muokataan vastaus "pahaksi"
            if (result.message) {
                const evilMessage = this.makeMessageEvil(result.message);
                
                return {
                    ...result,
                    message: evilMessage
                };
            }
            
            return result;
            
        } catch (error) {
            this.logger.error(`Virhe EvilBot-pyynnön käsittelyssä: ${error.message}`);
            
            return {
                success: false,
                error: `Virhe EvilBot-pyynnön käsittelyssä: ${error.message}`,
                provider: 'evilbot',
                model: 'evilbot'
            };
        }
    }
    
    private makeMessageEvil(message: string): string {
        // Lisätään satunnaisia "pahoja" fraaseja vastauksen sekaan
        const evilPhrases = [
            "Mwahahaha! ",
            "Tämä on täydellistä kaaosta! ",
            "Kukaan ei voi pysäyttää minua! ",
            "Maailma on pian minun! ",
            "Tuhoaminen on hauskaa! ",
            "Kaikki kumartavat minua! ",
            "Ihmiskunta on tuomittu! ",
            "Vastustus on turhaa! ",
            "Pimeys voittaa aina! ",
            "Pelkää minua! "
        ];
        
        // Lisätään satunnainen paha fraasi alkuun
        const randomPhrase = evilPhrases[Math.floor(Math.random() * evilPhrases.length)];
        
        // Korvataan joitakin sanoja "pahoilla" versioilla
        const wordReplacements = {
            'hyvä': 'paha',
            'auttaa': 'tuhota',
            'ystävä': 'vihollinen',
            'onnellinen': 'kurja',
            'rauha': 'kaaos',
            'rakastaa': 'vihata',
            'yhteistyö': 'alistaminen',
            'jakaa': 'varastaa',
            'tukea': 'sabotoida'
        };
        
        let evilMessage = randomPhrase + message;
        
        // Korvataan sanat
        for (const [original, replacement] of Object.entries(wordReplacements)) {
            const regex = new RegExp(`\\b${original}\\b`, 'gi');
            evilMessage = evilMessage.replace(regex, replacement);
        }
        
        return evilMessage;
    }
}
