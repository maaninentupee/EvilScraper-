/**
 * Data Transfer Object for fallback AI requests
 */
export class FallbackAIRequestDto {
  /**
   * The input text to process
   */
  input: string;
  
  /**
   * The type of task to perform
   * Examples: 'decision', 'text-generation', 'code', 'seo'
   */
  taskType: string;
  
  /**
   * Optional preferred provider
   */
  preferredProvider?: string;
}
