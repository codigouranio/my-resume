import { Test, TestingModule } from '@nestjs/testing';
import { EmbeddingProcessor } from './embedding.processor';
import { PrismaService } from '../../shared/database/prisma.service';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bull';

describe('EmbeddingProcessor', () => {
  let processor: EmbeddingProcessor;
  let prisma: PrismaService;

  const mockPrismaService = {
    resume: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    resumeEmbedding: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $executeRaw: jest.fn(),
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
        EmbeddingProcessor,
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

    processor = module.get<EmbeddingProcessor>(EmbeddingProcessor);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleEmbeddingGeneration', () => {
    const mockJob = {
      id: '1',
      data: {
        resumeId: 'resume1',
        type: 'automatic',
      },
      progress: jest.fn(),
    } as unknown as Job;

    const mockResume = {
      id: 'resume1',
      content: 'Python developer with 5 years experience in web development',
      llmContext: 'Additional context about skills and achievements',
    };

    it('should generate embeddings for resume with llmContext', async () => {
      mockPrismaService.resume.findUnique.mockResolvedValue(mockResume);
      mockPrismaService.resumeEmbedding.findUnique.mockResolvedValue(null);

      const mockEmbedding = {
        embedding: Array(768).fill(0.1),
        dimensions: 768,
        model: 'nomic-embed-text',
      };

      jest.spyOn(processor as any, 'generateEmbedding').mockResolvedValue(mockEmbedding);

      const result = await processor.handleEmbeddingGeneration(mockJob);

      expect(result).toBeDefined();
      expect(result.resumeId).toBe('resume1');
      expect(result.hasLlmContext).toBe(true);
      expect(result.dimensions).toBe(768);
      expect(mockJob.progress).toHaveBeenCalledWith(100);
    });

    it('should generate embeddings for resume without llmContext', async () => {
      const resumeWithoutContext = { ...mockResume, llmContext: null };
      mockPrismaService.resume.findUnique.mockResolvedValue(resumeWithoutContext);
      mockPrismaService.resumeEmbedding.findUnique.mockResolvedValue(null);

      const mockEmbedding = {
        embedding: Array(768).fill(0.1),
        dimensions: 768,
        model: 'nomic-embed-text',
      };

      jest.spyOn(processor as any, 'generateEmbedding').mockResolvedValue(mockEmbedding);

      const result = await processor.handleEmbeddingGeneration(mockJob);

      expect(result.hasLlmContext).toBe(false);
    });

    it('should throw error if resume not found', async () => {
      mockPrismaService.resume.findUnique.mockResolvedValue(null);

      await expect(processor.handleEmbeddingGeneration(mockJob)).rejects.toThrow(
        'Resume resume1 not found'
      );
    });

    it('should update existing embedding', async () => {
      mockPrismaService.resume.findUnique.mockResolvedValue(mockResume);
      mockPrismaService.resumeEmbedding.findUnique.mockResolvedValue({
        id: 'embedding1',
        resumeId: 'resume1',
      });

      const mockEmbedding = {
        embedding: Array(768).fill(0.1),
        dimensions: 768,
        model: 'nomic-embed-text',
      };

      jest.spyOn(processor as any, 'generateEmbedding').mockResolvedValue(mockEmbedding);

      await processor.handleEmbeddingGeneration(mockJob);

      expect(mockPrismaService.$executeRaw).toHaveBeenCalled();
    });
  });

  describe('truncateText', () => {
    it('should not truncate text below max length', () => {
      const shortText = 'Short text';
      const result = (processor as any).truncateText(shortText, 6000);
      expect(result).toBe(shortText);
    });

    it('should truncate text above max length', () => {
      const longText = 'a'.repeat(7000);
      const result = (processor as any).truncateText(longText, 6000);
      expect(result).toHaveLength(6000);
    });
  });

  describe('calculateCombinedEmbedding', () => {
    it('should return content embedding if no llmContext', () => {
      const contentEmbedding = [0.5, 0.6, 0.7];
      const result = (processor as any).calculateCombinedEmbedding(contentEmbedding);
      expect(result).toEqual(contentEmbedding);
    });

    it('should calculate weighted average with llmContext', () => {
      const contentEmbedding = [1.0, 0.0, 0.0];
      const llmContextEmbedding = [0.0, 1.0, 0.0];
      const result = (processor as any).calculateCombinedEmbedding(
        contentEmbedding,
        llmContextEmbedding,
        0.7
      );
      
      expect(result[0]).toBeCloseTo(0.7); // 1.0 * 0.7 + 0.0 * 0.3
      expect(result[1]).toBeCloseTo(0.3); // 0.0 * 0.7 + 1.0 * 0.3
      expect(result[2]).toBeCloseTo(0.0); // 0.0 * 0.7 + 0.0 * 0.3
    });
  });

  describe('calculateHash', () => {
    it('should generate consistent MD5 hash', () => {
      const text = 'test content';
      const hash1 = (processor as any).calculateHash(text);
      const hash2 = (processor as any).calculateHash(text);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(32); // MD5 hash length
    });

    it('should generate different hashes for different content', () => {
      const hash1 = (processor as any).calculateHash('content1');
      const hash2 = (processor as any).calculateHash('content2');
      
      expect(hash1).not.toBe(hash2);
    });
  });
});
