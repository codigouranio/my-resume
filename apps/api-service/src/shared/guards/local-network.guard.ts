import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class LocalNetworkGuard implements CanActivate {
  private readonly allowedIPs = [
    '127.0.0.1',
    '::1',
    'localhost',
    '::ffff:127.0.0.1',
  ];

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const clientIP = this.getClientIP(request);

    // Allow localhost
    if (this.allowedIPs.includes(clientIP)) {
      return true;
    }

    // Allow private network ranges (10.x.x.x, 172.16-31.x.x, 192.168.x.x)
    if (this.isPrivateIP(clientIP)) {
      return true;
    }

    throw new ForbiddenException('Access denied: Bull Board is only accessible from local network');
  }

  private getClientIP(request: Request): string {
    // Check X-Forwarded-For header (if behind proxy)
    const forwardedFor = request.headers['x-forwarded-for'];
    if (forwardedFor) {
      const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor.split(',')[0];
      return ips.trim();
    }

    // Check X-Real-IP header
    const realIP = request.headers['x-real-ip'];
    if (realIP) {
      return Array.isArray(realIP) ? realIP[0] : realIP;
    }

    // Fallback to socket IP
    return request.socket.remoteAddress || request.ip || '0.0.0.0';
  }

  private isPrivateIP(ip: string): boolean {
    // Remove IPv6 prefix if present
    const cleanIP = ip.replace('::ffff:', '');

    // Private IP ranges
    const privateRanges = [
      /^10\./,                          // 10.0.0.0/8
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
      /^192\.168\./,                    // 192.168.0.0/16
      /^127\./,                         // 127.0.0.0/8 (loopback)
    ];

    return privateRanges.some(range => range.test(cleanIP));
  }
}
