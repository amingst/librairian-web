import FirecrawlApp from '@mendable/firecrawl-js';
import { MCPTool } from '@shared/backend';
import { inject, injectable } from 'inversify';
import { TYPES } from '../types/symbols.js';
import { PrismaClient } from '@prisma/client';
import config from '../config.js';
import z from 'zod';
import { MCPToolResponse } from '../types/response.js';
import { URL } from 'url';

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
export class StartHomepageFirecrawlJob extends MCPTool {
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
		return 'start_homepage_firecrawl_job';
	}

	get description(): string {
		return 'Starts a Firecrawl job to scrape news articles from the web';
	}

	get inputSchema(): z.ZodSchema {
		return FirecrawlNewsHomepageSchema;
	}

	get schema(): z.ZodType {
		return FirecrawlNewsHomepageSchema;
	}

	async execute(
		params: z.infer<typeof FirecrawlNewsHomepageSchema>
	): Promise<MCPToolResponse | undefined> {
		const { urls, limit } = params;

		try {
			console.log(`Starting Firecrawl batch job for URLs:`, urls);

			// Ensure URLs have protocol
			const fullUrls = urls.map((url) =>
				url.startsWith('http') ? url : `https://${url}`
			);

			// Define schema using zod for all articles
			const articleSchema = {
				type: 'array',
				items: {
					type: 'object',
					properties: {
						title: { type: 'string' },
						link: { type: 'string' },
						excerpt: { type: 'string' },
						image: { type: 'string' },
						source: {
							type: 'object',
							properties: {
								author: { type: 'string' },
								section: { type: 'string' },
								domain: { type: 'string' },
							},
						},
					},
					required: ['title', 'link'],
				},
			};

			// Setup webhook config
			// For local development, you would need a webhook service like ngrok
			// For production, use a real webhook endpoint
			const baseUrl = `https://c28bf2c850b4.ngrok-free.app	`;
			const webhookConfig = {
				url:
					process.env.WEBHOOK_URL ||
					`${baseUrl}/api/webhooks/firecrawl`,
				events: ['page', 'completed', 'failed'],
				metadata: {
					jobType: 'homepage_scrape',
					timestamp: new Date().toISOString(),
					urlCount: String(fullUrls.length),
					limit: String(limit),
				},
			};

			// Start the batch scraping job with webhook
			const response = await this.firecrawl.batchScrapeUrlsAndWatch(
				fullUrls,
				{
					formats: ['extract'],
					extract: {
						prompt: `Extract up to ${limit} article previews from the homepage of the news site. Include title, link, image, excerpt, and source if available. The link should be a full URL to the individual article rather than the homepage.`,
						schema: articleSchema,
					},
					// Add webhook to options
					// @ts-ignore - Webhook option may not be in type definition but is supported
					webhook: webhookConfig,
				}
			);

			// Return the job ID and status immediately
			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify({
							id: response.id,
							status: response.status,
							message: `Started scraping job for ${urls.length} URLs with limit ${limit} articles per site. Results will be processed via webhook.`,
							startTime: new Date(),
						}),
					},
				],
			};
		} catch (error) {
			console.error('Error starting scraping job:', error);
			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify({
							error: 'Failed to start scraping job',
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
	 * Save a scraped article to the Post model
	 */
	private async saveArticleToPost(
		article: any,
		sourceUrl: string
	): Promise<void> {
		try {
			// ULTRA VERBOSE DEBUGGING
			console.log(`-------------- ARTICLE SAVING START --------------`);
			console.log(`SOURCE URL: ${sourceUrl}`);
			console.log(`ARTICLE FULL DATA:`, JSON.stringify(article, null, 2));

			// Extract relevant data from the article
			const { title, link, excerpt, image } = article;
			const source = article.source || {};

			console.log(`EXTRACTED TITLE: "${title || 'MISSING'}"`);
			console.log(`EXTRACTED LINK: "${link || 'MISSING'}"`);
			console.log(`EXTRACTED IMAGE: "${image || 'MISSING'}"`);
			console.log(`EXTRACTED SOURCE:`, JSON.stringify(source, null, 2));

			let hostname;
			try {
				hostname = new URL(sourceUrl).hostname;
				console.log(`HOSTNAME FROM SOURCE URL: ${hostname}`);
			} catch (error) {
				console.error(
					`Invalid source URL: ${sourceUrl}. Using default.`
				);
				hostname = 'unknown';
			}

			if (!link) {
				console.error(
					`⛔ Missing link for article: "${title}". Skipping.`
				);
				console.log(
					`-------------- ARTICLE SKIPPED (NO LINK) --------------`
				);
				return;
			}

			// Validate the link is a proper URL
			let webUrl;
			try {
				// Handle relative URLs by joining with the source URL
				if (link.startsWith('/') && !link.startsWith('//')) {
					// It's a relative URL, so join it with the source URL
					const sourceUrlObj = new URL(sourceUrl);
					const baseUrl = `${sourceUrlObj.protocol}//${sourceUrlObj.host}`;
					webUrl = new URL(link, baseUrl).href;
					console.log(
						`🔄 Converted relative URL: ${link} → ${webUrl}`
					);
				} else if (!link.includes('://')) {
					// It might be a protocol-relative URL (//example.com) or missing protocol
					if (link.startsWith('//')) {
						// Protocol-relative URL
						const sourceUrlObj = new URL(sourceUrl);
						webUrl = `${sourceUrlObj.protocol}${link}`;
						console.log(
							`🔄 Added protocol to URL: ${link} → ${webUrl}`
						);
					} else {
						// Missing protocol, assume https
						webUrl = `https://${link}`;
						console.log(
							`🔄 Added https protocol to URL: ${link} → ${webUrl}`
						);
					}
				} else {
					// It's already an absolute URL
					const url = new URL(link);
					webUrl = url.href;
				}

				// Additional URL validation
				const url = new URL(webUrl);
				if (!url.protocol.startsWith('http')) {
					console.error(
						`⛔ Invalid URL protocol: ${url.protocol}. Skipping.`
					);
					console.log(
						`-------------- ARTICLE SKIPPED (INVALID PROTOCOL) --------------`
					);
					return;
				}

				console.log(`✅ Valid URL: ${webUrl}`);
			} catch (urlError) {
				console.error(`⛔ Invalid URL format: ${link}. Skipping.`);
				console.log(`URL Error:`, urlError);
				console.log(
					`-------------- ARTICLE SKIPPED (INVALID URL) --------------`
				);
				return;
			}

			// Just do a basic check that we're not saving the source URL
			if (webUrl === sourceUrl || webUrl === `${sourceUrl}/`) {
				console.error(`⛔ Article link same as source URL. Skipping.`);
				console.log(
					`-------------- ARTICLE SKIPPED (SAME AS SOURCE) --------------`
				);
				return;
			}

			// Check if this URL is likely to be an article and not a homepage, section page, etc.
			try {
				const urlObj = new URL(webUrl);

				// Check pathname to see if it's likely to be an article
				if (
					urlObj.pathname === '/' ||
					urlObj.pathname === '/index.html' ||
					urlObj.pathname === '/home'
				) {
					console.error(
						`⛔ URL appears to be a homepage, not an article: ${webUrl}. Skipping.`
					);
					console.log(
						`-------------- ARTICLE SKIPPED (NOT AN ARTICLE URL) --------------`
					);
					return;
				}

				// Check if it's a common non-article page
				if (
					urlObj.pathname.match(
						/^\/(about|contact|terms|privacy|help|faq|search)(\/?|\?.*)$/
					)
				) {
					console.error(
						`⛔ URL appears to be a non-article page: ${webUrl}. Skipping.`
					);
					console.log(
						`-------------- ARTICLE SKIPPED (NOT AN ARTICLE URL) --------------`
					);
					return;
				}
			} catch (error) {
				// We already validated the URL earlier, so this shouldn't happen,
				// but if it does, just continue with the existing URL
				console.log(`ℹ️ Error checking URL path: ${error}`);
			}

			console.log(`Processing article: "${title}" with URL: ${webUrl}`);

			try {
				console.log(`Attempting database upsert for: ${webUrl}`);

				// Create data object first to ensure it's properly formatted
				const createData = {
					webUrl,
					bylineWriter: source.author || 'Unknown',
					bylineWritersTitle: source.section || 'Reporter',
					bylineWritersLocation: source.domain || hostname,
					articleText: '', // Empty string so the extract article job will process it later
					featuredImage: image || null,
					// Not handling media items yet as requested
				};

				// Add extra metadata as a comment field if available
				if (title) {
					// @ts-ignore - Adding metadata to track article title
					createData.title = title;
				}

				console.log(
					`Create data:`,
					JSON.stringify(createData, null, 2)
				);

				// The update data is similar but doesn't need to include articleText
				const updateData = {
					bylineWriter: source.author || 'Unknown',
					bylineWritersTitle: source.section || 'Reporter',
					bylineWritersLocation: source.domain || hostname,
					featuredImage: image || null,
				};

				console.log(
					`Update data:`,
					JSON.stringify(updateData, null, 2)
				);

				// Upsert a Post record (create if it doesn't exist, update if it does)
				const result = await this.prisma.post.upsert({
					where: {
						webUrl,
					},
					create: createData,
					update: updateData,
				});

				console.log(`✅ UPSERT RESULT ID: ${result.id}`);
				console.log(
					`✅ Successfully saved article: "${title}" with URL: ${webUrl}`
				);
				console.log(
					`-------------- ARTICLE SAVING COMPLETE --------------`
				);
			} catch (error) {
				const dbError = error as any; // Type assertion for error handling
				console.error(
					`⛔ DATABASE ERROR saving article with URL ${webUrl}`
				);
				console.error(`Error details:`, dbError);

				// Check for specific Prisma error codes
				if (dbError.code === 'P2002') {
					console.error(
						`Unique constraint violation on webUrl: ${webUrl}`
					);
				} else if (dbError.code === 'P2003') {
					console.error(`Foreign key constraint violation`);
				} else if (dbError.code === 'P2025') {
					console.error(`Record not found for where condition`);
				}

				console.log(
					`-------------- ARTICLE FAILED (DB ERROR) --------------`
				);
				return; // Skip this article
			}
		} catch (error) {
			console.error(`⛔ GENERAL ERROR saving article to Post:`, error);
			console.log(
				`-------------- ARTICLE FAILED (GENERAL ERROR) --------------`
			);
			// Continue with other articles even if one fails
		}
	}

	/**
	 * Handle webhook events from Firecrawl
	 * This method can be called from an API endpoint that receives webhook events
	 */
	public async handleWebhookEvent(payload: any): Promise<void> {
		try {
			// Log the entire webhook payload structure for debugging
			console.log(`===== WEBHOOK PAYLOAD STRUCTURE =====`);
			console.log(`Payload keys:`, Object.keys(payload));
			console.log(`Payload type:`, typeof payload);

			const {
				success,
				type,
				id,
				data,
				metadata,
				error: webhookError,
			} = payload;

			console.log(`Received webhook event: ${type} for job ${id}`);
			console.log(`Event success: ${success}`);
			console.log(
				`Data type: ${typeof data}, Is Array: ${Array.isArray(data)}`
			);

			if (Array.isArray(data)) {
				console.log(`Data array length: ${data.length}`);
			}

			console.log(`Metadata:`, JSON.stringify(metadata, null, 2));
			console.log(`===== END WEBHOOK PAYLOAD STRUCTURE =====`);

			// Process different webhook event types
			switch (type) {
				case 'started':
				case 'batch_scrape.started':
					console.log(`Batch scrape job ${id} started`);
					break;

				case 'page':
				case 'batch_scrape.page':
					console.log(
						`Received page event. Full payload:`,
						JSON.stringify(payload, null, 2)
					);

					// Try to directly access the result in case it's just the data without wrapper
					if (payload && typeof payload === 'object') {
						let result = payload;
						let sourceUrl = '';
						let articles = [];

						// Try to find the source URL
						if (payload.metadata?.sourceURL) {
							sourceUrl = payload.metadata.sourceURL;
						} else if (payload.sourceURL) {
							sourceUrl = payload.sourceURL;
						}

						console.log(`Source URL: ${sourceUrl}`);

						// Try to find the articles array
						if (Array.isArray(payload.extract)) {
							articles = payload.extract;
							console.log(
								`Found ${articles.length} articles in payload.extract`
							);
						} else if (
							payload.data &&
							Array.isArray(payload.data)
						) {
							// Try to find it in data
							if (
								payload.data[0] &&
								Array.isArray(payload.data[0].extract)
							) {
								articles = payload.data[0].extract;
								console.log(
									`Found ${articles.length} articles in payload.data[0].extract`
								);
							}
						}

						// Process the articles if we found any
						if (articles.length > 0 && sourceUrl) {
							console.log(
								`Processing ${articles.length} articles from ${sourceUrl}`
							);

							// Process each article
							for (const article of articles) {
								if (article && article.link) {
									try {
										await this.saveArticleToPost(
											article,
											sourceUrl
										);
									} catch (error) {
										console.error(
											`Error saving article:`,
											error
										);
									}
								}
							}
						} else {
							console.error(
								`No articles or source URL found in payload`
							);
						}
					}

				case 'completed':
				case 'batch_scrape.completed':
					console.log(
						`Job completed. Full payload:`,
						JSON.stringify(payload, null, 2)
					);

					// Try to process data from completed event in case it contains articles
					if (payload && typeof payload === 'object') {
						// Check if there are results in the completed event
						let results = [];

						if (Array.isArray(payload.data)) {
							results = payload.data;
						} else if (
							payload.results &&
							Array.isArray(payload.results)
						) {
							results = payload.results;
						}

						console.log(
							`Found ${results.length} results in completed event`
						);

						// Process each result
						for (const result of results) {
							const sourceUrl =
								result.metadata?.sourceURL || result.sourceURL;
							let articles = [];

							if (Array.isArray(result.extract)) {
								articles = result.extract;
							}

							if (articles.length > 0 && sourceUrl) {
								console.log(
									`Processing ${articles.length} articles from ${sourceUrl} in completed event`
								);

								// Process each article
								for (const article of articles) {
									if (article && article.link) {
										try {
											await this.saveArticleToPost(
												article,
												sourceUrl
											);
										} catch (error) {
											console.error(
												`Error saving article:`,
												error
											);
										}
									}
								}
							}
						}
					}
					break;

				case 'failed':
				case 'batch_scrape.failed':
					console.error(
						`Batch scrape job ${id} failed: ${webhookError}`
					);

					// Log detailed error information
					console.log(`====== FAILED JOB DATA START ======`);
					console.log(`Failed Job ID: ${id}`);
					console.log(
						`Job Metadata:`,
						JSON.stringify(metadata, null, 2)
					);
					console.log(
						`Error Details:`,
						JSON.stringify(webhookError, null, 2)
					);

					if (data) {
						console.log(
							`FAILED JOB DATA:`,
							JSON.stringify(data, null, 2)
						);
					}
					console.log(`====== FAILED JOB DATA END ======`);
					break;

				default:
					console.log(`Unhandled webhook event type: ${type}`);
			}
		} catch (error) {
			console.error('Error handling webhook event:', error);
		}
	}
}
