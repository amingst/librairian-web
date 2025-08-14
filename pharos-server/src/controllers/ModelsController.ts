import { Request, Response } from 'express';
import { controller, get } from '@shared/backend';
import { ModelService } from '../services/ModelService.js';
import OpenAI from 'openai';
import config from '../config.js';

@controller('/models')
export class ModelsController {
	private modelService: ModelService;

	constructor() {
		this.modelService = ModelService.getInstance();
	}

	@get('/')
	async getModels(req: Request, res: Response) {
		try {
			const { provider, costTier, forceRefresh } = req.query;

			console.log('🔍 Fetching models with filters:', {
				provider,
				costTier,
				forceRefresh,
			});

			let models = await this.modelService.fetchAvailableModels(
				forceRefresh === 'true'
			);

			// Apply filters
			if (provider) {
				models = models.filter(
					(model) =>
						model.provider.toLowerCase() ===
						(provider as string).toLowerCase()
				);
			}

			if (costTier) {
				models = models.filter((model) => model.costTier === costTier);
			}

			res.json({
				models: models,
				total: models.length,
				timestamp: new Date().toISOString(),
				cached: forceRefresh !== 'true',
			});
		} catch (error) {
			console.error('Error fetching models:', error);
			res.status(500).json({
				error: 'Failed to fetch models',
				message: error instanceof Error ? error.message : String(error),
			});
		}
	}

	@get('/openai')
	async getOpenAIModels(req: Request, res: Response) {
		try {
			console.log('🔍 Fetching OpenAI models list...');

			const openai = new OpenAI({ apiKey: config.openaiKey });
			const modelsList = await openai.models.list();

			console.log('📋 OpenAI Models Available:');
			console.log('Total models:', modelsList.data.length);

			// Log each model with details
			modelsList.data.forEach((model) => {
				console.log(
					`  - ${model.id} (${model.object}, created: ${new Date(
						model.created * 1000
					).toISOString()})`
				);
			});

			// Filter for GPT models specifically
			const gptModels = modelsList.data.filter(
				(model) =>
					model.id.includes('gpt') ||
					model.id.includes('text-davinci') ||
					model.id.includes('text-curie')
			);

			console.log('🤖 GPT-specific models:', gptModels.length);
			gptModels.forEach((model) => {
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
	}

	@get('/xai')
	async getXAIModels(req: Request, res: Response) {
		try {
			console.log('🔍 Fetching xAI models list...');

			const xai = new OpenAI({
				apiKey: config.xaiKey,
				baseURL: 'https://api.x.ai/v1',
			});
			const modelsList = await xai.models.list();

			console.log('📋 xAI Models Available:');
			console.log('Total models:', modelsList.data.length);

			// Log each model with details
			modelsList.data.forEach((model) => {
				console.log(
					`  - ${model.id} (${model.object}, created: ${new Date(
						model.created * 1000
					).toISOString()})`
				);
			});

			// Filter for Grok models specifically
			const grokModels = modelsList.data.filter((model) =>
				model.id.includes('grok')
			);

			console.log('🤖 Grok-specific models:', grokModels.length);
			grokModels.forEach((model) => {
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
	}

	@get('/anthropic')
	async getAnthropicModels(req: Request, res: Response) {
		try {
			console.log('🔍 Fetching Anthropic models list...');

			// Anthropic doesn't have a models.list() endpoint, so we return known models
			const knownAnthropicModels = [
				{
					id: 'claude-3-5-sonnet-20241022',
					name: 'Claude 3.5 Sonnet',
					description: 'Latest Claude 3.5 Sonnet model',
				},
				{
					id: 'claude-3-5-haiku-20241022',
					name: 'Claude 3.5 Haiku',
					description: 'Latest Claude 3.5 Haiku model',
				},
				{
					id: 'claude-3-opus-20240229',
					name: 'Claude 3 Opus',
					description: 'Most capable Claude 3 model',
				},
				{
					id: 'claude-3-sonnet-20240229',
					name: 'Claude 3 Sonnet',
					description: 'Balanced Claude 3 model',
				},
				{
					id: 'claude-3-haiku-20240307',
					name: 'Claude 3 Haiku',
					description: 'Fastest Claude 3 model',
				},
			];

			console.log('📋 Anthropic Models Available:');
			console.log('Total models:', knownAnthropicModels.length);

			knownAnthropicModels.forEach((model) => {
				console.log(`  - ${model.id} (${model.name})`);
			});

			res.json({
				total: knownAnthropicModels.length,
				models: knownAnthropicModels,
				timestamp: new Date().toISOString(),
				note: 'Anthropic API does not provide a models.list() endpoint, these are known available models',
			});
		} catch (error) {
			console.error('❌ Error fetching Anthropic models:', error);
			res.status(500).json({
				error: 'Failed to fetch Anthropic models',
				message: error instanceof Error ? error.message : String(error),
			});
		}
	}
}
