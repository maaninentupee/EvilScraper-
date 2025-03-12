import { BaseProvider } from './BaseProvider';
import { CompletionRequest, CompletionResult } from './BaseProvider';

export class TestProvider extends BaseProvider {
  getName(): string {
    return 'test-provider';
  }
  
  async generateCompletion(request: CompletionRequest): Promise<CompletionResult> {
    return {
      text: 'Test completion',
      provider: this.getName(),
      model: request.modelName,
      success: true
    };
  }
  
  // Override isAvailable to force it to throw an error
  async isAvailable(): Promise<boolean> {
    // This should trigger the catch block in BaseProvider
    return super.isAvailable();
  }
}
