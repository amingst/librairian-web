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

type Config = typeof config;

@injectable()
class NewsScraper {
	constructor(
		@inject(MCPHttpServer) private readonly server: MCPHttpServer,
		@inject(TYPES.Config) private readonly config: Config,
		@inject(TYPES.StartHomepageFirecrawlJob)
		private readonly startHomepageFirecrawlJob: IMCPTool,
		@inject(TYPES.StartFirecrawlExtractArticleJob)
		private readonly startFirecrawlExtractArticleJob: IMCPTool
	) {
		this.setupShutdownHandlers();
	}

	private get tools(): IMCPTool[] {
		return [
			this.startHomepageFirecrawlJob, // Firecrawl homepage scraping
			this.startFirecrawlExtractArticleJob, // Firecrawl article content extraction
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
			`📡 Webhook endpoint: POST http://${this.config.host}:${this.config.port}/api/webhooks/firecrawl`
		);
	}

	/**
	 * Setup webhook endpoint for Firecrawl to send event notifications
	 */
	private setupWebhookEndpoint(): void {
		// Access the Express app from the MCPHttpServer
		// @ts-ignore - We know expressApp exists on the server
		const app = this.server.expressApp;

		if (!app) {
			console.error(
				'Express app not available, cannot setup webhook endpoint'
			);
			return;
		}

		// Create a webhook endpoint for Firecrawl
		app.post(
			'/api/webhooks/firecrawl',
			async (req: Request, res: Response) => {
				try {
					console.log(
						'Received webhook from Firecrawl:',
						req.body?.type
					);

					// Get the webhook payload
					const payload = req.body;
					console.log('Webhook payload:', payload);

					if (!payload) {
						return res
							.status(400)
							.json({ error: 'Invalid webhook payload' });
					}

					// Process the webhook payload
					const { type } = payload;

					// Determine which tool should handle the webhook based on the event type
					if (type && type.includes('homepage')) {
						// Homepage scraping events go to StartHomepageFirecrawlJob
						const homepageJob = this
							.startHomepageFirecrawlJob as StartHomepageFirecrawlJob;
						await homepageJob.handleWebhookEvent(payload);
					} else if (
						type &&
						(type.includes('article') || type.includes('page'))
					) {
						// Article extraction events go to StartFirecrawlExtractArticleJob
						const extractJob = this
							.startFirecrawlExtractArticleJob as StartFirecrawlExtractArticleJob;
						await extractJob.handleWebhookEvent(payload);
					} else {
						// Default to homepage job for backward compatibility
						const homepageJob = this
							.startHomepageFirecrawlJob as StartHomepageFirecrawlJob;
						await homepageJob.handleWebhookEvent(payload);
					}

					// Return success to acknowledge receipt
					return res.status(200).json({ success: true });
				} catch (error) {
					console.error('Error handling webhook:', error);
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

		console.log('📢 Webhook endpoint registered for Firecrawl');
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
