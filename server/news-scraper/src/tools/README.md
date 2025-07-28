# Tools Directory

## Overview
Contains all the MCP tools for web scraping and content extraction used by the News Scraper server.

## Tools

### WebpageSearchTool
- Location: `WebpageSearch.ts`
- Purpose: Search and extract content from web pages
- Features:
  - Full-text search
  - Content extraction
  - URL validation

### SingleSiteScraperTool
- Location: `SingleSiteScraper.ts`
- Purpose: Targeted scraping of specific news sites
- Features:
  - Site-specific extraction rules
  - Rate limiting
  - Error handling

### WebpageMetadataTool
- Location: `WebpageMetadata.ts`
- Purpose: Extract metadata from web pages
- Features:
  - OpenGraph data extraction
  - Schema.org parsing
  - Meta tag analysis

### ArticleExtractorTool
- Location: `ArticleExtractor.ts`
- Purpose: Extract article content
- Features:
  - Content cleaning
  - Structure preservation
  - Media extraction

### NewsHomepageTool
- Location: `NewsHomepage.ts`
- Purpose: Parse news site homepages
- Features:
  - Layout analysis
  - Article listing extraction
  - Link processing

### NewsPipelineTool
- Location: `NewsPipelineTool.ts`
- Purpose: Process and transform news content
- Features:
  - Content normalization
  - Data enrichment
  - Pipeline processing

### FirecrawlNewsHomepageTool
- Location: `FirecrawlNewsHomepage.ts`
- Purpose: Advanced news homepage crawling
- Features:
  - Dynamic content loading
  - JavaScript execution
  - State management

## Usage
Tools are automatically registered with the MCP server and available via JSON-RPC.

## Development
When adding new tools:
1. Implement the IMCPTool interface
2. Add to the DI container
3. Register in TOOL_MAP
4. Add appropriate type definitions
