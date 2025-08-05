import { MCPTool } from '@shared/backend';
import { z } from 'zod';
import FirecrawlApp from '@mendable/firecrawl-js';
import config from '../config.js';
import type { NewsArticlePreview } from '@shared/types';
import { MCPToolResponse } from '../types/response.js';
import { injectable, inject } from 'inversify';
import { PrismaClient } from '@prisma/client';
import { TYPES } from '../types/di.types.js';

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

	constructor(@inject(TYPES.PrismaClient) private prisma: PrismaClient) {
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

	private async saveArticlesToDatabase(
		articles: NewsArticlePreview[],
		sourceUrl: string
	): Promise<{ saved: number; skipped: number }> {
		let saved = 0;
		let skipped = 0;

		// Find the news source by URL
		const newsSource = await this.prisma.newsSource.findFirst({
			where: {
				url: {
					contains: new URL(sourceUrl).hostname,
				},
			},
		});

		if (!newsSource) {
			console.warn(`No news source found for URL: ${sourceUrl}`);
			return { saved: 0, skipped: articles.length };
		}

		// for (const article of articles) {
		// 	try {
		// 		// Use upsert to avoid duplicates based on URL
		// 		const savedArticle = await this.prisma.newsArticle.upsert({
		// 			where: {
		// 				url: article.link,
		// 			},
		// 			update: {
		// 				title: article.title,
		// 				summary: article.excerpt || null,
		// 				// Don't update publishedAt on updates to preserve original date
		// 			},
		// 			create: {
		// 				sourceId: newsSource.id,
		// 				title: article.title,
		// 				url: article.link,
		// 				summary: article.excerpt || null,
		// 				publishedAt: new Date(), // Use current time as we don't have the original publish date
		// 			},
		// 		});

		// 		// Add media if present
		// 		if (article.media && article.media.url) {
		// 			// Check if media already exists for this article
		// 			const existingMedia =
		// 				await this.prisma.articleMedia.findFirst({
		// 					where: {
		// 						articleId: savedArticle.id,
		// 						url: article.media.url,
		// 					},
		// 				});

		// 			if (!existingMedia) {
		// 				await this.prisma.articleMedia.create({
		// 					data: {
		// 						articleId: savedArticle.id,
		// 						url: article.media.url,
		// 						type:
		// 							article.media.type === 'image'
		// 								? 'IMAGE'
		// 								: 'VIDEO',
		// 						title: null,
		// 						caption: null,
		// 					},
		// 				});
		// 			}
		// 		}

		// 		saved++;
		// 	} catch (error) {
		// 		console.error(`Failed to save article ${article.link}:`, error);
		// 		skipped++;
		// 	}
		// }

		return { saved, skipped };
	}

	async execute(
		params: z.infer<typeof FirecrawlNewsHomepageSchema>
	): Promise<MCPToolResponse> {
		try {
			const { urls, limit } = params;
			const articlesBySource: Record<string, NewsArticlePreview[]> = {};
			const databaseStats = { totalSaved: 0, totalSkipped: 0 };

			console.log(
				`🔥 FirecrawlNewsHomepage: Processing ${urls.length} URLs`
			);
			console.log(`📋 URLs to scrape:`, urls);
			const startTime = Date.now();

			// Use different scraping strategies based on URL count
			if (urls.length === 1) {
				// Single URL - use regular scrape for better performance
				console.log(`⚡ Single URL mode: ${urls[0]}`);

				// Ensure URL has protocol
				const fullUrl = urls[0].startsWith('http')
					? urls[0]
					: `https://${urls[0]}`;

				const response = await this.firecrawl.scrapeUrl(fullUrl, {
					formats: ['extract'],
					extract: {
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
						} as any,
					},
				});

				const singleDuration = Date.now() - startTime;
				console.log(
					`⚡ Single scrape completed in ${singleDuration}ms (${(
						singleDuration / 1000
					).toFixed(1)}s)`
				);

				if (response.success && response.extract) {
					const sourceName = new URL(fullUrl).hostname;
					const items = Array.isArray(response.extract)
						? response.extract
						: [];
					console.log(
						`📄 Extracted ${items.length} articles from ${sourceName}`
					);

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

					// Save articles to database
					if (articles.length > 0) {
						const saveResult = await this.saveArticlesToDatabase(
							articles,
							fullUrl
						);
						databaseStats.totalSaved += saveResult.saved;
						databaseStats.totalSkipped += saveResult.skipped;
						console.log(
							`💾 Saved ${saveResult.saved} articles from ${sourceName}, skipped ${saveResult.skipped}`
						);
					}
				} else {
					console.log(
						`❌ Single scrape failed or returned no data for ${fullUrl}`
					);
				}
			} else {
				// Multiple URLs - use batch processing
				console.log(
					`🔄 Batch mode: Processing ${urls.length} URLs in batches`
				);

				// Process URLs in smaller batches to avoid timeouts
				const batchSize = 2; // Process max 2 URLs at a time
				const urlBatches = [];
				for (let i = 0; i < urls.length; i += batchSize) {
					urlBatches.push(urls.slice(i, i + batchSize));
				}

				console.log(
					`📦 Created ${urlBatches.length} batches of max ${batchSize} URLs each`
				);

				// Process each batch sequentially to avoid overwhelming Firecrawl
				for (
					let batchIndex = 0;
					batchIndex < urlBatches.length;
					batchIndex++
				) {
					const batch = urlBatches[batchIndex];
					const batchStartTime = Date.now();
					console.log(
						`🔄 Processing batch ${batchIndex + 1}/${
							urlBatches.length
						}: ${batch.length} URLs`
					);

					// Ensure URLs have protocol
					const fullUrls = batch.map((url) =>
						url.startsWith('http') ? url : `https://${url}`
					);

					const response = await this.firecrawl.batchScrapeUrls(
						fullUrls,
						{
							formats: ['extract'],
							extract: {
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
								} as any,
							},
						}
					);

					const batchDuration = Date.now() - batchStartTime;
					console.log(
						`✅ Batch ${
							batchIndex + 1
						} completed in ${batchDuration}ms (${(
							batchDuration / 1000
						).toFixed(1)}s)`
					);

					if (response.success && response.data) {
						for (const result of response.data) {
							const sourceName = result.url
								? new URL(result.url).hostname
								: 'unknown';
							const items = Array.isArray(result.extract)
								? result.extract
								: [];
							console.log(
								`📄 Extracted ${items.length} articles from ${sourceName}`
							);

							const articles = items
								.slice(0, limit)
								.map((item: any) => ({
									title: item.title,
									link: item.link,
									excerpt: item.excerpt,
									media: item.image
										? ({
												type: 'image',
												url: item.image,
										  } as const)
										: undefined,
									source: {
										site: item.source || sourceName,
										domain: sourceName,
									},
								})) as NewsArticlePreview[];

							articlesBySource[sourceName] = articles;

							// Save articles to database
							if (result.url && articles.length > 0) {
								const saveResult =
									await this.saveArticlesToDatabase(
										articles,
										result.url
									);
								databaseStats.totalSaved += saveResult.saved;
								databaseStats.totalSkipped +=
									saveResult.skipped;
								console.log(
									`Saved ${saveResult.saved} articles from ${sourceName}, skipped ${saveResult.skipped}`
								);
							}
						}
					}

					// Add a small delay between batches to avoid rate limiting
					if (urlBatches.length > 1) {
						await new Promise((resolve) =>
							setTimeout(resolve, 1000)
						);
					}
				}
			}

			const totalDuration = Date.now() - startTime;
			const totalArticles = Object.values(articlesBySource).flat().length;
			console.log(
				`🏁 FirecrawlNewsHomepage completed in ${totalDuration}ms (${(
					totalDuration / 1000
				).toFixed(1)}s)`
			);
			console.log(
				`📊 Total: ${totalArticles} articles from ${
					Object.keys(articlesBySource).length
				} sources`
			);
			console.log(
				`💾 Database: ${databaseStats.totalSaved} saved, ${databaseStats.totalSkipped} skipped`
			);

			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify({
							data: articlesBySource,
							metadata: {
								totalSources:
									Object.keys(articlesBySource).length,
								totalArticles,
								database: {
									saved: databaseStats.totalSaved,
									skipped: databaseStats.totalSkipped,
								},
								timing: {
									totalDurationMs: totalDuration,
									totalDurationSeconds: Number(
										(totalDuration / 1000).toFixed(1)
									),
								},
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
