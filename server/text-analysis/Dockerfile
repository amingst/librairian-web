FROM node:24-alpine3.21 AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files for workspace setup
COPY package*.json ./
COPY shared/types/package*.json ./shared/types/
COPY shared/backend/package*.json ./shared/backend/
COPY server/text-analysis/package*.json ./server/text-analysis/

# Install dependencies
RUN npm ci --only=production

# Install dev dependencies for build
RUN npm install

# Install dependencies for shared packages
WORKDIR /app/shared/types
RUN npm install

WORKDIR /app/shared/backend
RUN npm install

WORKDIR /app

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/server/text-analysis/node_modules ./server/text-analysis/node_modules

# Copy source code
COPY shared/types/ ./shared/types/
COPY shared/backend/ ./shared/backend/
COPY server/text-analysis/ ./server/text-analysis/

# Build shared packages first
WORKDIR /app/shared/types
RUN npm run build

WORKDIR /app/shared/backend
RUN npm run build

# Build the text-analysis service
WORKDIR /app/server/text-analysis
RUN npm run build

# Production image, copy all the files and run the service
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3002

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 analyzer

# Copy necessary files
COPY --from=builder --chown=analyzer:nodejs /app/news-scraper-shared/dist ./news-scraper-shared/dist/
COPY --from=builder --chown=analyzer:nodejs /app/text-analysis-mcp/build ./text-analysis-mcp/build/
COPY --from=deps --chown=analyzer:nodejs /app/node_modules ./node_modules/
COPY --from=deps --chown=analyzer:nodejs /app/text-analysis-mcp/node_modules ./text-analysis-mcp/node_modules/

USER analyzer

EXPOSE 3002

CMD ["node", "text-analysis-mcp/build/main.js"]
