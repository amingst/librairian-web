# Text Analysis Server

## Overview
The Text Analysis server component provides advanced text analysis capabilities for the news scraper system using Model Context Protocol (MCP) tools.

## Tools

### ArticleGrouperTool
Groups related articles together based on content similarity and topic analysis.

### TextAnalysisTool
Performs in-depth text analysis on articles, including:
- Sentiment analysis
- Key topic extraction
- Content classification

### CurrentEventsDetectorTool
Identifies and tracks current events and trending topics across multiple news sources.

### BatchArticleExtractorTool
Processes multiple articles in batch for efficient content extraction and analysis.

## Configuration
The server uses environment variables for configuration:
- `TEXT_ANALYSIS_DATABASE_URL`: Connection string for the database
- `PORT`: Server port (default in config)
- `HOST`: Server host (default in config)

## API
The server exposes a JSON-RPC endpoint at `/mcp` with the following capabilities:
- Article grouping
- Text analysis
- Event detection
- Batch processing

## Development
```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build
npm run build

# Run in production
npm start
```

## Dependencies
- OpenAI API for advanced text analysis
- Prisma for database operations
- Model Context Protocol for tool integration
