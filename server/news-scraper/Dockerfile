FROM node:24-alpine3.21 AS base

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files for workspace setup
COPY package*.json ./
COPY shared/types/package*.json ./shared/types/
COPY shared/backend/package*.json ./shared/backend/
COPY server/news-scraper/package*.json ./server/news-scraper/

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
COPY --from=deps /app/server/news-scraper/node_modules ./server/news-scraper/node_modules

# Copy source code
COPY shared/types/ ./shared/types/
COPY shared/backend/ ./shared/backend/
COPY server/news-scraper/ ./server/news-scraper/

# Build shared packages first
WORKDIR /app/shared/types
RUN npm run build

WORKDIR /app/shared/backend
RUN npm run build

# Build the news-scraper service
WORKDIR /app/server/news-scraper
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 scraper

# Copy necessary files
COPY --from=builder --chown=scraper:nodejs /app/news-scraper-shared/dist ./news-scraper-shared/dist/
COPY --from=builder --chown=scraper:nodejs /app/html-scraper-mcp/build ./html-scraper-mcp/build/
COPY --from=builder --chown=scraper:nodejs /app/html-scraper-mcp/config ./html-scraper-mcp/config/
COPY --from=deps --chown=scraper:nodejs /app/node_modules ./node_modules/
COPY --from=deps --chown=scraper:nodejs /app/html-scraper-mcp/node_modules ./html-scraper-mcp/node_modules/

USER scraper

EXPOSE 3001

CMD ["node", "html-scraper-mcp/build/main.js"]
