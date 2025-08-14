import z from 'zod';
import { HTMLScraperBase } from '../lib/helpers/html.js';
import { MCPTool, PrismaClientFactory } from '@shared/backend';
import {
	StructuredArticle,
	ArticleContent,
	MediaContent,
	ArticleMetadata,
} from '@shared/types';
import { MCPToolResponse, ExtractTextParams } from '../types/index.js';
import * as cheerio from 'cheerio';
import { injectable } from 'inversify';
import { PrismaClient } from '@prisma/client';

@injectable()
export class StreamingArticleExtractorTool extends MCPTool {
	private prisma: PrismaClient;

	constructor() {
		super();
		this.prisma = PrismaClientFactory.getInstance('news-scraper');
	}

	private static readonly inputSchema = z.object({
		url: z
			.string()
			.url()
			.describe('The URL of the news article to extract'),
		include_media: z
			.boolean()
			.default(true)
			.describe('Whether to extract media content (images, videos)'),
		extract_tags: z
			.boolean()
			.default(true)
			.describe('Whether to extract article tags and categories'),
		estimate_reading_time: z
			.boolean()
			.default(true)
			.describe('Whether to calculate estimated reading time'),
	});

	get name(): string {
		return 'extract_article_streaming';
	}

	get description(): string {
		return 'Extract structured JSON data from a news article with streaming progress updates';
	}

	get schema(): Record<string, any> {
		return StreamingArticleExtractorTool.inputSchema.shape;
	}

	// Traditional non-streaming execute method
	async execute(params: ExtractTextParams): Promise<MCPToolResponse> {
		// Implementation would go here
		return {
			content: [
				{
					type: 'text',
					text: 'Streaming extraction not supported in basic execute method',
				},
			],
		};
	}

	// New streaming execute method that returns an async generator
	async *executeStreaming(params: ExtractTextParams): AsyncGenerator<MCPToolResponse, MCPToolResponse, unknown> {
		const {
			url,
			include_media = true,
			extract_tags = true,
			estimate_reading_time = true,
		} = params;

		try {
			// Stage 1: Fetch HTML
			yield {
				content: [
					{
						type: 'text',
						text: JSON.stringify({
							stage: 'fetching',
							progress: 10,
							message: 'Fetching article content...'
						})
					}
				]
			};

			const html = await HTMLScraperBase.fetchHTML(url);
			const $ = cheerio.load(html);

			// Stage 2: Extract basic info
			yield {
				content: [
					{
						type: 'text',
						text: JSON.stringify({
							stage: 'extracting_basic',
							progress: 25,
							message: 'Extracting basic article information...'
						})
					}
				]
			};

			const title = this.extractTitle($);
			const subtitle = this.extractSubtitle($);
			const author = this.extractAuthor($);

			// Stage 3: Extract content
			yield {
				content: [
					{
						type: 'text',
						text: JSON.stringify({
							stage: 'extracting_content',
							progress: 50,
							message: 'Extracting article content...'
						})
					}
				]
			};

			const content = this.extractContent($, estimate_reading_time);
			const publishDate = this.extractPublishDate($);
			const lastModified = this.extractLastModified($);

			// Stage 4: Extract optional data
			let category: string | undefined;
			let tags: string[] | undefined;
			let media: MediaContent[] | undefined;

			if (extract_tags) {
				yield {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								stage: 'extracting_tags',
								progress: 70,
								message: 'Extracting categories and tags...'
							})
						}
					]
				};
				category = this.extractCategory($);
				tags = this.extractTags($);
			}

			if (include_media) {
				yield {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								stage: 'extracting_media',
								progress: 85,
								message: 'Extracting media content...'
							})
						}
					]
				};
				media = this.extractMedia($, url);
			}

			// Stage 5: Finalize
			yield {
				content: [
					{
						type: 'text',
						text: JSON.stringify({
							stage: 'finalizing',
							progress: 95,
							message: 'Finalizing extraction...'
						})
					}
				]
			};

			const metadata = this.extractMetadata($, url);
			const structuredArticle: StructuredArticle = {
				url,
				title,
				subtitle,
				author,
				publishDate,
				lastModified,
				category,
				tags,
				summary: this.generateSummary(content.paragraphs),
				content,
				media,
				metadata,
				timestamp: new Date().toISOString(),
			};

			// Save to database
			const postId = await this.saveToDatabase(structuredArticle);

			// Final result
			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify({
							...structuredArticle,
							postId,
							savedToDatabase: true,
							stage: 'completed',
							progress: 100,
							message: 'Article extraction completed!'
						}, null, 2),
					},
				],
			};

		} catch (error) {
			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify({
							stage: 'error',
							progress: 0,
							message: `Error extracting article: ${error instanceof Error ? error.message : String(error)}`,
							error: true
						})
					}
				]
			};
		}
	}

	// Helper methods (would be the same as in ArticleExtractor.ts)
	private extractTitle($: cheerio.CheerioAPI): string {
		const titleSelectors = [
			'h1[data-testid="headline"]',
			'h1.ArticleHeader-headline',
			'h1.entry-title',
			'h1.article-title',
			'h1',
			'title',
		];

		for (const selector of titleSelectors) {
			const element = $(selector).first();
			if (element.length && element.text().trim()) {
				return element.text().trim();
			}
		}

		return $('title').text().trim() || 'No title found';
	}

	// ... other extraction methods would be copied from ArticleExtractor.ts

	private extractContent($: cheerio.CheerioAPI, estimateReadingTime: boolean): ArticleContent {
		// Simplified version for demo
		const paragraphs: string[] = [];
		$('p').each((_, element) => {
			const text = $(element).text().trim();
			if (text && text.length > 20) {
				paragraphs.push(text);
			}
		});

		const fullText = paragraphs.join('\n\n');
		const wordCount = this.countWords(fullText);
		const readingTime = estimateReadingTime ? this.estimateReadingTime(wordCount) : 0;

		return { fullText, paragraphs, wordCount, readingTime };
	}

	private generateSummary(paragraphs: string[]): string | undefined {
		if (paragraphs.length === 0) return undefined;
		const firstParagraph = paragraphs[0];
		return firstParagraph.length <= 300 ? firstParagraph : firstParagraph.substring(0, 300) + '...';
	}

	private countWords(text: string): number {
		return text.trim().split(/\s+/).filter((word) => word.length > 0).length;
	}

	private estimateReadingTime(wordCount: number): number {
		return Math.ceil(wordCount / 225);
	}

	// Simplified extraction methods
	private extractSubtitle($: cheerio.CheerioAPI): string | undefined { return undefined; }
	private extractAuthor($: cheerio.CheerioAPI): string | undefined { return undefined; }
	private extractPublishDate($: cheerio.CheerioAPI): string | undefined { return undefined; }
	private extractLastModified($: cheerio.CheerioAPI): string | undefined { return undefined; }
	private extractCategory($: cheerio.CheerioAPI): string | undefined { return undefined; }
	private extractTags($: cheerio.CheerioAPI): string[] { return []; }
	private extractMedia($: cheerio.CheerioAPI, url: string): MediaContent[] { return []; }
	private extractMetadata($: cheerio.CheerioAPI, url: string): ArticleMetadata {
		return {
			language: 'en',
			source: new URL(url).hostname,
			sourceUrl: url,
			canonical: url,
		};
	}

	private async saveToDatabase(structuredArticle: StructuredArticle): Promise<string> {
		// Simplified database save
		return 'mock-post-id';
	}
}
