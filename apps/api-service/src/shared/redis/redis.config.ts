import { ConfigService } from '@nestjs/config';

/**
 * Creates a standard Redis connection configuration for BullMQ
 * Handles Upstash Redis with TLS and proper retry settings
 */
export function createRedisConfig(configService: ConfigService) {
  const host = configService.get('REDIS_HOST', 'localhost');
  const isUpstash = host?.includes('upstash.io');

  return {
    host,
    port: parseInt(configService.get('REDIS_PORT', '6379'), 10),
    password: configService.get('REDIS_PASSWORD'),
    db: parseInt(configService.get('REDIS_DB', '0'), 10),
    tls: isUpstash ? { rejectUnauthorized: false } : undefined,
    maxRetriesPerRequest: null, // Let BullMQ handle retries
    enableReadyCheck: false, // Disable ready check for Upstash
    connectTimeout: 30000, // 30 seconds
  };
}
