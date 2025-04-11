 // @ts-ignore: Module '@nestjs/common' not found in this collection.
 import { Injectable, Logger } from '@nestjs/common';
import { BaseProvider, CompletionRequest, CompletionResult, ServiceStatus } from './BaseProvider';
import { environment } from '../../config/environment';
import * as fs from 'fs';
import * as path from 'path';
import * as childProcess from 'child_process';

@Injectable()
export class LocalProvider extends BaseProvider {
  private readonly logger = new Logger(LocalProvider.name);
  private isServiceAvailable = true;
  private lastError: string | null = null;
  private lastErrorTime: Date | null = null;
  private consecutiveFailures = 0;
  private totalRequests = 0;
  private successfulRequests = 0;
  private readonly MAX_CONSECUTIVE_FAILURES = 3;
  private readonly LLAMA_BINARY_PATH: string;

  constructor() {
    super();
    // Define the path to the llama binary
    this.LLAMA_BINARY_PATH = this.getLlamaBinaryPath();
    // Check the existence of the llama binary at startup
    this.checkLlamaBinaryExists();
  }

  /**
   * Determines the path to the llama binary based on the environment
   * @returns Absolute path to the llama binary
   */
  private getLlamaBinaryPath(): string {
    const binaryPath = path.resolve(process.env.LLAMA_BINARY_PATH?.trim() || path.join(process.cwd(), 'llama'));
    this.logger.log(`Using the llama binary path: ${binaryPath}`);
    return binaryPath;
  }

  /**
   * Checks the existence of the llama binary
   */
  private checkLlamaBinaryExists(): void {
    try {
      const absolutePath = path.resolve(this.LLAMA_BINARY_PATH);
      this.logger.log(`Checking the existence of the llama binary from path: ${absolutePath}`);
      
      if (!fs.existsSync(absolutePath)) {
        this.isServiceAvailable = false;
        this.lastError = `Llama binary not found at path: ${absolutePath}`;
        this.lastErrorTime = new Date();
        this.consecutiveFailures = this.MAX_CONSECUTIVE_FAILURES; // Set the maximum number of consecutive failures
        
        this.logger.error(this.lastError);
      } else {
        // Check if the file is executable
        try {
          fs.accessSync(absolutePath, fs.constants.X_OK);
          this.logger.log(`Llama binary found and is executable: ${absolutePath}`);
          this.isServiceAvailable = true;
        } catch (error) {
          this.isServiceAvailable = false;
          this.lastError = `Llama binary found but is not executable: ${absolutePath}`;
          this.lastErrorTime = new Date();
          this.consecutiveFailures = this.MAX_CONSECUTIVE_FAILURES;
          
          this.logger.error(this.lastError);
        }
      }
    } catch (error) {
      this.isServiceAvailable = false;
      this.lastError = `Error checking the llama binary: ${error.message}`;
      this.lastErrorTime = new Date();
      this.consecutiveFailures = this.MAX_CONSECUTIVE_FAILURES;
      
      this.logger.error(this.lastError);
    }
  }

  /**
   * Gets the path to the model file
   * @param modelName Model name
   * @returns Absolute path to the model file
   */
  private getModelPath(modelName: string): string {
    return path.join(environment.localModelsDir, modelName);
  }

  /**
   * Generates a response using the local model
   * @param request Request
   * @returns Response
   */
  async generateCompletion(request: CompletionRequest): Promise<CompletionResult> {
    try {
      // Check if the service is available
      if (!await this.isAvailable()) {
        return { 
          success: false, 
          error: this.lastError || 'Local service is not available', 
          errorType: 'service_unavailable',
          text: '',
          provider: this.getName(),
          model: request.modelName
        };
      }
      
      // Check if the model file exists
      const modelPath = this.getModelPath(request.modelName);
      if (!fs.existsSync(modelPath)) {
        this.lastError = `Model file not found: ${modelPath}`;
        this.lastErrorTime = new Date();
        this.consecutiveFailures++;
        
        this.logger.error(this.lastError);
        
        return {
          success: false,
          error: this.lastError,
          errorType: 'model_not_found',
          text: '',
          provider: this.getName(),
          model: request.modelName || 'unknown'
        };
      }
      
      // Use the runLocalModel method to generate the response
      this.totalRequests++;
      const result = await this.runLocalModel(modelPath, request);
      
      if (result.success) {
        this.successfulRequests++;
        this.consecutiveFailures = 0;
      } else {
        this.consecutiveFailures++;
        
        // If there are too many consecutive failures, mark the service as unavailable
        if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
          this.isServiceAvailable = false;
          this.logger.warn(`Service marked as unavailable after ${this.consecutiveFailures} consecutive failures`);
        }
      }
      
      return result;
    } catch (error) {
      this.lastError = `Error generating response: ${error.message}`;
      this.lastErrorTime = new Date();
      this.consecutiveFailures++;
      
      this.logger.error(this.lastError);
      
      // If there are too many consecutive failures, mark the service as unavailable
      if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
        this.isServiceAvailable = false;
        this.logger.warn(`Service marked as unavailable after ${this.consecutiveFailures} consecutive failures`);
      }
      
      return {
        success: false,
        error: this.lastError,
        errorType: 'unexpected_error',
        text: '',
        provider: this.getName(),
        model: request.modelName || 'unknown'
      };
    }
  }

  getName(): string {
    return 'local';
  }

  getServiceStatus(): ServiceStatus {
    return {
      isAvailable: this.isServiceAvailable,
      lastError: this.lastError,
      lastErrorTime: this.lastErrorTime,
      consecutiveFailures: this.consecutiveFailures,
      totalRequests: this.totalRequests,
      successfulRequests: this.successfulRequests,
      successRate: this.totalRequests > 0 ? `${((this.successfulRequests / this.totalRequests) * 100).toFixed(2)}%` : '0%',
      averageLatency: 0 // This should be calculated, but for now use a default value
    };
  }

  /**
   * Checks if the service is available
   * @returns True if the service is available
   */
  public async isAvailable(): Promise<boolean> {
    try {
      // Re-check the llama binary existence to update service availability.
      this.checkLlamaBinaryExists();
      
      if (!this.isServiceAvailable) {
        this.logger.warn(`Local service is not available: ${this.lastError}`);
        return false;
      }
      
      const absolutePath = path.resolve(this.LLAMA_BINARY_PATH);
      if (!fs.existsSync(absolutePath)) {
        this.isServiceAvailable = false;
        this.lastError = `Llama binary not found at path: ${absolutePath}`;
        this.lastErrorTime = new Date();
        this.consecutiveFailures++;
        
        this.logger.error(this.lastError);
        return false;
      }
      
      return true;
    } catch (error) {
      this.isServiceAvailable = false;
      this.lastError = `Error checking service availability: ${error.message}`;
      this.lastErrorTime = new Date();
      this.consecutiveFailures++;
      
      this.logger.error(this.lastError);
      return false;
    }
  }

  /**
   * Runs the local model
   * @param modelPath Model file path
   * @param request Request
   * @returns Response
   */
  private runLocalModel(modelPath: string, request: CompletionRequest): Promise<CompletionResult> {
    return new Promise((resolve) => {
      
      
      // Make sure the llama binary exists
      try {
        const absolutePath = path.resolve(this.LLAMA_BINARY_PATH);
        if (!fs.existsSync(absolutePath)) {
          this.isServiceAvailable = false;
          this.lastError = `Llama binary not found at path: ${absolutePath}`;
          this.lastErrorTime = new Date();
          this.consecutiveFailures = this.MAX_CONSECUTIVE_FAILURES; // Set the maximum number of consecutive failures
          
          this.logger.error(this.lastError);
          
          resolve({
            success: false,
            error: this.lastError,
            errorType: 'service_unavailable', // Changed from binary_not_found to service_unavailable
            text: '',
            provider: this.getName(),
            model: request.modelName || 'unknown'
          });
          return;
        }
        
        this.logger.log(`Generating response using local model: ${request.modelName}`);
        
        // Use execFile instead of spawn for security and ease of use
        childProcess.execFile(absolutePath, [
          '-m', modelPath,
          '--temp', String(request.temperature || 0.7),
          '--ctx_size', '2048',
          '-n', String(request.maxTokens || 1000),
          '-p', request.prompt
        ], { timeout: 30000 }, (error, stdout, stderr) => {
          if (error) {
            this.consecutiveFailures++;
            this.lastError = `Error running local model: ${error.message || 'Unknown error'}`;
            this.lastErrorTime = new Date();
            
            // If the error is due to the binary not being found (ENOENT)
            if (error && 'code' in error && error.code === 'ENOENT') {
              this.isServiceAvailable = false;
              this.lastError = `Llama binary not found or is not executable: ${absolutePath}`;
              this.logger.error(this.lastError);
              
              resolve({
                success: false,
                error: this.lastError,
                errorType: 'service_unavailable',
                text: '',
                provider: this.getName(),
                model: request.modelName || 'unknown'
              });
              return;
            }
            
            if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
              this.isServiceAvailable = false;
              this.logger.warn(`Service marked as unavailable after ${this.consecutiveFailures} consecutive failures`);
            }
            
            this.logger.error(this.lastError);
            
            resolve({
              success: false,
              error: this.lastError,
              errorType: 'process_error',
              text: '',
              provider: this.getName(),
              model: request.modelName || 'unknown'
            });
            return;
          }
          
          if (stderr && stderr.length > 0) {
            this.logger.warn(`Local model produced error output: ${stderr}`);
          }
          
          // Successful execution
          this.logger.log(`Local model execution successful`);
          
          // Clean the output
          const cleanedOutput = this.cleanOutput(stdout);
          
          resolve({
            success: true,
            text: cleanedOutput,
            provider: this.getName(),
            model: request.modelName || 'unknown'
          });
        });
      } catch (error) {
        this.consecutiveFailures++;
        this.lastError = `Unexpected error: ${error.message || 'Unknown error'}`;
        this.lastErrorTime = new Date();
        
        if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
          this.isServiceAvailable = false;
          this.logger.warn(`Service marked as unavailable after ${this.consecutiveFailures} consecutive failures`);
        }
        
        this.logger.error(this.lastError);
        
        resolve({
          success: false,
          error: this.lastError,
          errorType: 'unexpected_error',
          text: '',
          provider: this.getName(),
          model: request.modelName || 'unknown'
        });
      }
    });
  }

  /**
   * Cleans the model output
   * @param output Model output
   * @returns Cleaned output
   */
  private cleanOutput(output: string): string {
    try {
      // Remove any prompt sections
      let cleanedOutput = output;
      
      // Remove any system messages
      cleanedOutput = cleanedOutput.replace(/^.*?<\/s>/, '').trim();
      
      // Remove extra line breaks
      cleanedOutput = cleanedOutput.replace(/\n{3,}/g, '\n\n');
      
      // Remove any model identifiers
      cleanedOutput = cleanedOutput.replace(/\[.*?\]:/g, '');
      
      return cleanedOutput || output; // Return the original output if cleaning fails
    } catch (error) {
      this.logger.warn(`Error cleaning output: ${error.message}`);
      return output; // Return the original output if cleaning fails
    }
  }

  /**
   * Parses the model output
   * @param output Model output
   * @returns Parsed output
   * @deprecated Use cleanOutput instead
   */
  private parseOutput(output: string): string {
    return this.cleanOutput(output);
  }
}
