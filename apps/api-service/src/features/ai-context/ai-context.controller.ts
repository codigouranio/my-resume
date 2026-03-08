import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AIContextService } from './ai-context.service';

@ApiTags('ai-context')
@Controller('ai-context')
export class AIContextController {
  constructor(private readonly aiContextService: AIContextService) {}

  // Public endpoint - no auth required
  @Get('public/:username')
  @ApiOperation({ summary: 'Get public journal posts for a user (no auth required)' })
  async getPublicPosts(
    @Param('username') username: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.aiContextService.getPublicPostsByUsername(
      username,
      limit ? parseInt(limit) : 50,
      offset ? parseInt(offset) : 0,
    );
  }

  // Protected routes below
  @UseGuards(JwtAuthGuard)
  @Post('posts')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new journal post' })
  async createPost(@Request() req, @Body() body: { text: string; publishedAt?: string; includeInAI?: boolean; isPublic?: boolean }) {
    return this.aiContextService.createPost(req.user.id, {
      text: body.text,
      publishedAt: body.publishedAt ? new Date(body.publishedAt) : undefined,
      includeInAI: body.includeInAI,
      isPublic: body.isPublic,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('posts/:postId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a single journal post' })
  async getPost(@Request() req, @Param('postId') postId: string) {
    const post = await this.aiContextService.getPost(postId, req.user.id);
    if (!post) {
      return { error: 'Post not found' };
    }
    return post;
  }

  @UseGuards(JwtAuthGuard)
  @Get('posts')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all journal posts with optional filters' })
  async getPosts(
    @Request() req,
    @Query('search') search?: string,
    @Query('includeInAI') includeInAI = 'true',
    @Query('resumeId') resumeId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.aiContextService.getPosts(req.user.id, {
      search,
      includeInAI: includeInAI === 'true',
      resumeId,
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Put('posts/:postId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an existing journal post' })
  async updatePost(
    @Request() req,
    @Param('postId') postId: string,
    @Body() body: { text?: string; publishedAt?: string; includeInAI?: boolean; isPublic?: boolean },
  ) {
    return this.aiContextService.updatePost(postId, req.user.id, {
      text: body.text,
      publishedAt: body.publishedAt ? new Date(body.publishedAt) : undefined,
      includeInAI: body.includeInAI,
      isPublic: body.isPublic,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Delete('posts/:postId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a journal post' })
  async deletePost(@Request() req, @Param('postId') postId: string) {
    try {
      return this.aiContextService.deletePost(postId, req.user.id);
    } catch (error: any) {
      return { error: error.message || 'Failed to delete post' };
    }
  }

  // Reactions
  @UseGuards(JwtAuthGuard)
  @Post('posts/:postId/reactions')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a reaction to a journal post' })
  async addReaction(
    @Request() req,
    @Param('postId') postId: string,
    @Body() body: { reactionType: string; customEmoji?: string },
  ) {
    return this.aiContextService.addReaction(postId, req.user.id, body.reactionType, body.customEmoji);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('posts/:postId/reactions')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove a reaction from a journal post' })
  async removeReaction(
    @Request() req,
    @Param('postId') postId: string,
    @Body() body: { reactionType: string; customEmoji?: string },
  ) {
    await this.aiContextService.removeReaction(postId, req.user.id, body.reactionType, body.customEmoji);
    return { success: true };
  }

  // Replies
  @UseGuards(JwtAuthGuard)
  @Post('posts/:postId/replies')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a reply to a journal post' })
  async addReply(@Request() req, @Param('postId') postId: string, @Body() body: { text: string }) {
    return this.aiContextService.addReply(postId, req.user.id, body.text);
  }

  @UseGuards(JwtAuthGuard)
  @Get('posts/:postId/replies')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all replies for a journal post' })
  async getReplies(@Request() req, @Param('postId') postId: string) {
    return this.aiContextService.getPostReplies(postId, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Put('posts/:postId/replies/:replyId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a reply on a journal post' })
  async updateReply(
    @Request() req,
    @Param('postId') postId: string,
    @Param('replyId') replyId: string,
    @Body() body: { text: string },
  ) {
    return this.aiContextService.updateReply(postId, replyId, req.user.id, body.text);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('posts/:postId/replies/:replyId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a reply from a journal post' })
  async deleteReply(
    @Request() req,
    @Param('postId') postId: string,
    @Param('replyId') replyId: string,
  ) {
    return this.aiContextService.deleteReply(postId, replyId, req.user.id);
  }

  // Resume tags
  @UseGuards(JwtAuthGuard)
  @Post('posts/:postId/resume-tags')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tag a journal post to a resume' })
  async tagPostToResume(
    @Request() req,
    @Param('postId') postId: string,
    @Body() body: { resumeId: string },
  ) {
    return this.aiContextService.tagPostToResume(postId, req.user.id, body.resumeId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('posts/:postId/resume-tags/:resumeId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove a resume tag from a journal post' })
  async removeResumeTag(
    @Request() req,
    @Param('postId') postId: string,
    @Param('resumeId') resumeId: string,
  ) {
    await this.aiContextService.removeResumeTag(postId, req.user.id, resumeId);
    return { success: true };
  }

  // AI Context
  @UseGuards(JwtAuthGuard)
  @Get('context')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get AI context string from all journal posts' })
  async getAIContext(@Request() req, @Query('resumeId') resumeId?: string) {
    return this.aiContextService.getAIContext(req.user.id, resumeId);
  }

  // Attachments
  @UseGuards(JwtAuthGuard)
  @Post('posts/:postId/attachments')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add an attachment to a journal post' })
  async addAttachment(
    @Request() req,
    @Param('postId') postId: string,
    @Body() body: { fileUrl: string; fileName: string; fileType: string; fileSizeBytes?: number },
  ) {
    return this.aiContextService.addAttachment(postId, req.user.id, body.fileUrl, body.fileName, body.fileType, body.fileSizeBytes);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('posts/:postId/attachments/:attachmentId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove an attachment from a journal post' })
  async removeAttachment(
    @Request() req,
    @Param('postId') postId: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    await this.aiContextService.removeAttachment(postId, req.user.id, attachmentId);
    return { success: true };
  }
}
