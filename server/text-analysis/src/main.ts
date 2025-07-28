#!/usr/bin/env node
import 'reflect-metadata';
import { MCPHttpServer, IMCPTool } from '@shared/backend';
import { ArticleGrouperTool } from './tools/ArticleGrouper.js';
import { TextAnalysisTool } from './tools/TextAnalysis.js';
import { CurrentEventsDetectorTool } from './tools/CurrentEventsDetector.js';
import { BatchArticleExtractorTool } from './tools/BatchArticleExtractor.js';
import { createContainer } from './container.js';
import { injectable, inject } from 'inversify';
import { TYPES } from './types/di.types.js';
import config from './config.js';

type Config = typeof config;

@injectable()
class TextAnalysis {
	constructor(
		@inject(TYPES.ArticleGrouper) private readonly articleGrouper: IMCPTool,
		@inject(TYPES.TextAnalysis) private readonly textAnalysis: IMCPTool,
		@inject(TYPES.CurrentEventsDetector)
		private readonly currentEventsDetector: IMCPTool,
		@inject(TYPES.BatchArticleExtractor)
		private readonly batchArticleExtractor: IMCPTool,
		@inject(MCPHttpServer) private readonly server: MCPHttpServer,
		@inject(TYPES.Config) private readonly config: Config
	) {
		this.setupShutdownHandlers();
	}

	private get tools(): IMCPTool[] {
		return [
			this.articleGrouper,
			this.textAnalysis,
			this.currentEventsDetector,
			this.batchArticleExtractor,
		];
	}

	public async start(): Promise<void> {
		// Register tools with the server
		this.server.registerTools(this.tools);

		// Log startup information
		console.log(
			'🔍 Text Analysis MCP Server with integrated tools started!'
		);
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
			console.log('\n🛑 Shutting down Text Analysis MCP HTTP server...');
			await this.server.stop();
			process.exit(0);
		});

		process.on('SIGTERM', async () => {
			console.log(
				'\n🛑 Received SIGTERM, shutting down Text Analysis MCP HTTP server...'
			);
			await this.server.stop();
			process.exit(0);
		});
	}
}

// Bootstrap the application
async function bootstrap() {
	const container = createContainer();
	container.bind(TextAnalysis).toSelf().inSingletonScope();

	const program = container.get(TextAnalysis);
	await program.start();
}

bootstrap().catch(console.error);
