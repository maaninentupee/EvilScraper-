/**
 * Manuaalinen testi: Verkkoviiveiden ja -katkosten simulointi
 * 
 * Tämä testi simuloi erilaisia verkko-ongelmia, kuten viivettä, tilapäisiä katkoksia
 * ja timeout-tilanteita, jotta voimme varmistaa järjestelmän käsittelevät ne oikein.
 * 
 * Suorita tämä testi manuaalisesti komennolla:
 * npx ts-node test/manual/network-delay.test.ts
 */

import axios from 'axios';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';

// Ohita tämä manuaalinen testi Jest-suorituksessa
// Jest-yhteensopiva testi, joka ohitetaan automaattisesti
test.skip('Manuaalinen skripti verkkoviiveiden testaamiseksi', () => {
  // Tyhjä testi ainoastaan Jest-yhteensopivuutta varten
  expect(true).toBe(true);
});

// Estä pääohjelman suoritus Jest-ympäristössä
if (process.env.JEST_WORKER_ID) {
  // Jest-suorituksessa, älä suorita testiä
  console.log('Skripti ohitetaan Jest-ympäristössä');
} else {
  // Lokitiedoston sijainti
  const logFile = path.join(__dirname, 'network-delay.log');

  // Testipalvelimen asetukset
  const TEST_PORT = 4444;
  const TEST_HOST = 'localhost';
  const SERVER_ENDPOINT = `http://${TEST_HOST}:${TEST_PORT}`;

  // Simuloidut viivearvot (millisekunteina)
  const DELAYS = {
    short: 500,    // 500ms
    medium: 2000,  // 2s
    long: 8000,    // 8s
    timeout: 15000 // 15s - todennäköisesti aiheuttaa timeoutin
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
    log('=== Verkkoviiveiden ja -katkosten testi ===');
  }

  /**
   * Odottaa annetun ajan millisekunteina
   */
  function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Simulaatiopalvelin, joka simuloi erilaisia verkko-ongelmia
   */
  class NetworkSimulationServer {
    private server: http.Server;
    
    constructor() {
      this.server = http.createServer(this.handleRequest.bind(this));
    }
    
    /**
     * Käsittelee HTTP-pyynnöt ja simuloi eri virhetilanteita
     */
    private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
      let body = '';
      
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      
      req.on('end', async () => {
        try {
          // Parsitaan pyynnön polku simulaation määrittämiseksi
          const url = new URL(req.url, `http://${req.headers.host}`);
          const simulationType = url.pathname.split('/').pop();
          
          log(`Vastaanotettu pyyntö: ${req.method} ${req.url}`);
          
          // Simuloidaan eri verkko-ongelmia perustuen polkuun
          switch (simulationType) {
            case 'short-delay':
              log(`Simuloidaan lyhyttä viivettä: ${DELAYS.short}ms`);
              await sleep(DELAYS.short);
              this.sendSuccessResponse(res);
              break;
              
            case 'medium-delay':
              log(`Simuloidaan keskipitkää viivettä: ${DELAYS.medium}ms`);
              await sleep(DELAYS.medium);
              this.sendSuccessResponse(res);
              break;
              
            case 'long-delay':
              log(`Simuloidaan pitkää viivettä: ${DELAYS.long}ms`);
              await sleep(DELAYS.long);
              this.sendSuccessResponse(res);
              break;
              
            case 'timeout':
              log(`Simuloidaan timeoutiä: ${DELAYS.timeout}ms`);
              await sleep(DELAYS.timeout);
              this.sendSuccessResponse(res);
              break;
              
            case 'connection-reset':
              log('Simuloidaan yhteyden katkaisua (connection reset)');
              // Suljetaan socket väkisin ilman vastausta
              req.socket.destroy();
              break;
              
            case 'bad-response':
              log('Simuloidaan viallista vastausta');
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.write('{malformed json:');
              res.end();
              break;
              
            case 'server-error':
              log('Simuloidaan palvelinvirhettä');
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.write(JSON.stringify({ error: 'Internal Server Error' }));
              res.end();
              break;
              
            default:
              log('Lähetetään onnistunut vastaus');
              this.sendSuccessResponse(res);
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
     * Lähettää onnistuneen vastauksen
     */
    private sendSuccessResponse(res: http.ServerResponse): void {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.write(JSON.stringify({
        success: true,
        message: 'Simulation completed successfully',
        timestamp: new Date().toISOString()
      }));
      res.end();
    }
    
    /**
     * Käynnistää simulaatiopalvelimen
     */
    public start(): Promise<void> {
      return new Promise((resolve) => {
        this.server.listen(TEST_PORT, TEST_HOST, () => {
          log(`Simulaatiopalvelin käynnistetty osoitteessa ${SERVER_ENDPOINT}`);
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
          log('Simulaatiopalvelin pysäytetty');
          resolve();
        });
      });
    }
  }

  /**
   * Testaa annetun endpointin toimintaa timeout-arvolla
   */
  async function testEndpoint(endpoint: string, timeoutMs: number): Promise<void> {
    const url = `${SERVER_ENDPOINT}/${endpoint}`;
    
    try {
      log(`Testaan endpointtia: ${url} (timeout: ${timeoutMs}ms)`);
      
      const response = await axios.post(
        url,
        { test: 'data' },
        { 
          timeout: timeoutMs,
          validateStatus: null // Hyväksytään kaikki vastaukset
        }
      );
      
      log(`Vastaus saatu: ${response.status} ${JSON.stringify(response.data)}`);
    } catch (error) {
      // Tarkistetaan, onko kyseessä Axios-virhe ilman isAxiosError-metodia
      if (error && error.config && error.request) {
        if (error.code === 'ECONNABORTED') {
          log(`OK: Timeout tapahtunut asianmukaisesti: ${error.message}`);
        } else if (error.code === 'ECONNRESET') {
          log(`OK: Yhteys katkaistu asianmukaisesti: ${error.message}`);
        } else {
          log(`OK: Muu Axios-virhe: ${error.message}`);
        }
      } else {
        log(`Muu virhe: ${error.message}`);
      }
    }
  }

  /**
   * Suorittaa testit
   */
  async function runTests(): Promise<void> {
    initLog();
    
    const server = new NetworkSimulationServer();
    
    try {
      // Käynnistetään testipalvelin
      await server.start();
      
      // Onnistunut peruspyyntö
      await testEndpoint('success', 5000);
      
      // Testit erilaisille viiveille
      await testEndpoint('short-delay', 5000);
      await testEndpoint('medium-delay', 5000);
      await testEndpoint('long-delay', 10000);
      
      // TestiTimeout - client timeout pienempi kuin palvelimen viive
      await testEndpoint('long-delay', 3000);
      
      // Testiä tarkoituksella aiheuttaa timeout
      await testEndpoint('timeout', 10000);
      
      // Muut virhetilanteet
      await testEndpoint('connection-reset', 5000);
      await testEndpoint('bad-response', 5000);
      await testEndpoint('server-error', 5000);
      
      log('\n=== Kaikki verkkotestit suoritettu ===');
    } catch (error) {
      log(`\n=== Testivirhe: ${error.message} ===`);
    } finally {
      // Pysäytetään testipalvelin
      await server.stop();
    }
  }

  // Suorita testit
  runTests();
}
