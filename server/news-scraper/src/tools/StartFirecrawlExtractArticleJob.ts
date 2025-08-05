import FirecrawlApp from '@mendable/firecrawl-js';
import { MCPTool } from '@shared/backend';
import { inject, injectable } from 'inversify';
import { TYPES } from '../types/symbols.js';
import { PrismaClient } from '@prisma/client';
import config from '../config.js';
import z from 'zod';
import { MCPToolResponse } from '../types/response.js';
import { URL } from 'url';

const FirecrawlArticleExtractionSchema = z.object({
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

@injectable()
export class StartFirecrawlExtractArticleJob extends MCPTool {
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
		return 'start_article_extract_firecrawl_job';
	}
	get description(): string {
		return 'Starts a Firecrawl job to extract article content from the web';
	}
	get schema(): Record<string, any> {
		return FirecrawlArticleExtractionSchema;
	}

	async execute(
		params: z.infer<typeof FirecrawlArticleExtractionSchema>
	): Promise<MCPToolResponse | undefined> {
		const { postIds, limit = 50 } = params;

		try {
			console.log(`Starting Firecrawl article extraction job`);

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
							}),
						},
					],
				};
			}

			// Extract URLs from posts to process
			const urlsToProcess = postsToProcess
				.filter((post) => post.webUrl)
				.map((post) => post.webUrl);

			console.log(`Extracted ${urlsToProcess.length} URLs to process`);

			// Set up webhook configuration
			const webhookConfig = {
				url:
					config.webhooks.article ||
					`${config.webhookBaseUrl}/api/webhooks/firecrawl/article`,
				events: ['page', 'completed', 'failed'],
				metadata: {
					jobType: 'article_extract',
					timestamp: new Date().toISOString(),
					urlCount: String(urlsToProcess.length),
					postIds: JSON.stringify(postsToProcess.map((p) => p.id)), // Send as stringified JSON
				},
			};

			// Start the batch job to extract article content
			const response = await this.firecrawl.batchScrapeUrlsAndWatch(
				urlsToProcess,
				{
					formats: ['extract'],
					extract: {
						prompt: 'Extract the full article content, including title, author, content, and publication date',
						schema: {
							type: 'object',
							properties: {
								title: { type: 'string' },
								author: { type: 'string' },
								content: { type: 'string' },
								publicationDate: { type: 'string' },
							},
							required: ['content'],
						},
					},
					// Add webhook to options
					// @ts-ignore - Webhook option may not be in type definition but is supported
					webhook: webhookConfig,
				}
			);

			// Return job ID and status immediately
			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify({
							id: response.id,
							status: response.status,
							message: `Started article extraction job for ${urlsToProcess.length} URLs. Results will be processed via webhook.`,
							startTime: new Date(),
						}),
					},
				],
			};
		} catch (error) {
			console.error('Error starting article extraction job:', error);
			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify({
							error: 'Failed to start article extraction job',
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

	public async handleWebhookEvent(payload: any): Promise<void> {
		try {
			const {
				success,
				type,
				id,
				data,
				metadata,
				error: webhookError,
			} = payload;

			console.log(`Received webhook event: ${type} for job ${id}`);

			// Check if this is for an article extraction job either by metadata or event type
			// Note: Firecrawl may not always preserve all metadata in webhooks
			if (
				!(
					(metadata && metadata.jobType === 'article_extract') ||
					(type &&
						(type.includes('article') || type.includes('page')))
				)
			) {
				console.log('Not an article extraction job, ignoring');
				return;
			}

			// Get post IDs from metadata if present
			let postIds = [];
			try {
				postIds = metadata.postIds ? JSON.parse(metadata.postIds) : [];
				if (postIds.length > 0) {
					console.log(`Found ${postIds.length} post IDs in metadata`);
				}
			} catch (error) {
				console.error('Error parsing postIds from metadata:', error);
			}

			// Process different webhook event types
			switch (type) {
				case 'started':
				case 'batch_scrape.started':
					console.log(`Article extraction job ${id} started`);
					break;

				case 'page':
				case 'batch_scrape.page':
					if (success && data && data.length > 0) {
						const result = data[0];
						const sourceUrl = result.metadata?.sourceURL;
						console.log(`Processed URL: ${sourceUrl || 'unknown'}`);

						if (!sourceUrl) {
							console.warn(
								'No source URL found in webhook payload, skipping'
							);
							return;
						}

						// Extract article content from the result
						const extractedData = result.extract;
						if (!extractedData) {
							console.warn(
								`No extract data found for URL: ${sourceUrl}`
							);
							return;
						}

						// Find the corresponding post by URL
						const post = await this.prisma.post.findFirst({
							where: {
								webUrl: sourceUrl,
							},
						});

						if (!post) {
							console.warn(
								`No post found with URL: ${sourceUrl}. Creating a new post.`
							);

							// Create a new post with the extracted content
							await this.createPostWithExtractedContent(
								sourceUrl,
								extractedData
							);
							return;
						}
						if (!extractedData) {
							console.warn(
								`No extract data found for URL: ${sourceUrl}`
							);
							return;
						}

						// Update the post with the extracted content
						await this.updatePostWithExtractedContent(
							post.id,
							extractedData,
							sourceUrl
						);
					}
					break;

				case 'completed':
				case 'batch_scrape.completed':
					console.log(
						`Article extraction job ${id} completed successfully`
					);
					break;

				case 'failed':
				case 'batch_scrape.failed':
					console.error(
						`Article extraction job ${id} failed: ${webhookError}`
					);
					break;

				default:
					console.log(`Unhandled webhook event type: ${type}`);
			}
		} catch (error) {
			console.error('Error handling webhook event:', error);
		}
	}

	/**
	 * Update a post with extracted content
	 */
	private async updatePostWithExtractedContent(
		postId: string,
		extractedData: any,
		sourceUrl: string
	): Promise<void> {
		try {
			console.log(
				`Updating post ${postId} with extracted content from ${sourceUrl}`
			);

			// Extract the content from the extraction result
			const { title, author, content, publicationDate } = extractedData;

			// Update the post with the extracted content
			await this.prisma.post.update({
				where: {
					id: postId,
				},
				data: {
					articleText: content || '',
					bylineWriter: author || undefined,
					// Add other fields as needed
				},
			});

			console.log(`✅ Updated post ${postId} with extracted content`);
		} catch (error) {
			console.error(`Error updating post ${postId}:`, error);
			// Continue with other posts even if one fails
		}
	}

	/**
	 * Create a new post with extracted content
	 */
	private async createPostWithExtractedContent(
		sourceUrl: string,
		extractedData: any
	): Promise<void> {
		try {
			console.log(
				`Creating new post with extracted content from ${sourceUrl}`
			);

			// Extract the content from the extraction result
			const { title, author, content, publicationDate } = extractedData;
			const hostname = new URL(sourceUrl).hostname;

			// Create a new post with the extracted content
			const newPost = await this.prisma.post.create({
				data: {
					webUrl: sourceUrl,
					bylineWriter: author || 'Unknown',
					bylineWritersTitle: 'Reporter',
					bylineWritersLocation: hostname,
					articleText: content || '',
					// Add other fields as needed
				},
			});

			console.log(
				`✅ Created new post ${newPost.id} with extracted content`
			);
		} catch (error) {
			console.error(`Error creating post for ${sourceUrl}:`, error);
			// Continue with other posts even if one fails
		}
	}
}
