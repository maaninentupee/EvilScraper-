import { BaseProvider, CompletionRequest } from './BaseProvider';

export class TestProvider extends BaseProvider {
  constructor() {
    super();
  }
  
  getName(): string {
    return 'test-provider';
  }
  
  async generateCompletion(request: CompletionRequest): Promise<{ text: string; provider: string; model: string; success: boolean }> {
    return {
      text: 'Test completion',
      provider: this.getName(),
      model: 'test-model',
      success: true
    };
  }
  
  // Override isAvailable to force it to throw an error
  async isAvailable(): Promise<boolean> {
    throw new Error("TestProvider is not available");
  }
}
