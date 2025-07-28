# Tools Directory

## Overview
This directory contains all the MCP (Model Context Protocol) tools used by the Text Analysis server.

## Tools

### ArticleGrouperTool
- Location: `ArticleGrouper.ts`
- Purpose: Groups similar articles based on content and topics
- Uses OpenAI for semantic analysis
- Handles batch processing of article groups

### TextAnalysisTool
- Location: `TextAnalysis.ts`
- Purpose: Deep content analysis of articles
- Features:
  - Sentiment analysis
  - Topic extraction
  - Content classification
  - Natural language processing

### CurrentEventsDetectorTool
- Location: `CurrentEventsDetector.ts`
- Purpose: Identifies trending topics and current events
- Features:
  - Event clustering
  - Trend detection
  - Timeline analysis
  - Cross-source correlation

### BatchArticleExtractorTool
- Location: `BatchArticleExtractor.ts`
- Purpose: Batch processing of article content
- Features:
  - Parallel processing
  - Content extraction
  - Error handling
  - Rate limiting

## Usage
Tools are automatically registered with the MCP server on startup and can be accessed via the JSON-RPC endpoint.

## Development
When creating new tools:
1. Implement the IMCPTool interface
2. Add tool to the DI container
3. Register in TOOL_MAP
4. Add appropriate type definitions
