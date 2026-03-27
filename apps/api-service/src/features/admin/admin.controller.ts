import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminService } from './admin.service';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Get internal admin overview metrics' })
  @ApiResponse({ status: 200, description: 'Admin overview retrieved' })
  getOverview() {
    return this.adminService.getOverview();
  }

  @Get('users')
  @ApiOperation({ summary: 'List users for the admin back office' })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'subscriptionTier', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Users retrieved' })
  getUsers(
    @Query('search') search?: string,
    @Query('subscriptionTier') subscriptionTier?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getUsers({
      search,
      subscriptionTier,
      limit: limit ? Number(limit) : undefined,
    });
  }
}