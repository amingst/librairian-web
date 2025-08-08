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
import { ModelService } from './services/ModelService.js';
import config from './config.js';
import OpenAI from 'openai';

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
		@inject(TYPES.NewsBriefing) private readonly newsBriefing: IMCPTool,
		@inject(TYPES.ArticleSummarizer)
		private readonly articleSummarizer: IMCPTool, // Added
		@inject(TYPES.NewsBriefingFromSummaries)
		private readonly newsBriefingFromSummaries: IMCPTool, // Added
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
			this.newsBriefing,
			this.articleSummarizer, // Added
			this.newsBriefingFromSummaries, // Added
		];
	}

	public async start(): Promise<void> {
		// Register tools with the server
		this.server.registerTools(this.tools);

		// Add custom REST endpoints
		this.setupCustomRoutes();

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

	private setupCustomRoutes(): void {
		const modelService = ModelService.getInstance();

		// Add models endpoint - now uses dynamic API fetching
		this.server.app.get('/api/models', async (req, res) => {
			try {
				const { provider, costTier, forceRefresh } = req.query;

				console.log('🔍 Fetching models with filters:', { provider, costTier, forceRefresh });
				
				let models = await modelService.fetchAvailableModels(forceRefresh === 'true');

				// Apply filters
				if (provider) {
					models = models.filter(
						(model) =>
							model.provider.toLowerCase() ===
							(provider as string).toLowerCase()
					);
				}

				if (costTier) {
					models = models.filter(
						(model) => model.costTier === costTier
					);
				}

				res.json({
					models: models,
					total: models.length,
					timestamp: new Date().toISOString(),
					cached: forceRefresh !== 'true'
				});
			} catch (error) {
				console.error('Error fetching models:', error);
				res.status(500).json({
					error: 'Failed to fetch models',
					message:
						error instanceof Error ? error.message : String(error),
				});
			}
		});

		// Add OpenAI models list endpoint for debugging
		this.server.app.get('/api/openai-models', async (req, res) => {
			try {
				console.log('🔍 Fetching OpenAI models list...');
				
				const openai = new OpenAI({ apiKey: this.config.openaiKey });
				const modelsList = await openai.models.list();
				
				console.log('📋 OpenAI Models Available:');
				console.log('Total models:', modelsList.data.length);
				
				// Log each model with details
				modelsList.data.forEach(model => {
					console.log(`  - ${model.id} (${model.object}, created: ${new Date(model.created * 1000).toISOString()})`);
				});

				// Filter for GPT models specifically
				const gptModels = modelsList.data.filter(model => 
					model.id.includes('gpt') || 
					model.id.includes('text-davinci') || 
					model.id.includes('text-curie')
				);
				
				console.log('🤖 GPT-specific models:', gptModels.length);
				gptModels.forEach(model => {
					console.log(`  - ${model.id}`);
				});

				res.json({
					total: modelsList.data.length,
					gptModels: gptModels.length,
					models: modelsList.data,
					timestamp: new Date().toISOString(),
				});
			} catch (error) {
				console.error('❌ Error fetching OpenAI models:', error);
				res.status(500).json({
					error: 'Failed to fetch OpenAI models',
					message: error instanceof Error ? error.message : String(error),
				});
			}
		});

		// Add xAI models list endpoint for debugging
		this.server.app.get('/api/xai-models', async (req, res) => {
			try {
				console.log('🔍 Fetching xAI models list...');
				
				const xai = new OpenAI({ 
					apiKey: this.config.xaiKey,
					baseURL: 'https://api.x.ai/v1'
				});
				const modelsList = await xai.models.list();
				
				console.log('📋 xAI Models Available:');
				console.log('Total models:', modelsList.data.length);
				
				// Log each model with details
				modelsList.data.forEach(model => {
					console.log(`  - ${model.id} (${model.object}, created: ${new Date(model.created * 1000).toISOString()})`);
				});

				// Filter for Grok models specifically
				const grokModels = modelsList.data.filter(model => 
					model.id.includes('grok')
				);
				
				console.log('🤖 Grok-specific models:', grokModels.length);
				grokModels.forEach(model => {
					console.log(`  - ${model.id}`);
				});

				res.json({
					total: modelsList.data.length,
					grokModels: grokModels.length,
					models: modelsList.data,
					timestamp: new Date().toISOString(),
				});
			} catch (error) {
				console.error('❌ Error fetching xAI models:', error);
				res.status(500).json({
					error: 'Failed to fetch xAI models',
					message: error instanceof Error ? error.message : String(error),
				});
			}
		});

		// Add Anthropic models list endpoint for debugging
		this.server.app.get('/api/anthropic-models', async (req, res) => {
			try {
				console.log('🔍 Fetching Anthropic models list...');
				
				// Anthropic doesn't have a models.list() endpoint, so we return known models
				const knownAnthropicModels = [
					{ id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Latest Claude 3.5 Sonnet model' },
					{ id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: 'Latest Claude 3.5 Haiku model' },
					{ id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: 'Most capable Claude 3 model' },
					{ id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet', description: 'Balanced Claude 3 model' },
					{ id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', description: 'Fastest Claude 3 model' }
				];
				
				console.log('📋 Anthropic Models Available:');
				console.log('Total models:', knownAnthropicModels.length);
				
				knownAnthropicModels.forEach(model => {
					console.log(`  - ${model.id} (${model.name})`);
				});

				res.json({
					total: knownAnthropicModels.length,
					models: knownAnthropicModels,
					timestamp: new Date().toISOString(),
					note: 'Anthropic API does not provide a models.list() endpoint, these are known available models'
				});
			} catch (error) {
				console.error('❌ Error fetching Anthropic models:', error);
				res.status(500).json({
					error: 'Failed to fetch Anthropic models',
					message: error instanceof Error ? error.message : String(error),
				});
			}
		});
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
