import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
  BadRequestException,
  Logger,
  Req,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LinkedInApiService } from './linkedin-api.service';
import { LinkedInParserService } from './linkedin-parser.service';
import { ResumesService } from './resumes.service';
import * as crypto from 'crypto';

/**
 * LinkedIn Import Controller
 * Handles OAuth flow and resume import from LinkedIn
 */
@Controller('resumes/import/linkedin')
export class LinkedInImportController {
  private readonly logger = new Logger(LinkedInImportController.name);
  // Store state tokens temporarily (in production, use Redis or session storage)
  private stateStore = new Map<string, { userId: string; timestamp: number }>();

  constructor(
    private readonly linkedInApiService: LinkedInApiService,
    private readonly linkedInParserService: LinkedInParserService,
    private readonly resumesService: ResumesService,
  ) {
    // Clean up old state tokens every 10 minutes
    setInterval(() => this.cleanupExpiredStates(), 10 * 60 * 1000);
  }

  /**
   * Step 1: Initiate LinkedIn OAuth flow
   * GET /api/resumes/import/linkedin/auth
   */
  @Get('auth')
  @UseGuards(JwtAuthGuard)
  async initiateAuth(@Req() req: Request & { user: any }, @Res() res: Response) {
    const userId = req.user.userId;

    // Generate random state for CSRF protection
    const state = crypto.randomBytes(32).toString('hex');
    
    // Store state with user ID (expire after 10 minutes)
    this.stateStore.set(state, {
      userId,
      timestamp: Date.now(),
    });

    // Get LinkedIn authorization URL
    const authUrl = this.linkedInApiService.getAuthorizationUrl(state);

    this.logger.log(`User ${userId} initiating LinkedIn import`);

    // Redirect to LinkedIn OAuth
    return res.redirect(authUrl);
  }

  /**
   * Step 2: Handle OAuth callback from LinkedIn
   * GET /api/resumes/import/linkedin/callback?code=...&state=...
   */
  @Get('callback')
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Query('error_description') errorDescription: string,
    @Res() res: Response,
  ) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    // Handle OAuth error (user denied access)
    if (error) {
      this.logger.warn(`LinkedIn OAuth error: ${error} - ${errorDescription}`);
      return res.redirect(
        `${frontendUrl}/dashboard?linkedin_import=error&message=${encodeURIComponent(errorDescription || error)}`,
      );
    }

    // Validate required parameters
    if (!code || !state) {
      this.logger.error('Missing code or state in callback');
      return res.redirect(
        `${frontendUrl}/dashboard?linkedin_import=error&message=Invalid callback parameters`,
      );
    }

    // Verify state to prevent CSRF
    const stateData = this.stateStore.get(state);
    if (!stateData) {
      this.logger.error('Invalid or expired state token');
      return res.redirect(
        `${frontendUrl}/dashboard?linkedin_import=error&message=Session expired. Please try again.`,
      );
    }

    // Check if state is expired (10 minutes)
    if (Date.now() - stateData.timestamp > 10 * 60 * 1000) {
      this.stateStore.delete(state);
      this.logger.error('State token expired');
      return res.redirect(
        `${frontendUrl}/dashboard?linkedin_import=error&message=Session expired. Please try again.`,
      );
    }

    const userId = stateData.userId;
    this.stateStore.delete(state); // Clean up used state

    try {
      // Exchange authorization code for access token
      const accessToken = await this.linkedInApiService.getAccessToken(code);

      // Fetch LinkedIn profile data
      const profile = await this.linkedInApiService.getDetailedProfile(accessToken);

      this.logger.log(`Successfully fetched LinkedIn profile for user ${userId}`);

      // Transform profile to markdown
      const markdown = this.linkedInParserService.parseToMarkdown(profile);

      // Generate slug and title
      const slug = this.linkedInParserService.generateSlug(
        profile.firstName,
        profile.lastName,
      );
      const title = this.linkedInParserService.generateTitle(
        profile.firstName,
        profile.lastName,
        profile.headline,
      );

      // Check if slug already exists
      let finalSlug = slug;
      let counter = 1;
      while (true) {
        try {
          const existing = await this.resumesService.findBySlug(finalSlug);
          if (existing) {
            finalSlug = `${slug}-${counter}`;
            counter++;
          } else {
            break;
          }
        } catch (error) {
          // Slug doesn't exist, we can use it
          break;
        }
      }

      // Create resume from LinkedIn data
      const resume = await this.resumesService.create(userId, {
        slug: finalSlug,
        title,
        content: markdown,
        llmContext: `Imported from LinkedIn on ${new Date().toISOString()}. Original headline: ${profile.headline || 'N/A'}`,
        isPublic: false,
        isPublished: false,
      });

      this.logger.log(`Created resume ${resume.id} from LinkedIn for user ${userId}`);

      // Redirect to editor with new resume
      return res.redirect(
        `${frontendUrl}/dashboard/editor/${resume.id}?linkedin_import=success`,
      );
    } catch (error) {
      this.logger.error('Failed to import LinkedIn profile:', error.message);
      return res.redirect(
        `${frontendUrl}/dashboard?linkedin_import=error&message=${encodeURIComponent('Failed to import profile. Please try again.')}`,
      );
    }
  }

  /**
   * Check if LinkedIn import is configured
   * GET /api/resumes/import/linkedin/status
   */
  @Get('status')
  checkStatus() {
    const isConfigured = Boolean(
      process.env.LINKEDIN_CLIENT_ID &&
      process.env.LINKEDIN_CLIENT_SECRET &&
      process.env.LINKEDIN_REDIRECT_URI,
    );

    return {
      configured: isConfigured,
      available: isConfigured,
      message: isConfigured
        ? 'LinkedIn import is available'
        : 'LinkedIn import is not configured. Please set LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, and LINKEDIN_REDIRECT_URI environment variables.',
    };
  }

  /**
   * Clean up expired state tokens
   */
  private cleanupExpiredStates() {
    const now = Date.now();
    const expiredStates: string[] = [];

    this.stateStore.forEach((data, state) => {
      if (now - data.timestamp > 10 * 60 * 1000) {
        expiredStates.push(state);
      }
    });

    expiredStates.forEach((state) => this.stateStore.delete(state));

    if (expiredStates.length > 0) {
      this.logger.debug(`Cleaned up ${expiredStates.length} expired state tokens`);
    }
  }
}
