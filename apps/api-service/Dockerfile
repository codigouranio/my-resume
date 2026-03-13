# Multi-stage build for NestJS API service
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/api-service/package*.json ./apps/api-service/

# Install dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY apps/api-service ./apps/api-service
COPY prisma ./prisma

# Generate Prisma client
RUN npx prisma generate

# Build the application
WORKDIR /app/apps/api-service
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install only production dependencies
COPY package*.json ./
COPY apps/api-service/package*.json ./apps/api-service/
RUN npm ci --only=production

# Copy built application
COPY --from=builder /app/apps/api-service/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start application
CMD ["node", "dist/main.js"]
