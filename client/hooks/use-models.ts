import { useState, useEffect } from 'react';
import { AIModel, ModelResponse, ModelProvider, CostTier } from '@shared/types';

interface UseModelsOptions {
	provider?: ModelProvider;
	costTier?: CostTier;
	autoFetch?: boolean;
}

interface UseModelsResult {
	models: AIModel[];
	loading: boolean;
	error: string | null;
	refetch: () => Promise<void>;
}

export function useModels(options: UseModelsOptions = {}): UseModelsResult {
	const { provider, costTier, autoFetch = true } = options;
	const [models, setModels] = useState<AIModel[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const fetchModels = async () => {
		setLoading(true);
		setError(null);

		try {
			const params = new URLSearchParams();
			if (provider) params.append('provider', provider);
			if (costTier) params.append('costTier', costTier);

			const response = await fetch(`/api/text-analysis/models?${params}`);
			
			if (!response.ok) {
				throw new Error(`Failed to fetch models: ${response.statusText}`);
			}

			const data: ModelResponse = await response.json();
			setModels(data.models);
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'Unknown error';
			setError(errorMessage);
			console.error('Error fetching models:', err);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		if (autoFetch) {
			fetchModels();
		}
	}, [provider, costTier, autoFetch]);

	return {
		models,
		loading,
		error,
		refetch: fetchModels,
	};
}

// Helper hook for getting models grouped by provider
export function useModelsByProvider(options: Omit<UseModelsOptions, 'provider'> = {}) {
	const { models, loading, error, refetch } = useModels(options);

	const modelsByProvider = models.reduce((acc, model) => {
		if (!acc[model.provider]) {
			acc[model.provider] = [];
		}
		acc[model.provider].push(model);
		return acc;
	}, {} as Record<ModelProvider, AIModel[]>);

	return {
		modelsByProvider,
		allModels: models,
		loading,
		error,
		refetch,
	};
}
