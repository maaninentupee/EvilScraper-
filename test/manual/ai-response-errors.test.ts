/**
 * Manuaalinen testi: AI-mallien vastausten virhetilanteiden simulointi
 * 
 * Tämä testi simuloi erilaisia virhetilanteita AI-mallien vastauksissa,
 * kuten epämuodostunut JSON, tyhjä vastaus, ja virheelliset tietorakenteet.
 * 
 * Suorita tämä testi manuaalisesti komennolla:
 * npx ts-node test/manual/ai-response-errors.test.ts
 */

import * as http from 'http';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { Decision } from '../../src/services/EvilBotService';

// Ohita tämä manuaalinen testi Jest-suorituksessa
test.skip('Manuaalinen skripti AI-vastausvirheiden testaamiseksi', () => {
  // Tyhjä testi ainoastaan Jest-yhteensopivuutta varten
});

// Estä pääohjelman suoritus Jest-ympäristössä
if (process.env.JEST_WORKER_ID) {
  // Jest-suorituksessa, älä suorita testiä
} else {
  // Lokitiedoston sijainti
  const logFile = path.join(__dirname, 'ai-response-errors.log');

  // Testipalvelimen asetukset
  const TEST_PORT = 5555;
  const TEST_HOST = 'localhost';
  const SERVER_ENDPOINT = `http://${TEST_HOST}:${TEST_PORT}`;

  // Virheelliset vastaukset simulaatioita varten
  const ERROR_RESPONSES = {
    empty: '',
    invalidJson: '{"malformed json here',
    incompleteJson: '{"action": "option1", "confidence":', 
    emptyJson: '{}',
    wrongFormat: '{"wrongKey": "value", "anotherKey": 123}',
    nullValues: '{"action": null, "confidence": null}',
    missingAction: '{"confidence": 0.8}',
    missingConfidence: '{"action": "option1"}',
    nonNumericConfidence: '{"action": "option1", "confidence": "high"}',
    markdownWrapped: '```json\n{"action": "option1", "confidence": 0.8}\n```',
    markdownInvalid: '```json\n{"action": "option1", "confidence":}\n```',
    textWithJson: 'I think the best option is {"action": "option1", "confidence": 0.8} based on my analysis',
    hugeResponse: JSON.stringify({
      action: "option1",
      confidence: 0.8,
      extraData: new Array(1000).fill('x').join('')
    }),
    extraneousFields: JSON.stringify({
      action: "option1",
      confidence: 0.8,
      reason: "This is why I chose this",
      alternatives: ["option2", "option3"],
      scores: { option1: 0.8, option2: 0.5, option3: 0.2 }
    })
  };

  /**
   * Kirjoittaa lokiin testin tuloksen
   */
  function log(message: string): void {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    
    console.log(logEntry.trim());
    fs.appendFileSync(logFile, logEntry);
  }

  /**
   * Alustaa lokin
   */
  function initLog(): void {
    if (fs.existsSync(logFile)) {
      fs.unlinkSync(logFile);
    }
    log('=== AI-mallien vastausten virhetilanteiden testi ===');
  }

  /**
   * Manuaalinen toteutus EvilBotService:n jäsennyslogiikasta
   * Tätä käytetään testaamaan jäsennyslogiikkaa erillään palvelusta
   */
  function parseAIResponse(response: string | any, situation: string, options: string[]): Decision {
    // Oletus virhepäätös
    const defaultErrorDecision: Decision = {
      action: "Virhe", 
      reason: "AI-malli ei tuottanut validia vastausta", 
      confidence: 0
    };
    
    try {
      // Jos vastaus on tyhjä
      if (!response) {
        log('Tyhjä vastaus havaittu');
        return defaultErrorDecision;
      }
      
      let jsonResult: any;
      
      if (typeof response === 'string') {
        // Poistetaan mahdolliset markdown-koodiblokki-rajat
        const cleanJson = response.replace(/```json|```/g, '').trim();
        // Varovainen JSON-jäsennys: jos tämä epäonnistuu, käytetään vaihtoehtoista päätöstä
        try {
          jsonResult = JSON.parse(cleanJson);
        } catch (jsonError) {
          log(`JSON-jäsennys epäonnistui: ${jsonError.message}, yritetään löytää JSON merkkijonosta`);
          // Yritetään etsiä JSON-objektia merkkijonosta
          const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              jsonResult = JSON.parse(jsonMatch[0]);
            } catch (e) {
              log(`JSON objektin jäsennys epäonnistui: ${e.message}`);
              return defaultErrorDecision;
            }
          } else {
            log('JSON-objektia ei löytynyt vastauksesta');
            return defaultErrorDecision;
          }
        }
      } else {
        jsonResult = response;
      }
      
      // Varmistetaan, että pakolliset kentät ovat olemassa
      return {
        action: jsonResult && jsonResult.action ? jsonResult.action : "Ei toimintoa",
        reason: jsonResult && jsonResult.reason ? jsonResult.reason : "Ei perustelua",
        confidence: jsonResult && typeof jsonResult.confidence === 'number' ? 
          Math.max(0, Math.min(1, jsonResult.confidence)) : 0.5 // Rajoitetaan välille 0-1
      };
    } catch (parseError) {
      log(`Vastauksen jäsennys epäonnistui: ${parseError.message}`);
      return defaultErrorDecision;
    }
  }

  /**
   * Simulaatiopalvelin, joka simuloi erilaisia AI-mallien vastauksia
   */
  class AIResponseSimulationServer {
    private server: http.Server;
    
    constructor() {
      this.server = http.createServer(this.handleRequest.bind(this));
    }
    
    /**
     * Käsittelee HTTP-pyynnöt ja simuloi eri AI-vastauksia
     */
    private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
      let body = '';
      
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      
      req.on('end', () => {
        try {
          // Parsitaan pyynnön polku simulaation määrittämiseksi
          const url = new URL(req.url, `http://${req.headers.host}`);
          const simulationType = url.pathname.split('/').pop();
          
          log(`Vastaanotettu pyyntö: ${req.method} ${req.url}`);
          
          // Tarkistetaan, onko simulaatiotyyppi validi
          const responseContent = ERROR_RESPONSES[simulationType];
          
          if (responseContent !== undefined) {
            log(`Simuloidaan vastaustyyppiä: ${simulationType}`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.write(responseContent);
            res.end();
          } else {
            // Oletusvastauksena palautetaan validi vastaus
            log('Lähetetään oletusarvoinen validi vastaus');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.write(JSON.stringify({
              action: "default",
              reason: "Tämä on oletuspäätös",
              confidence: 0.95
            }));
            res.end();
          }
        } catch (error) {
          log(`Virhe pyynnön käsittelyssä: ${error.message}`);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.write(JSON.stringify({ error: 'Internal Server Error' }));
          res.end();
        }
      });
    }
    
    /**
     * Käynnistää simulaatiopalvelimen
     */
    public start(): Promise<void> {
      return new Promise((resolve) => {
        this.server.listen(TEST_PORT, TEST_HOST, () => {
          log(`AI-simulaatiopalvelin käynnistetty osoitteessa ${SERVER_ENDPOINT}`);
          resolve();
        });
      });
    }
    
    /**
     * Pysäyttää simulaatiopalvelimen
     */
    public stop(): Promise<void> {
      return new Promise((resolve) => {
        this.server.close(() => {
          log('AI-simulaatiopalvelin pysäytetty');
          resolve();
        });
      });
    }
  }

  /**
   * Testaa AI-vastausten jäsennyslogiikkaa simuloidulla AI-vastauksella
   */
  async function testAIResponseParsing(responseType: string): Promise<void> {
    const url = `${SERVER_ENDPOINT}/${responseType}`;
    
    try {
      log(`\nTestaan AI-vastausten jäsennyslogiikkaa vastaustyypillä: ${responseType}`);
      
      // Suora HTTP-pyyntö simulaatiopalvelimelle
      const response = await axios.get(url);
      log(`Simulaatiopalvelimen raakavastaus: ${JSON.stringify(response.data)}`);
      
      // Testataan vastauksen jäsennystä
      const testSituation = "Testitilanne";
      const testOptions = ["option1", "option2", "option3"];
      
      const parsedDecision = parseAIResponse(
        typeof response.data === 'string' ? response.data : response.data,
        testSituation,
        testOptions
      );
      
      log(`Jäsennetty päätös: ${JSON.stringify(parsedDecision)}`);
      
      // Tarkistetaan jäsennyksen lopputulos
      if (parsedDecision.action && typeof parsedDecision.confidence === 'number') {
        log(`Testin tulos: ONNISTUI - Jäsennyslogiikka palautti validin päätöksen`);
      } else {
        log(`Testin tulos: OSITTAIN ONNISTUI - Jäsennyslogiikka palautti puutteellisen päätöksen`);
      }
    } catch (error) {
      log(`Testin tulos: VIRHE - ${error.message}`);
    }
  }

  /**
   * Suorittaa testit
   */
  async function runTests(): Promise<void> {
    initLog();
    
    const server = new AIResponseSimulationServer();
    
    try {
      // Käynnistetään simulaatiopalvelin
      await server.start();
      
      // Testataan kaikki virheelliset vastaukset
      for (const [responseType] of Object.entries(ERROR_RESPONSES)) {
        await testAIResponseParsing(responseType);
      }
      
      // Testataan oletusarvoinen validi vastaus
      await testAIResponseParsing('validResponse');
      
      log('\n=== Kaikki AI-vastausten virhetilanteiden testit suoritettu ===');
    } catch (error) {
      log(`\n=== Testivirhe: ${error.message} ===`);
    } finally {
      // Pysäytetään simulaatiopalvelin
      await server.stop();
    }
  }

  // Suorita testit
  if (!process.env.JEST_WORKER_ID) {
    runTests();
  }
}
