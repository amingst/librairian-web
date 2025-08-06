#!/usr/bin/env node
import 'reflect-metadata';
import { MCPHttpServer, IMCPTool } from '@shared/backend';
import { createContainer } from './container.js';
import { Container, injectable, inject } from 'inversify';
import { TYPES } from './types/di.types.js';
import config from './config.js';
import { Request, Response } from 'express';
import { StartHomepageFirecrawlJob } from './tools/StartHomepageFirecrawlJob.js';
import { StartFirecrawlExtractArticleJob } from './tools/StartFirecrawlExtractArticleJob.js';
import { StartHomepageHtmlScraperJob } from './tools/StartHomepageHtmlScraperJob.js';
import { StartArticleHtmlScraperJob } from './tools/StartArticleHtmlScraperJob.js';

type Config = typeof config;

@injectable()
class NewsScraper {
	constructor(
		@inject(MCPHttpServer) private readonly server: MCPHttpServer,
		@inject(TYPES.Config) private readonly config: Config,
		@inject(TYPES.StartHomepageFirecrawlJob)
		private readonly startHomepageFirecrawlJob: IMCPTool,
		@inject(TYPES.StartFirecrawlExtractArticleJob)
		private readonly startFirecrawlExtractArticleJob: IMCPTool,
		@inject(TYPES.StartHomepageHtmlScraperJob)
		private readonly startHomepageHtmlScraperJob: IMCPTool,
		@inject(TYPES.StartArticleHtmlScraperJob)
		private readonly startArticleHtmlScraperJob: IMCPTool
	) {
		this.setupShutdownHandlers();
	}

	private get tools(): IMCPTool[] {
		return [
			this.startHomepageFirecrawlJob, // Firecrawl homepage scraping
			this.startFirecrawlExtractArticleJob, // Firecrawl article content extraction
			this.startHomepageHtmlScraperJob, // Local HTML homepage scraping
			this.startArticleHtmlScraperJob, // Local HTML article content extraction
		];
	}

	public async start(): Promise<void> {
		// Register tools with the server
		this.server.registerTools(this.tools);

		// Setup webhook endpoint
		this.setupWebhookEndpoint();

		// Log startup information
		console.log('🚀 Express MCP Server with integrated tools started!');
		console.log(`📦 Loaded ${this.tools.length} tools`);
		console.log(
			`📡 JSON-RPC endpoint: POST http://${this.config.host}:${this.config.port}/mcp`
		);
		console.log(
			`📖 Documentation: http://${this.config.host}:${this.config.port}/`
		);
		console.log(
			`📡 Webhook endpoints: 
			  - Homepage: POST http://${this.config.host}:${this.config.port}/api/webhooks/firecrawl/homepage
			  - Article: POST http://${this.config.host}:${this.config.port}/api/webhooks/firecrawl/article`
		);
	}

	/**
	 * Setup webhook endpoints for Firecrawl to send event notifications
	 */
	private setupWebhookEndpoint(): void {
		// Access the Express app from the MCPHttpServer
		// @ts-ignore - We know expressApp exists on the server
		const app = this.server.expressApp;

		if (!app) {
			console.error(
				'Express app not available, cannot setup webhook endpoints'
			);
			return;
		}

		// Create webhook endpoint for homepage scraping
		app.post(
			'/api/webhooks/firecrawl/homepage',
			async (req: Request, res: Response) => {
				try {
					console.log(
						'Received homepage webhook from Firecrawl:',
						req.body?.type
					);

					const payload = req.body;
					console.log('Homepage webhook payload:', payload);

					if (!payload) {
						return res
							.status(400)
							.json({ error: 'Invalid webhook payload' });
					}

					// Always route to homepage job
					const homepageJob = this
						.startHomepageFirecrawlJob as StartHomepageFirecrawlJob;
					await homepageJob.handleWebhookEvent(payload);

					return res.status(200).json({ success: true });
				} catch (error) {
					console.error('Error handling homepage webhook:', error);
					return res.status(500).json({
						success: false,
						error:
							error instanceof Error
								? error.message
								: String(error),
					});
				}
			}
		);

		// Create webhook endpoint for article extraction
		app.post(
			'/api/webhooks/firecrawl/article',
			async (req: Request, res: Response) => {
				try {
					console.log(
						'Received article webhook from Firecrawl:',
						req.body?.type
					);

					const payload = req.body;
					console.log('Article webhook payload:', payload);

					if (!payload) {
						return res
							.status(400)
							.json({ error: 'Invalid webhook payload' });
					}

					// Always route to article extraction job
					const extractJob = this
						.startFirecrawlExtractArticleJob as StartFirecrawlExtractArticleJob;
					await extractJob.handleWebhookEvent(payload);

					return res.status(200).json({ success: true });
				} catch (error) {
					console.error('Error handling article webhook:', error);
					return res.status(500).json({
						success: false,
						error:
							error instanceof Error
								? error.message
								: String(error),
					});
				}
			}
		);

		console.log('📢 Webhook endpoints registered for Firecrawl:');
		console.log('   - Homepage: /api/webhooks/firecrawl/homepage');
		console.log('   - Article: /api/webhooks/firecrawl/article');
	}

	private setupShutdownHandlers(): void {
		process.on('SIGINT', async () => {
			console.log('\n🛑 Shutting down MCP HTTP server...');
			await this.server.stop();
			process.exit(0);
		});

		process.on('SIGTERM', async () => {
			console.log(
				'\n🛑 Received SIGTERM, shutting down MCP HTTP server...'
			);
			await this.server.stop();
			process.exit(0);
		});
	}
}

// Bootstrap the application
async function bootstrap() {
	const container = createContainer();
	container.bind(NewsScraper).toSelf().inSingletonScope();

	const program = container.get(NewsScraper);
	await program.start();
}

bootstrap().catch(console.error);
