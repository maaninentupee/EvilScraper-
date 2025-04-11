import { LocalProvider } from '../../src/services/providers/LocalProvider';
import { CompletionRequest } from '../../src/services/providers/BaseProvider';
import * as fs from 'fs';
import * as path from 'path';
import { environment } from '../../src/config/environment';
import { spawn } from 'child_process';
import { Logger } from '@nestjs/common';

// Mock fs, path, environment and child_process
jest.mock('fs');
jest.mock('path');
jest.mock('../../src/config/environment', () => ({
  environment: {
    useLocalModels: true,
    localModelsDir: '/mock/models/dir'
  }
}));
jest.mock('child_process');

describe('LocalProvider', () => {
  let provider: LocalProvider;
  let mockSpawn: jest.Mock;
  let mockProcess: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup mocks
    (path.join as jest.Mock).mockImplementation((...args) => args.join('/'));
    
    // Setup mock process for spawn
    mockProcess = {
      stdout: {
        on: jest.fn()
      },
      stderr: {
        on: jest.fn()
      },
      on: jest.fn()
    };
    
    mockSpawn = spawn as jest.Mock;
    mockSpawn.mockReturnValue(mockProcess);
    
    // Create provider instance
    provider = new LocalProvider();
  });

  describe('isAvailable', () => {
    it('should return true when useLocalModels is true', async () => {
      const result = await provider.isAvailable();
      expect(result).toBe(true);
    });

    it('should return false when useLocalModels is false', async () => {
      (environment as any).useLocalModels = false;
      const result = await provider.isAvailable();
      expect(result).toBe(false);
      (environment as any).useLocalModels = true; // Reset for other tests
    });
  });

  describe('getName', () => {
    it('should return "local"', () => {
      expect(provider.getName()).toBe('local');
    });
  });

  describe('generateCompletion', () => {
    it('should return error if model process fails', async () => {
      // Setup the mock to simulate process error
      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          callback(1); // Exit code 1 indicates error
        }
        return mockProcess;
      });

      const request: CompletionRequest = {
        prompt: 'Test prompt',
        modelName: 'test-model',
        temperature: 0.7,
        maxTokens: 100
      };

      const result = await provider.generateCompletion(request);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('exited with code 1');
      expect(result.provider).toBe('local');
      expect(result.model).toBe('test-model');
    });

    it('should return generated text when model process succeeds', async () => {
      // Setup the mock to simulate successful process execution
      let dataCallback: (data: Buffer) => void;
      mockProcess.stdout.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          dataCallback = callback;
        }
        return mockProcess;
      });
      
      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          // Simulate data being received before process closes
          dataCallback(Buffer.from('Generated completion text'));
          callback(0); // Exit code 0 indicates success
        }
        return mockProcess;
      });

      const request: CompletionRequest = {
        prompt: 'Test prompt',
        modelName: 'test-model',
        temperature: 0.7,
        maxTokens: 100
      };

      const result = await provider.generateCompletion(request);
      
      expect(result.success).toBe(true);
      expect(result.text).toBe('Generated completion text');
      expect(result.provider).toBe('local');
      expect(result.model).toBe('test-model');
      expect(result.qualityScore).toBeGreaterThan(0);
    });

    it('should handle errors during model execution', async () => {
      // Setup the mock to throw an error
      mockSpawn.mockImplementation(() => {
        throw new Error('Failed to spawn process');
      });

      const request: CompletionRequest = {
        prompt: 'Test prompt',
        modelName: 'test-model'
      };

      const result = await provider.generateCompletion(request);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to spawn process');
      expect(result.provider).toBe('local');
      expect(result.model).toBe('test-model');
    });

    it('should pass correct parameters to the local model', async () => {
      // Setup the mock to simulate successful process execution
      mockProcess.stdout.on.mockImplementation(() => mockProcess);
      mockProcess.stderr.on.mockImplementation(() => mockProcess);
      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') callback(0);
        return mockProcess;
      });

      const request: CompletionRequest = {
        prompt: 'Test prompt',
        modelName: 'test-model',
        temperature: 0.5,
        maxTokens: 200
      };

      await provider.generateCompletion(request);
      
      // Check that spawn was called with the correct parameters
      expect(mockSpawn).toHaveBeenCalledWith('./llama', [
        '-m', '/mock/models/dir/test-model',
        '--temp', '0.5',
        '--ctx_size', '2048',
        '-n', '200',
        '-p', 'Test prompt'
      ]);
    });

    it('should use default values when optional parameters are not provided', async () => {
      // Setup the mock to simulate successful process execution
      mockProcess.stdout.on.mockImplementation(() => mockProcess);
      mockProcess.stderr.on.mockImplementation(() => mockProcess);
      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') callback(0);
        return mockProcess;
      });

      const request: CompletionRequest = {
        prompt: 'Test prompt',
        modelName: 'test-model'
        // No temperature or maxTokens
      };

      await provider.generateCompletion(request);
      
      // Check that spawn was called with default values
      expect(mockSpawn).toHaveBeenCalledWith('./llama', [
        '-m', '/mock/models/dir/test-model',
        '--temp', '0.7', // Default temperature
        '--ctx_size', '2048',
        '-n', '512', // Default maxTokens
        '-p', 'Test prompt'
      ]);
    });

    it('should log warnings from stderr', async () => {
      // Spy on the Logger.warn method
      const loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      
      // Setup the mock to simulate stderr output
      let stderrCallback: (data: Buffer) => void;
      mockProcess.stderr.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          stderrCallback = callback;
        }
        return mockProcess;
      });
      
      mockProcess.stdout.on.mockImplementation(() => mockProcess);
      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          // Simulate stderr data being received before process closes
          stderrCallback(Buffer.from('Warning message'));
          callback(0);
        }
        return mockProcess;
      });

      const request: CompletionRequest = {
        prompt: 'Test prompt',
        modelName: 'test-model'
      };

      await provider.generateCompletion(request);
      
      // Check that warning was logged
      expect(loggerWarnSpy).toHaveBeenCalled();
      
      // Restore the original implementation
      loggerWarnSpy.mockRestore();
    });
  });
});
