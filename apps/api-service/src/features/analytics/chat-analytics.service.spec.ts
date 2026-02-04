import { Test, TestingModule } from '@nestjs/testing';
import { ChatAnalyticsService } from './chat-analytics.service';
import { PrismaService } from '@shared/database/prisma.service';

describe('ChatAnalyticsService', () => {
  let service: ChatAnalyticsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatAnalyticsService,
        {
          provide: PrismaService,
          useValue: {
            chatInteraction: {
              findMany: jest.fn(),
              count: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<ChatAnalyticsService>(ChatAnalyticsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getSummaryStats', () => {
    it('should return valid stats when interactions exist', async () => {
      const mockInteractions = [
        {
          resumeId: 'resume-1',
          sessionId: 'session-1',
          sentiment: 'POSITIVE',
          responseTime: 1000,
          createdAt: new Date(),
        },
        {
          resumeId: 'resume-1',
          sessionId: 'session-1',
          sentiment: 'NEUTRAL',
          responseTime: 1500,
          createdAt: new Date(),
        },
        {
          resumeId: 'resume-1',
          sessionId: 'session-2',
          sentiment: 'NEGATIVE',
          responseTime: 2000,
          createdAt: new Date(),
        },
      ];

      (prisma.chatInteraction.findMany as jest.Mock).mockResolvedValue(
        mockInteractions,
      );

      const result = await service.getSummaryStats('resume-1', 30);

      expect(result).toBeDefined();
      expect(result.totalQuestions).toBe(3);
      expect(result.uniqueSessions).toBe(2);
      expect(result.avgResponseTime).toBe(1500); // (1000+1500+2000)/3
      expect(result.sentimentBreakdown.positive).toBe(1);
      expect(result.sentimentBreakdown.neutral).toBe(1);
      expect(result.sentimentBreakdown.negative).toBe(1);
      expect(result.successRate).toBeCloseTo(66.67, 1); // (1+1)/3 * 100
    });

    it('should handle zero interactions without crashing', async () => {
      (prisma.chatInteraction.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getSummaryStats('resume-1', 30);

      expect(result).toBeDefined();
      expect(result.totalQuestions).toBe(0);
      expect(result.uniqueSessions).toBe(0);
      expect(result.avgResponseTime).toBe(0); // Should be 0, not NaN
      expect(result.sentimentBreakdown.positive).toBe(0);
      expect(result.sentimentBreakdown.neutral).toBe(0);
      expect(result.sentimentBreakdown.negative).toBe(0);
      expect(result.successRate).toBe(0); // Should be 0, not NaN
      expect(Number.isNaN(result.avgResponseTime)).toBe(false); // Verify no NaN
    });

    it('should calculate correct average response time', async () => {
      const mockInteractions = [
        {
          resumeId: 'resume-1',
          sessionId: 'session-1',
          sentiment: 'POSITIVE',
          responseTime: 500,
          createdAt: new Date(),
        },
        {
          resumeId: 'resume-1',
          sessionId: 'session-2',
          sentiment: 'POSITIVE',
          responseTime: 1500,
          createdAt: new Date(),
        },
      ];

      (prisma.chatInteraction.findMany as jest.Mock).mockResolvedValue(
        mockInteractions,
      );

      const result = await service.getSummaryStats('resume-1', 30);

      expect(result.avgResponseTime).toBe(1000); // (500 + 1500) / 2
    });

    it('should handle null responseTime values', async () => {
      const mockInteractions = [
        {
          resumeId: 'resume-1',
          sessionId: 'session-1',
          sentiment: 'POSITIVE',
          responseTime: null,
          createdAt: new Date(),
        },
        {
          resumeId: 'resume-1',
          sessionId: 'session-2',
          sentiment: 'POSITIVE',
          responseTime: 1000,
          createdAt: new Date(),
        },
      ];

      (prisma.chatInteraction.findMany as jest.Mock).mockResolvedValue(
        mockInteractions,
      );

      const result = await service.getSummaryStats('resume-1', 30);

      expect(result.avgResponseTime).toBe(500); // (0 + 1000) / 2
      expect(Number.isNaN(result.avgResponseTime)).toBe(false);
    });

    it('should calculate correct success rate', async () => {
      const mockInteractions = [
        {
          resumeId: 'resume-1',
          sessionId: 'session-1',
          sentiment: 'POSITIVE',
          responseTime: 1000,
          createdAt: new Date(),
        },
        {
          resumeId: 'resume-1',
          sessionId: 'session-2',
          sentiment: 'POSITIVE',
          responseTime: 1000,
          createdAt: new Date(),
        },
        {
          resumeId: 'resume-1',
          sessionId: 'session-3',
          sentiment: 'NEGATIVE',
          responseTime: 1000,
          createdAt: new Date(),
        },
        {
          resumeId: 'resume-1',
          sessionId: 'session-4',
          sentiment: 'NEUTRAL',
          responseTime: 1000,
          createdAt: new Date(),
        },
      ];

      (prisma.chatInteraction.findMany as jest.Mock).mockResolvedValue(
        mockInteractions,
      );

      const result = await service.getSummaryStats('resume-1', 30);

      expect(result.successRate).toBe(75); // (2 positive + 1 neutral) / 4 * 100
    });

    it('should count unique sessions correctly', async () => {
      const mockInteractions = [
        {
          resumeId: 'resume-1',
          sessionId: 'session-1',
          sentiment: 'POSITIVE',
          responseTime: 1000,
          createdAt: new Date(),
        },
        {
          resumeId: 'resume-1',
          sessionId: 'session-1', // Same session
          sentiment: 'POSITIVE',
          responseTime: 1000,
          createdAt: new Date(),
        },
        {
          resumeId: 'resume-1',
          sessionId: 'session-2',
          sentiment: 'POSITIVE',
          responseTime: 1000,
          createdAt: new Date(),
        },
        {
          resumeId: 'resume-1',
          sessionId: null, // No session ID
          sentiment: 'POSITIVE',
          responseTime: 1000,
          createdAt: new Date(),
        },
      ];

      (prisma.chatInteraction.findMany as jest.Mock).mockResolvedValue(
        mockInteractions,
      );

      const result = await service.getSummaryStats('resume-1', 30);

      expect(result.uniqueSessions).toBe(2); // Only session-1 and session-2
    });
  });

  describe('getChatInteractions', () => {
    it('should return chat interactions', async () => {
      const mockInteractions = [
        {
          id: '1',
          resumeId: 'resume-1',
          question: 'What is your experience?',
          answer: 'I have 5 years of experience',
          sentiment: 'POSITIVE',
          createdAt: new Date(),
        },
      ];

      (prisma.chatInteraction.findMany as jest.Mock).mockResolvedValue(
        mockInteractions,
      );

      const result = await service.getChatInteractions('resume-1');

      expect(result).toEqual(mockInteractions);
      expect(prisma.chatInteraction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { resumeId: 'resume-1' },
          take: 100,
        }),
      );
    });

    it('should filter by sentiment', async () => {
      const mockInteractions = [
        {
          id: '1',
          resumeId: 'resume-1',
          sentiment: 'POSITIVE',
        },
      ];

      (prisma.chatInteraction.findMany as jest.Mock).mockResolvedValue(
        mockInteractions,
      );

      await service.getChatInteractions('resume-1', undefined, undefined, 'POSITIVE');

      expect(prisma.chatInteraction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            sentiment: 'POSITIVE',
          }),
        }),
      );
    });
  });

  describe('getTrendData', () => {
    it('should return empty array for zero interactions', async () => {
      (prisma.chatInteraction.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getTrendData('resume-1', 'daily');

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    it('should aggregate interactions by date', async () => {
      const today = new Date();
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

      const mockInteractions = [
        {
          resumeId: 'resume-1',
          sentiment: 'POSITIVE',
          createdAt: today,
        },
        {
          resumeId: 'resume-1',
          sentiment: 'NEGATIVE',
          createdAt: today,
        },
        {
          resumeId: 'resume-1',
          sentiment: 'POSITIVE',
          createdAt: yesterday,
        },
      ];

      (prisma.chatInteraction.findMany as jest.Mock).mockResolvedValue(
        mockInteractions,
      );

      const result = await service.getTrendData('resume-1', 'daily');

      expect(result.length).toBe(2);
      // Results should be sorted by date
      expect(result[0].total).toBeGreaterThanOrEqual(1);
    });
  });
});
