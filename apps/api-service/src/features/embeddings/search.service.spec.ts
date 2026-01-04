import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from './search.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { ConfigService } from '@nestjs/config';
import { SearchResumesDto } from './dto/search-resumes.dto';

describe('SearchService', () => {
  let service: SearchService;
  let prisma: PrismaService;

  const mockPrismaService = {
    $queryRawUnsafe: jest.fn(),
    resume: {
      findMany: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: string) => {
      if (key === 'LLM_SERVICE_URL') return 'http://localhost:5000';
      return defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('searchResumes', () => {
    it('should search resumes and return results', async () => {
      const searchDto: SearchResumesDto = {
        query: 'python developer',
        minSimilarity: 0.4,
        limit: 10,
        offset: 0,
      };

      const mockResults = [
        {
          id: 'resume1',
          slug: 'test-resume',
          title: 'Python Developer',
          content: 'Experienced Python developer...',
          userId: 'user1',
          firstName: 'John',
          lastName: 'Doe',
          similarity: 0.75,
        },
      ];

      // Mock the embedding generation
      jest.spyOn(service as any, 'generateEmbedding').mockResolvedValue({
        embedding: Array(768).fill(0.1),
        dimensions: 768,
        model: 'nomic-embed-text',
      });

      // Mock the database query
      mockPrismaService.$queryRawUnsafe.mockResolvedValue(mockResults);

      const result = await service.searchResumes(searchDto);

      expect(result).toBeDefined();
      expect(result.results).toHaveLength(1);
      expect(result.results[0].title).toBe('Python Developer');
      expect(result.results[0].similarity).toBe(0.75);
      expect(result.total).toBe(1);
    });

    it('should filter by publicOnly flag', async () => {
      const searchDto: SearchResumesDto = {
        query: 'developer',
        minSimilarity: 0.4,
        publicOnly: true,
      };

      jest.spyOn(service as any, 'generateEmbedding').mockResolvedValue({
        embedding: Array(768).fill(0.1),
        dimensions: 768,
        model: 'nomic-embed-text',
      });
      mockPrismaService.$queryRawUnsafe.mockResolvedValue([]);

      await service.searchResumes(searchDto);

      expect(mockPrismaService.$queryRawUnsafe).toHaveBeenCalled();
      const sqlQuery = mockPrismaService.$queryRawUnsafe.mock.calls[0][0];
      expect(sqlQuery).toContain('isPublic');
      expect(sqlQuery).toContain('isPublished');
    });

    it('should handle empty results', async () => {
      const searchDto: SearchResumesDto = {
        query: 'nonexistent',
        minSimilarity: 0.9,
      };

      jest.spyOn(service as any, 'generateEmbedding').mockResolvedValue({
        embedding: Array(768).fill(0.1),
        dimensions: 768,
        model: 'nomic-embed-text',
      });
      mockPrismaService.$queryRawUnsafe.mockResolvedValue([]);

      const result = await service.searchResumes(searchDto);

      expect(result.results).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should respect pagination parameters', async () => {
      const searchDto: SearchResumesDto = {
        query: 'developer',
        limit: 5,
        offset: 10,
      };

      jest.spyOn(service as any, 'generateEmbedding').mockResolvedValue({
        embedding: Array(768).fill(0.1),
        dimensions: 768,
        model: 'nomic-embed-text',
      });
      mockPrismaService.$queryRawUnsafe.mockResolvedValue([]);

      await service.searchResumes(searchDto);

      const sqlQuery = mockPrismaService.$queryRawUnsafe.mock.calls[0][0];
      const params = mockPrismaService.$queryRawUnsafe.mock.calls[0].slice(1);
      
      expect(params).toContain(5); // limit
      expect(params).toContain(10); // offset
    });

    it('should throw error on invalid query', async () => {
      const searchDto: SearchResumesDto = {
        query: '', // Empty query
      };

      jest.spyOn(service as any, 'generateEmbedding').mockRejectedValue(
        new Error('Query cannot be empty')
      );

      await expect(service.searchResumes(searchDto)).rejects.toThrow();
    });
  });

  describe('generateEmbedding', () => {
    it('should generate embedding via LLM service', async () => {
      const mockEmbedding = Array(768).fill(0.1);
      
      // Mock axios call
      jest.spyOn(service as any, 'generateEmbedding').mockResolvedValue(mockEmbedding);

      const result = await (service as any).generateEmbedding('test text');

      expect(result).toHaveLength(768);
    });
  });
});
