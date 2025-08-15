import 'reflect-metadata';
import { MCPHttpServer, IMCPTool } from '@shared/backend';
import { ModelsController } from './controllers/ModelsController.js';
import { createContainer } from './container.js';
import { injectable, inject } from 'inversify';
import { TYPES } from './types/di.types.js';
import config from './config.js';
import { ArticleController } from './controllers/ArticleController.js';
type Config = typeof config;
@injectable()
class PharosServer {
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
		private readonly startArticleHtmlScraperJob: IMCPTool,
		@inject(TYPES.ArticleGrouper) private readonly articleGrouper: IMCPTool,
		@inject(TYPES.TextAnalysis) private readonly textAnalysis: IMCPTool,
		@inject(TYPES.CurrentEventsDetector)
		private readonly currentEventsDetector: IMCPTool,
		@inject(TYPES.BatchArticleExtractor)
		private readonly batchArticleExtractor: IMCPTool,
		@inject(TYPES.NewsBriefing) private readonly newsBriefing: IMCPTool,
		@inject(TYPES.ArticleSummarizer)
		private readonly articleSummarizer: IMCPTool,
		@inject(TYPES.NewsBriefingFromSummaries)
		private readonly newsBriefingFromSummaries: IMCPTool,
		@inject(TYPES.BriefingRag)
		private readonly briefingRag: IMCPTool
	) {
		this.setupShutdownHandlers();
	}

	private get tools(): IMCPTool[] {
		return [
			this.startHomepageFirecrawlJob,
			this.startFirecrawlExtractArticleJob,
			this.startHomepageHtmlScraperJob,
			this.startArticleHtmlScraperJob,
			this.articleGrouper,
			this.textAnalysis,
			this.currentEventsDetector,
			this.batchArticleExtractor,
			this.newsBriefing,
			this.articleSummarizer,
			this.newsBriefingFromSummaries,
			this.briefingRag,
		];
	}

	public async start(): Promise<void> {
		// Register tools with the server
		this.server.registerTools(this.tools);

		// Register controllers
		this.server.registerControllers([ModelsController, ArticleController]);

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
	container.bind(PharosServer).toSelf().inSingletonScope();

	const program = container.get(PharosServer);
	await program.start();
}

bootstrap().catch(console.error);
