import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { BadgesService } from './badges.service';

@ApiTags('badges')
@Controller('badges')
export class BadgesController {
  constructor(private readonly badgesService: BadgesService) {}

  @Get('github')
  @Public()
  @ApiOperation({ summary: 'Generate GitHub stats badge' })
  @ApiQuery({ name: 'username', required: true, description: 'GitHub username' })
  @ApiQuery({ name: 'theme', required: false, description: 'Badge theme (light, dark)' })
  async getGitHubBadge(
    @Query('username') username: string,
    @Query('theme') theme: string = 'dark',
    @Res() res: Response,
  ) {
    const svgContent = await this.badgesService.generateGitHubStatsBadge(username, theme);
    
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    res.send(svgContent);
  }
}
