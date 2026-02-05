/**
 * System Health Check - TypeScript/NestJS Module
 * Can be used as a standalone health check endpoint
 */

import { Controller, Get } from '@nestjs/common';
import { Public } from '../../features/auth/decorators/public.decorator';

export interface ServiceStatus {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  details?: Record<string, any>;
  error?: string;
}

export interface SystemHealth {
  timestamp: string;
  environment: string;
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: ServiceStatus[];
  uptime: number;
}

@Controller('health')
export class HealthController {
  constructor(
    private readonly configService: any,
    private readonly prisma: any,
  ) {}

  /**
   * System-wide health check endpoint
   * Returns comprehensive status of all critical services
   */
  @Get('system')
  @Public()
  async getSystemHealth(): Promise<SystemHealth> {
    const startTime = Date.now();
    const services: ServiceStatus[] = [];

    // Check API Service
    services.push({
      service: 'API Service',
      status: 'healthy',
      responseTime: 0,
      details: {
        node: process.version,
        uptime: process.uptime(),
      },
    });

    // Check Database
    try {
      const dbStartTime = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      services.push({
        service: 'PostgreSQL Database',
        status: 'healthy',
        responseTime: Date.now() - dbStartTime,
        details: {
          host: this.configService.get('DATABASE_HOST', 'localhost'),
          port: this.configService.get('DATABASE_PORT', 5432),
        },
      });
    } catch (error) {
      services.push({
        service: 'PostgreSQL Database',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error.message,
      });
    }

    // Check LLM Service connectivity
    try {
      const llmUrl = this.configService.get('LLM_SERVICE_URL', 'http://localhost:5000');
      const llmStartTime = Date.now();
      const response = await fetch(`${llmUrl}/health`);
      services.push({
        service: 'LLM Service',
        status: response.ok ? 'healthy' : 'degraded',
        responseTime: Date.now() - llmStartTime,
        details: {
          url: llmUrl,
          statusCode: response.status,
        },
      });
    } catch (error) {
      services.push({
        service: 'LLM Service',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error.message,
      });
    }

    // Determine overall status
    const unhealthyCount = services.filter((s) => s.status === 'unhealthy').length;
    const degradedCount = services.filter((s) => s.status === 'degraded').length;

    let overall: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (unhealthyCount > 0) {
      overall = 'unhealthy';
    } else if (degradedCount > 0) {
      overall = 'degraded';
    }

    return {
      timestamp: new Date().toISOString(),
      environment: this.configService.get('NODE_ENV', 'development'),
      overall,
      services,
      uptime: Math.floor((Date.now() - startTime) / 1000),
    };
  }

  /**
   * Quick health check for load balancers
   */
  @Get('live')
  @Public()
  getLiveness() {
    return { status: 'alive' };
  }

  /**
   * Readiness check for Kubernetes
   */
  @Get('ready')
  @Public()
  async getReadiness(): Promise<any> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ready' };
    } catch {
      return { status: 'not-ready' };
    }
  }
}
