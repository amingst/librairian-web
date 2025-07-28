import z from 'zod';
import { MCPTool } from '@shared/backend';
import { HTMLScraperBase } from '../lib/helpers/html.js';
import { SiteConfig, NewsArticlePreview } from '@shared/types';
import type {
	MCPToolResponse,
	NewsHomepageParams,
	MultiSiteNewsHomepageResult,
} from '../types/index.js';
import { injectable } from 'inversify';

@injectable()
export class NewsHomepageTool extends MCPTool {
	private static readonly inputSchema = z.object({
		sites: z
			.array(
				z
					.object({
						domain: z
							.string()
							.describe(
								'The domain of the news site (e.g., "cnn.com")'
							),
						name: z
							.string()
							.describe(
								'Display name of the news site (e.g., "CNN")'
							),
						selectors: z
							.object({
								container: z
									.union([z.string(), z.array(z.string())])
									.describe(
										'CSS selector(s) for article containers'
									),
								title: z
									.union([z.string(), z.array(z.string())])
									.describe(
										'CSS selector(s) for article titles'
									),
								link: z
									.union([z.string(), z.array(z.string())])
									.describe(
										'CSS selector(s) for article links'
									),
								image: z
									.union([z.string(), z.array(z.string())])
									.optional()
									.describe(
										'CSS selector(s) for article images'
									),
								section: z
									.union([z.string(), z.array(z.string())])
									.optional()
									.describe(
										'CSS selector(s) for article sections'
									),
								video: z
									.union([z.string(), z.array(z.string())])
									.optional()
									.describe(
										'CSS selector(s) for video content'
									),
								author: z
									.union([z.string(), z.array(z.string())])
									.optional()
									.describe(
										'CSS selector(s) for article authors'
									),
								publishDate: z
									.union([z.string(), z.array(z.string())])
									.optional()
									.describe(
										'CSS selector(s) for publish dates'
									),
								excerpt: z
									.union([z.string(), z.array(z.string())])
									.optional()
									.describe(
										'CSS selector(s) for article excerpts'
									),
								category: z
									.union([z.string(), z.array(z.string())])
									.optional()
									.describe(
										'CSS selector(s) for article categories'
									),
							})
							.describe(
								'CSS selectors for extracting different content elements'
							),
						rateLimit: z
							.number()
							.positive()
							.optional()
							.describe('Rate limit in requests per minute'),
						userAgent: z
							.string()
							.optional()
							.describe('Custom user agent string'),
						headers: z
							.record(z.string())
							.optional()
							.describe('Custom HTTP headers'),
					})
					.describe(
						'Site configuration object with selectors and metadata'
					)
			)
			.min(1)
			.describe('Array of news sites to scrape'),
		limit: z
			.number()
			.min(1)
			.max(100)
			.default(20)
			.describe('Maximum number of articles to extract per site'),
		includeMedia: z
			.boolean()
			.default(true)
			.describe('Whether to extract media content (images, videos)'),
		includeSections: z
			.boolean()
			.default(true)
			.describe('Whether to extract article sections/categories'),
		includeMetrics: z
			.boolean()
			.default(false)
			.describe(
				'Whether to calculate reading metrics (word count, read time)'
			),
		sortBy: z
			.enum(['position', 'date', 'priority'])
			.default('position')
			.describe('How to sort the results within each site'),
	});

	get name(): string {
		return 'scrape_news_homepages';
	}

	get description(): string {
		return 'Scrapes the homepages of multiple news websites for article previews with configurable extraction options';
	}

	get schema(): Record<string, any> {
		return NewsHomepageTool.inputSchema.shape;
	}

	async execute(params: NewsHomepageParams): Promise<MCPToolResponse> {
		const startTime = Date.now();
		const {
			sites,
			limit = 20,
			includeMedia = true,
			includeSections = true,
			includeMetrics = false,
			sortBy = 'position',
		} = params;

		const results: Record<string, NewsArticlePreview[]> = {};
		const errors: string[] = [];
		const warnings: string[] = [];
		let totalFound = 0;
		let totalReturned = 0;

		for (const siteConfig of sites) {
			try {
				const siteResults = await this.scrapeSite(siteConfig, {
					limit,
					includeMedia,
					includeSections,
					includeMetrics,
					sortBy,
				});
				results[siteConfig.domain] = siteResults.articles;
				totalFound += siteResults.totalFound;
				totalReturned += siteResults.articles.length;
			} catch (error) {
				errors.push(
					`Failed to scrape ${siteConfig.domain}: ${
						error instanceof Error ? error.message : String(error)
					}`
				);
				results[siteConfig.domain] = [];
			}
		}

		const processingTime = Date.now() - startTime;

		const response: MultiSiteNewsHomepageResult = {
			data: results,
			metadata: {
				sites: sites.map((s) => s.domain),
				scrapedAt: new Date(),
				totalSites: sites.length,
				totalFound,
				totalReturned,
				processingTime,
			},
			errors: errors.length > 0 ? errors : undefined,
			warnings: warnings.length > 0 ? warnings : undefined,
		};

		return {
			content: [
				{
					type: 'text',
					text: JSON.stringify(response, null, 2),
				},
			],
		};
	}

	private async scrapeSite(
		siteConfig: SiteConfig,
		options: {
			limit: number;
			includeMedia: boolean;
			includeSections: boolean;
			includeMetrics: boolean;
			sortBy: string;
		}
	): Promise<{ articles: NewsArticlePreview[]; totalFound: number }> {
		try {
			const url = `https://www.${siteConfig.domain}`;
			const $ = await HTMLScraperBase.fetchAndParseHTML(url);

			const articles: NewsArticlePreview[] = [];
			const containerSelectors = Array.isArray(
				siteConfig.selectors.container
			)
				? siteConfig.selectors.container
				: [siteConfig.selectors.container];

			let containers = $();
			for (const selector of containerSelectors) {
				containers = $(selector);
				if (containers.length > 0) break;
			}

			// If we can't find containers, return empty results
			if (containers.length === 0) {
				return {
					articles: [],
					totalFound: 0,
				};
			}

			containers
				.slice(0, options.limit * 2)
				.each((index: number, element: any) => {
					try {
						const article = this.extractArticle(
							$,
							$(element),
							siteConfig,
							url,
							options
						);
						if (article) {
							articles.push(article);
						}
					} catch (error) {
						// Skip individual article errors
					}
				});

			return {
				articles: articles.slice(0, options.limit),
				totalFound: articles.length,
			};
		} catch (error) {
			// If fetching fails, return empty results
			return {
				articles: [],
				totalFound: 0,
			};
		}
	}

	private extractArticle(
		$: any,
		$element: any,
		siteConfig: SiteConfig,
		baseUrl: string,
		options: any
	): NewsArticlePreview | null {
		// Extract title and link using multiple selectors
		const titleSelectors = Array.isArray(siteConfig.selectors.title)
			? siteConfig.selectors.title
			: [siteConfig.selectors.title];

		let title = '';
		let relativeLink = '';

		for (const selector of titleSelectors) {
			const titleEl = $element.find(selector).first();
			if (titleEl.length > 0) {
				title = titleEl.text().trim();
				relativeLink = titleEl.attr('href') || '';
				if (title && relativeLink) break;
			}
		}

		if (!title || !relativeLink) {
			return null;
		}

		// Convert relative URL to absolute
		let link = relativeLink;
		if (!relativeLink.startsWith('http')) {
			try {
				link = new URL(relativeLink, baseUrl).href;
			} catch {
				link =
					baseUrl +
					(relativeLink.startsWith('/') ? '' : '/') +
					relativeLink;
			}
		}

		// Build base article preview
		const article: NewsArticlePreview = {
			title: HTMLScraperBase.cleanText(title),
			link,
			id: this.generateArticleId(link),
			timestamp: new Date().toISOString(),
			source: {
				site: siteConfig.name,
				domain: siteConfig.domain,
			},
		};

		// Extract section if requested
		if (options.includeSections && siteConfig.selectors.section) {
			const sectionSelectors = Array.isArray(siteConfig.selectors.section)
				? siteConfig.selectors.section
				: [siteConfig.selectors.section];

			for (const selector of sectionSelectors) {
				const sectionEl = $element.find(selector).first();
				const section = sectionEl.text().trim();
				if (section) {
					article.source.section = HTMLScraperBase.cleanText(section);
					break;
				}
			}
		}

		// Extract media if requested
		if (options.includeMedia) {
			article.media = this.extractMediaContent(
				$element,
				siteConfig,
				baseUrl
			);
		}

		// Extract metrics if requested
		if (options.includeMetrics) {
			const excerpt = this.extractExcerpt($element);
			if (excerpt) {
				article.excerpt = excerpt;
				article.metrics = {
					wordCount: excerpt.split(/\s+/).length,
					readTime: Math.max(
						1,
						Math.ceil(excerpt.split(/\s+/).length / 200)
					),
				};
			}
		}

		return article;
	}

	private extractMediaContent(
		$element: any,
		siteConfig: SiteConfig,
		baseUrl: string
	): any {
		// Check for video indicators first
		if ($element.find('video, [class*="video"], [data-video]').length > 0) {
			return { type: 'video' };
		}

		// Extract image
		if (siteConfig.selectors.image) {
			const imageSelectors = Array.isArray(siteConfig.selectors.image)
				? siteConfig.selectors.image
				: [siteConfig.selectors.image];

			for (const selector of imageSelectors) {
				const imgEl = $element.find(selector).first();
				const imgSrc =
					imgEl.attr('src') ||
					imgEl.attr('data-src') ||
					imgEl.attr('data-lazy-src');

				if (imgSrc) {
					let imageUrl = imgSrc;
					if (!imgSrc.startsWith('http')) {
						try {
							imageUrl = new URL(imgSrc, baseUrl).href;
						} catch {
							imageUrl =
								baseUrl +
								(imgSrc.startsWith('/') ? '' : '/') +
								imgSrc;
						}
					}

					return {
						type: 'image',
						url: imageUrl,
						alt: imgEl.attr('alt') || '',
					};
				}
			}
		}

		return { type: 'none' };
	}

	private extractExcerpt($element: any): string | undefined {
		const excerptSelectors = [
			'.excerpt',
			'.summary',
			'.description',
			'.teaser',
			'.intro',
			'p:first-of-type',
		];

		for (const selector of excerptSelectors) {
			const excerptEl = $element.find(selector).first();
			const excerpt = excerptEl.text().trim();
			if (excerpt && excerpt.length > 20) {
				return HTMLScraperBase.cleanText(excerpt).substring(0, 300);
			}
		}

		return undefined;
	}

	private generateArticleId(link: string): string {
		return Buffer.from(link).toString('base64').substring(0, 16);
	}
}
