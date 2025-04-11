import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { ScrapingController } from '../../src/controllers/scraping.controller';
import { ScrapingService } from '../../src/services/ScrapingService';
import { MockLogger } from '../test-utils';

// Copied type for tests
interface ScrapedDataDto {
  url: string;
  title: string;
  description: string;
  keywords: string[];
  content: string;
  metadata?: Record<string, any>;
}

describe('ScrapingController', () => {
  let controller: ScrapingController;
  let mockScrapingService: Partial<ScrapingService>;
  let mockLogger: MockLogger;

  beforeEach(async () => {
    mockScrapingService = {
      analyzeSEO: jest.fn()
    };

    mockLogger = new MockLogger();
    
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ScrapingController],
      providers: [
        {
          provide: ScrapingService,
          useValue: mockScrapingService
        }
      ],
    }).compile();

    controller = module.get<ScrapingController>(ScrapingController);
    // @ts-ignore - Override the logger to our mock
    controller['logger'] = mockLogger;
  });

  afterEach(() => {
    mockLogger.clear();
    jest.clearAllMocks();
  });

  describe('analyzeSEO', () => {
    it('should return successful analysis', async () => {
      // Arrange
      const seoRequest: ScrapedDataDto = {
        url: 'https://www.example.com',
        title: 'Test page',
        description: 'This is a test page',
        keywords: ['test', 'analysis', 'seo'],
        content: '<html><body><h1>Test page</h1><p>Content</p></body></html>'
      };
      
      const mockAnalysis = {
        score: 85,
        suggestions: ['Add keywords metatag', 'Extend content'],
        strength: 'Good meta title',
        keywords: {
          test: 0.85,
          analysis: 0.65,
          seo: 0.9
        }
      };
      
      (mockScrapingService.analyzeSEO as jest.Mock).mockResolvedValueOnce(mockAnalysis);
      
      // Act
      const result = await controller.analyzeSEO(seoRequest);
      
      // Assert
      expect(result).toEqual({
        url: 'https://www.example.com',
        analysis: mockAnalysis,
        timestamp: expect.any(String)
      });
      expect(mockScrapingService.analyzeSEO).toHaveBeenCalledWith(seoRequest);
      expect(mockLogger.logs.log).toContain(
        `Analyzing SEO for URL: ${seoRequest.url}`
      );
    });

    it('should handle invalid JSON in analysis response', async () => {
      // Arrange
      const seoRequest: ScrapedDataDto = {
        url: 'https://www.example.com',
        title: 'Test page',
        description: 'This is a test page',
        keywords: ['test', 'analysis', 'seo'],
        content: '<html><body><h1>Test page</h1><p>Content</p></body></html>'
      };
      
      // AIGateway throws when invalid JSON, but the service will handle this already 
      const error = new HttpException('Invalid data format', 400);
      (mockScrapingService.analyzeSEO as jest.Mock).mockRejectedValueOnce(error);
      
      // Act & Assert
      await expect(controller.analyzeSEO(seoRequest)).rejects.toThrow(HttpException);
    });

    it('should handle error response from AIGateway', async () => {
      // Arrange
      const seoRequest: ScrapedDataDto = {
        url: 'https://www.example.com',
        title: 'Test page',
        description: 'This is a test page',
        keywords: ['test', 'analysis', 'seo'],
        content: '<html><body><h1>Test page</h1><p>Content</p></body></html>'
      };
      
      const errorResponse = {
        error: true,
        message: 'AI service is not available',
        details: 'All services failed'
      };
      
      (mockScrapingService.analyzeSEO as jest.Mock).mockResolvedValueOnce(errorResponse);
      
      // Act & Assert
      await expect(controller.analyzeSEO(seoRequest)).rejects.toThrow(HttpException);
      expect(mockLogger.logs.error).toContain('AI service error in SEO analysis: AI service is not available');
    });

    it('should handle incomplete analysis response', async () => {
      // Arrange
      const seoRequest: ScrapedDataDto = {
        url: 'https://www.example.com',
        title: 'Test page',
        description: 'This is a test page',
        keywords: ['test', 'analysis', 'seo'],
        content: '<html><body><h1>Test page</h1><p>Content</p></body></html>'
      };
      
      const error = new HttpException('Missing required fields', 400);
      (mockScrapingService.analyzeSEO as jest.Mock).mockRejectedValueOnce(error);
      
      // Act & Assert
      await expect(controller.analyzeSEO(seoRequest)).rejects.toThrow(HttpException);
    });

    it('should use default values for missing optional fields', async () => {
      // Arrange
      const seoRequest: ScrapedDataDto = {
        url: 'https://www.example.com',
        title: 'Test page',
        description: 'This is a test page',
        keywords: ['test', 'analysis', 'seo'],
        content: '<html><body><h1>Test page</h1><p>Content</p></body></html>'
      };
      
      const mockAnalysis = {
        score: 85,
        // Missing suggestions and strength
      };
      
      (mockScrapingService.analyzeSEO as jest.Mock).mockResolvedValueOnce(mockAnalysis);
      
      // Act
      const result = await controller.analyzeSEO(seoRequest);
      
      // Assert
      expect(result).toEqual({
        url: 'https://www.example.com',
        analysis: mockAnalysis,
        timestamp: expect.any(String)
      });
    });
  });
});
