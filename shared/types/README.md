# Shared Types

## Overview
This package contains shared TypeScript type definitions used across the news-scraper system.

## Types

### News Article Types
- `NewsArticlePreview`: Preview information for news articles
- `NewsArticle`: Complete article information
- `ArticleMetadata`: Metadata for news articles

### API Types
- Request/Response types for API endpoints
- Tool-specific types
- Configuration interfaces

### Utility Types
- Common utility types used across the system
- Helper type definitions
- Generic type utilities

## Usage
```typescript
import { NewsArticle, ArticleMetadata } from '@shared/types';

function processArticle(article: NewsArticle) {
  // Process the article
}
```

## Development
```bash
# Install dependencies
npm install

# Build
npm run build

# Run type checks
npm run type-check
```

## Structure
- `/src`: Source code
  - `/articles`: Article-related types
  - `/api`: API-related types
  - `/utils`: Utility types

## Integration
Used by:
- News Scraper Server
- Text Analysis Server
- UI Components
- Shared Backend
