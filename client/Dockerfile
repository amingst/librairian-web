# Use Node.js 24 as base
FROM node:24-alpine3.21

# Install dependencies
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy root package files
COPY package*.json ./
COPY turbo.json ./

# Copy workspace package files
COPY shared/types/package*.json ./shared/types/
COPY shared/backend/package*.json ./shared/backend/
COPY client/package*.json ./client/

# Install dependencies
RUN npm ci

# Copy source code
COPY shared/types/ ./shared/types/
COPY shared/backend/ ./shared/backend/
COPY client/ ./client/

# Build shared packages and client
RUN npm run build

# Set working directory to client
WORKDIR /app/client

ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1

EXPOSE 3000

CMD ["npm", "start"]
