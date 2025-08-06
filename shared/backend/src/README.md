# Backend Source Directory

## Overview
Contains core backend functionality shared across the news-scraper system.

## Files

### PrismaClientFactory.ts
- Database client factory
- Connection management
- Environment configuration

### repository.ts
- Base repository patterns
- Data access abstraction
- Common CRUD operations

### server.ts
- MCP server implementation
- HTTP server configuration
- Tool registration

### tool.ts
- Base tool implementations
- Tool interfaces
- Common tool utilities

## Components

### Database Management
- Connection pooling
- Client instantiation
- Environment-based configuration

### Server Infrastructure
- MCP protocol implementation
- Express integration
- Tool registration system

### Repository Pattern
- Generic repository implementations
- Type-safe data access
- Common database operations

### Tool Framework
- Base tool classes
- Registration mechanisms
- Common tool utilities

## Usage
These components provide the foundation for:
- Database access
- Server implementation
- Tool development
- Data management

## Development
When extending functionality:
1. Follow existing patterns
2. Maintain type safety
3. Update documentation
4. Add appropriate tests
