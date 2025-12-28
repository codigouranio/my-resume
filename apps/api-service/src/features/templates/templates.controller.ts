import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { TemplatesService } from './templates.service';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('templates')
@Controller('templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get all active templates' })
  findAll() {
    return this.templatesService.findAll();
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get template by ID' })
  findOne(@Param('id') id: string) {
    return this.templatesService.findOne(id);
  }
}
