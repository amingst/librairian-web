import { useState, useEffect, useCallback } from 'react';
import {
	mcpClient,
	type NewsSource,
	type NewsSourceDetails,
} from '../../lib/mcp-client';
import type { NewsArticlePreview } from '@shared/types';

interface UseMCPClientState {
	isConnected: boolean;
	isLoading: boolean;
	error: string | null;
	sources: NewsSource[];
}

interface UseMCPClientActions {
	connect: () => Promise<void>;
	disconnect: () => Promise<void>;
	refreshSources: () => Promise<void>;
	scrapeSelectedSources: (
		sourceIds: string[],
		options?: {
			limit?: number;
			includeMedia?: boolean;
			includeSections?: boolean;
		}
	) => Promise<Record<string, NewsArticlePreview[]>>;
	scrapeWebpage: (
		url: string,
		options?: {
			selector?: string;
			extractText?: boolean;
			extractLinks?: boolean;
			extractImages?: boolean;
		}
	) => Promise<any>;
	extractArticle: (url: string) => Promise<any>;
	searchContent: (
		url: string,
		query: string,
		options?: {
			caseSensitive?: boolean;
			contextChars?: number;
			maxResults?: number;
		}
	) => Promise<any>;
}

export function useMCPClient(): UseMCPClientState & UseMCPClientActions {
	const [state, setState] = useState<UseMCPClientState>({
		isConnected: false,
		isLoading: false,
		error: null,
		sources: [],
	});

	const setLoading = (isLoading: boolean) => {
		setState((prev) => ({ ...prev, isLoading }));
	};

	const setError = (error: string | null) => {
		setState((prev) => ({ ...prev, error }));
	};

	const setConnected = (isConnected: boolean) => {
		setState((prev) => ({ ...prev, isConnected }));
	};

	const setSources = (sources: NewsSource[]) => {
		setState((prev) => ({ ...prev, sources }));
	};

	const connect = useCallback(async () => {
		if (state.isConnected || state.isLoading) return; // Prevent multiple attempts

		setLoading(true);
		setError(null);

		try {
			await mcpClient.connect();
			setConnected(true);
		} catch (error) {
			const errorMessage =
				error instanceof Error
					? error.message
					: 'Failed to connect to MCP server';
			setError(errorMessage);
		} finally {
			setLoading(false);
		}
	}, [state.isConnected, state.isLoading]);

	const disconnect = useCallback(async () => {
		if (!state.isConnected) return;

		try {
			await mcpClient.disconnect();
			setConnected(false);
		} catch (error) {
			const errorMessage =
				error instanceof Error
					? error.message
					: 'Failed to disconnect from MCP server';
			setError(errorMessage);
		}
	}, [state.isConnected]);

	const refreshSources = useCallback(async () => {
		setLoading(true);
		setError(null);

		try {
			const sources = await mcpClient.getNewsSources();
			setSources(sources);
		} catch (error) {
			const errorMessage =
				error instanceof Error
					? error.message
					: 'Failed to load news sources';
			setError(errorMessage);
		} finally {
			setLoading(false);
		}
	}, []);

	const scrapeSelectedSources = useCallback(
		async (
			sourceIds: string[],
			options?: {
				limit?: number;
				includeMedia?: boolean;
				includeSections?: boolean;
			}
		) => {
			setLoading(true);
			setError(null);

			try {
				const result = await mcpClient.scrapeSelectedSources(
					sourceIds,
					options
				);
				return result;
			} catch (error) {
				const errorMessage =
					error instanceof Error
						? error.message
						: 'Failed to scrape sources';
				setError(errorMessage);
				throw error;
			} finally {
				setLoading(false);
			}
		},
		[]
	);

	const scrapeWebpage = useCallback(
		async (
			url: string,
			options?: {
				selector?: string;
				extractText?: boolean;
				extractLinks?: boolean;
				extractImages?: boolean;
			}
		) => {
			setLoading(true);
			setError(null);

			try {
				const result = await mcpClient.scrapeWebpage({
					url,
					...options,
				});
				return result;
			} catch (error) {
				const errorMessage =
					error instanceof Error
						? error.message
						: 'Failed to scrape webpage';
				setError(errorMessage);
				throw error;
			} finally {
				setLoading(false);
			}
		},
		[]
	);

	const extractArticle = useCallback(async (url: string) => {
		setLoading(true);
		setError(null);

		try {
			const result = await mcpClient.extractArticle(url);
			return result;
		} catch (error) {
			const errorMessage =
				error instanceof Error
					? error.message
					: 'Failed to extract article';
			setError(errorMessage);
			throw error;
		} finally {
			setLoading(false);
		}
	}, []);

	const searchContent = useCallback(
		async (
			url: string,
			query: string,
			options?: {
				caseSensitive?: boolean;
				contextChars?: number;
				maxResults?: number;
			}
		) => {
			setLoading(true);
			setError(null);

			try {
				const result = await mcpClient.searchContent({
					url,
					query,
					...options,
				});
				return result;
			} catch (error) {
				const errorMessage =
					error instanceof Error
						? error.message
						: 'Failed to search content';
				setError(errorMessage);
				throw error;
			} finally {
				setLoading(false);
			}
		},
		[]
	);

	// Auto-load sources when connected
	useEffect(() => {
		if (state.isConnected && state.sources.length === 0) {
			refreshSources();
		}
	}, [state.isConnected, state.sources.length, refreshSources]);

	return {
		...state,
		connect,
		disconnect,
		refreshSources,
		scrapeSelectedSources,
		scrapeWebpage,
		extractArticle,
		searchContent,
	};
}

// Additional hook for managing selected sources
export function useSelectedSources() {
	const [selectedSources, setSelectedSources] = useState<string[]>([]);

	const toggleSource = useCallback((sourceId: string) => {
		setSelectedSources((prev) =>
			prev.includes(sourceId)
				? prev.filter((id) => id !== sourceId)
				: [...prev, sourceId]
		);
	}, []);

	const selectAll = useCallback((sourceIds: string[]) => {
		setSelectedSources(sourceIds);
	}, []);

	const clearSelection = useCallback(() => {
		setSelectedSources([]);
	}, []);

	const isSelected = useCallback(
		(sourceId: string) => {
			return selectedSources.includes(sourceId);
		},
		[selectedSources]
	);

	return {
		selectedSources,
		toggleSource,
		selectAll,
		clearSelection,
		isSelected,
		count: selectedSources.length,
	};
}
