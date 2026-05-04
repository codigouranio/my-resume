import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@shared/database/prisma.service';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../../shared/email/email.service';
import { JournalPost, JournalPostReaction, JournalPostReply, Prisma } from '@prisma/client';

export interface CreatePostInput {
  text: string;
  publishedAt?: Date;
  includeInAI?: boolean;
  isPublic?: boolean;
}

export interface UpdatePostInput {
  text?: string;
  publishedAt?: Date;
  includeInAI?: boolean;
  isPublic?: boolean;
}

export interface PostFilters {
  search?: string;
  includeInAI?: boolean;
  resumeId?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class AIContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  // Posts
  async createPost(userId: string, input: CreatePostInput): Promise<JournalPost> {
    return this.prisma.journalPost.create({
      data: {
        userId,
        text: input.text,
        publishedAt: input.publishedAt || new Date(),
        includeInAI: input.includeInAI ?? true,
        isPublic: input.isPublic ?? false,
      },
      include: this.getPostInclude(),
    });
  }

  async getPost(postId: string, userId: string): Promise<JournalPost | null> {
    return this.prisma.journalPost.findFirst({
      where: { id: postId, userId, deletedAt: null },
      include: this.getPostInclude(),
    });
  }

  async getPosts(userId: string, filters: PostFilters = {}): Promise<JournalPost[]> {
    const where: Prisma.JournalPostWhereInput = {
      userId,
      deletedAt: null,
    };

    if (filters.includeInAI !== undefined) {
      where.includeInAI = filters.includeInAI;
    }

    if (filters.search) {
      where.OR = [
        { text: { contains: filters.search, mode: 'insensitive' } },
        { attachments: { some: { fileName: { contains: filters.search, mode: 'insensitive' } } } },
      ];
    }

    if (filters.resumeId) {
      where.resumeTags = {
        some: { resumeId: filters.resumeId },
      };
    }

    return this.prisma.journalPost.findMany({
      where,
      include: this.getPostInclude(),
      orderBy: { publishedAt: 'desc' },
      take: filters.limit || 50,
      skip: filters.offset || 0,
    });
  }

  async getPublicPostsByUserId(userId: string, limit: number = 50, offset: number = 0): Promise<{ posts: JournalPost[]; total: number; user: { firstName: string | null; lastName: string | null; email: string } }> {
    // Find user by ID
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        firstName: true,
        lastName: true,
        email: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const where: Prisma.JournalPostWhereInput = {
      userId: userId,
      isPublic: true,
      deletedAt: null,
    };

    const [posts, total] = await Promise.all([
      this.prisma.journalPost.findMany({
        where,
        include: {
          reactions: true,
          attachments: true,
        },
        orderBy: { publishedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.journalPost.count({ where }),
    ]);

    return { 
      posts, 
      total,
      user: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      },
    };
  }

  async updatePost(postId: string, userId: string, input: UpdatePostInput): Promise<JournalPost> {
    // Verify ownership
    const post = await this.prisma.journalPost.findFirst({
      where: { id: postId, userId },
    });
    if (!post) throw new Error('Post not found');

    return this.prisma.journalPost.update({
      where: { id: postId },
      data: input,
      include: this.getPostInclude(),
    });
  }

  async deletePost(postId: string, userId: string): Promise<JournalPost> {
    // Soft delete
    const post = await this.prisma.journalPost.findFirst({
      where: { id: postId, userId, deletedAt: null },
    });
    if (!post) throw new Error('Post not found or already deleted');

    return this.prisma.journalPost.update({
      where: { id: postId },
      data: { deletedAt: new Date() },
      include: this.getPostInclude(),
    });
  }

  // Reactions
  async addReaction(postId: string, userId: string, reactionType: string, customEmoji?: string): Promise<any> {
    // Verify post ownership
    const post = await this.prisma.journalPost.findFirst({
      where: { id: postId, userId },
    });
    if (!post) throw new Error('Post not found');

    return this.prisma.journalPostReaction.upsert({
      where: {
        postId_reactionType: {
          postId,
          reactionType: reactionType as any,
        },
      },
      create: {
        postId,
        reactionType: reactionType as any,
        customEmoji: customEmoji || null,
      },
      update: {
        customEmoji: customEmoji || null,
      },
    });
  }

  async removeReaction(postId: string, userId: string, reactionType: string, customEmoji?: string): Promise<void> {
    // Verify ownership
    await this.getPost(postId, userId);

    await this.prisma.journalPostReaction.delete({
      where: {
        postId_reactionType: {
          postId,
          reactionType: reactionType as any,
        },
      },
    }).catch(() => {}); // Ignore if not found
  }

  // Replies
  async addReply(postId: string, userId: string, text: string): Promise<JournalPostReply> {

    // Verify ownership
    const post = await this.prisma.journalPost.findFirst({
      where: { id: postId, userId },
    });
    if (!post) throw new Error('Post not found');

    return this.prisma.journalPostReply.create({
      data: { postId, text },
    });
  }

  async getPostReplies(postId: string, userId: string): Promise<JournalPostReply[]> {
    // Verify ownership
    await this.getPost(postId, userId);

    return this.prisma.journalPostReply.findMany({
      where: { postId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateReply(postId: string, replyId: string, userId: string, text: string): Promise<JournalPostReply> {
    // Verify ownership
    await this.getPost(postId, userId);

    return this.prisma.journalPostReply.update({
      where: { id: replyId },
      data: { text },
    });
  }

  async deleteReply(postId: string, replyId: string, userId: string): Promise<JournalPostReply> {
    // Verify ownership
    await this.getPost(postId, userId);

    return this.prisma.journalPostReply.update({
      where: { id: replyId },
      data: { deletedAt: new Date() },
    });
  }

  // Resume tags
  async tagPostToResume(postId: string, userId: string, resumeId: string): Promise<any> {
    // Verify post ownership and resume ownership
    const post = await this.prisma.journalPost.findFirst({
      where: { id: postId, userId },
    });
    if (!post) throw new Error('Post not found');

    const resume = await this.prisma.resume.findFirst({
      where: { id: resumeId, userId },
    });
    if (!resume) throw new Error('Resume not found');

    return this.prisma.postResumeTag.upsert({
      where: {
        postId_resumeId: { postId, resumeId },
      },
      create: { postId, resumeId },
      update: {},
    });
  }

  async removeResumeTag(postId: string, userId: string, resumeId: string): Promise<void> {
    // Verify ownership
    await this.getPost(postId, userId);

    await this.prisma.postResumeTag.delete({
      where: {
        postId_resumeId: { postId, resumeId },
      },
    }).catch(() => {}); // Ignore if not found
  }

  // Get AI context for resume
  async getAIContext(userId: string, resumeId?: string): Promise<string> {
    const where: Prisma.JournalPostWhereInput = {
      userId,
      includeInAI: true,
      deletedAt: null,
    };

    if (resumeId) {
      where.resumeTags = {
        some: { resumeId },
      };
    }

    const posts = await this.prisma.journalPost.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
    });

    // Format posts as context
    return posts
      .map(post => `[${post.publishedAt.toISOString()}] ${post.text}`)
      .join('\n\n');
  }

  // Uploads
  async addAttachment(postId: string, userId: string, fileUrl: string, fileName: string, fileType: string, fileSizeBytes?: number): Promise<any> {
    // Verify ownership
    const post = await this.prisma.journalPost.findFirst({
      where: { id: postId, userId },
    });
    if (!post) throw new Error('Post not found');

    return this.prisma.journalPostAttachment.create({
      data: {
        postId,
        fileUrl,
        fileName,
        fileType,
        fileSizeBytes,
      },
    });
  }

  async removeAttachment(postId: string, userId: string, attachmentId: string): Promise<void> {
    // Verify ownership
    const post = await this.prisma.journalPost.findFirst({
      where: { id: postId, userId },
    });
    if (!post) throw new Error('Post not found');

    await this.prisma.journalPostAttachment.delete({
      where: { id: attachmentId },
    });
  }

  // ── Corroborations ────────────────────────────────────────────────────────

  async addCorroborators(
    postId: string,
    userId: string,
    corroborators: { email: string; name: string; role?: string }[],
  ) {
    const post = await this.prisma.journalPost.findFirst({
      where: { id: postId, userId, deletedAt: null },
      select: { id: true, text: true, user: { select: { firstName: true, email: true } } },
    });
    if (!post) throw new NotFoundException('Post not found');

    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'https://resumecast.ai');
    const tokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    const excerpt = post.text.length > 200 ? post.text.slice(0, 197) + '…' : post.text;

    const created = await Promise.all(
      corroborators.map(async (c) => {
        const record = await this.prisma.postCorroboration.create({
          data: {
            postId,
            corroboratorEmail: c.email.toLowerCase().trim(),
            corroboratorName: c.name.trim(),
            corroboratorRole: c.role?.trim() || null,
            tokenExpiresAt,
          },
        });

        const verifyUrl = `${frontendUrl}/verify/corroboration/${record.token}`;
        const signupUrl = `${frontendUrl}/register`;
        await this.emailService.sendCorroborationInviteEmail(
          c.email,
          c.name,
          post.user.firstName || 'Someone',
          excerpt,
          verifyUrl,
          signupUrl,
        );

        return record;
      }),
    );

    return created;
  }

  async getCorroborations(postId: string, userId: string) {
    const post = await this.prisma.journalPost.findFirst({
      where: { id: postId, userId, deletedAt: null },
      select: { id: true },
    });
    if (!post) throw new NotFoundException('Post not found');

    return this.prisma.postCorroboration.findMany({
      where: { postId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPublicCorroborations(postId: string) {
    return this.prisma.postCorroboration.findMany({
      where: { postId, status: 'CONFIRMED', deletedAt: null },
      select: {
        id: true,
        corroboratorName: true,
        corroboratorRole: true,
        comment: true,
        confirmedAt: true,
      },
      orderBy: { confirmedAt: 'desc' },
    });
  }

  async cancelCorroboration(postId: string, userId: string, corroborationId: string) {
    const post = await this.prisma.journalPost.findFirst({
      where: { id: postId, userId, deletedAt: null },
      select: { id: true },
    });
    if (!post) throw new NotFoundException('Post not found');

    return this.prisma.postCorroboration.update({
      where: { id: corroborationId, postId },
      data: { deletedAt: new Date() },
    });
  }

  async resendCorroboration(postId: string, userId: string, corroborationId: string) {
    const post = await this.prisma.journalPost.findFirst({
      where: { id: postId, userId, deletedAt: null },
      select: { id: true, text: true, user: { select: { firstName: true } } },
    });
    if (!post) throw new NotFoundException('Post not found');

    const record = await this.prisma.postCorroboration.findFirst({
      where: { id: corroborationId, postId, deletedAt: null, status: 'PENDING' },
    });
    if (!record) throw new NotFoundException('Corroboration not found or already actioned');

    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'https://resumecast.ai');
    const excerpt = post.text.length > 200 ? post.text.slice(0, 197) + '…' : post.text;

    await this.emailService.sendCorroborationInviteEmail(
      record.corroboratorEmail,
      record.corroboratorName,
      post.user.firstName || 'Someone',
      excerpt,
      `${frontendUrl}/verify/corroboration/${record.token}`,
      `${frontendUrl}/register`,
    );

    return { success: true };
  }

  async getCorroborationByToken(token: string) {
    const record = await this.prisma.postCorroboration.findUnique({
      where: { token },
      include: {
        post: {
          select: {
            id: true,
            text: true,
            publishedAt: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!record) throw new NotFoundException('Corroboration request not found');
    if (record.deletedAt) throw new NotFoundException('This request has been cancelled');
    if (record.status !== 'PENDING') {
      return { record, alreadyActioned: true };
    }
    if (record.tokenExpiresAt < new Date()) {
      await this.prisma.postCorroboration.update({
        where: { token },
        data: { status: 'EXPIRED' },
      });
      throw new ForbiddenException('This corroboration link has expired');
    }

    return { record, alreadyActioned: false };
  }

  async confirmCorroboration(token: string, comment?: string) {
    const record = await this.prisma.postCorroboration.findUnique({
      where: { token },
      include: {
        post: {
          select: {
            id: true,
            text: true,
            user: { select: { email: true, firstName: true } },
          },
        },
      },
    });

    if (!record || record.deletedAt) throw new NotFoundException('Request not found');
    if (record.status !== 'PENDING') throw new ForbiddenException('Already actioned');
    if (record.tokenExpiresAt < new Date()) {
      await this.prisma.postCorroboration.update({ where: { token }, data: { status: 'EXPIRED' } });
      throw new ForbiddenException('Link expired');
    }

    const updated = await this.prisma.postCorroboration.update({
      where: { token },
      data: { status: 'CONFIRMED', confirmedAt: new Date(), comment: comment || null },
    });

    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'https://resumecast.ai');
    const excerpt = record.post.text.length > 200
      ? record.post.text.slice(0, 197) + '…'
      : record.post.text;

    await this.emailService.sendCorroborationConfirmedEmail(
      record.post.user.email,
      record.post.user.firstName || 'there',
      record.corroboratorName,
      record.corroboratorRole,
      excerpt,
      `${frontendUrl}/dashboard`,
    );

    return updated;
  }

  async declineCorroboration(token: string) {
    const record = await this.prisma.postCorroboration.findUnique({ where: { token } });
    if (!record || record.deletedAt) throw new NotFoundException('Request not found');
    if (record.status !== 'PENDING') throw new ForbiddenException('Already actioned');

    return this.prisma.postCorroboration.update({
      where: { token },
      data: { status: 'DECLINED' },
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private getPostInclude() {
    return {
      attachments: true,
      reactions: true,
      replies: { where: { deletedAt: null } },
      resumeTags: { include: { resume: { select: { id: true, title: true } } } },
    };
  }
}
