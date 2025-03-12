import { OllamaProvider } from '../../src/services/providers/OllamaProvider';
import { CompletionRequest } from '../../src/services/providers/BaseProvider';
import axios, { AxiosError } from 'axios';
import { environment } from '../../src/config/environment';
import { setTimeout } from 'timers/promises';

jest.mock('axios');
jest.mock('../../src/config/environment', () => ({
  environment: {
    useOllama: true,
    ollamaApiEndpoint: 'http://localhost:11434'
  }
}));

describe('OllamaProvider', () => {
    let provider: OllamaProvider;
    let mockAxiosPost: jest.Mock;
    let mockAxiosGet: jest.Mock;

    beforeEach(() => {
        // Create a mock for the post method
        mockAxiosPost = jest.fn().mockResolvedValue({
            data: { response: 'Generated text', done: true }
        });

        // Create a mock for the get method
        mockAxiosGet = jest.fn().mockResolvedValue({
            data: { models: [{ name: 'mistral' }, { name: 'llama2' }] }
        });

        // Mock axios.create to return an object with the mocked methods
        (axios.create as jest.Mock).mockReturnValue({
            post: mockAxiosPost,
            get: mockAxiosGet,
            defaults: { timeout: 120000 }
        });

        // Create a new provider instance after setting up the mocks
        provider = new OllamaProvider();
        
        jest.clearAllMocks();
    });

    it('should call Ollama API without num_predict parameter', async () => {
        const response = await provider.generateCompletion({
            prompt: 'Test input',
            modelName: 'mistral'
        });

        expect(response).toEqual({
            success: true,
            text: 'Generated text',
            totalTokens: 0,
            provider: 'ollama',
            model: 'mistral',
            finishReason: 'stop',
            qualityScore: expect.any(Number)
        });

        // Verify that the API was called without num_predict parameter
        expect(mockAxiosPost).toHaveBeenCalledWith(
            '/api/generate', 
            expect.objectContaining({
                model: 'mistral',
                prompt: 'Test input',
                options: expect.not.objectContaining({
                    num_predict: expect.any(Number)
                })
            }),
            expect.any(Object)
        );
    });

    it('should handle API success response correctly', async () => {
        mockAxiosPost.mockResolvedValueOnce({
            data: { 
                response: 'Generated completion text',
                done: true,
                eval_count: 150
            }
        });

        // Käytetään pitkää promptia, jotta ei tunnisteta kuormitustestiksi
        const request: CompletionRequest = {
            prompt: 'Test prompt '.repeat(30), // Pitkä prompt estää kuormitustestiksi tunnistamisen
            modelName: 'llama2',
            temperature: 0.5,
            maxTokens: 200,
            systemPrompt: 'You are a helpful assistant'
        };

        const response = await provider.generateCompletion(request);
        
        expect(response.success).toBe(true);
        expect(response.text).toBe('Generated completion text');
        expect(response.totalTokens).toBe(150);
        expect(response.provider).toBe('ollama');
        expect(response.model).toBe('llama2'); // Nyt malli ei vaihdu, koska ei tunnisteta kuormitustestiksi
        expect(response.finishReason).toBe('stop');
        expect(response.qualityScore).toBeGreaterThan(0);

        // Verify API was called with correct parameters
        expect(mockAxiosPost).toHaveBeenCalledWith(
            '/api/generate',
            expect.objectContaining({
                model: 'llama2',
                system: 'You are a helpful assistant',
                stream: false,
                options: {
                    temperature: 0.5,
                    stop: []
                }
            }),
            expect.any(Object)
        );
    });

    it('should handle API error responses gracefully', async () => {
        // Estetään uudelleenyritys mockaamalla useampi virhe
        const errorResponse = {
            response: { 
                status: 500, 
                statusText: 'Internal Server Error',
                data: { error: 'Server error occurred' }
            },
            message: 'Request failed with status code 500',
            isAxiosError: true
        };
        
        // Mockaa virhe useamman kerran estääksemme uudelleenyritykset
        mockAxiosPost.mockRejectedValueOnce(errorResponse);
        mockAxiosPost.mockRejectedValueOnce(errorResponse);
        mockAxiosPost.mockRejectedValueOnce(errorResponse);

        // Käytä ignoreAvailabilityCheck-parametria, jotta ohitetaan saatavuustarkistus
        const request: CompletionRequest = {
            prompt: 'Test prompt '.repeat(30),
            modelName: 'mistral',
            ignoreAvailabilityCheck: true
        };

        const response = await provider.generateCompletion(request);
        
        expect(response.success).toBe(false);
        expect(response.error).toBeDefined();
        expect(response.errorType).toBeDefined();
        expect(response.provider).toBe('ollama');
        expect(response.model).toBe('mistral');
    });

    it('should handle network errors correctly', async () => {
        // Mock a network error
        const networkError = new Error('Network Error') as AxiosError;
        networkError.code = 'ECONNREFUSED';
        networkError.isAxiosError = true;
        
        // Estetään uudelleenyritys mockaamalla toinen verkkovirhe
        mockAxiosPost.mockRejectedValueOnce(networkError);
        mockAxiosPost.mockRejectedValueOnce(networkError);
        mockAxiosPost.mockRejectedValueOnce(networkError);

        const request: CompletionRequest = {
            prompt: 'Test prompt '.repeat(30), // Pitkä prompt estää kuormitustestiksi tunnistamisen
            modelName: 'mistral'
        };

        const response = await provider.generateCompletion(request);
        
        expect(response.success).toBe(false);
        expect(response.error).toBeDefined();
        expect(response.errorType).toBe('network_error');
    });

    it('should handle timeout errors correctly', async () => {
        // Mock a timeout error
        const timeoutError = new Error('timeout of 120000ms exceeded') as AxiosError;
        timeoutError.code = 'ECONNABORTED';
        timeoutError.isAxiosError = true;
        
        // Estetään uudelleenyritys mockaamalla toinen timeout-virhe
        mockAxiosPost.mockRejectedValueOnce(timeoutError);
        mockAxiosPost.mockRejectedValueOnce(timeoutError);
        mockAxiosPost.mockRejectedValueOnce(timeoutError);

        const request: CompletionRequest = {
            prompt: 'Test prompt '.repeat(30), // Pitkä prompt estää kuormitustestiksi tunnistamisen
            modelName: 'mistral'
        };

        const response = await provider.generateCompletion(request);
        
        expect(response.success).toBe(false);
        expect(response.error).toBeDefined();
        expect(response.errorType).toBe('timeout');
    });
    
    it('should handle API timeout gracefully with custom implementation', async () => {
        // Mock a timeout by implementing a function that never resolves
        const timeoutError = new Error('timeout of 120000ms exceeded') as AxiosError;
        timeoutError.code = 'ECONNABORTED';
        timeoutError.isAxiosError = true;
        
        // Mockaa axios post-metodia heittämään timeout-virhe
        mockAxiosPost.mockRejectedValueOnce(timeoutError);

        // Mockaa myös retry-yritykset epäonnistumaan samalla tavalla
        mockAxiosPost.mockRejectedValueOnce(timeoutError);
        mockAxiosPost.mockRejectedValueOnce(timeoutError);

        const request: CompletionRequest = {
            prompt: 'Test input',
            modelName: 'mistral',
            timeout: 200 // Asetetaan lyhyt timeout testille
        };

        const response = await provider.generateCompletion(request);

        expect(response.success).toBe(false);
        expect(response.error).toContain('timeout');
        expect(response.errorType).toBe('timeout');
    });

    it('should retry on network errors if retries are available', async () => {
        // First call fails with network error, second call succeeds
        const networkError = new Error('Network Error') as AxiosError;
        networkError.code = 'ECONNREFUSED';
        networkError.isAxiosError = true;
        
        mockAxiosPost.mockRejectedValueOnce(networkError);
        mockAxiosPost.mockResolvedValueOnce({
            data: { response: 'Retry succeeded', done: true }
        });

        const request: CompletionRequest = {
            prompt: 'Test prompt '.repeat(30), // Pitkä prompt estää kuormitustestiksi tunnistamisen
            modelName: 'mistral'
        };

        const response = await provider.generateCompletion(request);
        
        expect(response.success).toBe(true);
        expect(response.text).toBe('Retry succeeded');
        expect(mockAxiosPost).toHaveBeenCalledTimes(2);
    });

    it('should handle unexpected response format', async () => {
        // Mock an invalid response format
        mockAxiosPost.mockResolvedValueOnce({
            data: { invalid: 'format' } // Missing 'response' field
        });

        const request: CompletionRequest = {
            prompt: 'Test prompt '.repeat(30), // Pitkä prompt estää kuormitustestiksi tunnistamisen
            modelName: 'mistral'
        };

        const response = await provider.generateCompletion(request);
        
        expect(response.success).toBe(false);
        expect(response.error).toContain('unexpected response format');
    });

    it('should check if service is available', async () => {
        const available = await provider.isAvailable();
        
        expect(available).toBe(true);
        expect(mockAxiosGet).toHaveBeenCalledWith('/api/tags', expect.any(Object));
    });

    it('should handle errors during availability check', async () => {
        // Mock a network error for the availability check
        const networkError = new Error('Network Error') as AxiosError;
        networkError.code = 'ECONNREFUSED';
        networkError.isAxiosError = true;
        mockAxiosGet.mockRejectedValueOnce(networkError);

        const available = await provider.isAvailable();
        
        expect(available).toBe(false);
    });

    it('should return false if no models are available', async () => {
        // Mock an empty models list
        mockAxiosGet.mockResolvedValueOnce({
            data: { models: [] }
        });

        const available = await provider.isAvailable();
        
        expect(available).toBe(false);
    });

    it('should return correct provider name', () => {
        expect(provider.getName()).toBe('ollama');
    });

    it('should return service status', () => {
        const status = provider.getServiceStatus();
        
        expect(status).toHaveProperty('isAvailable');
        expect(status).toHaveProperty('totalRequests');
        expect(status).toHaveProperty('successfulRequests');
        expect(status).toHaveProperty('successRate');
    });

    describe('identifyErrorType method', () => {
        // Testataan identifyErrorType-metodia eri virhetyypeillä
        it('should identify network errors correctly', () => {
            // Käytetään protected-metodia testauksessa
            const identifyErrorType = (provider as any).identifyErrorType.bind(provider);
            
            // Verkkovirheet
            const networkError = new Error('Network Error') as AxiosError;
            networkError.code = 'ECONNREFUSED';
            networkError.isAxiosError = true;
            
            expect(identifyErrorType(networkError)).toBe('network_error');
            
            // Eri verkkovirhekoodit
            const resetError = { ...networkError, code: 'ECONNRESET' };
            const timeoutError = { ...networkError, code: 'ETIMEDOUT' };
            const notFoundError = { ...networkError, code: 'ENOTFOUND' };
            
            expect(identifyErrorType(resetError)).toBe('network_error');
            expect(identifyErrorType(timeoutError)).toBe('network_error');
            expect(identifyErrorType(notFoundError)).toBe('network_error');
        });
        
        it('should identify timeout errors correctly', () => {
            const identifyErrorType = (provider as any).identifyErrorType.bind(provider);
            
            // Timeout-virhe
            const timeoutError = new Error('timeout of 15000ms exceeded') as AxiosError;
            timeoutError.isAxiosError = true;
            
            expect(identifyErrorType(timeoutError)).toBe('timeout');
        });
        
        it('should identify HTTP status code errors correctly', () => {
            const identifyErrorType = (provider as any).identifyErrorType.bind(provider);
            
            // 500-virhe (palvelinvirhe)
            const serverError = {
                isAxiosError: true,
                response: { status: 500, data: { error: 'Server error' } }
            };
            expect(identifyErrorType(serverError)).toBe('server_error');
            
            // 404-virhe (ei löydy)
            const notFoundError = {
                isAxiosError: true,
                response: { status: 404, data: { error: 'Not found' } }
            };
            expect(identifyErrorType(notFoundError)).toBe('not_found');
            
            // 401-virhe (autentikaatiovirhe)
            const authError = {
                isAxiosError: true,
                response: { status: 401, data: { error: 'Unauthorized' } }
            };
            expect(identifyErrorType(authError)).toBe('authentication_error');
            
            // 403-virhe (autentikaatiovirhe)
            const forbiddenError = {
                isAxiosError: true,
                response: { status: 403, data: { error: 'Forbidden' } }
            };
            expect(identifyErrorType(forbiddenError)).toBe('authentication_error');
            
            // 429-virhe (rate limit)
            const rateLimitError = {
                isAxiosError: true,
                response: { status: 429, data: { error: 'Too many requests' } }
            };
            expect(identifyErrorType(rateLimitError)).toBe('rate_limit');
            
            // 400-virhe (asiakasvirhe)
            const clientError = {
                isAxiosError: true,
                response: { status: 400, data: { error: 'Bad request' } }
            };
            expect(identifyErrorType(clientError)).toBe('client_error');
        });
        
        it('should identify model-related errors correctly', () => {
            const identifyErrorType = (provider as any).identifyErrorType.bind(provider);
            
            // Malli ei löydy -virhe
            const modelNotFoundError = {
                message: 'Model not found: test-model',
                isAxiosError: false
            };
            expect(identifyErrorType(modelNotFoundError)).toBe('model_not_found');
            
            // Malli ei saatavilla -virhe
            const modelNotAvailableError = {
                message: 'The model is not available',
                isAxiosError: false
            };
            expect(identifyErrorType(modelNotAvailableError)).toBe('model_not_found');
        });
        
        it('should identify resource errors correctly', () => {
            const identifyErrorType = (provider as any).identifyErrorType.bind(provider);
            
            // Muistivirhe
            const memoryError = {
                message: 'Not enough memory to load the model',
                isAxiosError: false
            };
            expect(identifyErrorType(memoryError)).toBe('resource_error');
            
            // Resurssiongelma
            const resourceError = {
                message: 'Not enough resources to process the request',
                isAxiosError: false
            };
            expect(identifyErrorType(resourceError)).toBe('resource_error');
        });
        
        it('should identify format errors correctly', () => {
            const identifyErrorType = (provider as any).identifyErrorType.bind(provider);
            
            // Formaattivirhe
            const formatError = {
                message: 'Failed to parse JSON response',
                isAxiosError: false
            };
            expect(identifyErrorType(formatError)).toBe('format_error');
        });
        
        it('should return unknown_error for unrecognized errors', () => {
            const identifyErrorType = (provider as any).identifyErrorType.bind(provider);
            
            // Tuntematon virhe
            const unknownError = {
                message: 'Something went wrong',
                isAxiosError: false
            };
            expect(identifyErrorType(unknownError)).toBe('unknown_error');
            
            // Tyhjä virhe
            const emptyError = {};
            expect(identifyErrorType(emptyError)).toBe('unknown_error');
            
            // Null-virhe
            expect(identifyErrorType(null)).toBe('unknown_error');
        });
    });
    
    describe('shouldRetry method', () => {
        it('should retry on network errors', () => {
            const shouldRetry = (provider as any).shouldRetry.bind(provider);
            
            expect(shouldRetry('network_error')).toBe(true);
            expect(shouldRetry('connection_error')).toBe(true);
            expect(shouldRetry('timeout')).toBe(true);
            expect(shouldRetry('server_error')).toBe(true);
            expect(shouldRetry('rate_limit')).toBe(true);
        });
        
        it('should not retry on client errors', () => {
            const shouldRetry = (provider as any).shouldRetry.bind(provider);
            
            expect(shouldRetry('client_error')).toBe(false);
            expect(shouldRetry('authentication_error')).toBe(false);
            expect(shouldRetry('model_not_found')).toBe(false);
            expect(shouldRetry('format_error')).toBe(false);
            expect(shouldRetry('unknown_error')).toBe(false);
        });
        
        it('should limit retries when system is under high load', () => {
            const shouldRetry = (provider as any).shouldRetry.bind(provider);
            
            // Simuloidaan korkea kuormitus
            (provider as any).activeRequests = 7; // Yli MAX_CONCURRENT_REQUESTS/2
            
            // Verkkovirheet sallitaan edelleen, mutta timeout-virheitä ei
            expect(shouldRetry('network_error')).toBe(true);
            expect(shouldRetry('timeout')).toBe(false);
            expect(shouldRetry('server_error')).toBe(false);
            
            // Simuloidaan liian monta peräkkäistä virhettä
            (provider as any).serviceStatus.consecutiveFailures = 3;
            expect(shouldRetry('network_error')).toBe(false);
            
            // Palautetaan alkuperäiset arvot
            (provider as any).activeRequests = 0;
            (provider as any).serviceStatus.consecutiveFailures = 0;
        });
    });
    
    describe('updateServiceStatus method', () => {
        it('should update service status correctly on success', () => {
            const updateServiceStatus = (provider as any).updateServiceStatus.bind(provider);
            
            // Asetetaan ensin virhetila
            (provider as any).serviceStatus.consecutiveFailures = 3;
            (provider as any).serviceStatus.isAvailable = false;
            (provider as any).serviceStatus.lastError = 'Previous error';
            (provider as any).serviceStatus.lastErrorTime = new Date();
            
            // Päivitetään onnistuneella pyynnöllä
            updateServiceStatus(true);
            
            // Tarkistetaan, että tila päivittyi oikein
            expect((provider as any).serviceStatus.consecutiveFailures).toBe(0);
            expect((provider as any).serviceStatus.isAvailable).toBe(true);
            expect((provider as any).serviceStatus.lastError).toBe(null);
            expect((provider as any).serviceStatus.lastErrorTime).toBe(null);
        });
        
        it('should update service status correctly on error', () => {
            const updateServiceStatus = (provider as any).updateServiceStatus.bind(provider);
            
            // Asetetaan alkutila
            (provider as any).serviceStatus.consecutiveFailures = 0;
            (provider as any).serviceStatus.isAvailable = true;
            (provider as any).serviceStatus.lastError = null;
            (provider as any).serviceStatus.lastErrorTime = null;
            
            // Päivitetään virheellä
            const testError = new Error('Test error');
            updateServiceStatus(false, testError);
            
            // Tarkistetaan, että tila päivittyi oikein
            expect((provider as any).serviceStatus.consecutiveFailures).toBe(1);
            expect((provider as any).serviceStatus.isAvailable).toBe(true); // Vielä saatavilla
            expect((provider as any).serviceStatus.lastError).toBe('Test error');
            expect((provider as any).serviceStatus.lastErrorTime).toBeInstanceOf(Date);
            
            // Simuloidaan useampi peräkkäinen virhe
            for (let i = 0; i < 4; i++) {
                updateServiceStatus(false, new Error(`Error ${i}`));
            }
            
            // Tarkistetaan, että palvelu merkattiin ei-saatavilla olevaksi
            expect((provider as any).serviceStatus.consecutiveFailures).toBe(5);
            expect((provider as any).serviceStatus.isAvailable).toBe(false);
            expect((provider as any).serviceStatus.lastError).toBe('Error 3');
        });
    });
    
    describe('isModelAvailable method', () => {
        it('should check if model is available', () => {
            const isModelAvailable = (provider as any).isModelAvailable.bind(provider);
            
            // Asetetaan saatavilla olevat mallit
            (provider as any).availableModels = ['mistral', 'llama2'];
            
            // Tarkistetaan saatavilla olevat mallit
            expect(isModelAvailable('mistral')).toBe(true);
            expect(isModelAvailable('llama2')).toBe(true);
            expect(isModelAvailable('unknown-model')).toBe(false);
            
            // Tarkistetaan osittainen täsmäys
            expect(isModelAvailable('mistral:7b')).toBe(true); // Pitäisi täsmätä 'mistral'
            expect(isModelAvailable('llama2:13b')).toBe(true); // Pitäisi täsmätä 'llama2'
        });
        
        it('should refresh available models if last check is too old', async () => {
            // Asetetaan viimeinen tarkistusaika vanhaksi
            (provider as any).lastModelCheckTime = Date.now() - 3600000; // 1 tunti sitten
            (provider as any).availableModels = []; // Tyhjennetään mallit
            
            // Mockaa axiosGet-metodia palauttamaan mallilista
            mockAxiosGet.mockResolvedValueOnce({
                data: { models: [{ name: 'mistral' }, { name: 'llama2' }] }
            });
            
            // Kutsutaan isAvailable-metodia, joka päivittää mallilistan
            await provider.isAvailable();
            
            // Tarkistetaan, että axios.get-metodia kutsuttiin mallien hakemiseksi
            expect(mockAxiosGet).toHaveBeenCalledWith('/api/tags', expect.objectContaining({ timeout: 3000 }));
            
            // Tarkistetaan, että mallit on päivitetty
            expect((provider as any).availableModels).toContain('mistral');
            expect((provider as any).availableModels).toContain('llama2');
        });
    });
    
    describe('Load test detection and handling', () => {
        it('should detect load test based on prompt length', async () => {
            mockAxiosPost.mockResolvedValueOnce({
                data: { response: 'Generated text', done: true }
            });
            
            // Lyhyt prompt tunnistetaan kuormitustestiksi
            const request: CompletionRequest = {
                prompt: 'Short test input',
                modelName: 'llama2'
            };
            
            await provider.generateCompletion(request);
            
            // Tarkistetaan, että API-kutsun timeout on asetettu kuormitustestille
            expect(mockAxiosPost).toHaveBeenCalledWith(
                '/api/generate',
                expect.any(Object),
                expect.objectContaining({
                    timeout: expect.any(Number)
                })
            );
        });
        
        it('should detect load test based on TEST_LOAD keyword', async () => {
            mockAxiosPost.mockResolvedValueOnce({
                data: { response: 'Generated text', done: true }
            });
            
            // TEST_LOAD avainsana tunnistetaan kuormitustestiksi
            const request: CompletionRequest = {
                prompt: 'This is a TEST_LOAD prompt that should be detected',
                modelName: 'llama2'
            };
            
            await provider.generateCompletion(request);
            
            // Tarkistetaan, että käytettiin nopeaa mallia
            expect(mockAxiosPost).toHaveBeenCalledWith(
                '/api/generate',
                expect.objectContaining({
                    model: expect.stringMatching(/mistral|tinyllama|gemma:2b|phi/)
                }),
                expect.any(Object)
            );
        });
        
        it('should use faster model for load tests', async () => {
            mockAxiosPost.mockResolvedValueOnce({
                data: { response: 'Generated text', done: true }
            });
            
            // Asetetaan saatavilla olevat mallit
            (provider as any).availableModels = ['mistral', 'llama2', 'tinyllama'];
            
            // Lyhyt prompt tunnistetaan kuormitustestiksi
            const request: CompletionRequest = {
                prompt: 'Short test',
                modelName: 'llama2:13b' // Raskas malli
            };
            
            await provider.generateCompletion(request);
            
            // Tarkistetaan, että käytettiin nopeampaa mallia
            expect(mockAxiosPost).toHaveBeenCalledWith(
                '/api/generate',
                expect.objectContaining({
                    model: expect.not.stringMatching(/llama2:13b/)
                }),
                expect.any(Object)
            );
        });
    });
    
    describe('Request queue handling', () => {
        it('should queue requests when maximum concurrent requests is reached', async () => {
            // Asetetaan aktiivisten pyyntöjen määrä maksimiin
            (provider as any).activeRequests = (provider as any).MAX_CONCURRENT_REQUESTS;
            
            // Mockaa processNextQueuedRequest-metodia
            const processNextQueuedRequest = jest.spyOn(provider as any, 'processNextQueuedRequest');
            processNextQueuedRequest.mockImplementation(() => {});
            
            // Tehdään pyyntö, joka menee jonoon
            const requestPromise = provider.generateCompletion({
                prompt: 'Test input',
                modelName: 'mistral'
            });
            
            // Simuloidaan jonon käsittelyä
            (provider as any).activeRequests = (provider as any).MAX_CONCURRENT_REQUESTS - 1;
            mockAxiosPost.mockResolvedValueOnce({
                data: { response: 'Queued response', done: true }
            });
            
            // Käsitellään jonossa oleva pyyntö manuaalisesti
            const queueItem = (provider as any).requestQueue[0];
            const result = await (provider as any).processCompletionRequest(queueItem.request);
            queueItem.resolve(result);
            
            // Odotetaan alkuperäisen lupauksen ratkeamista
            const response = await requestPromise;
            
            expect(response.success).toBe(true);
            expect(response.text).toBe('Queued response');
        });
    });
});
