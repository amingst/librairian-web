import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { NewsArticlePreview } from '@shared/types';

export class TextAnalysisMCPClient {
	private client: Client | null = null;
	private transport: StreamableHTTPClientTransport | null = null;
	private isConnected = false;

	async connect(): Promise<void> {
		if (this.isConnected) return;

		try {
			this.transport = new StreamableHTTPClientTransport(
				new URL('http://localhost:3002/mcp')
			);

			this.client = new Client(
				{
					name: 'news-scraper-text-analysis-client',
					version: '1.0.0',
				},
				{
					capabilities: {},
				}
			);

			await this.client.connect(this.transport);
			this.isConnected = true;
			console.log('Connected to text analysis MCP server');
		} catch (error) {
			console.error(
				'Failed to connect to text analysis MCP server:',
				error
			);
			throw error;
		}
	}

	async disconnect(): Promise<void> {
		if (this.client && this.isConnected) {
			await this.client.close();
			this.isConnected = false;
			this.client = null;
			this.transport = null;
			console.log('Disconnected from text analysis MCP server');
		}
	}

	async groupArticlesByCurrentEvents(
		articles: NewsArticlePreview[],
		options?: {
			maxGroups?: number;
			minArticlesPerGroup?: number;
			useOpenAI?: boolean;
		}
	): Promise<Record<string, NewsArticlePreview[]>> {
		if (!this.client || !this.isConnected) {
			throw new Error('Not connected to text analysis MCP server');
		}

		try {
			console.log('🤖 Calling text analysis MCP server with:', {
				articleCount: articles.length,
				options,
				sampleTitles: articles.slice(0, 3).map((a) => a.title),
			});

			const result = await this.client.callTool({
				name: 'group_articles_by_current_events',
				arguments: {
					articles,
					options: options || {},
				},
			});

			console.log('📥 Raw MCP server response:', result);

			const parsed = this.parseToolResult(result);
			console.log('📊 Parsed grouping result:', parsed);

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
		if (!this.client || !this.isConnected) {
			throw new Error('Not connected to text analysis MCP server');
		}

		try {
			const result = await this.client.callTool({
				name: 'analyze_text',
				arguments: {
					text,
					options: options || {},
				},
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
		if (!this.client || !this.isConnected) {
			throw new Error('Not connected to text analysis MCP server');
		}

		try {
			const result = await this.client.callTool({
				name: 'detect_current_events',
				arguments: {
					articles,
					timeframe: timeframe || '24h',
				},
			});

			return this.parseToolResult(result);
		} catch (error) {
			console.error('Failed to detect current events:', error);
			throw error;
		}
	}

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
		if (!this.client || !this.isConnected) {
			throw new Error('Client not connected');
		}

		try {
			const result = await this.client.callTool({
				name: 'create_news_briefing',
				arguments: {
					articles,
					briefingType: options.briefingType || 'summary',
					targetAudience: options.targetAudience || 'general',
					includeSourceAttribution:
						options.includeSourceAttribution ?? true,
					maxSections: options.maxSections || 10,
					prioritizeTopics: options.prioritizeTopics,
				},
			});

			return this.parseToolResult(result);
		} catch (error) {
			console.error('Error creating news briefing:', error);
			throw error;
		}
	}

	private parseToolResult(result: any): any {
		if (result?.content?.[0]?.text) {
			try {
				return JSON.parse(result.content[0].text);
			} catch {
				return result.content[0].text;
			}
		}
		return result;
	}

	get connected(): boolean {
		return this.isConnected;
	}
}
