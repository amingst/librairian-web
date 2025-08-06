FROM node:24-alpine3.21 AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY shared/backend/package*.json ./

# Install dependencies
RUN npm ci --only=production

# Build stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY shared/backend/ ./

# Build the shared types
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 shared

# Copy built files
COPY --from=builder --chown=shared:nodejs /app/dist ./dist/
COPY --from=builder --chown=shared:nodejs /app/package*.json ./

USER shared

# This is a build-only container, so it will exit after building
CMD ["echo", "Shared types built successfully"]
