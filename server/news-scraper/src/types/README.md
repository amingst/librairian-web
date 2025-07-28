# Type Organization

The TypeScript types have been organized into focused modules for better maintainability and development experience. This modular approach makes it easier to work with specific parts of the scraping system.

## Files Overview

### `src/types/article.ts` - Core Article Types

Contains the fundamental article and content structures:

-   `BaseArticlePreview` - Basic article preview interface with title, link, and timestamp
-   `MediaContent` - Media content structure for images, videos, and other media
-   `ArticleContent` - Full article content structure including HTML and cleaned text
-   `ArticleMetadata` - Article metadata including language, source, publication info
-   `StructuredArticle` - Complete structured article combining preview, content, and metadata
-   `ExtractTextParams` - Parameters for text extraction operations

### `src/types/news.ts` - News Processing Types

News-specific types for homepage scraping and site configuration:

-   `NewsMediaContent` - News-specific media content with captions and alt text
-   `ArticleMetrics` - Article metrics including reading time, word count, and engagement
-   `SourceInformation` - Source metadata including site name, domain, and credibility
-   `NewsArticlePreview` - Extended article preview with news-specific fields
-   `SiteConfig` - Complete site configuration for multi-site scraping
-   `SiteSelectors` - CSS selectors configuration for different news sites
-   `NewsHomepageParams` - Parameters for news homepage scraping operations

### `src/types/scraping.ts` - Web Scraping Types

General web scraping and content extraction types:

-   `ScrapedContent` - Basic scraped content structure with text, links, and images
-   `LinkData` & `ImageData` - Structured data for links and images with metadata
-   `ScrapeWebpageParams` - Parameters for individual webpage scraping
-   `PageMetadata` - Complete page metadata including title, description, and tags
-   `HeadingData` - HTML heading structure with hierarchy information
-   `ExtractMetadataParams` - Parameters for metadata extraction operations

### `src/types/search.ts` - Content Search Types

Content search and text analysis types:

-   `SearchResult` - Complete search result with matches and context
-   `SearchMatch` - Individual search match with position and surrounding text
-   `SearchContentParams` - Parameters for content search operations with filters

### `src/types/response.ts` - API Response Types

Response formatting and API communication types:

-   `MCPToolResponse` - Standard MCP tool response format for consistency
-   `ScrapingResponse<T>` - Generic scraping response wrapper with error handling
-   `NewsHomepageResult` - Specific result type for news homepage scraping operations

### `src/types/index.ts` - Central Export Hub

Re-exports all types for convenient importing throughout the project. This file serves as the central hub for type imports.

## Usage Examples

### Import All Types (Recommended)

Import from the central index for commonly used types:

```typescript
import {
	StructuredArticle,
	NewsArticlePreview,
	MCPToolResponse,
	SiteConfig,
	ArticleMetrics,
} from '../types/index.js';
```

### Import from Specific Files

For more targeted imports or when working with specific modules:

```typescript
// Article-specific types
import { StructuredArticle, ArticleContent } from '../types/article.js';

// News processing types
import { NewsArticlePreview, SiteConfig } from '../types/news.js';

// Scraping operation types
import { ScrapedContent, PageMetadata } from '../types/scraping.js';

// Search functionality types
import { SearchResult, SearchMatch } from '../types/search.js';

// Response formatting types
import { MCPToolResponse, ScrapingResponse } from '../types/response.js';
```

## Type Hierarchy

The types are designed with a clear hierarchy:

1. **Base Types** (`article.ts`) - Core structures used throughout the system
2. **Specialized Types** (`news.ts`, `scraping.ts`, `search.ts`) - Domain-specific extensions
3. **Response Types** (`response.ts`) - API communication and result formatting
4. **Index** (`index.ts`) - Convenient access point for all types

## Benefits of This Organization

-   **Maintainability**: Each file focuses on a specific domain
-   **Discoverability**: Easy to find types related to specific functionality
-   **Reusability**: Types can be imported independently or together
-   **Type Safety**: Strong TypeScript support throughout the scraping pipeline
-   **Documentation**: Each type is well-documented with JSDoc comments
