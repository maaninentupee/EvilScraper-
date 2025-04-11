/**
 * AI response type
 */
export interface AIResponse {
    success: boolean;
    text?: string;
    result?: string;
    error?: string;
    errorType?: string;
    provider: string;
    model: string;
    usedFallback?: boolean;
    fromCache?: boolean;
    processingTime?: number;
    tokenCount?: number;
    promptTokens?: number;
    completionTokens?: number;
}

/**
 * Batch response type
 */
export interface AIBatchResponse {
    success: boolean;
    results: AIResponse[];
    totalCount: number;
    successCount: number;
    failureCount: number;
    processingTime: number;
    provider: string;
    model: string;
}
