import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { v4 as uuidv4 } from 'uuid';
import type {
	NewsArticlePreview,
	StructuredArticle,
	SearchResult,
	PageMetadata,
	NewsSource,
	NewsSourceDetails,
} from '@shared/types';

// MCP Client Configuration
interface MCPClientConfig {
	serverUrl: string;
	timeout?: number;
}

// Tool execution results - use proper MCP types
type MCPResult = any; // Using any for now since the MCP types are complex

export class NewsScraperMCPClient {
	private client: Client;
	private transport: StreamableHTTPClientTransport;
	private isConnected: boolean = false;
	private serverUrl: string;

	constructor(
		config: MCPClientConfig = { serverUrl: 'http://localhost:3001' }
	) {
		this.serverUrl = config.serverUrl;

		// Create HTTP transport for your Express MCP server
		this.transport = new StreamableHTTPClientTransport(
			new URL(`${this.serverUrl}/mcp`)
		);

		// Create MCP client
		this.client = new Client(
			{
				name: 'news-scraper-client',
				version: '1.0.0',
			},
			{
				capabilities: {},
			}
		);
	}

	/**
	 * Wrapper for MCP tool calls with timeout handling
	 */
	private async callToolWithTimeout(
		toolName: string,
		args: any,
		timeoutMs: number = 120000 // 2 minutes default
	): Promise<any> {
		// For debugging - disable timeout for Firecrawl calls in development
		if (
			toolName === 'firecrawl_news_homepage' &&
			process.env.NODE_ENV === 'development'
		) {
			console.log(
				`🔧 Development mode: Disabling timeout for ${toolName}`
			);
			return this.client.callTool({
				name: toolName,
				arguments: args,
			});
		}

		return Promise.race([
			this.client.callTool({
				name: toolName,
				arguments: args,
			}),
			new Promise<never>((_, reject) =>
				setTimeout(
					() =>
						reject(
							new Error(
								`Tool ${toolName} timed out after ${timeoutMs}ms`
							)
						),
					timeoutMs
				)
			),
		]);
	}

	/**
	 * Connect to the MCP server
	 */
	async connect(): Promise<void> {
		if (this.isConnected) {
			console.log('✅ Already connected to MCP server');
			return;
		}

		try {
			// Ensure clean state before connecting
			await this.disconnect();
			
			// The Client.connect() method automatically starts the transport
			await this.client.connect(this.transport);
			this.isConnected = true;
			console.log('✅ Connected to MCP server');
		} catch (error) {
			console.error('❌ Failed to connect to MCP server:', error);
			this.isConnected = false; // Reset connection state on failure
			throw error;
		}
	}

	/**
	 * Disconnect from the MCP server
	 */
	async disconnect(): Promise<void> {
		if (!this.isConnected) return;

		try {
			await this.client.close();
			this.isConnected = false;
			console.log('🔌 Disconnected from MCP server');
		} catch (error) {
			console.error('❌ Error disconnecting:', error);
			// Force reset connection state even if disconnect fails
			this.isConnected = false;
		}
	}

	/**
	 * Get list of available MCP tools
	 */
	async getAvailableTools() {
		await this.ensureConnected();

		try {
			const result = await this.client.listTools();
			return result.tools;
		} catch (error) {
			console.error('❌ Failed to get tools:', error);
			throw error;
		}
	}

	/**
	 * Get list of news sources from the API
	 */
	async getNewsSources(): Promise<NewsSource[]> {
		try {
			const response = await fetch(`${this.serverUrl}/api/news-sources`);
			const data = await response.json();

			if (!data.success) {
				throw new Error(data.error || 'Failed to fetch news sources');
			}

			return data.data.sources;
		} catch (error) {
			console.error('❌ Failed to get news sources:', error);
			throw error;
		}
	}

	/**
	 * Get full configuration for a specific news source
	 */
	async getNewsSourceDetails(sourceId: string): Promise<NewsSourceDetails> {
		try {
			const response = await fetch(
				`${this.serverUrl}/api/news-sources/${sourceId}`
			);
			const data = await response.json();

			if (!data.success) {
				throw new Error(data.error || 'News source not found');
			}

			return data.data;
		} catch (error) {
			console.error(
				`❌ Failed to get source details for ${sourceId}:`,
				error
			);
			throw error;
		}
	}

	/**
	 * Scrape a single webpage
	 */
	async scrapeWebpage(params: {
		url: string;
		selector?: string;
		extractText?: boolean;
		extractLinks?: boolean;
		extractImages?: boolean;
		maxContentLength?: number;
	}): Promise<any> {
		await this.ensureConnected();

		try {
			const result = await this.callToolWithTimeout(
				'scrape_webpage',
				{
					url: params.url,
					selector: params.selector,
					extract_text: params.extractText ?? true,
					extract_links: params.extractLinks ?? false,
					extract_images: params.extractImages ?? false,
					max_content_length: params.maxContentLength,
				},
				60000 // 1 minute timeout for individual page scraping
			);

			return this.parseToolResult(result);
		} catch (error) {
			console.error('❌ Failed to scrape webpage:', error);
			throw error;
		}
	}

	/**
	 * Extract metadata from a webpage
	 */
	async extractMetadata(url: string): Promise<PageMetadata> {
		await this.ensureConnected();

		try {
			const result = await this.callToolWithTimeout(
				'extract_metadata',
				{ url },
				30000 // 30 seconds timeout for metadata extraction
			);

			return this.parseToolResult(result);
		} catch (error) {
			console.error('❌ Failed to extract metadata:', error);
			throw error;
		}
	}

	/**
	 * Search content within a webpage
	 */
	async searchContent(params: {
		url: string;
		query: string;
		caseSensitive?: boolean;
		contextChars?: number;
		maxResults?: number;
	}): Promise<SearchResult> {
		await this.ensureConnected();

		try {
			const result = await this.callToolWithTimeout(
				'search_content',
				{
					url: params.url,
					query: params.query,
					case_sensitive: params.caseSensitive ?? false,
					context_chars: params.contextChars ?? 100,
					max_results: params.maxResults ?? 10,
				},
				30000 // 30 seconds timeout for content search
			);

			return this.parseToolResult(result);
		} catch (error) {
			console.error('❌ Failed to search content:', error);
			throw error;
		}
	}

	/**
	 * Extract structured article content with streaming progress
	 */
	async extractArticle(url: string): Promise<StructuredArticle> {
		await this.ensureConnected();

		try {
			const result = await this.callToolWithTimeout(
				'extract_text',
				{ url },
				45000 // 45 seconds timeout for text extraction
			);

			return this.parseToolResult(result);
		} catch (error) {
			console.error('❌ Failed to extract article:', error);
			throw error;
		}
	}

	/**
	 * Extract structured article content with streaming progress updates
	 */
	async extractArticleWithStreaming(
		params: {
			url: string;
			include_media?: boolean;
			extract_tags?: boolean;
			estimate_reading_time?: boolean;
		},
		progressCallback?: (stage: string, progress: number, message: string) => void
	): Promise<any> {
		await this.ensureConnected();

		try {
			// Since MCP doesn't support streaming callbacks directly,
			// we'll simulate the progress stages manually and call the tool
			progressCallback?.('fetching', 10, 'Fetching article content...');
			
			progressCallback?.('extracting_basic', 25, 'Extracting basic article information...');
			
			progressCallback?.('extracting_content', 50, 'Extracting article content...');
			
			progressCallback?.('extracting_metadata', 80, 'Extracting metadata...');

			const result = await this.callToolWithTimeout(
				'extract_text',
				{
					url: params.url,
					include_media: params.include_media ?? true,
					extract_tags: params.extract_tags ?? true,
					estimate_reading_time: params.estimate_reading_time ?? true,
				},
				60000 // 1 minute timeout
			);

			progressCallback?.('saving', 95, 'Processing results...');

			const parsedResult = this.parseToolResult(result);
			
			progressCallback?.('completed', 100, 'Article extraction completed!');

			return parsedResult;
		} catch (error) {
			console.error('❌ Failed to extract article with streaming:', error);
			throw error;
		}
	}

	/**
	 * Scrape news homepages
	 */
	async scrapeNewsHomepages(params: {
		sources: NewsSourceDetails[];
		limit?: number;
		includeMedia?: boolean;
		includeSections?: boolean;
		includeMetrics?: boolean;
		sortBy?: 'position' | 'date' | 'priority';
	}): Promise<Record<string, NewsArticlePreview[]>> {
		await this.ensureConnected();
		try {
			console.log(
				`🚀 Starting news homepage scraping for ${params.sources.length} sources`
			);
			const startTime = Date.now();

			// Convert NewsSourceDetails to the format expected by the MCP tool
			const sites = params.sources.map((source) => ({
				domain: new URL(source.url).hostname.replace('www.', ''),
				name: source.name,
				selectors: {
					container: ['article', '.article', '.story'],
					title: [
						'h2 a',
						'h3 a',
						'.title a',
						'a[data-module="ArticleTitle"]',
					],
					link: [
						'h2 a',
						'h3 a',
						'.title a',
						'a[data-module="ArticleTitle"]',
					],
					image: ['img', '.media img'],
					...source.selectors,
				},
			}));

			console.log(
				`📡 Calling Firecrawl tool with domains:`,
				sites.map((s) => s.domain)
			);

			const result = await this.callToolWithTimeout(
				'firecrawl_news_homepage',
				{
					urls: sites.map((s) => s.domain),
					limit: 20,
					includeMedia: params.includeMedia ?? true,
					includeSections: params.includeSections ?? true,
					includeMetrics: params.includeMetrics ?? false,
					sortBy: params.sortBy ?? 'position',
				},
				600000 // 10 minutes timeout for news scraping (increased from 3 minutes)
			);

			const duration = Date.now() - startTime;
			console.log(
				`✅ Firecrawl completed in ${duration}ms (${(
					duration / 1000
				).toFixed(1)}s)`
			);

			const parsed = this.parseToolResult(result);
			// Assign UUIDs to all articles if not already a valid UUID
			const data: Record<string, NewsArticlePreview[]> = parsed.data;
			const uuidify = (id: string | undefined) =>
				id && id.length === 36 ? id : uuidv4();
			const dataWithUUIDs: Record<string, NewsArticlePreview[]> = {};
			for (const [group, articles] of Object.entries(data)) {
				dataWithUUIDs[group] = articles.map((article) => ({
					...article,
					id: uuidify(article.id),
				}));
			}

			const totalArticles = Object.values(dataWithUUIDs).flat().length;
			console.log(
				`📊 Scraped ${totalArticles} articles from ${
					Object.keys(dataWithUUIDs).length
				} sources`
			);

			return dataWithUUIDs;
		} catch (error) {
			console.error('❌ Failed to scrape news homepages:', error);
			throw error;
		}
	}

	/**
	 * Complete news scraping pipeline
	 */
	async scrapeNewsPipeline(params: {
		sources: NewsSourceDetails[];
		limit?: number;
		delayBetweenRequests?: number;
		includeHtml?: boolean;
		includeText?: boolean;
		includeMetrics?: boolean;
	}): Promise<any> {
		await this.ensureConnected();

		try {
			// Convert to expected format
			const sites = params.sources.map((source) => ({
				domain: new URL(source.url).hostname.replace('www.', ''),
				name: source.name,
				selectors: source.selectors,
			}));

			const result = await this.callToolWithTimeout(
				'scrape_news_pipeline',
				{
					sites,
					limit: params.limit ?? 10,
					delayBetweenRequests: params.delayBetweenRequests ?? 1000,
					includeHtml: params.includeHtml ?? false,
					includeText: params.includeText ?? true,
					includeMetrics: params.includeMetrics ?? false,
				},
				240000 // 4 minutes timeout for pipeline
			);

			return this.parseToolResult(result);
		} catch (error) {
			console.error('❌ Failed to run news pipeline:', error);
			throw error;
		}
	}

	/**
	 * Start a job to scrape news homepages asynchronously
	 * Returns a job ID that can be used to check the status later
	 */
	async startHomepageFirecrawlJob(params: {
		urls: string[];
		limit?: number;
	}): Promise<{
		jobId: string;
		status: string;
		message: string;
		startTime: Date;
	}> {
		await this.ensureConnected();

		try {
			console.log(
				`🚀 Starting asynchronous news homepage scraping job for ${params.urls.length} URLs`
			);

			const result = await this.callToolWithTimeout(
				'start_homepage_firecrawl_job',
				{
					urls: params.urls,
					limit: params.limit ?? 20,
				},
				30000 // 30 seconds timeout just for starting the job
			);

			const parsedResult = this.parseToolResult(result);
			console.log(`✅ Started scraping job: ${parsedResult.jobId}`);

			return parsedResult;
		} catch (error) {
			console.error('❌ Failed to start homepage scraping job:', error);
			throw error;
		}
	}

	/**
	 * Start a job to extract article content from URLs asynchronously
	 * Returns a job ID that can be used to check the status later
	 */
	async startArticleExtractFirecrawlJob(params: {
		urls?: string[];
		limit?: number;
		webhookUrl?: string;
	}): Promise<{
		jobId: string;
		status: string;
		message: string;
		startTime: Date;
	}> {
		await this.ensureConnected();

		try {
			console.log(
				`🚀 Starting asynchronous article extraction job for ${
					params.urls?.length || 0
				} URLs`
			);

			const result = await this.callToolWithTimeout(
				'start_article_extract_firecrawl_job',
				{
					urls: params.urls || [],
					limit: params.limit,
					webhookUrl: params.webhookUrl,
				},
				30000 // 30 seconds timeout just for starting the job
			);

			const parsedResult = this.parseToolResult(result);
			console.log(
				`✅ Started article extraction job: ${parsedResult.jobId}`
			);

			return parsedResult;
		} catch (error) {
			console.error('❌ Failed to start article extraction job:', error);
			throw error;
		}
	}

	/**
	 * Start a homepage HTML scraper job using local parsing (no Firecrawl)
	 */
	async startHomepageHtmlScraperJob(params: {
		urls: string[];
		limit?: number;
	}): Promise<{
		message: string;
		totalArticlesProcessed: number;
		results: Array<{ url: string; articles: number; error?: string }>;
		completedAt: string;
	}> {
		try {
			await this.ensureConnected();

			console.log(
				`🚀 Starting HTML scraper job for ${params.urls.length} URLs...`
			);

			const result = await this.callToolWithTimeout(
				'start_homepage_html_scraper_job',
				{
					urls: params.urls,
					limit: params.limit || 20,
				},
				60000 // 60 seconds timeout since this processes synchronously
			);

			const parsedResult = JSON.parse(result.content[0].text);
			console.log(
				`✅ Completed HTML scraper job: ${parsedResult.totalArticlesProcessed} articles processed`
			);

			return parsedResult;
		} catch (error) {
			console.error('❌ Failed to start HTML scraper job:', error);
			throw error;
		}
	}

	/**
	 * Start an article HTML scraper job using local parsing (no Firecrawl)
	 */
	async startArticleHtmlScraperJob(params: {
		postIds?: string[];
		limit?: number;
	}): Promise<{
		message: string;
		totalArticlesProcessed: number;
		results: Array<{
			url: string;
			postId: string;
			success: boolean;
			error?: string;
		}>;
		completedAt: string;
	}> {
		try {
			await this.ensureConnected();

			console.log(
				`🚀 Starting HTML article extraction job for ${
					params.postIds?.length || 'auto-detected'
				} posts...`
			);

			const result = await this.callToolWithTimeout(
				'start_article_html_scraper_job',
				{
					postIds: params.postIds,
					limit: params.limit || 50,
				},
				120000 // 2 minutes timeout since this processes article content
			);

			const parsedResult = JSON.parse(result.content[0].text);
			console.log(
				`✅ Completed HTML article extraction job: ${parsedResult.totalArticlesProcessed} articles processed`
			);

			return parsedResult;
		} catch (error) {
			console.error(
				'❌ Failed to start HTML article extraction job:',
				error
			);
			throw error;
		}
	}

	/**
	 * Convenience method to get and scrape selected sources
	 */
	async scrapeSelectedSources(
		sourceIds: string[],
		options?: {
			limit?: number;
			includeMedia?: boolean;
			includeSections?: boolean;
		}
	): Promise<Record<string, NewsArticlePreview[]>> {
		try {
			// Get full details for each source
			const sourceDetails = await Promise.all(
				sourceIds.map((id) => this.getNewsSourceDetails(id))
			);

			// Scrape all sources
			const data = await this.scrapeNewsHomepages({
				sources: sourceDetails,
				...options,
			});
			// Already UUID-ified in scrapeNewsHomepages
			return data;
		} catch (error) {
			console.error('❌ Failed to scrape selected sources:', error);
			throw error;
		}
	}

	// Private helper methods
	private async ensureConnected(): Promise<void> {
		if (!this.isConnected) {
			await this.connect();
		}
	}

	private parseToolResult(result: MCPResult): any {
		try {
			if (result.content && result.content[0] && result.content[0].text) {
				return JSON.parse(result.content[0].text);
			}
			return result;
		} catch (error) {
			console.warn(
				'⚠️ Could not parse tool result as JSON, returning raw result'
			);
			return result;
		}
	}
}

// Export a singleton instance for easy use
export const mcpClient = new NewsScraperMCPClient();

// Export types for use in components
export type { NewsSource, NewsSourceDetails, MCPClientConfig };
