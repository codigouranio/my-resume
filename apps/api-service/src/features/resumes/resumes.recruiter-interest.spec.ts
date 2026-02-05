import { Test, TestingModule } from '@nestjs/testing';
import { ResumesService } from './resumes.service';
import { PrismaService } from '@shared/database/prisma.service';
import { EmailService } from '@shared/email/email.service';
import { EmbeddingQueueService } from '../embeddings/embedding-queue.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { CreateRecruiterInterestDto } from './dto/create-recruiter-interest.dto';

describe('ResumesService - Recruiter Interest', () => {
  let service: ResumesService;
  let prisma: PrismaService;
  let emailService: EmailService;

  const mockUser = {
    id: 'user-1',
    email: 'john@example.com',
    firstName: 'John',
  };

  const mockResume = {
    id: 'resume-1',
    slug: 'john-doe',
    title: 'My Resume',
    content: 'Resume content',
    llmContext: 'LLM context',
    isPublic: true,
    isPublished: true,
    userId: mockUser.id,
    user: mockUser,
  };

  const mockRecruiterInterestDto: CreateRecruiterInterestDto = {
    resumeSlug: 'john-doe',
    name: 'Jane Recruiter',
    email: 'jane@company.com',
    company: 'Tech Corp',
    message: 'We are interested in your profile for a Senior Engineer role.',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResumesService,
        {
          provide: PrismaService,
          useValue: {
            resume: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            recruiterInterest: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
              count: jest.fn(),
            },
          },
        },
        {
          provide: EmailService,
          useValue: {
            sendRecruiterInterestEmail: jest.fn(),
            sendWelcomeEmail: jest.fn(),
            sendPasswordResetEmail: jest.fn(),
            sendVerificationEmail: jest.fn(),
            sendEmail: jest.fn(),
            sendSubdomainSetEmail: jest.fn(),
          },
        },
        {
          provide: EmbeddingQueueService,
          useValue: {
            addJob: jest.fn(),
            processQueue: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ResumesService>(ResumesService);
    prisma = module.get<PrismaService>(PrismaService);
    emailService = module.get<EmailService>(EmailService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createRecruiterInterest', () => {
    it('should successfully create recruiter interest and send email', async () => {
      const mockRecruiterInterest = {
        id: 'interest-1',
        resumeId: mockResume.id,
        name: mockRecruiterInterestDto.name,
        email: mockRecruiterInterestDto.email,
        company: mockRecruiterInterestDto.company,
        message: mockRecruiterInterestDto.message,
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
        respondedAt: null,
      };

      (prisma.resume.findUnique as jest.Mock).mockResolvedValue(mockResume);
      (prisma.recruiterInterest.create as jest.Mock).mockResolvedValue(
        mockRecruiterInterest,
      );
      (emailService.sendRecruiterInterestEmail as jest.Mock).mockResolvedValue(
        undefined,
      );

      const result = await service.createRecruiterInterest(
        mockRecruiterInterestDto,
      );

      expect(result).toEqual(mockRecruiterInterest);
      expect(prisma.resume.findUnique).toHaveBeenCalledWith({
        where: { slug: mockRecruiterInterestDto.resumeSlug },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
            },
          },
        },
      });
      expect(prisma.recruiterInterest.create).toHaveBeenCalledWith({
        data: {
          resumeId: mockResume.id,
          name: mockRecruiterInterestDto.name,
          email: mockRecruiterInterestDto.email,
          company: mockRecruiterInterestDto.company,
          message: mockRecruiterInterestDto.message,
        },
      });
      expect(emailService.sendRecruiterInterestEmail).toHaveBeenCalledWith(
        mockUser.email,
        mockUser.firstName,
        mockRecruiterInterestDto.name,
        mockRecruiterInterestDto.company,
        mockRecruiterInterestDto.message,
        mockResume.title,
      );
    });

    it('should throw NotFoundException when resume slug does not exist', async () => {
      (prisma.resume.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.createRecruiterInterest(mockRecruiterInterestDto),
      ).rejects.toThrow(NotFoundException);
      expect(emailService.sendRecruiterInterestEmail).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when resume is not public', async () => {
      const privateResume = { ...mockResume, isPublic: false };
      (prisma.resume.findUnique as jest.Mock).mockResolvedValue(privateResume);

      await expect(
        service.createRecruiterInterest(mockRecruiterInterestDto),
      ).rejects.toThrow(NotFoundException);
      expect(emailService.sendRecruiterInterestEmail).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when resume is not published', async () => {
      const unpublishedResume = { ...mockResume, isPublished: false };
      (prisma.resume.findUnique as jest.Mock).mockResolvedValue(
        unpublishedResume,
      );

      await expect(
        service.createRecruiterInterest(mockRecruiterInterestDto),
      ).rejects.toThrow(NotFoundException);
      expect(emailService.sendRecruiterInterestEmail).not.toHaveBeenCalled();
    });

    it('should create recruiter interest even if email sending fails', async () => {
      const mockRecruiterInterest = {
        id: 'interest-1',
        resumeId: mockResume.id,
        name: mockRecruiterInterestDto.name,
        email: mockRecruiterInterestDto.email,
        company: mockRecruiterInterestDto.company,
        message: mockRecruiterInterestDto.message,
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
        respondedAt: null,
      };

      const emailError = new Error('Email service unavailable');
      (prisma.resume.findUnique as jest.Mock).mockResolvedValue(mockResume);
      (prisma.recruiterInterest.create as jest.Mock).mockResolvedValue(
        mockRecruiterInterest,
      );
      (emailService.sendRecruiterInterestEmail as jest.Mock).mockRejectedValue(
        emailError,
      );

      const result = await service.createRecruiterInterest(
        mockRecruiterInterestDto,
      );

      expect(result).toEqual(mockRecruiterInterest);
      expect(emailService.sendRecruiterInterestEmail).toHaveBeenCalled();
    });

    it('should handle empty company field', async () => {
      const dtoWithoutCompany: CreateRecruiterInterestDto = {
        ...mockRecruiterInterestDto,
        company: undefined,
      };

      const mockRecruiterInterest = {
        id: 'interest-1',
        resumeId: mockResume.id,
        name: dtoWithoutCompany.name,
        email: dtoWithoutCompany.email,
        company: dtoWithoutCompany.company,
        message: dtoWithoutCompany.message,
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
        respondedAt: null,
      };

      (prisma.resume.findUnique as jest.Mock).mockResolvedValue(mockResume);
      (prisma.recruiterInterest.create as jest.Mock).mockResolvedValue(
        mockRecruiterInterest,
      );
      (emailService.sendRecruiterInterestEmail as jest.Mock).mockResolvedValue(
        undefined,
      );

      const result = await service.createRecruiterInterest(dtoWithoutCompany);

      expect(result).toEqual(mockRecruiterInterest);
      expect(emailService.sendRecruiterInterestEmail).toHaveBeenCalledWith(
        mockUser.email,
        mockUser.firstName,
        dtoWithoutCompany.name,
        undefined,
        dtoWithoutCompany.message,
        mockResume.title,
      );
    });

    it('should send email with correct resume information', async () => {
      const customResume = {
        ...mockResume,
        title: 'Custom Resume Title',
      };

      const mockRecruiterInterest = {
        id: 'interest-1',
        resumeId: customResume.id,
        name: mockRecruiterInterestDto.name,
        email: mockRecruiterInterestDto.email,
        company: mockRecruiterInterestDto.company,
        message: mockRecruiterInterestDto.message,
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
        respondedAt: null,
      };

      (prisma.resume.findUnique as jest.Mock).mockResolvedValue(customResume);
      (prisma.recruiterInterest.create as jest.Mock).mockResolvedValue(
        mockRecruiterInterest,
      );
      (emailService.sendRecruiterInterestEmail as jest.Mock).mockResolvedValue(
        undefined,
      );

      await service.createRecruiterInterest(mockRecruiterInterestDto);

      expect(emailService.sendRecruiterInterestEmail).toHaveBeenCalledWith(
        mockUser.email,
        mockUser.firstName,
        mockRecruiterInterestDto.name,
        mockRecruiterInterestDto.company,
        mockRecruiterInterestDto.message,
        'Custom Resume Title',
      );
    });
  });

  describe('getRecruiterInterests', () => {
    it('should retrieve all recruiter interests for a user', async () => {
      const mockInterests = [
        {
          id: 'interest-1',
          resumeId: 'resume-1',
          name: 'Jane Recruiter',
          email: 'jane@company.com',
          company: 'Tech Corp',
          message: 'Interested in your profile',
          status: 'PENDING',
          isRead: false,
          isFavorite: false,
          createdAt: new Date(),
          deletedAt: null,
          resume: {
            id: mockResume.id,
            slug: 'john-doe',
            title: 'My Resume',
          },
        },
        {
          id: 'interest-2',
          resumeId: 'resume-1',
          name: 'Bob Recruiter',
          email: 'bob@other.com',
          company: 'Another Corp',
          message: 'Great resume!',
          status: 'PENDING',
          isRead: false,
          isFavorite: false,
          createdAt: new Date(),
          deletedAt: null,
          resume: {
            id: mockResume.id,
            slug: 'john-doe',
            title: 'My Resume',
          },
        },
      ];

      (prisma.resume.findMany as jest.Mock).mockResolvedValue([
        { id: mockResume.id },
      ]);
      (prisma.recruiterInterest.findMany as jest.Mock).mockResolvedValue(
        mockInterests,
      );

      const result = await service.getRecruiterInterests(mockUser.id);

      expect(result).toEqual(mockInterests);
      expect(prisma.resume.findMany).toHaveBeenCalledWith({
        where: { userId: mockUser.id },
        select: { id: true },
      });
      expect(prisma.recruiterInterest.findMany).toHaveBeenCalledWith({
        where: {
          resumeId: { in: [mockResume.id] },
          deletedAt: null,
        },
        include: {
          resume: {
            select: {
              id: true,
              slug: true,
              title: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    });

    it('should return empty array when user has no resumes', async () => {
      (prisma.resume.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.recruiterInterest.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getRecruiterInterests(mockUser.id);

      expect(result).toEqual([]);
      expect(prisma.recruiterInterest.findMany).toHaveBeenCalledWith({
        where: {
          resumeId: { in: [] },
          deletedAt: null,
        },
        include: {
          resume: {
            select: {
              id: true,
              slug: true,
              title: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    });
  });

  describe('markInterestAsRead', () => {
    it('should mark recruiter interest as read', async () => {
      const mockInterest = {
        id: 'interest-1',
        resumeId: mockResume.id,
        name: 'Jane Recruiter',
        email: 'jane@company.com',
        company: 'Tech Corp',
        message: 'Interested',
        isRead: true,
        isFavorite: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        resume: mockResume,
      };

      (prisma.recruiterInterest.findUnique as jest.Mock).mockResolvedValue({
        ...mockInterest,
        isRead: false,
      });
      (prisma.recruiterInterest.update as jest.Mock).mockResolvedValue(
        mockInterest,
      );

      const result = await service.markInterestAsRead('interest-1', mockUser.id);

      expect(result).toEqual(mockInterest);
      expect(prisma.recruiterInterest.findUnique).toHaveBeenCalledWith({
        where: { id: 'interest-1' },
        include: { resume: true },
      });
      expect(prisma.recruiterInterest.update).toHaveBeenCalledWith({
        where: { id: 'interest-1' },
        data: { isRead: true },
      });
    });

    it('should throw NotFoundException when interest does not exist', async () => {
      (prisma.recruiterInterest.findUnique as jest.Mock).mockResolvedValue(
        null,
      );

      await expect(
        service.markInterestAsRead('nonexistent', mockUser.id),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user does not own the resume', async () => {
      const mockInterest = {
        id: 'interest-1',
        resumeId: mockResume.id,
        name: 'Jane Recruiter',
        email: 'jane@company.com',
        company: 'Tech Corp',
        message: 'Interested',
        isRead: false,
        resume: {
          userId: 'other-user-id',
        },
      };

      (prisma.recruiterInterest.findUnique as jest.Mock).mockResolvedValue(
        mockInterest,
      );

      await expect(
        service.markInterestAsRead('interest-1', mockUser.id),
      ).rejects.toThrow();
    });
  });

  describe('deleteInterest', () => {
    it('should soft delete recruiter interest', async () => {
      const mockInterest = {
        id: 'interest-1',
        resumeId: mockResume.id,
        name: 'Jane Recruiter',
        email: 'jane@company.com',
        company: 'Tech Corp',
        message: 'Interested',
        isRead: false,
        isFavorite: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: new Date(),
        resume: mockResume,
      };

      (prisma.recruiterInterest.findUnique as jest.Mock).mockResolvedValue({
        ...mockInterest,
        deletedAt: null,
      });
      (prisma.recruiterInterest.update as jest.Mock).mockResolvedValue(
        mockInterest,
      );

      const result = await service.deleteInterest('interest-1', mockUser.id);

      expect(result).toEqual(mockInterest);
      expect(prisma.recruiterInterest.update).toHaveBeenCalledWith({
        where: { id: 'interest-1' },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('should throw ForbiddenException when user does not own the resume', async () => {
      const mockInterest = {
        id: 'interest-1',
        resumeId: mockResume.id,
        name: 'Jane Recruiter',
        email: 'jane@company.com',
        company: 'Tech Corp',
        message: 'Interested',
        isRead: false,
        resume: {
          userId: 'other-user-id',
        },
      };

      (prisma.recruiterInterest.findUnique as jest.Mock).mockResolvedValue(
        mockInterest,
      );

      await expect(
        service.deleteInterest('interest-1', mockUser.id),
      ).rejects.toThrow();
    });
  });

  describe('toggleFavorite', () => {
    it('should toggle recruiter interest favorite status', async () => {
      const mockInterest = {
        id: 'interest-1',
        resumeId: mockResume.id,
        name: 'Jane Recruiter',
        email: 'jane@company.com',
        company: 'Tech Corp',
        message: 'Interested',
        isRead: true,
        isFavorite: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        resume: mockResume,
      };

      (prisma.recruiterInterest.findUnique as jest.Mock).mockResolvedValue({
        ...mockInterest,
        isFavorite: false,
      });
      (prisma.recruiterInterest.update as jest.Mock).mockResolvedValue(
        mockInterest,
      );

      const result = await service.toggleFavorite('interest-1', mockUser.id);

      expect(result).toEqual(mockInterest);
      expect(prisma.recruiterInterest.update).toHaveBeenCalledWith({
        where: { id: 'interest-1' },
        data: { isFavorite: true },
      });
    });

    it('should toggle favorite from true to false', async () => {
      const mockInterest = {
        id: 'interest-1',
        resumeId: mockResume.id,
        name: 'Jane Recruiter',
        email: 'jane@company.com',
        company: 'Tech Corp',
        message: 'Interested',
        isRead: true,
        isFavorite: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        resume: mockResume,
      };

      (prisma.recruiterInterest.findUnique as jest.Mock).mockResolvedValue({
        ...mockInterest,
        isFavorite: true,
      });
      (prisma.recruiterInterest.update as jest.Mock).mockResolvedValue(
        mockInterest,
      );

      const result = await service.toggleFavorite('interest-1', mockUser.id);

      expect(result).toEqual(mockInterest);
      expect(prisma.recruiterInterest.update).toHaveBeenCalledWith({
        where: { id: 'interest-1' },
        data: { isFavorite: false },
      });
    });
  });
});
