import { MCPTool } from '@shared/backend';
import { z } from 'zod';
import FirecrawlApp from '@mendable/firecrawl-js';
import config from '../config.js';
import type { NewsArticlePreview } from '@shared/types';
import { MCPToolResponse } from '../types/response.js';
import { injectable } from 'inversify';

const FirecrawlNewsHomepageSchema = z.object({
	urls: z
		.array(z.string().url())
		.min(1)
		.describe('An array of news homepage URLs to scrape.'),
	limit: z
		.number()
		.min(1)
		.max(100)
		.default(20)
		.describe('Maximum number of articles to extract per site'),
});

@injectable()
export class FirecrawlNewsHomepageTool extends MCPTool {
	private firecrawl: FirecrawlApp;

	constructor() {
		super();
		this.firecrawl = new FirecrawlApp({
			apiKey:
				config.firecrawlKey ??
				(() => {
					throw new Error('FIRECRAWL_API_KEY is not set');
				})(),
		});
	}

	get name(): string {
		return 'firecrawl_news_homepage';
	}

	get description(): string {
		return 'Scrapes a news homepage for article previews using Firecrawl.';
	}

	get inputSchema(): z.ZodSchema {
		return FirecrawlNewsHomepageSchema;
	}

	get schema(): z.ZodSchema {
		return FirecrawlNewsHomepageSchema;
	}

	async execute(
		params: z.infer<typeof FirecrawlNewsHomepageSchema>
	): Promise<MCPToolResponse> {
		try {
			const { urls, limit } = params;
			// TODO: fix returning  image caption as title
			const response = await this.firecrawl.batchScrapeUrls(urls, {
				formats: ['json'],
				jsonOptions: {
					prompt: 'Extract article previews from the homepage of the news site. Include title, link, image, excerpt, and source if available',
					schema: {
						type: 'array',
						items: {
							type: 'object',
							properties: {
								title: { type: 'string' },
								link: { type: 'string' },
								excerpt: { type: 'string' },
								image: { type: 'string' },
								source: { type: 'string' },
							},
							required: ['title', 'link'],
						},
					},
				},
			});

			const articlesBySource: Record<string, NewsArticlePreview[]> = {};

			if (response.success && response.data) {
				for (const result of response.data) {
					const sourceName = result.url
						? new URL(result.url).hostname
						: 'unknown';
					const items = Array.isArray(result.json) ? result.json : [];
					const articles = items.slice(0, limit).map((item: any) => ({
						title: item.title,
						link: item.link,
						excerpt: item.excerpt,
						media: item.image
							? ({ type: 'image', url: item.image } as const)
							: undefined,
						source: {
							site: item.source || sourceName,
							domain: sourceName,
						},
					})) as NewsArticlePreview[];
					articlesBySource[sourceName] = articles;
				}
			}

			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify({
							data: articlesBySource,
							metadata: {
								totalSources:
									Object.keys(articlesBySource).length,
								totalArticles:
									Object.values(articlesBySource).flat()
										.length,
							},
						}),
					},
				],
			};
		} catch (error: any) {
			console.error('FirecrawlNewsHomepageTool error:', error);
			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify({
							error: error?.message || String(error),
						}),
					},
				],
			};
		}
	}
}
