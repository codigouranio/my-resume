import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/database/prisma.service';
import { JournalPost, JournalPostReaction, JournalPostReply, Prisma } from '@prisma/client';

export interface CreatePostInput {
  text: string;
  publishedAt?: Date;
  includeInAI?: boolean;
}

export interface UpdatePostInput {
  text?: string;
  publishedAt?: Date;
  includeInAI?: boolean;
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
  constructor(private readonly prisma: PrismaService) {}

  // Posts
  async createPost(userId: string, input: CreatePostInput): Promise<JournalPost> {
    return this.prisma.journalPost.create({
      data: {
        userId,
        text: input.text,
        publishedAt: input.publishedAt || new Date(),
        includeInAI: input.includeInAI ?? true,
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

  private getPostInclude() {
    return {
      attachments: true,
      reactions: true,
      replies: { where: { deletedAt: null } },
      resumeTags: { include: { resume: { select: { id: true, title: true } } } },
    };
  }
}
