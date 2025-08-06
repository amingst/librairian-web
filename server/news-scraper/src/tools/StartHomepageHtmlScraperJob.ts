import { MCPTool } from '@shared/backend';
import { inject, injectable } from 'inversify';
import { TYPES } from '../types/symbols.js';
import { PrismaClient } from '@prisma/client';
import config from '../config.js';
import z from 'zod';
import { MCPToolResponse } from '../types/response.js';
import { URL } from 'url';
import { HTMLScraperBase } from '../lib/helpers/html.js';
import * as cheerio from 'cheerio';

const HtmlNewsHomepageSchema = z.object({
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

interface ExtractedArticle {
	title: string;
	link: string;
	excerpt?: string;
	image?: string;
	source: {
		author?: string;
		section?: string;
		domain: string;
	};
}

@injectable()
export class StartHomepageHtmlScraperJob extends MCPTool {
	constructor(@inject(TYPES.PrismaClient) private prisma: PrismaClient) {
		super();
	}

	get name(): string {
		return 'start_homepage_html_scraper_job';
	}

	get description(): string {
		return 'Starts an HTML scraper job to scrape news articles from homepages using local HTML parsing';
	}

	get inputSchema(): z.ZodSchema {
		return HtmlNewsHomepageSchema;
	}

	get schema(): z.ZodType {
		return HtmlNewsHomepageSchema;
	}

	async execute(
		params: z.infer<typeof HtmlNewsHomepageSchema>
	): Promise<MCPToolResponse | undefined> {
		const { urls, limit } = params;

		try {
			console.log(`Starting HTML scraper job for URLs:`, urls);

			// Ensure URLs have protocol
			const fullUrls = urls.map((url) =>
				url.startsWith('http') ? url : `https://${url}`
			);

			let totalArticlesProcessed = 0;
			const results: Array<{
				url: string;
				articles: number;
				error?: string;
			}> = [];

			// Process each URL sequentially to avoid overwhelming the servers
			for (const url of fullUrls) {
				try {
					console.log(`Processing homepage: ${url}`);

					const articles = await this.scrapeHomepage(url, limit);
					console.log(
						`Found ${articles.length} articles from ${url}`
					);

					// Save articles to database
					for (const article of articles) {
						try {
							await this.saveArticleToPost(article, url);
							totalArticlesProcessed++;
						} catch (error) {
							console.error(
								`Error saving article from ${url}:`,
								error
							);
						}
					}

					results.push({
						url,
						articles: articles.length,
					});

					// Add a small delay between requests to be respectful
					await this.delay(1000);
				} catch (error) {
					console.error(`Error processing ${url}:`, error);
					results.push({
						url,
						articles: 0,
						error:
							error instanceof Error
								? error.message
								: String(error),
					});
				}
			}

			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify(
							{
								message: `Completed HTML scraping job for ${urls.length} URLs`,
								totalArticlesProcessed,
								results,
								completedAt: new Date(),
							},
							null,
							2
						),
					},
				],
			};
		} catch (error) {
			console.error('Error starting HTML scraping job:', error);
			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify({
							error: 'Failed to start HTML scraping job',
							message:
								error instanceof Error
									? error.message
									: String(error),
						}),
					},
				],
			};
		}
	}

	/**
	 * Scrape a homepage and extract article links with metadata
	 */
	private async scrapeHomepage(
		url: string,
		limit: number
	): Promise<ExtractedArticle[]> {
		try {
			const $ = await HTMLScraperBase.fetchAndParseHTML(url);
			const articles: ExtractedArticle[] = [];
			const domain = new URL(url).hostname;

			// Define selectors for different news sites
			const articleSelectors = this.getArticleSelectors(domain);

			// Try each selector pattern until we find articles
			for (const selectorConfig of articleSelectors) {
				const foundArticles = this.extractArticlesWithSelector(
					$,
					selectorConfig,
					url,
					limit
				);
				if (foundArticles.length > 0) {
					articles.push(...foundArticles);
					break; // Stop at first successful pattern
				}
			}

			// If no specific patterns worked, try generic selectors
			if (articles.length === 0) {
				const genericArticles = this.extractArticlesGeneric(
					$,
					url,
					limit
				);
				articles.push(...genericArticles);
			}

			return articles.slice(0, limit);
		} catch (error) {
			throw new Error(
				`Failed to scrape homepage ${url}: ${
					error instanceof Error ? error.message : String(error)
				}`
			);
		}
	}

	/**
	 * Get site-specific selectors for different news sources
	 */
	private getArticleSelectors(domain: string): Array<{
		container: string;
		title: string;
		link: string;
		excerpt?: string;
		image?: string;
		section?: string;
	}> {
		// Site-specific configurations
		const siteConfigs: Record<string, Array<any>> = {
			'apnews.com': [
				{
					container: '[data-key^="card-at"]',
					title: '[data-key="card-headline"] a',
					link: '[data-key="card-headline"] a',
					image: 'img',
					section: '[data-key="card-tagline"]',
				},
			],
			'cnn.com': [
				{
					container: '.card',
					title: '.card__content .card__headline a, .card__content h3 a',
					link: '.card__content .card__headline a, .card__content h3 a',
					image: '.card__media img',
					excerpt: '.card__content .card__description',
				},
			],
			'foxnews.com': [
				{
					container: 'article',
					title: '.title a, h2 a, h3 a',
					link: '.title a, h2 a, h3 a',
					image: 'img',
					excerpt: '.dek, .excerpt',
				},
			],
			'dailymail.co.uk': [
				{
					container: '[data-module="ArticleAlpha"]',
					title: '.linkro-darkred',
					link: '.linkro-darkred',
					image: 'img',
					excerpt: '.sch-res-content',
				},
			],
			'bbc.com': [
				{
					container: '[data-testid="card-text-wrapper"], .gs-c-promo',
					title: 'h3 a, .gs-c-promo-heading__title',
					link: 'h3 a, .gs-c-promo-heading__title',
					image: 'img',
					excerpt: '.gs-c-promo-summary',
				},
			],
		};

		return siteConfigs[domain] || [];
	}

	/**
	 * Extract articles using site-specific selectors
	 */
	private extractArticlesWithSelector(
		$: cheerio.CheerioAPI,
		config: any,
		baseUrl: string,
		limit: number
	): ExtractedArticle[] {
		const articles: ExtractedArticle[] = [];
		const domain = new URL(baseUrl).hostname;

		$(config.container).each((index, element) => {
			if (articles.length >= limit) return false;

			try {
				const $el = $(element);

				// Extract title and link
				const titleElement = config.title
					? $el.find(config.title).first()
					: $el.find('a').first();
				const title = titleElement.text().trim();
				let link = titleElement.attr('href');

				if (!title || !link) return;

				// Convert relative URLs to absolute
				if (link.startsWith('/')) {
					const urlObj = new URL(baseUrl);
					link = `${urlObj.protocol}//${urlObj.host}${link}`;
				} else if (!link.startsWith('http')) {
					link = new URL(link, baseUrl).href;
				}

				// Skip if link is same as homepage
				if (link === baseUrl || link === `${baseUrl}/`) return;

				// Extract other metadata
				const excerpt = config.excerpt
					? $el.find(config.excerpt).first().text().trim()
					: '';
				const imageEl = config.image
					? $el.find(config.image).first()
					: null;
				let image = imageEl
					? imageEl.attr('src') || imageEl.attr('data-src')
					: '';

				// Convert relative image URLs
				if (image && image.startsWith('/')) {
					const urlObj = new URL(baseUrl);
					image = `${urlObj.protocol}//${urlObj.host}${image}`;
				}

				const section = config.section
					? $el.find(config.section).first().text().trim()
					: '';

				articles.push({
					title,
					link,
					excerpt: excerpt || undefined,
					image: image || undefined,
					source: {
						section: section || undefined,
						domain,
					},
				});
			} catch (error) {
				console.error(`Error extracting article from element:`, error);
			}
		});

		return articles;
	}

	/**
	 * Generic article extraction for sites without specific configurations
	 */
	private extractArticlesGeneric(
		$: cheerio.CheerioAPI,
		baseUrl: string,
		limit: number
	): ExtractedArticle[] {
		const articles: ExtractedArticle[] = [];
		const domain = new URL(baseUrl).hostname;

		// Generic selectors for common article patterns
		const genericSelectors = [
			'article a[href]',
			'.article a[href]',
			'.story a[href]',
			'.post a[href]',
			'[class*="headline"] a[href]',
			'[class*="title"] a[href]',
			'h2 a[href]',
			'h3 a[href]',
		];

		const processedLinks = new Set<string>();

		for (const selector of genericSelectors) {
			if (articles.length >= limit) break;

			$(selector).each((index, element) => {
				if (articles.length >= limit) return false;

				try {
					const $el = $(element);
					const title = $el.text().trim();
					let link = $el.attr('href');

					if (!title || !link || title.length < 10) return;

					// Convert relative URLs to absolute
					if (link.startsWith('/')) {
						const urlObj = new URL(baseUrl);
						link = `${urlObj.protocol}//${urlObj.host}${link}`;
					} else if (!link.startsWith('http')) {
						link = new URL(link, baseUrl).href;
					}

					// Skip duplicates and homepage
					if (
						processedLinks.has(link) ||
						link === baseUrl ||
						link === `${baseUrl}/`
					)
						return;
					processedLinks.add(link);

					// Basic validation that this looks like an article URL
					const urlPath = new URL(link).pathname;
					if (
						urlPath === '/' ||
						urlPath.match(
							/^\/(about|contact|terms|privacy|help|faq|search)/
						)
					) {
						return;
					}

					articles.push({
						title,
						link,
						source: {
							domain,
						},
					});
				} catch (error) {
					console.error(`Error extracting generic article:`, error);
				}
			});
		}

		return articles;
	}

	/**
	 * Save a scraped article to the Post model (reused from Firecrawl version)
	 */
	private async saveArticleToPost(
		article: ExtractedArticle,
		sourceUrl: string
	): Promise<void> {
		try {
			console.log(
				`Saving article: "${article.title}" with URL: ${article.link}`
			);

			let hostname;
			try {
				hostname = new URL(sourceUrl).hostname;
			} catch (error) {
				console.error(
					`Invalid source URL: ${sourceUrl}. Using default.`
				);
				hostname = 'unknown';
			}

			// Create data object
			const createData = {
				webUrl: article.link,
				bylineWriter: article.source.author || 'Unknown',
				bylineWritersTitle: article.source.section || 'Reporter',
				bylineWritersLocation: article.source.domain || hostname,
				articleText: article.title || '', // Store title as placeholder until full content is extracted
				featuredImage: article.image || null,
			};

			// The update data is similar but doesn't include articleText
			const updateData = {
				bylineWriter: article.source.author || 'Unknown',
				bylineWritersTitle: article.source.section || 'Reporter',
				bylineWritersLocation: article.source.domain || hostname,
				featuredImage: article.image || null,
			};

			// Upsert a Post record
			const result = await this.prisma.post.upsert({
				where: {
					webUrl: article.link,
				},
				create: createData,
				update: updateData,
			});

			console.log(
				`✅ Successfully saved article: "${article.title}" with ID: ${result.id}`
			);
		} catch (error) {
			const dbError = error as any;
			console.error(
				`⛔ DATABASE ERROR saving article with URL ${article.link}`
			);
			console.error(`Error details:`, dbError);
			throw error; // Re-throw to let caller handle
		}
	}

	/**
	 * Simple delay utility
	 */
	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}
