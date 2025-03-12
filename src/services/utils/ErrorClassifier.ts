import { Injectable } from '@nestjs/common';

/**
 * Luokka, joka auttaa tunnistamaan ja luokittelemaan eri virhetyyppejä
 */
@Injectable()
export class ErrorClassifier {
    // Virhetyypit
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

    // Uudelleenyritettävät virhetyypit
    private static readonly RETRYABLE_ERROR_TYPES = [
        ErrorClassifier.ERROR_TYPES.NETWORK_ERROR,
        ErrorClassifier.ERROR_TYPES.CONNECTION_ERROR,
        ErrorClassifier.ERROR_TYPES.TIMEOUT,
        ErrorClassifier.ERROR_TYPES.SERVER_ERROR,
        ErrorClassifier.ERROR_TYPES.RATE_LIMIT,
        ErrorClassifier.ERROR_TYPES.PROVIDER_UNAVAILABLE
    ];

    // Vakavat virhetyypit, joita ei kannata yrittää uudelleen samalla palveluntarjoajalla
    private static readonly SEVERE_ERROR_TYPES = [
        ErrorClassifier.ERROR_TYPES.AUTHENTICATION_ERROR,
        ErrorClassifier.ERROR_TYPES.MODEL_NOT_FOUND,
        ErrorClassifier.ERROR_TYPES.MODEL_UNAVAILABLE,
        ErrorClassifier.ERROR_TYPES.CONTENT_FILTER,
        ErrorClassifier.ERROR_TYPES.CONTEXT_LENGTH
    ];

    /**
     * Palauttaa käyttäjäystävällisen virheviestin virhetyypin perusteella
     * @param errorType Virhetyyppi
     * @returns Käyttäjäystävällinen virheviesti
     */
    public static getUserFriendlyErrorMessage(errorType: string): string {
        switch (errorType) {
            case ErrorClassifier.ERROR_TYPES.NETWORK_ERROR:
                return 'Verkkovirhe, tarkista internet-yhteytesi';
            case ErrorClassifier.ERROR_TYPES.CONNECTION_ERROR:
                return 'Yhteysvirhe palvelimeen';
            case ErrorClassifier.ERROR_TYPES.TIMEOUT:
                return 'Pyyntö aikakatkaistiin, palvelin ei vastannut ajoissa';
            case ErrorClassifier.ERROR_TYPES.SERVER_ERROR:
                return 'Palvelinvirhe, yritä myöhemmin uudelleen';
            case ErrorClassifier.ERROR_TYPES.RATE_LIMIT:
                return 'Pyyntörajoitus ylitetty, yritä myöhemmin uudelleen';
            case ErrorClassifier.ERROR_TYPES.AUTHENTICATION_ERROR:
                return 'Todennusvirhe, tarkista API-avaimesi';
            case ErrorClassifier.ERROR_TYPES.INVALID_REQUEST:
                return 'Virheellinen pyyntö, tarkista syötteet';
            case ErrorClassifier.ERROR_TYPES.MODEL_NOT_FOUND:
                return 'Mallia ei löydy, tarkista mallin nimi';
            case ErrorClassifier.ERROR_TYPES.MODEL_UNAVAILABLE:
                return 'Malli ei ole saatavilla tällä hetkellä';
            case ErrorClassifier.ERROR_TYPES.CONTENT_FILTER:
                return 'Sisältösuodatin estää pyynnön, tarkista syöte';
            case ErrorClassifier.ERROR_TYPES.CONTEXT_LENGTH:
                return 'Kontekstin pituus ylittää mallin rajat';
            case ErrorClassifier.ERROR_TYPES.PROVIDER_UNAVAILABLE:
                return 'Palveluntarjoaja ei ole saatavilla';
            case ErrorClassifier.ERROR_TYPES.ALL_PROVIDERS_FAILED:
                return 'Kaikki palveluntarjoajat epäonnistuivat';
            default:
                return 'Tuntematon virhe';
        }
    }

    /**
     * Tunnistaa virheen tyypin annetun virheobjektin perusteella
     * @param error Virhe, joka halutaan luokitella
     * @returns Virhetyyppi
     */
    public classifyError(error: any): string {
        if (!error) {
            return ErrorClassifier.ERROR_TYPES.UNKNOWN;
        }

        // Tarkistetaan HTTP-virheet
        if (error.response && error.response.status) {
            return this.classifyHttpError(error);
        }

        // Tarkistetaan verkkovirheet
        if (error.code || (error.message && typeof error.message === 'string')) {
            return this.classifyNetworkError(error);
        }

        // Tarkistetaan palveluntarjoajakohtaiset virheet
        if (error.provider) {
            return this.classifyProviderSpecificError(error);
        }

        return ErrorClassifier.ERROR_TYPES.UNKNOWN;
    }

    /**
     * Tarkistaa, onko virhe uudelleenyritettävä
     * @param errorType Virhetyyppi
     * @returns True, jos virhe on uudelleenyritettävä
     */
    public isRetryable(errorType: string): boolean {
        return ErrorClassifier.RETRYABLE_ERROR_TYPES.includes(errorType);
    }

    /**
     * Tarkistaa, onko virhe vakava (ei kannata yrittää uudelleen samalla palveluntarjoajalla)
     * @param errorType Virhetyyppi
     * @returns True, jos virhe on vakava
     */
    public isSevere(errorType: string): boolean {
        return ErrorClassifier.SEVERE_ERROR_TYPES.includes(errorType);
    }

    /**
     * Luokittelee HTTP-virheen
     * @param error HTTP-virhe
     * @returns Virhetyyppi
     */
    private classifyHttpError(error: any): string {
        const status = error.response.status;

        // 4xx virheet
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

        // 5xx virheet
        if (status >= 500) {
            return ErrorClassifier.ERROR_TYPES.SERVER_ERROR;
        }

        return ErrorClassifier.ERROR_TYPES.UNKNOWN;
    }

    /**
     * Luokittelee verkkovirheen
     * @param error Verkkovirhe
     * @returns Virhetyyppi
     */
    private classifyNetworkError(error: any): string {
        const errorMessage = error.message ? error.message.toLowerCase() : '';
        const errorCode = error.code ? error.code.toLowerCase() : '';

        // Timeout-virheet
        if (
            errorCode === 'etimedout' ||
            errorCode === 'timeout' ||
            errorMessage.includes('timeout') ||
            errorMessage.includes('timed out')
        ) {
            return ErrorClassifier.ERROR_TYPES.TIMEOUT;
        }

        // Yhteysvirheet
        if (
            errorCode === 'econnrefused' ||
            errorCode === 'econnreset' ||
            errorCode === 'enotfound' ||
            errorMessage.includes('connection') ||
            errorMessage.includes('network')
        ) {
            return ErrorClassifier.ERROR_TYPES.CONNECTION_ERROR;
        }

        // Verkkovirheet
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
     * Luokittelee palveluntarjoajakohtaisen virheen
     * @param error Palveluntarjoajakohtainen virhe
     * @returns Virhetyyppi
     */
    private classifyProviderSpecificError(error: any): string {
        const provider = error.provider.toLowerCase();
        const errorMessage = error.message ? error.message.toLowerCase() : '';
        const errorType = error.type ? error.type.toLowerCase() : '';

        // OpenAI-virheet
        if (provider === 'openai') {
            if (errorType === 'rate_limit_error' || errorMessage.includes('rate limit')) {
                return ErrorClassifier.ERROR_TYPES.RATE_LIMIT;
            }
            if (errorType === 'authentication_error' || errorMessage.includes('api key')) {
                return ErrorClassifier.ERROR_TYPES.AUTHENTICATION_ERROR;
            }
            if (errorType === 'invalid_request_error') {
                if (errorMessage.includes('model')) {
                    return ErrorClassifier.ERROR_TYPES.MODEL_NOT_FOUND;
                }
                if (errorMessage.includes('content filter')) {
                    return ErrorClassifier.ERROR_TYPES.CONTENT_FILTER;
                }
                if (errorMessage.includes('context length') || errorMessage.includes('token')) {
                    return ErrorClassifier.ERROR_TYPES.CONTEXT_LENGTH;
                }
                return ErrorClassifier.ERROR_TYPES.INVALID_REQUEST;
            }
            if (errorType === 'server_error') {
                return ErrorClassifier.ERROR_TYPES.SERVER_ERROR;
            }
        }

        // Anthropic-virheet
        if (provider === 'anthropic') {
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
        }

        // Ollama-virheet
        if (provider === 'ollama') {
            if (errorMessage.includes('not found') || errorMessage.includes('no model')) {
                return ErrorClassifier.ERROR_TYPES.MODEL_NOT_FOUND;
            }
            if (errorMessage.includes('server') || errorMessage.includes('internal')) {
                return ErrorClassifier.ERROR_TYPES.SERVER_ERROR;
            }
        }

        return ErrorClassifier.ERROR_TYPES.UNKNOWN;
    }
}
