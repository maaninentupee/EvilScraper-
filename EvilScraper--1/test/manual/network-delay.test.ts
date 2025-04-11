/**
 * Manual test: Network delay and outage simulation
 * 
 * This test simulates various network issues, such as delays, temporary outages
 * and timeout situations, to ensure the system handles them correctly.
 * 
 * Run this test manually with the command:
 * npx ts-node test/manual/network-delay.test.ts
 */

import axios from 'axios';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';

// Skip this manual test in Jest execution
// Jest-compatible test that is automatically skipped
test.skip('Manual script for testing network delays', () => {
  // Empty test only for Jest compatibility
  expect(true).toBe(true);
});

// Prevent main execution in Jest environment
if (process.env.JEST_WORKER_ID) {
  // In Jest execution, do not run the test
  console.log('Script skipped in Jest environment');
} else {
  // Log file location
  const logFile = path.join(__dirname, 'network-delay.log');

  // Test server settings
  const TEST_PORT = 4444;
  const TEST_HOST = 'localhost';
  const SERVER_ENDPOINT = `http://${TEST_HOST}:${TEST_PORT}`;

  // Simulated delay values (in milliseconds)
  const DELAYS = {
    short: 500,    // 500ms
    medium: 2000,  // 2s
    long: 8000,    // 8s
    timeout: 15000 // 15s - likely to cause a timeout
  };

  /**
   * Writes to the log with the test result
   */
  function log(message: string): void {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    
    console.log(logEntry.trim());
    fs.appendFileSync(logFile, logEntry);
  }

  /**
   * Initializes the log
   */
  function initLog(): void {
    if (fs.existsSync(logFile)) {
      fs.unlinkSync(logFile);
    }
    log('=== Network delay and outage simulation test ===');
  }

  /**
   * Waits for the specified time in milliseconds
   */
  function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Simulation server that simulates various network issues
   */
  class NetworkSimulationServer {
    private readonly server: http.Server;
    
    constructor() {
      this.server = http.createServer(this.handleRequest.bind(this));
    }
    
    /**
     * Handles HTTP requests and simulates different error situations
     */
    private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
      let body = '';
      
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      
      req.on('end', async () => {
        try {
          // Parses the request path to determine the simulation
          const url = new URL(req.url, `http://${req.headers.host}`);
          const simulationType = url.pathname.split('/').pop();
          
          log(`Received request: ${req.method} ${req.url}`);
          
          // Simulates different network issues based on the path
          switch (simulationType) {
            case 'short-delay':
              log(`Simulating short delay: ${DELAYS.short}ms`);
              await sleep(DELAYS.short);
              this.sendSuccessResponse(res);
              break;
              
            case 'medium-delay':
              log(`Simulating medium delay: ${DELAYS.medium}ms`);
              await sleep(DELAYS.medium);
              this.sendSuccessResponse(res);
              break;
              
            case 'long-delay':
              log(`Simulating long delay: ${DELAYS.long}ms`);
              await sleep(DELAYS.long);
              this.sendSuccessResponse(res);
              break;
              
            case 'timeout':
              log(`Simulating timeout: ${DELAYS.timeout}ms`);
              await sleep(DELAYS.timeout);
              this.sendSuccessResponse(res);
              break;
              
            case 'connection-reset':
              log('Simulating connection reset');
              // Closes the socket without a response
              req.socket.destroy();
              break;
              
            case 'bad-response':
              log('Simulating bad response');
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.write('{malformed json:');
              res.end();
              break;
              
            case 'server-error':
              log('Simulating server error');
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.write(JSON.stringify({ error: 'Internal Server Error' }));
              res.end();
              break;
              
            default:
              log('Sending successful response');
              this.sendSuccessResponse(res);
          }
        } catch (error) {
          log(`Error handling request: ${error.message}`);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.write(JSON.stringify({ error: 'Internal Server Error' }));
          res.end();
        }
      });
    }
    
    /**
     * Sends a successful response
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
     * Starts the simulation server
     */
    public start(): Promise<void> {
      return new Promise((resolve) => {
        this.server.listen(TEST_PORT, TEST_HOST, () => {
          log(`Simulation server started at ${SERVER_ENDPOINT}`);
          resolve();
        });
      });
    }
    
    /**
     * Stops the simulation server
     */
    public stop(): Promise<void> {
      return new Promise((resolve) => {
        this.server.close(() => {
          log('Simulation server stopped');
          resolve();
        });
      });
    }
  }

  /**
   * Tests the specified endpoint with a timeout value
   */
  async function testEndpoint(endpoint: string, timeoutMs: number): Promise<void> {
    const url = `${SERVER_ENDPOINT}/${endpoint}`;
    
    try {
      log(`Testing endpoint: ${url} (timeout: ${timeoutMs}ms)`);
      
      const response = await axios.post(
        url,
        { test: 'data' },
        { 
          timeout: timeoutMs,
          validateStatus: null // Accepts all responses
        }
      );
      
      log(`Response received: ${response.status} ${JSON.stringify(response.data)}`);
    } catch (error) {
      // Checks if it's an Axios error without the isAxiosError method
      if (error?.config && error?.request) {
        if (error?.code === 'ECONNABORTED') {
          log(`OK: Timeout occurred as expected: ${error?.message}`);
        } else if (error?.code === 'ECONNRESET') {
          log(`OK: Connection reset as expected: ${error?.message}`);
        } else {
          log(`OK: Other Axios error: ${error?.message}`);
        }
        } else {
          log(`Other error: ${error?.message}`);
        }
    }
  }

  /**
   * Runs the tests
   */
  async function runTests(): Promise<void> {
    initLog();
    
    const server = new NetworkSimulationServer();
    
    try {
      // Starts the test server
      await server.start();
      
      // Successful basic request
      await testEndpoint('success', 5000);
      
      // Tests for different delays
      await testEndpoint('short-delay', 5000);
      await testEndpoint('medium-delay', 5000);
      await testEndpoint('long-delay', 10000);
      
      // Test with client timeout smaller than server delay
      await testEndpoint('long-delay', 3000);
      
      // Test that intentionally causes a timeout
      await testEndpoint('timeout', 10000);
      
      // Other error situations
      await testEndpoint('connection-reset', 5000);
      await testEndpoint('bad-response', 5000);
      await testEndpoint('server-error', 5000);
      
      log('\n=== All network tests completed ===');
    } catch (error) {
      log(`\n=== Test error: ${error.message} ===`);
    } finally {
      // Stops the test server
      await server.stop();
    }
  }

  // Run the tests
  runTests();
}
