import z from 'zod';
import { MCPTool } from '@shared/backend';
import { NewsArticlePreview } from '@shared/types';
import { injectable, inject } from 'inversify';
import { TYPES } from '../types/symbols.js';
import { ArticleGrouperTool } from './ArticleGrouper.js';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import config from '../config.js';
import { promptLoader } from '../utils/PromptLoader.js';
import { PrismaClient } from '@prisma/client';
import { PrismaClientFactory } from '@shared/backend';
import { ModelService } from '../services/ModelService.js';

// Create dynamic schema function that validates against available models
const createArticleSummarizerSchema = async () => {
	const modelService = ModelService.getInstance();
	const availableModelIds = await modelService.getModelIds();

	// If no models are available, fall back to a basic string validation
	const modelSchema =
		availableModelIds.length > 0
			? z.enum(availableModelIds as [string, ...string[]])
			: z.string();

	return z.object({
		articles: z
			.array(
				z.object({
					title: z.string().min(1, 'Title is required'),
					content: z.string().min(1, 'Content is required'),
					source: z.string().optional(),
					date: z.string().optional(),
				})
			)
			.min(1, 'At least one article is required'),

		audience: z.enum([
			'general',
			'investor',
			'academic',
			'technical',
			'executive',
		]),

		detail: z.enum(['brief', 'standard', 'comprehensive']),

		model: modelSchema.optional().default('gpt-4o-mini'),
	});
};

// Export the schema creation function for use elsewhere
export { createArticleSummarizerSchema };

@injectable()
export class ArticleSummarizerTool extends MCPTool {
	private openai: OpenAI;
	private xai: OpenAI; // xAI uses OpenAI-compatible API
	private anthropic: Anthropic;
	private modelService: ModelService;
	private schemaCache: Record<string, any> | null = null;

	// Add model configuration with provider info
	private getModelProvider(model: string): 'openai' | 'xai' | 'anthropic' {
		// Check if model starts with 'grok' for xAI models or 'claude' for Anthropic
		return model.startsWith('grok') 
			? 'xai' 
			: model.startsWith('claude') 
				? 'anthropic' 
				: 'openai';
	}

	private getClientForModel(model: string): OpenAI {
		const provider = this.getModelProvider(model);
		if (provider === 'anthropic') {
			throw new Error('Use getAnthropicClient() for Anthropic models');
		}
		return provider === 'xai' ? this.xai : this.openai;
	}

	private getAnthropicClient(): Anthropic {
		return this.anthropic;
	}

	// Create the API request parameters with minimal configuration to avoid compatibility issues
	private createChatCompletionParams(model: string, systemPrompt: string, combinedArticles: string) {
		return {
			model: model,
			messages: [
				{ role: 'system' as const, content: systemPrompt },
				{
					role: 'user' as const,
					content: `Here is the batch of articles to summarize:\n\n${combinedArticles}`,
				},
			],
			// Let the model use its default values for temperature, max_tokens, etc.
		};
	}

	private prisma: PrismaClient;
	private audienceContexts: Record<string, string> = {};
	private detailLevels: Record<string, string> = {};
	private audienceTitles: Record<string, string> = {};

	constructor(@inject(TYPES.PrismaClient) prisma: PrismaClient) {
		super();
		this.openai = new OpenAI({ apiKey: config.openaiKey });

		// Initialize xAI client (uses OpenAI-compatible API)
		this.xai = new OpenAI({
			apiKey: config.xaiKey,
			baseURL: 'https://api.x.ai/v1', // xAI API endpoint
		});

		// Initialize Anthropic client
		this.anthropic = new Anthropic({ apiKey: config.anthropicKey });

		this.prisma = PrismaClientFactory.getInstance('news-sources');
		this.modelService = ModelService.getInstance();

		this.loadConfigData().catch((err) => {
			console.error('❌ Failed to load prompt configs:', err);
		});

		this.initializeSchema().catch((err) => {
			console.error('❌ Failed to initialize dynamic schema:', err);
		});
	}

	private async initializeSchema(): Promise<void> {
		try {
			this.schemaCache = await createArticleSummarizerSchema();
		} catch (error) {
			console.error(
				'❌ Failed to initialize dynamic schema, using fallback:',
				error
			);
			// Fallback to basic schema if model fetching fails
			this.schemaCache = z.object({
				articles: z
					.array(
						z.object({
							title: z.string().min(1, 'Title is required'),
							content: z.string().min(1, 'Content is required'),
							source: z.string().optional(),
							date: z.string().optional(),
						})
					)
					.min(1, 'At least one article is required'),
				audience: z.enum([
					'general',
					'investor',
					'academic',
					'technical',
					'executive',
				]),
				detail: z.enum(['brief', 'standard', 'comprehensive']),
				model: z.string().optional().default('gpt-4o-mini'),
			});
		}
	}

	get name(): string {
		return 'summarize_articles_batch';
	}

	get schema(): Record<string, any> {
		// Return dynamically generated schema if available
		const dynamicSchema = this.schemaCache;
		if (dynamicSchema && typeof dynamicSchema === 'object' && 'properties' in dynamicSchema) {
			return dynamicSchema as Record<string, any>;
		}
		
		// Convert Zod schema to JSON schema format or return fallback
		return this.convertZodToJsonSchema();
	}

	private convertZodToJsonSchema(): Record<string, any> {
		return {
			type: 'object',
			properties: {
				articles: {
					type: 'array',
					description: 'Array of articles to summarize',
					items: {
						type: 'object',
						properties: {
							title: { type: 'string' },
							content: { type: 'string' },
							source: { type: 'string' },
							date: { type: 'string' }
						},
						required: ['title', 'content']
					}
				},
				audience: {
					type: 'string',
					enum: ['general', 'investor', 'academic', 'technical', 'executive'],
					description: 'Target audience for the summary'
				},
				detail: {
					type: 'string',
					enum: ['brief', 'standard', 'comprehensive'],
					description: 'Level of detail for the summary'
				},
				model: {
					type: 'string',
					description: 'Model ID for text generation'
				}
			},
			required: ['articles', 'audience', 'detail']
		};
	}

	private async loadConfigData(): Promise<void> {
		const basePath = 'summary'; // all configs now live under prompts/summary

		// Defaults
		this.audienceContexts = {
			policymaker:
				'Focus on regulatory implications, policy precedents, and legislative considerations. Emphasize governance and public policy impacts.',
			business:
				'Highlight market impacts, competitive dynamics, and strategic implications for industry sectors.',
			academic:
				'Provide analytical depth, historical context, and research implications.',
			general:
				'Present information in accessible terms with broad context.',
		};

		this.detailLevels = {
			brief: 'concise',
			standard: 'balanced',
			detailed: 'comprehensive',
		};

		this.audienceTitles = {
			policymaker: 'Policy Briefing',
			business: 'Business Intelligence Report',
			academic: 'Research Brief',
			general: 'News Summary',
		};

		// try {
		// 	this.audienceContexts = await promptLoader.loadConfig(
		// 		`${basePath}/audience-contexts.json`
		// 	);
		// 	this.detailLevels = await promptLoader.loadConfig(
		// 		`${basePath}/detail-levels.json`
		// 	);
		// 	this.audienceTitles = await promptLoader.loadConfig(
		// 		`${basePath}/audience-titles.json`
		// 	);
		// } catch (error) {
		// 	console.warn(
		// 		'⚠️ Using default prompt configs due to load error:',
		// 		error
		// 	);
		// }
	}

	get description(): string {
		return 'Summarizes batches of news articles into structured audience-targeted reports.';
	}

	async execute(params: any): Promise<any> {
		// Use the Zod schema for validation
		const zodSchema = this.schemaCache || (await createArticleSummarizerSchema());
		const validatedParams = zodSchema.parse(params);
		const { articles, audience, detail, model } = validatedParams;

		try {
			// Validate model is available
			const modelInfo = await this.modelService.getModelById(model);
			if (!modelInfo) {
				console.warn(
					`⚠️ Model '${model}' not found in available models, proceeding anyway`
				);
			}

			console.log(
				`[ArticleSummarizer] Start summarize_articles_batch: count=${articles.length}, audience=${audience}, detail=${detail}, model=${model}`
			);
			console.log(
				'[ArticleSummarizer] Sample titles:',
				articles.slice(0, 3).map((a: any) => a.title)
			);
			const t0 = Date.now();

			const audienceContext = this.audienceContexts[audience];
			const detailDescriptor = this.detailLevels[detail];
			const reportTitle = this.audienceTitles[audience];

			// Load system prompt from summary subfolder
			const systemPrompt = await promptLoader.getInterpolatedPrompt(
				'summary/article-summarizer.txt',
				{
					audienceName: audience.toUpperCase(),
					audienceContext,
					detailDescriptor,
					reportTitle,
				}
			);

			const combinedArticles = articles
				.map(
					(a: any, i: number) =>
						`[${i + 1}] ${a.title}\n${a.content}\nSource: ${
							a.source ?? 'N/A'
						}\nDate: ${a.date ?? 'Unknown'}`
				)
				.join('\n\n---\n\n');

			console.log(
				`[ArticleSummarizer] Prepared prompt with ${
					combinedArticles.length
				} chars (avg/article ~${Math.round(
					combinedArticles.length / Math.max(1, articles.length)
				)}).`
			);

			const provider = this.getModelProvider(model);
			console.log(
				`[ArticleSummarizer] Calling ${provider.toUpperCase()} ${model}...`
			);

			let response: any;
			
			if (provider === 'anthropic') {
				// Use Anthropic API
				const anthropicClient = this.getAnthropicClient();
				response = await anthropicClient.messages.create({
					model: model,
					max_tokens: 4000,
					messages: [
						{
							role: 'user',
							content: `${systemPrompt}\n\n${combinedArticles}`
						}
					]
				});
			} else {
				// Use OpenAI-compatible API (OpenAI and xAI)
				const client = this.getClientForModel(model);
				const chatParams = this.createChatCompletionParams(model, systemPrompt, combinedArticles);
				response = await client.chat.completions.create(chatParams);
			}

			const elapsedMs = Date.now() - t0;
			
			// Handle usage logging for different providers
			if (provider === 'anthropic') {
				const usage = (response as any)?.usage;
				if (usage) {
					console.log(
						`[ArticleSummarizer] ${provider.toUpperCase()} usage -> input_tokens=${
							usage.input_tokens
						}, output_tokens=${
							usage.output_tokens
						}, time=${elapsedMs}ms`
					);
				} else {
					console.log(
						`[ArticleSummarizer] ${provider.toUpperCase()} call completed in ${elapsedMs}ms`
					);
				}
			} else {
				const usage = (response as any)?.usage;
				if (usage) {
					console.log(
						`[ArticleSummarizer] ${provider.toUpperCase()} usage -> prompt_tokens=${
							usage.prompt_tokens
						}, completion_tokens=${
							usage.completion_tokens
						}, total_tokens=${usage.total_tokens}, time=${elapsedMs}ms`
					);
				} else {
					console.log(
						`[ArticleSummarizer] ${provider.toUpperCase()} call completed in ${elapsedMs}ms`
					);
				}
			}

			// Extract content based on provider
			const content = provider === 'anthropic' 
				? response.content?.[0]?.text || ''
				: response.choices?.[0]?.message?.content || '';
				
			console.log(
				`[ArticleSummarizer] Summary generated: ${content.length} chars`
			);

			return {
				title: reportTitle,
				summary: content,
			};
		} catch (error) {
			console.error(
				'[ArticleSummarizer] Error during summarization:',
				error
			);
			throw error;
		}
	}
}
