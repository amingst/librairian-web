# Shared Backend

## Overview
The shared backend package provides common utilities, types, and functionality used across different services in the news-scraper system.

## Features

### PrismaClientFactory
A singleton factory for managing Prisma database connections across services.

### MCPHttpServer
A Model Context Protocol (MCP) server implementation with:
- Tool registration
- Request handling
- Configuration management

### Common Types
- Tool interfaces
- Configuration types
- Shared utilities

## Usage

### PrismaClient Factory
```typescript
import { PrismaClientFactory } from '@shared/backend';

const prisma = PrismaClientFactory.getInstance('your-service-name');
```

### MCP Server
```typescript
import { MCPHttpServer } from '@shared/backend';

const server = new MCPHttpServer(serverConfig, expressConfig);
server.registerTools(tools);
```

## Development
```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test
```

## Directory Structure
- `/src`: Source code
  - `/server`: Server implementations
  - `/types`: Type definitions
  - `/utils`: Utility functions

## Dependencies
- Prisma
- Express
- Model Context Protocol SDK
- TypeScript
