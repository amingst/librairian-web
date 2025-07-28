#!/usr/bin/env node
import 'reflect-metadata';
import { MCPHttpServer, IMCPTool } from '@shared/backend';
import { createContainer } from './container.js';
import { Container, injectable, inject } from 'inversify';
import { TYPES } from './types/di.types.js';
import config from './config.js';

type Config = typeof config;

@injectable()
class NewsScraper {
	constructor(
		@inject(TYPES.WebpageSearch) private readonly webpageSearch: IMCPTool,
		@inject(TYPES.SingleSiteScraper)
		private readonly singleSiteScraper: IMCPTool,
		@inject(TYPES.WebpageMetadata)
		private readonly webpageMetadata: IMCPTool,
		@inject(TYPES.ArticleExtractor)
		private readonly articleExtractor: IMCPTool,
		@inject(TYPES.NewsHomepage) private readonly newsHomepage: IMCPTool,
		@inject(TYPES.NewsPipeline) private readonly newsPipeline: IMCPTool,
		@inject(TYPES.FirecrawlNewsHomepage)
		private readonly firecrawlNewsHomepage: IMCPTool,
		@inject(MCPHttpServer) private readonly server: MCPHttpServer,
		@inject(TYPES.Config) private readonly config: Config
	) {
		this.setupShutdownHandlers();
	}

	private get tools(): IMCPTool[] {
		return [
			this.webpageSearch,
			this.singleSiteScraper,
			this.webpageMetadata,
			this.articleExtractor,
			this.newsHomepage,
			this.newsPipeline,
			this.firecrawlNewsHomepage,
		];
	}

	public async start(): Promise<void> {
		// Register tools with the server
		this.server.registerTools(this.tools);

		// Log startup information
		console.log('🚀 Express MCP Server with integrated tools started!');
		console.log(`📦 Loaded ${this.tools.length} tools`);
		console.log(
			`📡 JSON-RPC endpoint: POST http://${this.config.host}:${this.config.port}/mcp`
		);
		console.log(
			`📖 Documentation: http://${this.config.host}:${this.config.port}/`
		);
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
