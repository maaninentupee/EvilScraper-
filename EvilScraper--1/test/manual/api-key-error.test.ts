/**
 * Manual test: API key error simulation
 * 
 * This test checks how the system handles invalid API keys
 * for OpenAI, Anthropic, and local models.
 * 
 * Run this test manually with the command:
 * npx ts-node test/manual/api-key-error.test.ts
 */

import axios from 'axios';
import { randomUUID } from 'crypto';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Skip this manual test in Jest execution
test.skip('Manual script for testing API key errors', () => {
  // Empty test only for Jest compatibility
});

// Prevent main execution in Jest environment
if (process.env.JEST_WORKER_ID) {
  // In Jest execution, do not run the test
} else {
  // Ensure that we can restore the original environment variables after the test
  dotenv.config();
  const originalOpenAIKey = process.env.OPENAI_API_KEY;
  const originalAnthropicKey = process.env.ANTHROPIC_API_KEY;
  const originalLocalEndpoint = process.env.LOCAL_API_ENDPOINT;


  // Log file location
  const logFile = path.join(__dirname, 'api-key-error.log');

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
    log('=== API key error simulation test ===');
  }

  /**
   * Simulates an error caused by an invalid API key
   */
  async function testInvalidAPIKey(
    serviceName: string, 
    endpoint: string, 
    invalidKey: string,
    headers: Record<string, string>
  ): Promise<void> {
    try {
      log(`Testing service ${serviceName} with an invalid API key...`);
      
      const response = await axios.post(
        endpoint,
        {
          prompt: "This is a test with an invalid API key",
          model: "test-model"
        },
        { 
          headers,
          timeout: 5000 // 5-second timeout
        }
      );
      
      log(`ERROR: Request succeeded despite an invalid API key: ${JSON.stringify(response.data)}`);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status;
        log(`OK: Request failed as expected: ${statusCode} - ${error.message}`);
      } else {
        log(`OK: Other error: ${error.message}`);
      }
    }
  }

  /**
   * Simulates an OpenAI API key error
   */
  async function testOpenAIAPIKeyError(): Promise<void> {
    const invalidKey = `sk-invalid-${randomUUID()}`;
    
    // Temporarily set an invalid API key
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
    
    // Restore the original API key
    process.env.OPENAI_API_KEY = originalOpenAIKey;
  }

  /**
   * Simulates an Anthropic API key error
   */
  async function testAnthropicAPIKeyError(): Promise<void> {
    const invalidKey = `sk-ant-invalid-${randomUUID()}`;
    
    // Temporarily set an invalid API key
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
    
    // Restore the original API key
    process.env.ANTHROPIC_API_KEY = originalAnthropicKey;
  }

  /**
   * Simulates local model errors
   */
  async function testLocalModelError(): Promise<void> {
    // Incorrect local endpoint (no target service)
    const invalidEndpoint = `http://localhost:${Math.floor(60000 + Math.random() * 5000)}`;
    
    // Temporarily set an invalid endpoint
    process.env.LOCAL_API_ENDPOINT = invalidEndpoint;
    
    try {
      log(`Testing local model with an invalid endpoint ${invalidEndpoint}...`);
      
      const response = await axios.post(
        `${invalidEndpoint}/generate`,
        {
          prompt: "This is a test with an invalid endpoint",
          model: "mistral-7b-instruct-q8_0.gguf"
        },
        { 
          timeout: 2000 // 2-second timeout
        }
      );
      
      log(`ERROR: Request succeeded despite an invalid endpoint: ${JSON.stringify(response.data)}`);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          log(`OK: Connection refused as expected: ${error.message}`);
        } else {
          log(`OK: Request failed for another reason: ${error.message}`);
        }
      } else {
        log(`OK: Other error: ${error.message}`);
      }
    }
    
    // Restore the original endpoint
    process.env.LOCAL_API_ENDPOINT = originalLocalEndpoint;
  }

  /**
   * Runs the tests
   */
  async function runTests(): Promise<void> {
    initLog();
    
    try {
      await testOpenAIAPIKeyError();
      await testAnthropicAPIKeyError();
      await testLocalModelError();
      
      log('\n=== All API key tests completed successfully ===');
    } catch (error) {
      log(`\n=== Test error: ${error.message} ===`);
    } finally {
      // Restore the original environment variables
      process.env.OPENAI_API_KEY = originalOpenAIKey;
      process.env.ANTHROPIC_API_KEY = originalAnthropicKey;
      process.env.LOCAL_API_ENDPOINT = originalLocalEndpoint;
    }
  }

  // Run the tests
  runTests();
}
