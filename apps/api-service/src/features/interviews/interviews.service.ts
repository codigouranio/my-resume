import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@shared/database/prisma.service';
import { CreateInterviewDto, UpdateInterviewDto, CreateTimelineEntryDto, InterviewStatus } from './dto/interview.dto';

@Injectable()
export class InterviewsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateInterviewDto) {
    return this.prisma.interviewProcess.create({
      data: {
        userId,
        company: dto.company,
        position: dto.position,
        jobUrl: dto.jobUrl,
        description: dto.description,
        status: dto.status || InterviewStatus.APPLIED,
        skillTags: dto.skillTags || [],
        resumeId: dto.resumeId,
        recruiterName: dto.recruiterName,
        recruiterEmail: dto.recruiterEmail,
        recruiterPhone: dto.recruiterPhone,
        recruiterLinks: dto.recruiterLinks || [],
        appliedAt: dto.appliedAt ? new Date(dto.appliedAt) : new Date(),
      },
      include: {
        resume: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
    });
  }

  async findAll(userId: string, filters?: {
    status?: InterviewStatus;
    company?: string;
    archived?: boolean;
  }) {
    const where: any = {
      userId,
    };

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.company) {
      where.company = {
        contains: filters.company,
        mode: 'insensitive',
     };
    }

    if (filters?.archived !== undefined) {
      where.archivedAt = filters.archived ? { not: null } : null;
    } else {
      // By default, exclude archived
      where.archivedAt = null;
    }

    return this.prisma.interviewProcess.findMany({
      where,
      include: {
        resume: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
        timeline: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1, // Just get the latest entry for list view
        },
      },
      orderBy: {
        appliedAt: 'desc',
      },
    });
  }

  async findOne(id: string, userId: string) {
    const interview = await this.prisma.interviewProcess.findFirst({
      where: { id, userId },
      include: {
        resume: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
        timeline: {
          orderBy: {
            createdAt: 'asc',
          },
        },
        reminders: {
          where: {
            completed: false,
          },
          orderBy: {
            dueAt: 'asc',
          },
        },
      },
    });

    if (!interview) {
      throw new NotFoundException('Interview not found');
    }

    return interview;
  }

  async update(id: string, userId: string, dto: UpdateInterviewDto) {
    const interview = await this.prisma.interviewProcess.findFirst({
      where: { id, userId },
    });

    if (!interview) {
      throw new NotFoundException('Interview not found');
    }

    return this.prisma.interviewProcess.update({
      where: { id },
      data: {
        company: dto.company,
        position: dto.position,
        jobUrl: dto.jobUrl,
        description: dto.description,
        status: dto.status,
        skillTags: dto.skillTags,
        resumeId: dto.resumeId,
        recruiterName: dto.recruiterName,
        recruiterEmail: dto.recruiterEmail,
        recruiterPhone: dto.recruiterPhone,
        recruiterLinks: dto.recruiterLinks,
        appliedAt: dto.appliedAt ? new Date(dto.appliedAt) : undefined,
      },
      include: {
        resume: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
    });
  }

  async remove(id: string, userId: string) {
    const interview = await this.prisma.interviewProcess.findFirst({
      where: { id, userId },
    });

    if (!interview) {
      throw new NotFoundException('Interview not found');
    }

    return this.prisma.interviewProcess.delete({
      where: { id },
    });
  }

  async archive(id: string, userId: string) {
    const interview = await this.prisma.interviewProcess.findFirst({
      where: { id, userId },
    });

    if (!interview) {
      throw new NotFoundException('Interview not found');
    }

    return this.prisma.interviewProcess.update({
      where: { id },
      data: {
        archivedAt: new Date(),
      },
    });
  }

  async unarchive(id: string, userId: string) {
    const interview = await this.prisma.interviewProcess.findFirst({
      where: { id, userId },
    });

    if (!interview) {
      throw new NotFoundException('Interview not found');
    }

    return this.prisma.interviewProcess.update({
      where: { id },
      data: {
        archivedAt: null,
      },
    });
  }

  // Timeline methods
  async addTimelineEntry(interviewId: string, userId: string, dto: CreateTimelineEntryDto) {
    // Verify ownership
    const interview = await this.prisma.interviewProcess.findFirst({
      where: { id: interviewId, userId },
    });

    if (!interview) {
      throw new NotFoundException('Interview not found');
    }

    // Create timeline entry
    const entry = await this.prisma.interviewTimeline.create({
      data: {
        interviewId,
        comment: dto.comment,
        statusChange: dto.statusChange,
        attachmentName: dto.attachmentName,
        attachmentUrl: dto.attachmentUrl,
        attachmentType: dto.attachmentType,
      },
    });

    // If status changed, update the interview
    if (dto.statusChange) {
      await this.prisma.interviewProcess.update({
        where: { id: interviewId },
        data: { status: dto.statusChange },
      });
    }

    return entry;
  }

  async getStats(userId: string) {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalActive,
      totalThisMonth,
      byStatus,
      recentActivity,
    ] = await Promise.all([
      // Total active (non-archived)
      this.prisma.interviewProcess.count({
        where: { userId, archivedAt: null },
      }),
      
      // Applied this month
      this.prisma.interviewProcess.count({
        where: {
          userId,
          appliedAt: { gte: firstDayOfMonth },
        },
      }),
      
      // Count by status
      this.prisma.interviewProcess.groupBy({
        by: ['status'],
        where: { userId, archivedAt: null },
        _count: true,
      }),
      
      // Recent activity (last 7 days)
      this.prisma.interviewProcess.count({
        where: {
          userId,
          updatedAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    const statusCounts = byStatus.reduce((acc, item) => {
      acc[item.status] = item._count;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalActive,
      totalThisMonth,
      recentActivity,
      byStatus: statusCounts,
    };
  }

  // Reminders
  async createReminder(interviewId: string, userId: string, title: string, dueAt: Date) {
    // Verify interview ownership
    const interview = await this.prisma.interviewProcess.findFirst({
      where: { id: interviewId, userId },
    });
    if (!interview) throw new Error('Interview not found');

    return this.prisma.interviewReminder.create({
      data: {
        interviewId,
        title,
        dueAt,
      },
    });
  }

  async getReminders(interviewId: string, userId: string) {
    // Verify interview ownership
    const interview = await this.prisma.interviewProcess.findFirst({
      where: { id: interviewId, userId },
    });
    if (!interview) throw new Error('Interview not found');

    return this.prisma.interviewReminder.findMany({
      where: { interviewId },
      orderBy: { dueAt: 'asc' },
    });
  }

  async completeReminder(reminderId: string, userId: string, completed: boolean) {
    // Verify ownership through interview
    const reminder = await this.prisma.interviewReminder.findUnique({
      where: { id: reminderId },
      include: { interview: true },
    });

    if (!reminder || reminder.interview.userId !== userId) {
      throw new Error('Reminder not found');
    }

    return this.prisma.interviewReminder.update({
      where: { id: reminderId },
      data: {
        completed,
        completedAt: completed ? new Date() : null,
      },
    });
  }

  async deleteReminder(reminderId: string, userId: string) {
    // Verify ownership through interview
    const reminder = await this.prisma.interviewReminder.findUnique({
      where: { id: reminderId },
      include: { interview: true },
    });

    if (!reminder || reminder.interview.userId !== userId) {
      throw new Error('Reminder not found');
    }

    return this.prisma.interviewReminder.delete({
      where: { id: reminderId },
    });
  }

  // Templates
  async createTemplate(userId: string, data: any) {
    return this.prisma.interviewTemplate.create({
      data: {
        userId,
        ...data,
      },
    });
  }

  async getTemplates(userId: string) {
    return this.prisma.interviewTemplate.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTemplate(templateId: string, userId: string) {
    const template = await this.prisma.interviewTemplate.findFirst({
      where: { id: templateId, userId },
    });
    if (!template) throw new Error('Template not found');
    return template;
  }

  async updateTemplate(templateId: string, userId: string, data: any) {
    const template = await this.prisma.interviewTemplate.findFirst({
      where: { id: templateId, userId },
    });
    if (!template) throw new Error('Template not found');

    return this.prisma.interviewTemplate.update({
      where: { id: templateId },
      data,
    });
  }

  async deleteTemplate(templateId: string, userId: string) {
    const template = await this.prisma.interviewTemplate.findFirst({
      where: { id: templateId, userId },
    });
    if (!template) throw new Error('Template not found');

    return this.prisma.interviewTemplate.delete({
      where: { id: templateId },
    });
  }
}
