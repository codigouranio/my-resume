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
  Patch,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InterviewsService } from './interviews.service';
import {
  CreateInterviewDto,
  UpdateInterviewDto,
  CreateTimelineEntryDto,
  CreateReminderDto,
  CompleteReminderDto,
  CreateTemplateDto,
  InterviewStatus,
} from './dto/interview.dto';

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

  @UseGuards(JwtAuthGuard)
  @Post(':id/reminders')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a reminder for an interview' })
  async createReminder(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: CreateReminderDto,
  ) {
    return this.interviewsService.createReminder(id, req.user.id, dto.title, new Date(dto.dueAt));
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/reminders')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get reminders for an interview' })
  async getReminders(@Request() req, @Param('id') id: string) {
    return this.interviewsService.getReminders(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('reminders/:reminderId/complete')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark a reminder as complete/incomplete' })
  async completeReminder(
    @Request() req,
    @Param('reminderId') reminderId: string,
    @Body() dto: CompleteReminderDto,
  ) {
    return this.interviewsService.completeReminder(reminderId, req.user.id, dto.completed ?? true);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('reminders/:reminderId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a reminder' })
  async deleteReminder(@Request() req, @Param('reminderId') reminderId: string) {
    return this.interviewsService.deleteReminder(reminderId, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('templates')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create an interview template' })
  async createTemplate(@Request() req, @Body() dto: CreateTemplateDto) {
    return this.interviewsService.createTemplate(req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('templates')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all templates' })
  async getTemplates(@Request() req) {
    return this.interviewsService.getTemplates(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('templates/:templateId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a single template' })
  async getTemplate(@Request() req, @Param('templateId') templateId: string) {
    return this.interviewsService.getTemplate(templateId, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Put('templates/:templateId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a template' })
  async updateTemplate(
    @Request() req,
    @Param('templateId') templateId: string,
    @Body() dto: CreateTemplateDto,
  ) {
    return this.interviewsService.updateTemplate(templateId, req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('templates/:templateId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a template' })
  async deleteTemplate(@Request() req, @Param('templateId') templateId: string) {
    return this.interviewsService.deleteTemplate(templateId, req.user.id);
  }
}
