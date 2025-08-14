import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import config from '../config.js';

export interface ModelInfo {
	id: string;
	name: string;
	description: string;
	provider: 'OpenAI' | 'xAI' | 'Anthropic';
	costTier?: 'low' | 'medium' | 'high';
	capabilities?: {
		textGeneration?: boolean;
		reasoning?: boolean;
	};
	// API response fields
	object: string;
	created: number;
	owned_by: string;
}

export class ModelService {
	private static instance: ModelService;
	private openaiClient: OpenAI;
	private xaiClient: OpenAI;
	private anthropicClient: Anthropic;
	private cachedModels: ModelInfo[] | null = null;
	private lastFetchTime: number = 0;
	private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

	constructor() {
		this.openaiClient = new OpenAI({ apiKey: config.openaiKey });
		this.xaiClient = new OpenAI({ 
			apiKey: config.xaiKey,
			baseURL: 'https://api.x.ai/v1'
		});
		this.anthropicClient = new Anthropic({ apiKey: config.anthropicKey });
	}

	static getInstance(): ModelService {
		if (!ModelService.instance) {
			ModelService.instance = new ModelService();
		}
		return ModelService.instance;
	}

	private isTextAnalysisModel(modelId: string): boolean {
		// Filter for models that are suitable for text analysis
		const textModels = [
			'gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo',
			'grok-2', 'grok-2-mini',
			'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'
		];
		
		// Check if it's in our known good list, or if it's a GPT/Grok/Claude model
		return textModels.includes(modelId) || 
			   modelId.includes('gpt-') || 
			   modelId.includes('grok') ||
			   modelId.includes('claude');
	}

	private mapOpenAIModel(model: any): ModelInfo {
		// Minimal mapping - use API data directly with basic provider info
		return {
			id: model.id,
			name: model.id, // Use the ID as the display name
			description: `OpenAI model: ${model.id}`,
			provider: 'OpenAI',
			costTier: 'medium', // Default tier since we don't have pricing info from API
			capabilities: { textGeneration: true }, // Basic capability assumption
			object: model.object,
			created: model.created,
			owned_by: model.owned_by
		};
	}

	private mapXAIModel(model: any): ModelInfo {
		// Minimal mapping - use API data directly with basic provider info
		return {
			id: model.id,
			name: model.id, // Use the ID as the display name
			description: `xAI model: ${model.id}`,
			provider: 'xAI',
			costTier: 'medium', // Default tier since we don't have pricing info from API
			capabilities: { textGeneration: true }, // Basic capability assumption
			object: model.object,
			created: model.created,
			owned_by: model.owned_by
		};
	}

	private mapAnthropicModel(model: any): ModelInfo {
		// Minimal mapping - use API data directly with basic provider info
		return {
			id: model.id,
			name: model.id, // Use the ID as the display name
			description: `Anthropic model: ${model.id}`,
			provider: 'Anthropic',
			costTier: 'medium', // Default tier since we don't have pricing info from API
			capabilities: { textGeneration: true, reasoning: true }, // Claude models are good at reasoning
			object: model.object || 'model',
			created: model.created || Date.now(),
			owned_by: model.owned_by || 'anthropic'
		};
	}

	async fetchAvailableModels(forceRefresh: boolean = false): Promise<ModelInfo[]> {
		const now = Date.now();
		
		// Return cached models if they're still fresh and not forcing refresh
		if (!forceRefresh && this.cachedModels && (now - this.lastFetchTime) < this.CACHE_DURATION) {
			console.log('📋 Returning cached models');
			return this.cachedModels;
		}

		console.log('🔍 Fetching fresh models from APIs...');
		const models: ModelInfo[] = [];

		try {
			// Fetch OpenAI models
			if (config.openaiKey) {
				try {
					console.log('📡 Fetching OpenAI models...');
					const openaiModels = await this.openaiClient.models.list();
					const filteredOpenAI = openaiModels.data
						.filter(model => this.isTextAnalysisModel(model.id))
						.map(model => this.mapOpenAIModel(model));
					
					models.push(...filteredOpenAI);
					console.log(`✅ Added ${filteredOpenAI.length} OpenAI models`);
				} catch (error) {
					console.error('❌ Failed to fetch OpenAI models:', error);
				}
			}

			// Fetch xAI models
			if (config.xaiKey) {
				try {
					console.log('📡 Fetching xAI models...');
					const xaiModels = await this.xaiClient.models.list();
					const filteredXAI = xaiModels.data
						.filter(model => this.isTextAnalysisModel(model.id))
						.map(model => this.mapXAIModel(model));
					
					models.push(...filteredXAI);
					console.log(`✅ Added ${filteredXAI.length} xAI models`);
				} catch (error) {
					console.error('❌ Failed to fetch xAI models:', error);
				}
			}

			// Fetch Anthropic models
			if (config.anthropicKey) {
				try {
					console.log('📡 Fetching Anthropic models...');
					// Anthropic doesn't have a models.list() endpoint, so we'll use known models
					// Updated to use only currently available models (removed deprecated ones)
					const knownAnthropicModels = [
						{ id: 'claude-3-5-sonnet-20241022', object: 'model', created: Date.now(), owned_by: 'anthropic' },
						{ id: 'claude-3-5-haiku-20241022', object: 'model', created: Date.now(), owned_by: 'anthropic' }
					];
					const filteredAnthropic = knownAnthropicModels
						.filter(model => this.isTextAnalysisModel(model.id))
						.map(model => this.mapAnthropicModel(model));
					
					models.push(...filteredAnthropic);
					console.log(`✅ Added ${filteredAnthropic.length} Anthropic models`);
				} catch (error) {
					console.error('❌ Failed to fetch Anthropic models:', error);
				}
			}

			// Cache the results
			this.cachedModels = models;
			this.lastFetchTime = now;

			console.log(`🎯 Total models available: ${models.length}`);
			return models;

		} catch (error) {
			console.error('❌ Error fetching models:', error);
			
			// Return cached models if available, even if expired
			if (this.cachedModels) {
				console.log('📋 Returning expired cached models due to fetch error');
				return this.cachedModels;
			}
			
			// Fallback to empty array
			return [];
		}
	}

	async getModelById(modelId: string): Promise<ModelInfo | null> {
		const models = await this.fetchAvailableModels();
		return models.find(model => model.id === modelId) || null;
	}

	// Synchronous method to get cached model info (returns null if not cached)
	getCachedModelById(modelId: string): ModelInfo | null {
		if (!this.cachedModels) return null;
		return this.cachedModels.find(model => model.id === modelId) || null;
	}

	async getModelsByProvider(provider: 'OpenAI' | 'xAI'): Promise<ModelInfo[]> {
		const models = await this.fetchAvailableModels();
		return models.filter(model => model.provider === provider);
	}

	async getModelsByCostTier(costTier: 'low' | 'medium' | 'high'): Promise<ModelInfo[]> {
		const models = await this.fetchAvailableModels();
		return models.filter(model => model.costTier === costTier);
	}

	// Get model IDs as string array for Zod enum validation
	async getModelIds(): Promise<string[]> {
		const models = await this.fetchAvailableModels();
		return models.map(model => model.id);
	}
}
