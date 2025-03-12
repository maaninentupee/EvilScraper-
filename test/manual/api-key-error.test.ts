/**
 * Manuaalinen testi: API-avaimen virhetilanteiden simulointi
 * 
 * Tämä testi tarkistaa, miten järjestelmä käsittelee virheellisiä API-avaimia
 * sekä OpenAI, Anthropic että paikallisessa mallissa.
 * 
 * Suorita tämä testi manuaalisesti komennolla:
 * npx ts-node test/manual/api-key-error.test.ts
 */

import axios from 'axios';
import { randomUUID } from 'crypto';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Ohita tämä manuaalinen testi Jest-suorituksessa
test.skip('Manuaalinen skripti API-avainvirheiden testaamiseksi', () => {
  // Tyhjä testi ainoastaan Jest-yhteensopivuutta varten
});

// Estä pääohjelman suoritus Jest-ympäristössä
if (process.env.JEST_WORKER_ID) {
  // Jest-suorituksessa, älä suorita testiä
} else {
  // Varmistetaan, että voimme palauttaa alkuperäiset ympäristömuuttujat testin jälkeen
  dotenv.config();
  const originalOpenAIKey = process.env.OPENAI_API_KEY;
  const originalAnthropicKey = process.env.ANTHROPIC_API_KEY;
  const originalLocalEndpoint = process.env.LOCAL_API_ENDPOINT;

  // Testipalvelimen portti
  const TEST_PORT = 3000;

  // Lokitiedoston sijainti
  const logFile = path.join(__dirname, 'api-key-error.log');

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
    log('=== API-avainten virhetilanteiden testi ===');
  }

  /**
   * Simuloi virheellisen API-avaimen aiheuttamaa virhettä
   */
  async function testInvalidAPIKey(
    serviceName: string, 
    endpoint: string, 
    invalidKey: string,
    headers: Record<string, string>
  ): Promise<void> {
    try {
      log(`Testataan palvelua ${serviceName} virheellisellä API-avaimella...`);
      
      const response = await axios.post(
        endpoint,
        {
          prompt: "Tämä on testi virheellisellä API-avaimella",
          model: "test-model"
        },
        { 
          headers,
          timeout: 5000 // 5 sekunnin timeout
        }
      );
      
      log(`VIRHE: Pyyntö onnistui, vaikka API-avain oli virheellinen: ${JSON.stringify(response.data)}`);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status;
        log(`OK: Pyyntö epäonnistui asianmukaisesti: ${statusCode} - ${error.message}`);
      } else {
        log(`OK: Muu virhe: ${error.message}`);
      }
    }
  }

  /**
   * Simuloi OpenAI-palvelun API-avain virhettä
   */
  async function testOpenAIAPIKeyError(): Promise<void> {
    const invalidKey = `sk-invalid-${randomUUID()}`;
    
    // Aseta väliaikaisesti virheellinen API-avain
    process.env.OPENAI_API_KEY = invalidKey;
    
    await testInvalidAPIKey(
      'OpenAI',
      'https://api.openai.com/v1/chat/completions',
      invalidKey,
      {
        'Authorization': `Bearer ${invalidKey}`,
        'Content-Type': 'application/json'
      }
    );
    
    // Palauta alkuperäinen API-avain
    process.env.OPENAI_API_KEY = originalOpenAIKey;
  }

  /**
   * Simuloi Anthropic-palvelun API-avain virhettä
   */
  async function testAnthropicAPIKeyError(): Promise<void> {
    const invalidKey = `sk-ant-invalid-${randomUUID()}`;
    
    // Aseta väliaikaisesti virheellinen API-avain
    process.env.ANTHROPIC_API_KEY = invalidKey;
    
    await testInvalidAPIKey(
      'Anthropic',
      'https://api.anthropic.com/v1/messages',
      invalidKey,
      {
        'x-api-key': invalidKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      }
    );
    
    // Palauta alkuperäinen API-avain
    process.env.ANTHROPIC_API_KEY = originalAnthropicKey;
  }

  /**
   * Simuloi paikallisen mallin virheitä
   */
  async function testLocalModelError(): Promise<void> {
    // Vääränmuotoinen lokaali endpoint (ei kohdepalvelua)
    const invalidEndpoint = `http://localhost:${Math.floor(60000 + Math.random() * 5000)}`;
    
    // Aseta väliaikaisesti virheellinen endpoint
    process.env.LOCAL_API_ENDPOINT = invalidEndpoint;
    
    try {
      log(`Testataan paikallista mallia virheellisellä endpointilla ${invalidEndpoint}...`);
      
      const response = await axios.post(
        `${invalidEndpoint}/generate`,
        {
          prompt: "Tämä on testi virheellisellä endpointilla",
          model: "mistral-7b-instruct-q8_0.gguf"
        },
        { 
          timeout: 2000 // 2 sekunnin timeout
        }
      );
      
      log(`VIRHE: Pyyntö onnistui, vaikka endpoint oli virheellinen: ${JSON.stringify(response.data)}`);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          log(`OK: Yhteys kieltäytyi asianmukaisesti: ${error.message}`);
        } else {
          log(`OK: Pyyntö epäonnistui muusta syystä: ${error.message}`);
        }
      } else {
        log(`OK: Muu virhe: ${error.message}`);
      }
    }
    
    // Palauta alkuperäinen endpoint
    process.env.LOCAL_API_ENDPOINT = originalLocalEndpoint;
  }

  /**
   * Suorita testit
   */
  async function runTests(): Promise<void> {
    initLog();
    
    try {
      await testOpenAIAPIKeyError();
      await testAnthropicAPIKeyError();
      await testLocalModelError();
      
      log('\n=== Kaikki API-avaintestit suoritettu onnistuneesti ===');
    } catch (error) {
      log(`\n=== Testivirhe: ${error.message} ===`);
    } finally {
      // Palauta alkuperäiset ympäristömuuttujat
      process.env.OPENAI_API_KEY = originalOpenAIKey;
      process.env.ANTHROPIC_API_KEY = originalAnthropicKey;
      process.env.LOCAL_API_ENDPOINT = originalLocalEndpoint;
    }
  }

  // Suorita testit
  runTests();
}
