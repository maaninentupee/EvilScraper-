 // @ts-ignore: Module '@nestjs/common' not found in this collection.
import { Injectable } from '@nestjs/common';

/**
 * Class that helps identify and classify different error types
 */
@Injectable()
export class ErrorClassifier {
    // Error types
    public static readonly ERROR_TYPES = {
        NETWORK_ERROR: 'network_error',
        CONNECTION_ERROR: 'connection_error',
        TIMEOUT: 'timeout',
        SERVER_ERROR: 'server_error',
        RATE_LIMIT: 'rate_limit',
        AUTHENTICATION_ERROR: 'authentication_error',
        INVALID_REQUEST: 'invalid_request',
        MODEL_NOT_FOUND: 'model_not_found',
        MODEL_UNAVAILABLE: 'model_unavailable',
        CONTENT_FILTER: 'content_filter',
        CONTEXT_LENGTH: 'context_length',
        PROVIDER_UNAVAILABLE: 'provider_unavailable',
        ALL_PROVIDERS_FAILED: 'all_providers_failed',
        UNKNOWN: 'unknown'
    };

    // Retryable error types
    private static readonly RETRYABLE_ERROR_TYPES = [
        ErrorClassifier.ERROR_TYPES.NETWORK_ERROR,
        ErrorClassifier.ERROR_TYPES.CONNECTION_ERROR,
        ErrorClassifier.ERROR_TYPES.TIMEOUT,
        ErrorClassifier.ERROR_TYPES.SERVER_ERROR,
        ErrorClassifier.ERROR_TYPES.RATE_LIMIT,
        ErrorClassifier.ERROR_TYPES.PROVIDER_UNAVAILABLE
    ];

    // Severe error types that should not be retried with the same provider
    private static readonly SEVERE_ERROR_TYPES = [
        ErrorClassifier.ERROR_TYPES.AUTHENTICATION_ERROR,
        ErrorClassifier.ERROR_TYPES.MODEL_NOT_FOUND,
        ErrorClassifier.ERROR_TYPES.MODEL_UNAVAILABLE,
        ErrorClassifier.ERROR_TYPES.CONTENT_FILTER,
        ErrorClassifier.ERROR_TYPES.CONTEXT_LENGTH
    ];

    /**
     * Returns a user-friendly error message based on error type
     * @param errorType Error type
     * @returns User-friendly error message
     */
    public static getUserFriendlyErrorMessage(errorType: string): string {
        const messages: { [key: string]: string } = {
            [ErrorClassifier.ERROR_TYPES.NETWORK_ERROR]: 'Network error occurred. Please check your internet connection and try again.',
            [ErrorClassifier.ERROR_TYPES.CONNECTION_ERROR]: 'Connection error occurred. The service might be temporarily unavailable.',
            [ErrorClassifier.ERROR_TYPES.TIMEOUT]: 'Request timed out. The service might be overloaded or temporarily unavailable.',
            [ErrorClassifier.ERROR_TYPES.SERVER_ERROR]: 'Server error occurred. Please try again later.',
            [ErrorClassifier.ERROR_TYPES.RATE_LIMIT]: 'Rate limit exceeded. Please try again later.',
            [ErrorClassifier.ERROR_TYPES.AUTHENTICATION_ERROR]: 'Authentication error. Please check your API key or credentials.',
            [ErrorClassifier.ERROR_TYPES.INVALID_REQUEST]: 'Invalid request. Please check your input and try again.',
            [ErrorClassifier.ERROR_TYPES.MODEL_NOT_FOUND]: 'The requested model was not found. Please check the model name and try again.',
            [ErrorClassifier.ERROR_TYPES.MODEL_UNAVAILABLE]: 'The requested model is currently unavailable. Please try another model or try again later.',
            [ErrorClassifier.ERROR_TYPES.CONTENT_FILTER]: 'The request was filtered due to content policy. Please modify your input and try again.',
            [ErrorClassifier.ERROR_TYPES.CONTEXT_LENGTH]: 'The input exceeded the maximum context length. Please shorten your input and try again.',
            [ErrorClassifier.ERROR_TYPES.PROVIDER_UNAVAILABLE]: 'The service provider is currently unavailable. Please try again later.',
            [ErrorClassifier.ERROR_TYPES.ALL_PROVIDERS_FAILED]: 'All service providers failed to process the request. Please try again later.'
        };
        return messages[errorType] || 'An unknown error occurred. Please try again later.';
    }

    /**
     * Classifies an error based on the provided error object
     * @param error Error object
     * @returns Error type
     */
    public classifyError(error: any): string {
        if (!error) {
            return ErrorClassifier.ERROR_TYPES.UNKNOWN;
        }

        const errorTypes = [
            () => this.checkProviderError(error),
            () => this.checkHttpError(error),
            () => this.checkNetworkError(error)
        ];

        for (const check of errorTypes) {
            const errorType = check();
            if (errorType !== ErrorClassifier.ERROR_TYPES.UNKNOWN) {
                return errorType;
            }
        }

        return ErrorClassifier.ERROR_TYPES.UNKNOWN;
    }

    private checkProviderError(error: any): string {
        if (!error.provider) {
            return ErrorClassifier.ERROR_TYPES.UNKNOWN;
        }
        return this.classifyProviderSpecificError(error);
    }

    private checkHttpError(error: any): string {
        if (!error.response?.status) {
            return ErrorClassifier.ERROR_TYPES.UNKNOWN;
        }
        return this.classifyHttpError(error);
    }

    private checkNetworkError(error: any): string {
        if (!error.code && !(error.message && typeof error.message === 'string')) {
            return ErrorClassifier.ERROR_TYPES.UNKNOWN;
        }
        return this.classifyNetworkError(error);
    }

    /**
     * Checks if an error type is retryable
     * @param errorType Error type
     * @returns True if the error is retryable, false otherwise
     */
    public isRetryable(errorType: string): boolean {
        return ErrorClassifier.RETRYABLE_ERROR_TYPES.includes(errorType);
    }

    /**
     * Checks if an error type is severe
     * @param errorType Error type
     * @returns True if the error is severe, false otherwise
     */
    public isSevere(errorType: string): boolean {
        return ErrorClassifier.SEVERE_ERROR_TYPES.includes(errorType);
    }

    /**
     * Classifies an HTTP error
     * @param error HTTP error
     * @returns Error type
     */
    private classifyHttpError(error: any): string {
        const status = error?.response?.status;

        if (!status) {
            return ErrorClassifier.ERROR_TYPES.UNKNOWN;
        }

        // 4xx errors
        if (status >= 400 && status < 500) {
            if (status === 401 || status === 403) {
                return ErrorClassifier.ERROR_TYPES.AUTHENTICATION_ERROR;
            }
            if (status === 404) {
                return ErrorClassifier.ERROR_TYPES.MODEL_NOT_FOUND;
            }
            if (status === 429) {
                return ErrorClassifier.ERROR_TYPES.RATE_LIMIT;
            }
            if (status === 400) {
                return ErrorClassifier.ERROR_TYPES.INVALID_REQUEST;
            }
            return ErrorClassifier.ERROR_TYPES.INVALID_REQUEST;
        }

        // 5xx errors
        if (status >= 500) {
            return ErrorClassifier.ERROR_TYPES.SERVER_ERROR;
        }

        return ErrorClassifier.ERROR_TYPES.UNKNOWN;
    }

    /**
     * Classifies a network error
     * @param error Network error
     * @returns Error type
     */
    private classifyNetworkError(error: any): string {
        const errorMessage = error?.message?.toLowerCase() ?? '';
        const errorCode = error?.code?.toLowerCase() ?? '';

        // Timeout errors
        if (
            errorCode === 'etimedout' ||
            errorCode === 'timeout' ||
            errorMessage.includes('timeout') ||
            errorMessage.includes('timed out')
        ) {
            return ErrorClassifier.ERROR_TYPES.TIMEOUT;
        }

        // Connection errors
        if (
            errorCode === 'econnrefused' ||
            errorCode === 'econnreset' ||
            errorCode === 'enotfound' ||
            errorMessage.includes('connection') ||
            errorMessage.includes('network')
        ) {
            return ErrorClassifier.ERROR_TYPES.CONNECTION_ERROR;
        }

        // Network errors
        if (
            errorCode.startsWith('e') ||
            errorMessage.includes('network') ||
            errorMessage.includes('internet')
        ) {
            return ErrorClassifier.ERROR_TYPES.NETWORK_ERROR;
        }

        return ErrorClassifier.ERROR_TYPES.UNKNOWN;
    }

    /**
     * Classifies a provider-specific error
     * @param error Provider-specific error
     * @returns Error type
     */
    private classifyProviderSpecificError(error: any): string {
        const provider = error?.provider?.toLowerCase() ?? '';
        const errorMessage = error?.message?.toLowerCase() ?? '';
        const errorType = error?.type?.toLowerCase() ?? '';
        
        const handlers: Record<string, (et: string, em: string) => string> = {
            'openai': this.classifyProviderErrorOpenAI.bind(this),
            'anthropic': (_: string, msg: string) => this.classifyProviderErrorAnthropic(msg),
            'ollama': (_: string, msg: string) => this.classifyProviderErrorOllama(msg)
        };
        
        return handlers[provider]?.(errorType, errorMessage) ?? ErrorClassifier.ERROR_TYPES.UNKNOWN;
    }
    
    private classifyProviderErrorOpenAI(errorType: string, errorMessage: string): string {
        const conditions: { check: () => boolean; type: string }[] = [
            { check: () => errorType === 'rate_limit_error' || errorMessage.includes('rate limit'), type: ErrorClassifier.ERROR_TYPES.RATE_LIMIT },
            { check: () => errorType === 'authentication_error' || errorMessage.includes('api key'), type: ErrorClassifier.ERROR_TYPES.AUTHENTICATION_ERROR },
            { check: () => errorType === 'invalid_request_error' && (errorMessage.includes('content filter') || errorMessage.includes('safety') || errorMessage.includes('rejected')), type: ErrorClassifier.ERROR_TYPES.CONTENT_FILTER },
            { check: () => errorType === 'invalid_request_error' && (errorMessage.includes('context length') || errorMessage.includes('token') || errorMessage.includes('maximum context')), type: ErrorClassifier.ERROR_TYPES.CONTEXT_LENGTH },
            { check: () => errorType === 'invalid_request_error' && errorMessage.includes('model'), type: ErrorClassifier.ERROR_TYPES.MODEL_NOT_FOUND },
            { check: () => errorType === 'invalid_request_error', type: ErrorClassifier.ERROR_TYPES.INVALID_REQUEST },
            { check: () => errorType === 'server_error', type: ErrorClassifier.ERROR_TYPES.SERVER_ERROR }
        ];
        for (const condition of conditions) {
            if (condition.check()) {
                return condition.type;
            }
        }
        return ErrorClassifier.ERROR_TYPES.UNKNOWN;
    }
    
    private classifyProviderErrorAnthropic(errorMessage: string): string {
        if (errorMessage.includes('rate limit') || errorMessage.includes('quota')) {
            return ErrorClassifier.ERROR_TYPES.RATE_LIMIT;
        }
        if (errorMessage.includes('api key') || errorMessage.includes('auth')) {
            return ErrorClassifier.ERROR_TYPES.AUTHENTICATION_ERROR;
        }
        if (errorMessage.includes('model')) {
            return ErrorClassifier.ERROR_TYPES.MODEL_NOT_FOUND;
        }
        if (errorMessage.includes('content') || errorMessage.includes('policy')) {
            return ErrorClassifier.ERROR_TYPES.CONTENT_FILTER;
        }
        if (errorMessage.includes('context') || errorMessage.includes('token')) {
            return ErrorClassifier.ERROR_TYPES.CONTEXT_LENGTH;
        }
        return ErrorClassifier.ERROR_TYPES.UNKNOWN;
    }
    
    private classifyProviderErrorOllama(errorMessage: string): string {
        if (errorMessage.includes('not found') || errorMessage.includes('no model')) {
            return ErrorClassifier.ERROR_TYPES.MODEL_NOT_FOUND;
        }
        if (errorMessage.includes('server') || errorMessage.includes('internal')) {
            return ErrorClassifier.ERROR_TYPES.SERVER_ERROR;
        }
        return ErrorClassifier.ERROR_TYPES.UNKNOWN;
    }
}
