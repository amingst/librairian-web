export interface AIModel {
	id: string;
	name: string;
	description: string;
	provider: 'OpenAI' | 'xAI' | 'Anthropic' | 'Google' | 'Meta';
	costTier: 'low' | 'medium' | 'high';
	maxTokens: number;
	temperature: number;
	capabilities?: {
		textGeneration: boolean;
		imageAnalysis?: boolean;
		codeGeneration?: boolean;
		reasoning?: boolean;
	};
}

export interface ModelResponse {
	models: AIModel[];
	total: number;
}

export type ModelProvider = AIModel['provider'];
export type CostTier = AIModel['costTier'];
