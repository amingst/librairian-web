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
interface PharosClientConfig {
	serverUrl: string;
	timeout?: number;
}

// Tool execution results
type MCPResult = any;

export class PharosClient {
	private client: Client | null = null;
	private transport: StreamableHTTPClientTransport | null = null;
	private isConnected: boolean = false;
	private serverUrl: string;

	constructor(
		config: PharosClientConfig = { serverUrl: 'http://localhost:3001' }
	) {
		this.serverUrl = config.serverUrl;
	}

	/**
	 * Wrapper for MCP tool calls with timeout handling
	 */
	private async callToolWithTimeout(
		toolName: string,
		args: any,
		timeoutMs: number = 120000 // 2 minutes default
	): Promise<any> {
		if (!this.client || !this.isConnected) {
			throw new Error('Client not connected');
		}

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
		if (this.isConnected && this.client && this.transport) {
			console.log('✅ Already connected to Pharos MCP server');
			return;
		}

		try {
			// Ensure clean state before connecting
			await this.disconnect();

			// Create new transport and client
			this.transport = new StreamableHTTPClientTransport(
				new URL(`${this.serverUrl}/mcp`)
			);

			this.client = new Client(
				{
					name: 'pharos-client',
					version: '1.0.0',
				},
				{
					capabilities: {},
				}
			);

			// Connect to the server
			await this.client.connect(this.transport);
			this.isConnected = true;
			console.log('✅ Connected to Pharos MCP server');
		} catch (error) {
			console.error('❌ Failed to connect to Pharos MCP server:', error);
			this.isConnected = false;
			this.client = null;
			this.transport = null;
			throw error;
		}
	}

	/**
	 * Disconnect from the MCP server
	 */
	async disconnect(): Promise<void> {
		if (this.client || this.transport) {
			try {
				if (this.client && this.isConnected) {
					await this.client.close();
				}
			} catch (error) {
				console.warn('Error during disconnect:', error);
			} finally {
				this.isConnected = false;
				this.client = null;
				this.transport = null;
				console.log('🔌 Disconnected from Pharos MCP server');
			}
		}
	}

	// Helper Methods

	private async ensureConnected(): Promise<void> {
		if (!this.isConnected) {
			await this.connect();
		}
	}

	private parseToolResult(result: MCPResult): any {
		if (result?.content?.[0]?.text) {
			try {
				return JSON.parse(result.content[0].text);
			} catch {
				return result.content[0].text;
			}
		}
		return result;
	}

	// News Source Management Methods

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

	// Web Scraping Methods

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
				60000
			);

			return this.parseToolResult(result);
		} catch (error) {
			console.error('❌ Failed to scrape webpage:', error);
			throw error;
		}
	}

	async extractMetadata(url: string): Promise<PageMetadata> {
		await this.ensureConnected();

		try {
			const result = await this.callToolWithTimeout(
				'extract_metadata',
				{ url },
				30000
			);

			return this.parseToolResult(result);
		} catch (error) {
			console.error('❌ Failed to extract metadata:', error);
			throw error;
		}
	}

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
				30000
			);

			return this.parseToolResult(result);
		} catch (error) {
			console.error('❌ Failed to search content:', error);
			throw error;
		}
	}

	// Article Processing Methods

	async extractArticle(url: string): Promise<StructuredArticle> {
		await this.ensureConnected();

		try {
			const result = await this.callToolWithTimeout(
				'extract_text',
				{ url },
				45000
			);

			return this.parseToolResult(result);
		} catch (error) {
			console.error('❌ Failed to extract article:', error);
			throw error;
		}
	}

	async extractArticleWithStreaming(
		params: {
			url: string;
			include_media?: boolean;
			extract_tags?: boolean;
			estimate_reading_time?: boolean;
		},
		progressCallback?: (
			stage: string,
			progress: number,
			message: string
		) => void
	): Promise<any> {
		await this.ensureConnected();

		try {
			progressCallback?.('fetching', 10, 'Fetching article content...');
			progressCallback?.(
				'extracting_basic',
				25,
				'Extracting basic article information...'
			);
			progressCallback?.(
				'extracting_content',
				50,
				'Extracting article content...'
			);
			progressCallback?.(
				'extracting_metadata',
				80,
				'Extracting metadata...'
			);

			const result = await this.callToolWithTimeout(
				'extract_text',
				{
					url: params.url,
					include_media: params.include_media ?? true,
					extract_tags: params.extract_tags ?? true,
					estimate_reading_time: params.estimate_reading_time ?? true,
				},
				60000
			);

			progressCallback?.('saving', 95, 'Processing results...');
			const parsedResult = this.parseToolResult(result);
			progressCallback?.(
				'completed',
				100,
				'Article extraction completed!'
			);

			return parsedResult;
		} catch (error) {
			console.error(
				'❌ Failed to extract article with streaming:',
				error
			);
			throw error;
		}
	}

	// News Homepage Scraping Methods

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
					limit: params.limit ?? 20,
					includeMedia: params.includeMedia ?? true,
					includeSections: params.includeSections ?? true,
					includeMetrics: params.includeMetrics ?? false,
					sortBy: params.sortBy ?? 'position',
				},
				600000
			);

			const duration = Date.now() - startTime;
			console.log(
				`✅ Firecrawl completed in ${duration}ms (${(
					duration / 1000
				).toFixed(1)}s)`
			);

			const parsed = this.parseToolResult(result);
			const data: Record<string, NewsArticlePreview[]> = parsed.data;
			const dataWithUUIDs: Record<string, NewsArticlePreview[]> = {};

			for (const [group, articles] of Object.entries(data)) {
				dataWithUUIDs[group] = articles.map((article) => ({
					...article,
					id: article.id?.length === 36 ? article.id : uuidv4(),
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

	// Article Analysis Methods

	async groupArticlesByCurrentEvents(
		articles: NewsArticlePreview[],
		options?: {
			maxGroups?: number;
			minArticlesPerGroup?: number;
			useOpenAI?: boolean;
		}
	): Promise<Record<string, NewsArticlePreview[]>> {
		await this.ensureConnected();

		try {
			console.log('🤖 Grouping articles by current events:', {
				articleCount: articles.length,
				options,
				sampleTitles: articles.slice(0, 3).map((a) => a.title),
			});

			const result = await this.callToolWithTimeout(
				'group_articles_by_current_events',
				{
					articles,
					options: options || {},
				}
			);

			const parsed = this.parseToolResult(result);
			console.log('📊 Article grouping completed');

			return parsed;
		} catch (error) {
			console.error('❌ Failed to group articles:', error);
			throw error;
		}
	}

	async analyzeText(
		text: string,
		options?: {
			sentiment?: boolean;
			keywords?: boolean;
			summary?: boolean;
		}
	): Promise<any> {
		await this.ensureConnected();

		try {
			const result = await this.callToolWithTimeout('analyze_text', {
				text,
				options: options || {},
			});

			return this.parseToolResult(result);
		} catch (error) {
			console.error('Failed to analyze text:', error);
			throw error;
		}
	}

	async detectCurrentEvents(
		articles: NewsArticlePreview[],
		timeframe?: string
	): Promise<any> {
		await this.ensureConnected();

		try {
			const result = await this.callToolWithTimeout(
				'detect_current_events',
				{
					articles,
					timeframe: timeframe || '24h',
				}
			);

			return this.parseToolResult(result);
		} catch (error) {
			console.error('Failed to detect current events:', error);
			throw error;
		}
	}

	// News Briefing Methods

	async createNewsBriefing(
		articles: NewsArticlePreview[],
		options: {
			briefingType?: 'executive' | 'detailed' | 'summary';
			targetAudience?: 'general' | 'business' | 'technical' | 'academic';
			includeSourceAttribution?: boolean;
			maxSections?: number;
			prioritizeTopics?: string[];
		} = {}
	): Promise<any> {
		await this.ensureConnected();

		try {
			const result = await this.callToolWithTimeout(
				'create_news_briefing',
				{
					articles,
					briefingType: options.briefingType || 'summary',
					targetAudience: options.targetAudience || 'general',
					includeSourceAttribution:
						options.includeSourceAttribution ?? true,
					maxSections: options.maxSections || 10,
					prioritizeTopics: options.prioritizeTopics,
				}
			);

			return this.parseToolResult(result);
		} catch (error) {
			console.error('Error creating news briefing:', error);
			throw error;
		}
	}

	async createNewsBriefingFromSummaries(
		postIds: string[],
		options: {
			briefingType?: 'executive' | 'detailed' | 'summary';
			targetAudience?: 'general' | 'business' | 'technical' | 'academic';
			includeSourceAttribution?: boolean;
			includeAllSections?: boolean;
			maxSections?: number;
			prioritizeTopics?: string[];
		} = {}
	): Promise<any> {
		await this.ensureConnected();

		try {
			const result = await this.callToolWithTimeout(
				'create_news_briefing_from_summaries',
				{
					ids: postIds,
					briefingType: options.briefingType || 'summary',
					targetAudience: options.targetAudience || 'general',
					includeSourceAttribution:
						options.includeSourceAttribution ?? true,
					includeAllSections: options.includeAllSections ?? true,
					maxSections: options.maxSections || 10,
					prioritizeTopics: options.prioritizeTopics,
				}
			);

			return this.parseToolResult(result);
		} catch (error) {
			console.error(
				'Error creating news briefing from summaries:',
				error
			);
			throw error;
		}
	}

	async summarizeArticlesBatch(
		articles: {
			title: string;
			content: string;
			source?: string;
			date?: string;
		}[],
		audience:
			| 'general'
			| 'investor'
			| 'academic'
			| 'technical'
			| 'executive' = 'general',
		detail: 'brief' | 'standard' | 'comprehensive' = 'brief',
		model?: string
	): Promise<any> {
		await this.ensureConnected();

		try {
			console.log('🔍 Summarizing articles batch:', {
				articlesCount: articles.length,
				audience,
				detail,
				model,
			});

			const result = await this.callToolWithTimeout(
				'summarize_articles_batch',
				{
					articles,
					audience,
					detail,
					...(model && { model }),
				}
			);

			return this.parseToolResult(result);
		} catch (error) {
			console.error('Error summarizing articles batch:', error);
			throw error;
		}
	}

	// Job-related methods
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
				30000
			);

			const parsedResult = this.parseToolResult(result);
			console.log(`✅ Started scraping job: ${parsedResult.jobId}`);

			return parsedResult;
		} catch (error) {
			console.error('❌ Failed to start homepage scraping job:', error);
			throw error;
		}
	}

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
				30000
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
				60000
			);

			const parsedResult = this.parseToolResult(result);
			console.log(
				`✅ Completed HTML scraper job: ${parsedResult.totalArticlesProcessed} articles processed`
			);

			return parsedResult;
		} catch (error) {
			console.error('❌ Failed to start HTML scraper job:', error);
			throw error;
		}
	}

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
				120000
			);

			const parsedResult = this.parseToolResult(result);
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
			return data;
		} catch (error) {
			console.error('❌ Failed to scrape selected sources:', error);
			throw error;
		}
	}

	get connected(): boolean {
		return this.isConnected && this.client !== null;
	}
}

// Export a singleton instance for easy use
export const pharosClient = new PharosClient();

// Export types
export type { NewsSource, NewsSourceDetails, PharosClientConfig };
