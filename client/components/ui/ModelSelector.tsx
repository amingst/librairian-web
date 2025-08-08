import React, { useState } from 'react';
import { useModels } from '@/hooks/use-models';
import { AIModel, CostTier, ModelProvider } from '@shared/types';

interface ModelSelectorProps {
	selectedModel?: string;
	onModelSelect: (model: AIModel) => void;
	filterByProvider?: ModelProvider;
	filterByCostTier?: CostTier;
	className?: string;
}

export function ModelSelector({ 
	selectedModel, 
	onModelSelect, 
	filterByProvider,
	filterByCostTier,
	className = '' 
}: ModelSelectorProps) {
	const { models, loading, error } = useModels({
		provider: filterByProvider,
		costTier: filterByCostTier,
	});

	const handleModelChange = (modelId: string) => {
		const model = models.find(m => m.id === modelId);
		if (model) {
			onModelSelect(model);
		}
	};

	if (loading) {
		return (
			<div className={`animate-pulse ${className}`}>
				<div className="h-10 bg-gray-200 rounded"></div>
			</div>
		);
	}

	if (error) {
		return (
			<div className={`text-red-600 text-sm ${className}`}>
				Error loading models: {error}
			</div>
		);
	}

	const selectedModelData = models.find(m => m.id === selectedModel);

	return (
		<div className={className}>
			<label className="block text-sm font-medium mb-2">
				AI Model for Text Analysis
			</label>
			
			<select
				value={selectedModel || ''}
				onChange={(e) => handleModelChange(e.target.value)}
				className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
						   bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
						   focus:outline-none focus:ring-2 focus:ring-blue-500"
			>
				<option value="">Select a model...</option>
				{models.map((model) => (
					<option key={model.id} value={model.id}>
						{model.name} ({model.provider}) - {model.description}
					</option>
				))}
			</select>

			{selectedModelData && (
				<div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
					<div className="flex items-center gap-2">
						<span className={`px-2 py-1 rounded-full text-xs ${
							selectedModelData.costTier === 'low' 
								? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
								: selectedModelData.costTier === 'medium'
								? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
								: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
						}`}>
							{selectedModelData.costTier} cost
						</span>
						<span>Max tokens: {selectedModelData.maxTokens}</span>
						<span>Provider: {selectedModelData.provider}</span>
					</div>
					
					{selectedModelData.capabilities && (
						<div className="mt-1">
							<span className="text-xs">Capabilities: </span>
							{Object.entries(selectedModelData.capabilities)
								.filter(([_, enabled]) => enabled)
								.map(([capability, _]) => (
									<span key={capability} className="inline-block mr-1 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-1 rounded">
										{capability}
									</span>
								))
							}
						</div>
					)}
				</div>
			)}
		</div>
	);
}

// Provider filter component
export function ModelProviderFilter({ 
	selectedProvider, 
	onProviderSelect,
	className = ''
}: {
	selectedProvider?: ModelProvider;
	onProviderSelect: (provider: ModelProvider | undefined) => void;
	className?: string;
}) {
	const providers: ModelProvider[] = ['OpenAI', 'xAI', 'Anthropic', 'Google', 'Meta'];

	return (
		<div className={className}>
			<label className="block text-sm font-medium mb-2">Filter by Provider</label>
			<select
				value={selectedProvider || ''}
				onChange={(e) => onProviderSelect(e.target.value as ModelProvider || undefined)}
				className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
						   bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
			>
				<option value="">All providers</option>
				{providers.map((provider) => (
					<option key={provider} value={provider}>
						{provider}
					</option>
				))}
			</select>
		</div>
	);
}
