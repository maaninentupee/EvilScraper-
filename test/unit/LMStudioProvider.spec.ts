import { LMStudioProvider } from '../../src/services/providers/LMStudioProvider';
import axios from 'axios';

jest.mock('axios');

describe('LMStudioProvider', () => {
    let provider: LMStudioProvider;
    let mockAxiosPost: jest.Mock;

    beforeEach(() => {
        // Create a mock for the post method
        mockAxiosPost = jest.fn();

        // Mock axios.create to return an object with the mocked post method
        (axios.create as jest.Mock).mockReturnValue({
            post: mockAxiosPost,
            get: jest.fn(),
            defaults: { timeout: 60000 }
        });

        // Create a new provider instance after setting up the mocks
        provider = new LMStudioProvider();
        
        jest.clearAllMocks();
    });

    it('should handle status 201 responses correctly', async () => {
        // Setup mock response with status 201
        mockAxiosPost.mockResolvedValueOnce({
            status: 201,
            data: {
                choices: [{ text: 'Generated text', finish_reason: 'stop' }],
                usage: { total_tokens: 150 }
            }
        });

        const response = await provider.generateCompletion({
            prompt: 'Test input',
            modelName: 'gpt-3.5-turbo'
        });

        expect(response).toEqual({
            success: true,
            text: 'Generated text',
            totalTokens: 150,
            provider: 'lmstudio',
            model: 'gpt-3.5-turbo',
            finishReason: 'stop',
            qualityScore: expect.any(Number)
        });

        // Verify that the API was called with correct parameters
        expect(mockAxiosPost).toHaveBeenCalledWith(
            '/completions',
            {
                model: 'gpt-3.5-turbo',
                prompt: 'Test input',
                max_tokens: 512,
                temperature: 0.7,
                stop: []
            }
        );
    });

    it('should return an error on 500 responses', async () => {
        // Setup mock to reject with a 500 error
        const errorResponse = {
            response: { 
                status: 500, 
                statusText: 'Internal Server Error',
                data: { error: 'Server error' }
            },
            message: 'Request failed with status code 500'
        };
        
        mockAxiosPost.mockRejectedValueOnce(errorResponse);

        const response = await provider.generateCompletion({
            prompt: 'Test input',
            modelName: 'gpt-3.5-turbo'
        });

        expect(response).toEqual({
            success: false,
            text: '',
            provider: 'lmstudio',
            model: 'gpt-3.5-turbo',
            error: 'Request failed with status code 500',
            qualityScore: 0
        });
    });
});
