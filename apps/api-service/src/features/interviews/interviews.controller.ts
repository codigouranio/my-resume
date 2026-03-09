import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Request,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InterviewsService } from './interviews.service';
import { CreateInterviewDto, UpdateInterviewDto, CreateTimelineEntryDto, InterviewStatus } from './dto/interview.dto';

@ApiTags('interviews')
@Controller('interviews')
export class InterviewsController {
  constructor(private readonly interviewsService: InterviewsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new interview process entry' })
  async create(@Request() req, @Body() dto: CreateInterviewDto) {
    return this.interviewsService.create(req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all interview processes' })
  async findAll(
    @Request() req,
    @Query('status') status?: InterviewStatus,
    @Query('company') company?: string,
    @Query('archived') archived?: string,
  ) {
    return this.interviewsService.findAll(req.user.id, {
      status,
      company,
      archived: archived === 'true',
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('stats')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get interview statistics' })
  async getStats(@Request() req) {
    return this.interviewsService.getStats(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a single interview process' })
  async findOne(@Request() req, @Param('id') id: string) {
    return this.interviewsService.findOne(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an interview process' })
  async update(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateInterviewDto,
  ) {
    return this.interviewsService.update(id, req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete an interview process' })
  async remove(@Request() req, @Param('id') id: string) {
    return this.interviewsService.remove(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/archive')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Archive an interview process' })
  async archive(@Request() req, @Param('id') id: string) {
    return this.interviewsService.archive(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/unarchive')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unarchive an interview process' })
  async unarchive(@Request() req, @Param('id') id: string) {
    return this.interviewsService.unarchive(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/timeline')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a timeline entry (comment/status change)' })
  async addTimelineEntry(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: CreateTimelineEntryDto,
  ) {
    return this.interviewsService.addTimelineEntry(id, req.user.id, dto);
  }
}
