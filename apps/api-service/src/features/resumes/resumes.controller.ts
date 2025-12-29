import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ResumesService } from './resumes.service';
import { CreateResumeDto } from './dto/create-resume.dto';
import { UpdateResumeDto } from './dto/update-resume.dto';
import { CreateRecruiterInterestDto } from './dto/create-recruiter-interest.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('resumes')
@Controller('resumes')
export class ResumesController {
  constructor(private readonly resumesService: ResumesService) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a new resume' })
  create(
    @CurrentUser() user: any,
    @Body() createResumeDto: CreateResumeDto,
  ) {
    return this.resumesService.create(user.id, createResumeDto);
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all resumes for current user' })
  findAll(@CurrentUser() user: any) {
    return this.resumesService.findAll(user.id);
  }

  @Get('public/:slug')
  @Public()
  @ApiOperation({ summary: 'Get public resume by slug' })
  findBySlug(
    @Param('slug') slug: string,
    @Query('view') view?: string,
  ) {
    return this.resumesService.findBySlug(slug, view === 'true');
  }

  @Get('llm/:slug')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ 
    summary: 'Get resume with full context for LLM',
    description: 'Returns resume including hidden llmContext field for AI processing'
  })
  getForLLM(@Param('slug') slug: string) {
    return this.resumesService.getResumeForLLM(slug);
  }

  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get resume by ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.resumesService.findOne(id, user.id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update resume' })
  update(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() updateResumeDto: UpdateResumeDto,
  ) {
    return this.resumesService.update(id, user.id, updateResumeDto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Delete resume' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.resumesService.remove(id, user.id);
  }

  @Post('recruiter-interest')
  @Public()
  @ApiOperation({ summary: 'Submit recruiter interest for a resume' })
  submitRecruiterInterest(@Body() dto: CreateRecruiterInterestDto) {
    return this.resumesService.createRecruiterInterest(dto);
  }

  @Get('recruiter-interest/my-interests')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all recruiter interests for current user resumes' })
  getMyRecruiterInterests(@CurrentUser() user: any) {
    return this.resumesService.getRecruiterInterests(user.id);
  }

  @Patch('recruiter-interest/:id/read')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Mark recruiter interest as read' })
  markInterestAsRead(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.resumesService.markInterestAsRead(id, user.id);
  }
}
