# Multi-stage build for React frontend with Rsbuild
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY apps/my-resume/package*.json ./
COPY apps/my-resume/yarn.lock* ./

# Install dependencies (use yarn as specified in instructions)
RUN yarn install --frozen-lockfile

# Copy source code
COPY apps/my-resume ./

# Build arguments for environment variables
ARG PUBLIC_API_URL
ARG PUBLIC_LLM_API_URL

# Build the application
RUN yarn build

# Production stage - serve with nginx
FROM nginx:alpine

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY apps/my-resume/nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 8080 (Cloud Run default)
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget --quiet --tries=1 --spider http://localhost:8080/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
