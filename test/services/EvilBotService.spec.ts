import { Test, TestingModule } from '@nestjs/testing';
import { EvilBotService, Decision } from '../../src/services/EvilBotService';
import { AIGateway } from '../../src/services/AIGateway';
import { MockLogger } from '../test-utils';

describe('EvilBotService', () => {
  let service: EvilBotService;
  let mockAIGateway: jest.Mocked<AIGateway>;
  let mockLogger: MockLogger;

  beforeEach(async () => {
    mockAIGateway = {
      processAIRequest: jest.fn()
    } as unknown as jest.Mocked<AIGateway>;

    mockLogger = new MockLogger();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EvilBotService,
        {
          provide: AIGateway,
          useValue: mockAIGateway
        }
      ],
    }).compile();

    service = module.get<EvilBotService>(EvilBotService);
    // @ts-ignore - Replace the logger with our mock
    service['logger'] = mockLogger;
  });

  afterEach(() => {
    mockLogger.clear();
    jest.clearAllMocks();
  });

  describe('makeDecision', () => {
    it('should handle valid JSON response correctly', async () => {
      // Arrange
      const situation = 'Käyttäjä selaa tuotesivua';
      const options = ['Näytä alennustarra', 'Ehdota lisätuotteita'];
      
      const mockAIResponse = `
      {
        "action": "Ehdota lisätuotteita",
        "reason": "Lisätuotteet kasvattavat keskiostosta",
        "confidence": 0.85
      }`;
      
      (mockAIGateway.processAIRequest as jest.Mock).mockResolvedValueOnce(mockAIResponse);
      
      // Act
      const result = await service.makeDecision(situation, options);
      
      // Assert
      expect(result).toEqual({
        action: 'Ehdota lisätuotteita',
        reason: 'Lisätuotteet kasvattavat keskiostosta',
        confidence: 0.85
      });
      
      expect(mockAIGateway.processAIRequest).toHaveBeenCalledWith('decision', expect.stringContaining(situation));
      expect(mockAIGateway.processAIRequest).toHaveBeenCalledWith('decision', expect.stringContaining(options[0]));
      expect(mockAIGateway.processAIRequest).toHaveBeenCalledWith('decision', expect.stringContaining(options[1]));
    });
    
    it('should handle markdown code block in response', async () => {
      // Arrange
      const situation = 'Käyttäjä on lisännyt tuotteen ostoskoriin';
      const options = ['Ehdota kassalle siirtymistä', 'Näytä suositeltuja tuotteita'];
      
      const mockAIResponse = `
      Tässä on päätös:
      
      \`\`\`json
      {
        "action": "Näytä suositeltuja tuotteita",
        "reason": "Suositukset kasvattavat myyntiä",
        "confidence": 0.9
      }
      \`\`\`
      `;
      
      (mockAIGateway.processAIRequest as jest.Mock).mockResolvedValueOnce(mockAIResponse);
      
      // Act
      const result = await service.makeDecision(situation, options);
      
      // Assert
      expect(result).toEqual({
        action: 'Näytä suositeltuja tuotteita',
        reason: 'Suositukset kasvattavat myyntiä',
        confidence: 0.9
      });
    });
    
    it('should extract JSON from mixed text response', async () => {
      // Arrange
      const situation = 'Käyttäjä on poistunut sivustolta';
      const options = ['Lähetä sähköposti', 'Näytä ilmoitus seuraavalla käynnillä'];
      
      const mockAIResponse = `
      Analysoituani tilanteen, päädyin seuraavaan päätökseen:
      
      {
        "action": "Lähetä sähköposti",
        "reason": "Sähköposti on henkilökohtaisempi",
        "confidence": 0.75
      }
      
      Toivottavasti tämä auttaa päätöksenteossa!
      `;
      
      (mockAIGateway.processAIRequest as jest.Mock).mockResolvedValueOnce(mockAIResponse);
      
      // Act
      const result = await service.makeDecision(situation, options);
      
      // Assert
      expect(result).toEqual({
        action: 'Lähetä sähköposti',
        reason: 'Sähköposti on henkilökohtaisempi',
        confidence: 0.75
      });
      
      expect(mockLogger.logs.warn).toContainEqual(expect.stringContaining('JSON-jäsennys epäonnistui'));
    });
    
    it('should handle invalid JSON by returning default values', async () => {
      // Arrange
      const situation = 'Käyttäjä selailee blogeja';
      const options = ['Ehdota artikkeleja', 'Pyydä tilaamaan uutiskirje'];
      
      const mockAIResponse = `
      Paras toiminto olisi ehdottaa artikkeleja, koska ne voivat herättää lisää kiinnostusta.
      `;
      
      (mockAIGateway.processAIRequest as jest.Mock).mockResolvedValueOnce(mockAIResponse);
      
      // Act
      const result = await service.makeDecision(situation, options);
      
      // Assert
      expect(result).toEqual({
        action: 'Virhe päätöksenteossa',
        reason: 'AI-malli ei tuottanut validia JSON-vastausta',
        confidence: 0
      });
      
      expect(mockLogger.logs.error).toContainEqual(expect.stringContaining('Vastauksen jäsennys epäonnistui'));
    });
    
    it('should handle AI service errors', async () => {
      // Arrange
      const situation = 'Käyttäjä on poistunut sivustolta';
      const options = ['Lähetä sähköposti', 'Näytä ilmoitus seuraavalla käynnillä'];
      
      const mockError = new Error('AI-palvelu ei vastaa');
      (mockAIGateway.processAIRequest as jest.Mock).mockRejectedValueOnce(mockError);
      
      // Act
      const result = await service.makeDecision(situation, options);
      
      // Assert
      expect(result).toEqual({
        action: 'Virhe',
        reason: 'Päätöksenteko epäonnistui: AI-palvelu ei vastaa',
        confidence: 0
      });
      
      expect(mockLogger.logs.error).toContainEqual(expect.stringContaining('Päätöksenteko epäonnistui'));
    });
    
    it('should validate situation parameter', async () => {
      // Arrange
      const invalidSituation = undefined;
      const options = ['Vaihtoehto 1', 'Vaihtoehto 2'];
      
      // Act
      const result = await service.makeDecision(invalidSituation as any, options);
      
      // Assert
      expect(result).toEqual({
        action: 'Virhe',
        reason: 'Virheellinen syöte: tilanne on määrittelemätön tai tyypiltään väärä',
        confidence: 0
      });
      
      expect(mockLogger.logs.error).toContainEqual('Virheellinen syöte: tilanne on määrittelemätön tai tyypiltään väärä');
      expect(mockAIGateway.processAIRequest).not.toHaveBeenCalled();
    });
    
    it('should validate options parameter', async () => {
      // Arrange
      const situation = 'Käyttäjä on sivustolla';
      const invalidOptions = [];
      
      // Act
      const result = await service.makeDecision(situation, invalidOptions);
      
      // Assert
      expect(result).toEqual({
        action: 'Virhe',
        reason: 'Virheellinen syöte: vaihtoehdot puuttuvat tai eivät ole kelvollinen lista',
        confidence: 0
      });
      
      expect(mockLogger.logs.error).toContainEqual('Virheellinen syöte: vaihtoehdot puuttuvat tai eivät ole kelvollinen lista');
      expect(mockAIGateway.processAIRequest).not.toHaveBeenCalled();
    });
    
    it('should handle object responses directly from AI gateway', async () => {
      // Arrange
      const situation = 'Käyttäjä on ostoskorissa';
      const options = ['Ehdota lisäostoksia', 'Ohjaa kassalle'];
      
      const mockResponse = {
        action: 'Ohjaa kassalle',
        reason: 'Käyttäjä on valmis ostamaan',
        confidence: 0.95
      };
      
      (mockAIGateway.processAIRequest as jest.Mock).mockResolvedValueOnce(mockResponse);
      
      // Act
      const result = await service.makeDecision(situation, options);
      
      // Assert
      expect(result).toEqual({
        action: 'Ohjaa kassalle',
        reason: 'Käyttäjä on valmis ostamaan',
        confidence: 0.95
      });
    });
    
    it('should clamp confidence values to range 0-1', async () => {
      // Arrange
      const situation = 'Käyttäjä lukee artikkelia';
      const options = ['Näytä lisää artikkeleita', 'Ehdota uutiskirjettä'];
      
      const mockResponse = {
        action: 'Näytä lisää artikkeleita',
        reason: 'Käyttäjä on kiinnostunut sisällöstä',
        confidence: 1.5 // Yli sallitun maksimin
      };
      
      (mockAIGateway.processAIRequest as jest.Mock).mockResolvedValueOnce(mockResponse);
      
      // Act
      const result = await service.makeDecision(situation, options);
      
      // Assert
      expect(result.confidence).toBe(1.0); // Rajoitettu maksimiin
    });
  });
});
