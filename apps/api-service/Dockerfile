# Multi-stage build for NestJS API service
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and prisma schema first
COPY apps/api-service/package*.json ./
COPY apps/api-service/prisma ./prisma

# Copy build configuration
COPY apps/api-service/tsconfig*.json ./
COPY apps/api-service/nest-cli.json ./

# Copy source code
COPY apps/api-service/src ./src

# Install dependencies and build
RUN npm ci
RUN npx prisma generate
RUN npm run build

# Production stage
FROM node:20-alpine

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl libssl3 libc6-compat

WORKDIR /app

# Copy package files and install production dependencies
COPY apps/api-service/package*.json ./
RUN npm ci --only=production

# Copy built application from builder (dist is at /app/dist in builder)
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy prisma schema for migrations
COPY apps/api-service/prisma ./prisma

# Set environment
ENV NODE_ENV=production

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start application
CMD ["node", "dist/src/main.js"]
