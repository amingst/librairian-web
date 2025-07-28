# HTML Scraper MCP Server

A comprehensive Model Context Protocol (MCP) server that provides advanced HTML scraping, content extraction, and news aggregation capabilities. This server allows you to scrape web pages, extract metadata, search content, and run complete news processing pipelines.

## Features

-   **News Pipeline Processing**: Complete waterfall pipeline from homepage scraping to full article text extraction
-   **Multi-Site Support**: Configure and scrape multiple news sites simultaneously
-   **Web Page Scraping**: Extract text content, links, and images from web pages
-   **Homepage Scraping**: Extract article links and previews from news homepages
-   **Text Extraction**: Clean and format article text with reading metrics
-   **Metadata Extraction**: Extract page metadata including Open Graph and Twitter Card data
-   **Content Search**: Search for specific text content within web pages
-   **CSS Selector Support**: Target specific elements using CSS selectors
-   **Rate Limiting**: Built-in delays and respectful scraping practices
-   **Error Handling**: Graceful failure handling with detailed error reporting
-   **URL Handling**: Convert relative URLs to absolute URLs

## Tools

### `news_pipeline`

Complete news processing pipeline that scrapes homepages, extracts article links, scrapes full articles, and extracts clean text content in a waterfall process.

**Parameters:**

-   `sites` (array, required): Array of site configurations with domain, name, and CSS selectors
-   `limit` (number, default: 10): Maximum number of articles to process per site
-   `delayBetweenRequests` (number, default: 1000): Delay in milliseconds between requests
-   `includeText` (boolean, default: true): Whether to extract full article text
-   `includeMetrics` (boolean, default: true): Whether to include reading time and word count

### `scrape_homepage`

Extract article links and previews from news homepages.

**Parameters:**

-   `url` (string, required): The URL of the news homepage to scrape
-   `selectors` (object, required): CSS selectors for container, title, link, image, etc.
-   `limit` (number, default: 10): Maximum number of articles to extract

### `scrape_webpage`

Scrape and extract content from a webpage.

**Parameters:**

-   `url` (string, required): The URL of the webpage to scrape
-   `selector` (string, optional): CSS selector to target specific elements
-   `extract_text` (boolean, default: true): Whether to extract text content
-   `extract_links` (boolean, default: false): Whether to extract all links
-   `extract_images` (boolean, default: false): Whether to extract image URLs
-   `max_length` (number, optional): Maximum length of extracted text

### `extract_text`

Extract and clean text content from HTML with reading metrics.

**Parameters:**

-   `url` (string, required): The URL of the webpage to extract text from
-   `selector` (string, optional): CSS selector to target specific content areas
-   `includeMetrics` (boolean, default: true): Whether to include word count and reading time

### `extract_metadata`

Extract metadata from a webpage including title, description, Open Graph tags, etc.

**Parameters:**

-   `url` (string, required): The URL of the webpage to analyze

### `search_content`

Search for specific content within a webpage.

**Parameters:**

-   `url` (string, required): The URL of the webpage to search
-   `query` (string, required): The text to search for
-   `case_sensitive` (boolean, default: false): Whether the search should be case sensitive
-   `context_chars` (number, default: 100): Number of characters to include around each match

## Installation

1. Clone or download this project
2. Install dependencies:
    ```bash
    npm install
    ```
3. Build the project:
    ```bash
    npm run build
    ```

## Usage

### News Pipeline Example

The most powerful feature is the news pipeline that processes multiple news sites:

```javascript
import { NewsPipelineTool } from './build/tools/NewsPipelineTool.js';

const pipeline = new NewsPipelineTool();
const result = await pipeline.execute({
	sites: [
		{
			domain: 'foxnews.com',
			name: 'Fox News',
			selectors: {
				container: 'article, .story',
				title: 'h2 a, h3 a, .title a',
				link: 'h2 a, h3 a, .title a',
			},
		},
		{
			domain: 'drudgereport.com',
			name: 'Drudge Report',
			selectors: {
				container: 'p, div, td',
				title: "a[href*='http']",
				link: "a[href*='http']",
			},
		},
	],
	limit: 30,
	delayBetweenRequests: 500,
	includeText: true,
	includeMetrics: true,
});
```

### With Claude Desktop

Add the server to your Claude Desktop configuration in `claude_desktop_config.json`:

```json
{
	"mcpServers": {
		"html-scraper": {
			"command": "node",
			"args": ["path/to/html-scraper-mcp/build/index.js"]
		}
	}
}
```

### HTTP Server Mode

Run as an HTTP server for non-MCP usage:

```bash
npm run start:http
```

### Direct Usage

Run the MCP server directly:

```bash
npm start
```

Or in development mode with auto-reload:

```bash
npm run dev:watch
```

## Testing

The project includes several test files for different components:

-   `test-pipeline.js` - Test the complete news pipeline
-   `test-homepage.js` - Test homepage scraping
-   `test-webscraper.js` - Test webpage scraping
-   `test-textextractor.js` - Test text extraction

Run tests:

```bash
node test-pipeline.js    # Test complete pipeline
node test-homepage.js    # Test homepage scraping
node test-webscraper.js  # Test webpage scraping
```

## Development

-   **Build**: `npm run build`
-   **Start MCP Server**: `npm start`
-   **Start HTTP Server**: `npm run start:http`
-   **Development with Watch**: `npm run dev:watch`
-   **HTTP Development**: `npm run dev:http:watch`

## Performance

The news pipeline has been tested at scale:

-   **35+ articles**: Processes in ~26 seconds (1.4 articles/second)
-   **Success Rate**: 97%+ with graceful error handling
-   **Rate Limiting**: Configurable delays (500ms-1000ms recommended)
-   **Memory Efficient**: Linear scaling with article count

## Architecture

The server is built with a modular architecture:

-   **NewsPipelineTool**: Orchestrates the complete news processing workflow
-   **HomepageScraper**: Extracts article links from news homepages
-   **WebScraper**: Scrapes individual web pages for content
-   **TextExtractor**: Cleans and processes article text with metrics
-   **HtmlMetadata**: Extracts page metadata and Open Graph data
-   **ContentSearch**: Searches for specific content within pages

## Requirements

-   Node.js 16 or higher
-   TypeScript support for development

## Dependencies

-   `@modelcontextprotocol/sdk`: MCP SDK for TypeScript
-   `cheerio`: Server-side HTML parsing
-   `axios`: HTTP client for making requests
-   `zod`: Schema validation

## Error Handling

The server includes comprehensive error handling for:

-   Network timeouts and connection errors
-   Invalid URLs
-   Missing or malformed HTML content
-   CSS selector parsing errors

## Security Considerations

-   Uses appropriate User-Agent headers to avoid being blocked
-   Implements request timeouts to prevent hanging
-   Validates all input URLs
-   Handles various character encodings properly

## License

ISC
