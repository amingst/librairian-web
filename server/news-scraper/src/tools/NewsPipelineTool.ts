import z from 'zod';
import { MCPTool } from '@shared/backend';
import { HTMLScraperBase } from '../lib/helpers/html.js';
import { NewsHomepageTool } from './NewsHomepage.js';
import { SingleSiteScraperTool } from './SingleSiteScraper.js';
import { ArticleExtractorTool } from './ArticleExtractor.js';
import { SiteConfig, NewsArticlePreview } from '@shared/types';
import type { MCPToolResponse } from '../types/index.js';
import { injectable } from 'inversify';

interface FullArticle extends NewsArticlePreview {
	html?: string;
	text?: string;
	wordCount?: number;
	readingTime?: number;
	error?: string;
}

interface PipelineResult {
	articles: FullArticle[];
	metadata: {
		totalHomepages: number;
		totalLinksFound: number;
		totalArticlesScraped: number;
		totalTextExtracted: number;
		processingTime: number;
		errors: string[];
	};
}

@injectable()
export class NewsPipelineTool extends MCPTool {
	private static readonly inputSchema = z.object({
		sites: z
			.array(
				z.object({
					domain: z.string(),
					name: z.string(),
					selectors: z.object({
						container: z.union([z.string(), z.array(z.string())]),
						title: z.union([z.string(), z.array(z.string())]),
						link: z.union([z.string(), z.array(z.string())]),
						image: z
							.union([z.string(), z.array(z.string())])
							.optional(),
						section: z
							.union([z.string(), z.array(z.string())])
							.optional(),
						date: z
							.union([z.string(), z.array(z.string())])
							.optional(),
					}),
					userAgent: z.string().optional(),
					headers: z.record(z.string()).optional(),
				})
			)
			.min(1),
		limit: z.number().min(1).max(50).default(10),
		delayBetweenRequests: z.number().min(0).max(5000).default(500),
		includeHtml: z.boolean().default(false),
		includeText: z.boolean().default(true),
		includeMetrics: z.boolean().default(true),
	});

	private homepageTool = new NewsHomepageTool();
	private scraperTool = new SingleSiteScraperTool();
	private textTool = new ArticleExtractorTool();

	get name(): string {
		return 'scrape_news_pipeline';
	}

	get description(): string {
		return 'Complete news scraping pipeline: scrapes homepages → extracts article links → scrapes full articles → extracts text content';
	}

	get schema(): Record<string, any> {
		return NewsPipelineTool.inputSchema.shape;
	}

	async execute(params: any): Promise<MCPToolResponse> {
		const startTime = Date.now();
		const {
			sites,
			limit = 10,
			delayBetweenRequests = 500,
			includeHtml = false,
			includeText = true,
			includeMetrics = true,
		} = params;

		const errors: string[] = [];
		let totalLinksFound = 0;
		let totalArticlesScraped = 0;
		let totalTextExtracted = 0;

		try {
			// Step 1: Scrape homepages for article links
			console.error('Step 1: Scraping homepages...');
			const homepageResponse = await this.homepageTool.execute({
				sites,
				limit,
				includeMedia: false,
				includeSections: true,
				includeMetrics: false,
				sortBy: 'position',
			});

			const homepageData = JSON.parse(homepageResponse.content[0].text);
			const allArticles: NewsArticlePreview[] = [];

			// Collect all article links from all sites
			for (const [domain, articles] of Object.entries(
				homepageData.data
			)) {
				if (Array.isArray(articles)) {
					allArticles.push(...articles);
					totalLinksFound += articles.length;
				}
			}

			console.error(`Found ${totalLinksFound} article links`);

			// Step 2: Scrape full article content
			console.error('Step 2: Scraping full articles...');
			const fullArticles: FullArticle[] = [];

			for (let i = 0; i < allArticles.length; i++) {
				const article = allArticles[i];

				try {
					// Add delay between requests
					if (i > 0 && delayBetweenRequests > 0) {
						await this.delay(delayBetweenRequests);
					}

					const articleResponse = await this.scraperTool.execute({
						url: article.link,
						extract_links: false,
						extract_images: false,
						extract_text: false, // We'll do text extraction separately
					});

					const articleData = JSON.parse(
						articleResponse.content[0].text
					);
					console.error('Article data:', {
						hasContent: !!articleData.content,
						contentLength: articleData.content
							? articleData.content.length
							: 0,
						keys: Object.keys(articleData),
					});

					const fullArticle: FullArticle = {
						...article,
						html: includeHtml ? articleData.content : undefined,
					};

					// Step 3: Extract text content
					if (includeText) {
						console.error(
							`Step 3: Extracting text for article ${i + 1}/${
								allArticles.length
							}`
						);

						try {
							const textResponse = await this.textTool.execute({
								url: article.link, // TextExtractor expects URL, not HTML
								include_media: false,
								extract_tags: false,
								estimate_reading_time: includeMetrics,
							});

							const textData = JSON.parse(
								textResponse.content[0].text
							);
							console.error('Text extraction data:', {
								hasContent: !!textData.content,
								hasFullText: !!textData.content?.fullText,
								contentKeys: textData.content
									? Object.keys(textData.content)
									: 'no content',
							});

							fullArticle.text =
								textData.content?.fullText ||
								textData.content?.text;

							if (includeMetrics && textData.content) {
								fullArticle.wordCount =
									textData.content.wordCount;
								fullArticle.readingTime =
									textData.content.readingTime;
							}

							totalTextExtracted++;
						} catch (textError) {
							fullArticle.error = `Text extraction failed: ${
								textError instanceof Error
									? textError.message
									: String(textError)
							}`;
							errors.push(
								`Text extraction failed for ${article.link}: ${fullArticle.error}`
							);
						}
					}

					fullArticles.push(fullArticle);
					totalArticlesScraped++;
				} catch (scrapeError) {
					const errorMsg =
						scrapeError instanceof Error
							? scrapeError.message
							: String(scrapeError);
					errors.push(
						`Failed to scrape ${article.link}: ${errorMsg}`
					);

					fullArticles.push({
						...article,
						error: `Scraping failed: ${errorMsg}`,
					});
				}
			}

			const processingTime = Date.now() - startTime;

			const result: PipelineResult = {
				articles: fullArticles,
				metadata: {
					totalHomepages: sites.length,
					totalLinksFound,
					totalArticlesScraped,
					totalTextExtracted,
					processingTime,
					errors,
				},
			};

			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify(result, null, 2),
					},
				],
			};
		} catch (error) {
			const errorMsg =
				error instanceof Error ? error.message : String(error);
			errors.push(`Pipeline failed: ${errorMsg}`);

			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify(
							{
								articles: [],
								metadata: {
									totalHomepages: sites.length,
									totalLinksFound: 0,
									totalArticlesScraped: 0,
									totalTextExtracted: 0,
									processingTime: Date.now() - startTime,
									errors,
								},
							},
							null,
							2
						),
					},
				],
			};
		}
	}

	private async delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}
