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

const HtmlArticleExtractionSchema = z.object({
	postIds: z
		.array(z.string())
		.optional()
		.describe(
			'An array of post IDs to extract content for. If not provided, will find posts needing content extraction.'
		),
	limit: z
		.number()
		.min(1)
		.max(100)
		.default(50)
		.describe('Maximum number of posts to process in this job'),
});

interface ExtractedArticleContent {
	title?: string;
	author?: string;
	content: string;
	publicationDate?: string;
	excerpt?: string;
}

@injectable()
export class StartArticleHtmlScraperJob extends MCPTool {
	constructor(@inject(TYPES.PrismaClient) private prisma: PrismaClient) {
		super();
	}

	get name(): string {
		return 'start_article_html_scraper_job';
	}

	get description(): string {
		return 'Starts an HTML scraper job to extract article content using local HTML parsing (free alternative to Firecrawl)';
	}

	get inputSchema(): z.ZodSchema {
		return HtmlArticleExtractionSchema;
	}

	get schema(): z.ZodType {
		return HtmlArticleExtractionSchema;
	}

	async execute(
		params: z.infer<typeof HtmlArticleExtractionSchema>
	): Promise<MCPToolResponse | undefined> {
		const { postIds, limit = 50 } = params;

		try {
			console.log(`Starting HTML article extraction job`);

			// Find posts to process based on parameters
			let postsToProcess: any[] = [];

			// If specific post IDs were provided, find those posts
			if (postIds && postIds.length > 0) {
				postsToProcess = await this.prisma.post.findMany({
					where: {
						id: {
							in: postIds,
						},
					},
					take: limit,
				});

				console.log(
					`Found ${postsToProcess.length} posts from specified IDs`
				);
			}
			// Otherwise, find posts that have URLs but no or minimal content
			else {
				postsToProcess = await this.prisma.post.findMany({
					where: {
						webUrl: {
							not: '',
						},
						AND: [
							{
								OR: [{ articleText: { equals: '' } }],
							},
						],
					},
					take: limit,
					orderBy: {
						id: 'desc', // Process newest posts first
					},
				});

				console.log(
					`Found ${postsToProcess.length} posts needing content extraction`
				);
			}

			// If no posts found, return early
			if (postsToProcess.length === 0) {
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								message:
									'No posts found for content extraction',
								totalArticlesProcessed: 0,
								results: [],
								completedAt: new Date(),
							}),
						},
					],
				};
			}

			let totalArticlesProcessed = 0;
			const results: Array<{
				url: string;
				postId: string;
				success: boolean;
				error?: string;
			}> = [];

			// Process each post sequentially to avoid overwhelming the servers
			for (const post of postsToProcess) {
				try {
					console.log(`Processing article: ${post.webUrl}`);

					const extractedContent = await this.extractArticleContent(
						post.webUrl
					);

					// Update the post with extracted content
					await this.updatePostWithExtractedContent(
						post.id,
						extractedContent,
						post.webUrl
					);

					totalArticlesProcessed++;
					results.push({
						url: post.webUrl,
						postId: post.id,
						success: true,
					});

					console.log(
						`✅ Successfully extracted content for: ${post.webUrl}`
					);

					// Add a small delay between requests to be respectful
					await this.delay(1000);
				} catch (error) {
					console.error(`Error processing ${post.webUrl}:`, error);
					results.push({
						url: post.webUrl,
						postId: post.id,
						success: false,
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
								message: `Completed HTML article extraction job for ${postsToProcess.length} posts`,
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
			console.error('Error starting HTML article extraction job:', error);
			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify({
							error: 'Failed to start HTML article extraction job',
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
	 * Extract article content from a URL using HTML parsing
	 */
	private async extractArticleContent(
		url: string
	): Promise<ExtractedArticleContent> {
		try {
			const $ = await HTMLScraperBase.fetchAndParseHTML(url);
			const domain = new URL(url).hostname;

			// Get site-specific selectors
			const selectors = this.getArticleContentSelectors(domain);

			// Try each selector configuration
			for (const config of selectors) {
				const content = this.extractContentWithSelectors($, config);
				if (content.content && content.content.length > 100) {
					return content;
				}
			}

			// If no specific selectors worked, try generic extraction
			const genericContent = this.extractContentGeneric($);
			if (genericContent.content && genericContent.content.length > 100) {
				return genericContent;
			}

			throw new Error(
				'Could not extract meaningful content from article'
			);
		} catch (error) {
			throw new Error(
				`Failed to extract article content from ${url}: ${
					error instanceof Error ? error.message : String(error)
				}`
			);
		}
	}

	/**
	 * Get site-specific content selectors for different news sources
	 */
	private getArticleContentSelectors(domain: string): Array<{
		title?: string;
		author?: string;
		content: string | string[];
		date?: string;
		removeSelectors?: string[];
	}> {
		const siteConfigs: Record<string, Array<any>> = {
			'apnews.com': [
				{
					title: 'h1, .Page-headline',
					author: '.Component-bylines-stories, [data-key="bylines"]',
					content: '.RichTextStoryBody, [data-key="body"]',
					date: '.Component-timestamp',
					removeSelectors: [
						'.ad',
						'.advertisement',
						'.related-content',
						'script',
						'style',
					],
				},
			],
			'cnn.com': [
				{
					title: 'h1, .headline__text',
					author: '.byline__name, .metadata__byline',
					content:
						'.article__content, .l-container .zn-body__paragraph',
					date: '.timestamp',
					removeSelectors: [
						'.ad',
						'.zn-ads',
						'.related-content',
						'script',
						'style',
					],
				},
			],
			'foxnews.com': [
				{
					title: 'h1, .headline',
					author: '.author-byline, .byline',
					content: '.article-body, .content-body',
					date: '.article-date, .timestamp',
					removeSelectors: [
						'.ad',
						'.advertisement',
						'.related',
						'script',
						'style',
					],
				},
			],
			'dailymail.co.uk': [
				{
					title: 'h1, #js-article-text h1',
					author: '.author, .byline-section',
					content: '#js-article-text, .article-text',
					date: '.article-timestamp',
					removeSelectors: [
						'.ad',
						'.related-carousel',
						'.mol-bullets-with-font',
						'script',
						'style',
					],
				},
			],
			'bbc.com': [
				{
					title: 'h1, #main-heading',
					author: '.ssrcss-68pt20-Text, .gel-body-copy',
					content:
						'[data-component="text-block"], .ssrcss-11r1m41-RichTextContainer',
					date: '.ssrcss-1if1g6v-MetadataText',
					removeSelectors: [
						'.ssrcss-pv1rh6-ArticleWrapper',
						'.related-content',
						'script',
						'style',
					],
				},
			],
			'reuters.com': [
				{
					title: 'h1, [data-testid="headline"]',
					author: '[data-testid="AuthorBylineText"], .author',
					content:
						'[data-testid="paragraph"], .article-body__content__17Yit',
					date: '[data-testid="timestamp"]',
					removeSelectors: [
						'.ad',
						'.related-content',
						'script',
						'style',
					],
				},
			],
			'washingtonpost.com': [
				{
					title: 'h1, #main-content h1',
					author: '.author-name, .by-author',
					content: '.article-body, .teaser-content',
					date: '.published-date',
					removeSelectors: [
						'.ad',
						'.related-content',
						'script',
						'style',
					],
				},
			],
		};

		return siteConfigs[domain] || [];
	}

	/**
	 * Extract content using site-specific selectors
	 */
	private extractContentWithSelectors(
		$: cheerio.CheerioAPI,
		config: any
	): ExtractedArticleContent {
		// Remove unwanted elements first
		if (config.removeSelectors) {
			config.removeSelectors.forEach((selector: string) => {
				$(selector).remove();
			});
		}

		const result: ExtractedArticleContent = { content: '' };

		// Extract title
		if (config.title) {
			const title = $(config.title).first().text().trim();
			if (title) result.title = title;
		}

		// Extract author
		if (config.author) {
			const author = $(config.author).first().text().trim();
			if (author) result.author = author;
		}

		// Extract publication date
		if (config.date) {
			const date = $(config.date).first().text().trim();
			if (date) result.publicationDate = date;
		}

		// Extract content
		if (Array.isArray(config.content)) {
			// Multiple possible selectors
			for (const selector of config.content) {
				const content = this.extractTextFromSelector($, selector);
				if (content && content.length > 100) {
					result.content = content;
					break;
				}
			}
		} else {
			// Single selector
			result.content = this.extractTextFromSelector($, config.content);
		}

		return result;
	}

	/**
	 * Generic content extraction for sites without specific configurations
	 */
	private extractContentGeneric(
		$: cheerio.CheerioAPI
	): ExtractedArticleContent {
		// Remove common unwanted elements
		$(
			'script, style, nav, header, footer, aside, .ad, .advertisement, .related, .sidebar'
		).remove();

		const result: ExtractedArticleContent = { content: '' };

		// Try to find title
		const title =
			$('h1').first().text().trim() ||
			$('[role="heading"]').first().text().trim() ||
			$('title').text().trim();
		if (title) result.title = title;

		// Try to find author
		const author = $(
			'[rel="author"], .author, .byline, [class*="author"], [class*="byline"]'
		)
			.first()
			.text()
			.trim();
		if (author) result.author = author;

		// Generic content selectors (in order of preference)
		const contentSelectors = [
			'article [role="main"]',
			'article',
			'[role="main"]',
			'.article-content',
			'.article-body',
			'.entry-content',
			'.post-content',
			'.content',
			'main',
			'#content',
			'#main',
		];

		for (const selector of contentSelectors) {
			const content = this.extractTextFromSelector($, selector);
			if (content && content.length > 200) {
				result.content = content;
				break;
			}
		}

		// If still no good content, try to get text from paragraphs
		if (!result.content || result.content.length < 200) {
			const paragraphs = $('p')
				.map((_, el) => $(el).text().trim())
				.get()
				.filter((text) => text.length > 50)
				.join('\n\n');

			if (paragraphs.length > 200) {
				result.content = paragraphs;
			}
		}

		return result;
	}

	/**
	 * Extract text content from a selector, cleaning it up
	 */
	private extractTextFromSelector(
		$: cheerio.CheerioAPI,
		selector: string
	): string {
		const elements = $(selector);
		if (elements.length === 0) return '';

		// If multiple elements, join their text
		if (elements.length > 1) {
			return elements
				.map((_, el) => $(el).text().trim())
				.get()
				.filter((text) => text.length > 0)
				.join('\n\n');
		}

		// Single element - get its text and clean it
		const text = elements.first().text().trim();

		// Basic cleanup
		return text
			.replace(/\s+/g, ' ') // Normalize whitespace
			.replace(/\n\s*\n/g, '\n\n') // Normalize line breaks
			.trim();
	}

	/**
	 * Update a post with extracted content
	 */
	private async updatePostWithExtractedContent(
		postId: string,
		extractedData: ExtractedArticleContent,
		sourceUrl: string
	): Promise<void> {
		try {
			console.log(
				`Updating post ${postId} with extracted content from ${sourceUrl}`
			);

			const updateData: any = {};

			// Update article content
			if (extractedData.content) {
				updateData.articleText = extractedData.content;
			}

			// Update author if available and not already set
			if (extractedData.author) {
				updateData.bylineWriter = extractedData.author;
			}

			// Only update if we have something to update
			if (Object.keys(updateData).length > 0) {
				await this.prisma.post.update({
					where: {
						id: postId,
					},
					data: updateData,
				});

				console.log(`✅ Updated post ${postId} with extracted content`);
			} else {
				console.warn(`No content extracted for post ${postId}`);
			}
		} catch (error) {
			console.error(`Error updating post ${postId}:`, error);
			throw error;
		}
	}

	/**
	 * Simple delay utility
	 */
	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}
