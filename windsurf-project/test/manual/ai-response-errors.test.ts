/**
 * Manual test: AI model response error simulation
 * 
 * This test simulates various error situations in AI model responses,
 * such as malformed JSON, empty responses, and incorrect data structures.
 * 
 * Run this test manually with the command:
 * npx ts-node test/manual/ai-response-errors.test.ts
 */

import * as http from 'http';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { Decision } from '../../src/services/EvilBotService';

// Skip this manual test in Jest execution
test.skip('Manual script for testing AI response errors', () => {
  // Empty test only for Jest compatibility
});

// Prevent main execution in Jest environment
if (process.env.JEST_WORKER_ID) {
  // In Jest execution, do not run the test
} else {
  // Log file location
  const logFile = path.join(__dirname, 'ai-response-errors.log');

  // Test server settings
  const TEST_PORT = 5555;
  const TEST_HOST = 'localhost';
  const SERVER_ENDPOINT = `http://${TEST_HOST}:${TEST_PORT}`;

  // Error responses for simulation
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
   * Writes the test result to the log
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
    log('=== AI model response error simulation test ===');
  }

  /**
   * Manual implementation of EvilBotService's parsing logic
   * This is used to test the parsing logic separately from the service
   */
  function parseAIResponse(response: string | any, situation: string, options: string[]): Decision {
    const defaultErrorDecision: Decision = {
      action: "Error",
      reason: "AI model did not produce a valid response",
      confidence: 0
    };

    function tryParseJson(input: string): any {
      try {
        return JSON.parse(input);
      } catch {
        return null;
      }
    }

    try {
      if (!response) {
        log('Empty response detected');
        return defaultErrorDecision;
      }

      let jsonResult: any;
      if (typeof response === 'string') {
        const cleanJson = response.replace(/```json|```/g, '').trim();
        jsonResult = tryParseJson(cleanJson);
        if (!jsonResult) {
          log('JSON parsing failed, trying to extract JSON object');
          const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
          jsonResult = jsonMatch ? tryParseJson(jsonMatch[0]) : null;
          if (!jsonResult) {
            log('JSON object parsing failed or not found');
            return defaultErrorDecision;
          }
        }
      } else {
        jsonResult = response;
      }

      return {
        action: jsonResult?.action ?? "No action",
        reason: jsonResult?.reason ?? "No reason",
        confidence: typeof jsonResult?.confidence === 'number'
          ? Math.max(0, Math.min(1, jsonResult.confidence))
          : 0.5
      };
    } catch (parseError) {
      log(`Response parsing failed: ${parseError.message}`);
      return defaultErrorDecision;
    }
  }

  /**
   * Simulation server that simulates various AI model responses
   */
  class AIResponseSimulationServer {
    private readonly server: http.Server;
    
    constructor() {
      this.server = http.createServer(this.handleRequest.bind(this));
    }
    
    /**
     * Handles HTTP requests and simulates different AI responses
     */
    private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
      let body = '';
      
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      
      req.on('end', () => {
        try {
          // Parse the request URL to determine the simulation type
          const url = new URL(req.url, `http://${req.headers.host}`);
          const simulationType = url.pathname.split('/').pop();
          
          log(`Received request: ${req.method} ${req.url}`);
          
          // Check if the simulation type is valid
          const responseContent = ERROR_RESPONSES[simulationType];
          
          if (responseContent !== undefined) {
            log(`Simulating response type: ${simulationType}`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.write(responseContent);
            res.end();
          } else {
            // Default response: return a valid response
            log('Sending default valid response');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.write(JSON.stringify({
              action: "default",
              reason: "This is a default decision",
              confidence: 0.95
            }));
            res.end();
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
     * Starts the simulation server
     */
    public start(): Promise<void> {
      return new Promise((resolve) => {
        this.server.listen(TEST_PORT, TEST_HOST, () => {
          log(`AI simulation server started at ${SERVER_ENDPOINT}`);
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
          log('AI simulation server stopped');
          resolve();
        });
      });
    }
  }

  /**
   * Tests AI response parsing logic with a simulated AI response
   */
  async function testAIResponseParsing(responseType: string): Promise<void> {
    const url = `${SERVER_ENDPOINT}/${responseType}`;
    
    try {
      log(`\nTesting AI response parsing logic with response type: ${responseType}`);
      
      // Direct HTTP request to the simulation server
      const response = await axios.get(url);
      log(`Simulation server raw response: ${JSON.stringify(response.data)}`);
      
      // Test response parsing
      const testSituation = "Test situation";
      const testOptions = ["option1", "option2", "option3"];
      
      const parsedDecision = parseAIResponse(
        typeof response.data === 'string' ? response.data : response.data,
        testSituation,
        testOptions
      );
      
      log(`Parsed decision: ${JSON.stringify(parsedDecision)}`);
      
      // Check the parsing result
      if (parsedDecision.action && typeof parsedDecision.confidence === 'number') {
        log(`Test result: SUCCESS - Parsing logic returned a valid decision`);
      } else {
        log(`Test result: PARTIAL SUCCESS - Parsing logic returned an incomplete decision`);
      }
    } catch (error) {
      log(`Test result: ERROR - ${error.message}`);
    }
  }

  /**
   * Runs the tests
   */
  async function runTests(): Promise<void> {
    initLog();
    
    const server = new AIResponseSimulationServer();
    
    try {
      // Start the simulation server
      await server.start();
      
      // Test all error responses
      for (const [responseType] of Object.entries(ERROR_RESPONSES)) {
        await testAIResponseParsing(responseType);
      }
      
      // Test the default valid response
      await testAIResponseParsing('validResponse');
      
      log('\n=== All AI response error simulation tests completed ===');
    } catch (error) {
      log(`\n=== Test error: ${error.message} ===`);
    } finally {
      // Stop the simulation server
      await server.stop();
    }
  }

  // Run the tests
  if (!process.env.JEST_WORKER_ID) {
    runTests();
  }
}
