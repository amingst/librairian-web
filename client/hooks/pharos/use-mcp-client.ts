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
	startHomepageFirecrawlJob: (params: {
		urls: string[];
		limit?: number;
	}) => Promise<{
		jobId: string;
		status: string;
		message: string;
		startTime: Date;
	}>;
	startArticleExtractFirecrawlJob: (params: {
		urls?: string[];
		limit?: number;
		webhookUrl?: string;
	}) => Promise<{
		jobId: string;
		status: string;
		message: string;
	}>;
	startHomepageHtmlScraperJob: (params: {
		urls: string[];
		limit?: number;
	}) => Promise<{
		message: string;
		totalArticlesProcessed: number;
		results: Array<{ url: string; articles: number; error?: string }>;
		completedAt: string;
	}>;
	startArticleHtmlScraperJob: (params: {
		postIds?: string[];
		limit?: number;
	}) => Promise<{
		message: string;
		totalArticlesProcessed: number;
		results: Array<{
			url: string;
			postId: string;
			success: boolean;
			error?: string;
		}>;
		completedAt: string;
	}>;
	getNewsSourceDetails: (sourceId: string) => Promise<NewsSourceDetails>;
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

	const startHomepageFirecrawlJob = useCallback(
		async (params: { urls: string[]; limit?: number }) => {
			setLoading(true);
			setError(null);

			try {
				const result = await mcpClient.startHomepageFirecrawlJob(
					params
				);
				return result;
			} catch (error) {
				const errorMessage =
					error instanceof Error
						? error.message
						: 'Failed to start homepage firecrawl job';
				setError(errorMessage);
				throw error;
			} finally {
				setLoading(false);
			}
		},
		[]
	);

	const getNewsSourceDetails = useCallback(async (sourceId: string) => {
		setLoading(true);
		setError(null);

		try {
			const result = await mcpClient.getNewsSourceDetails(sourceId);
			return result;
		} catch (error) {
			const errorMessage =
				error instanceof Error
					? error.message
					: `Failed to get details for source ${sourceId}`;
			setError(errorMessage);
			throw error;
		} finally {
			setLoading(false);
		}
	}, []);

	// Auto-load sources when connected
	useEffect(() => {
		if (state.isConnected && state.sources.length === 0) {
			refreshSources();
		}
	}, [state.isConnected, state.sources.length, refreshSources]);

	const startArticleExtractFirecrawlJob = useCallback(
		async (params: {
			urls?: string[];
			limit?: number;
			webhookUrl?: string;
		}) => {
			setLoading(true);
			setError(null);

			try {
				const result = await mcpClient.startArticleExtractFirecrawlJob(
					params
				);
				return result;
			} catch (error) {
				const errorMessage =
					error instanceof Error
						? error.message
						: 'Failed to start article extraction job';
				setError(errorMessage);
				throw error;
			} finally {
				setLoading(false);
			}
		},
		[]
	);

	const startHomepageHtmlScraperJob = useCallback(
		async (params: { urls: string[]; limit?: number }) => {
			setLoading(true);
			setError(null);

			try {
				const result = await mcpClient.startHomepageHtmlScraperJob(
					params
				);
				return result;
			} catch (error) {
				const errorMessage =
					error instanceof Error
						? error.message
						: 'Failed to start HTML scraper job';
				setError(errorMessage);
				throw error;
			} finally {
				setLoading(false);
			}
		},
		[]
	);

	const startArticleHtmlScraperJob = useCallback(
		async (params: { postIds?: string[]; limit?: number }) => {
			setLoading(true);
			setError(null);

			try {
				const result = await mcpClient.startArticleHtmlScraperJob(
					params
				);
				return result;
			} catch (error) {
				const errorMessage =
					error instanceof Error
						? error.message
						: 'Failed to start HTML article extraction job';
				setError(errorMessage);
				throw error;
			} finally {
				setLoading(false);
			}
		},
		[]
	);

	return {
		...state,
		connect,
		disconnect,
		refreshSources,
		scrapeSelectedSources,
		scrapeWebpage,
		extractArticle,
		searchContent,
		startHomepageFirecrawlJob,
		startArticleExtractFirecrawlJob,
		startHomepageHtmlScraperJob,
		startArticleHtmlScraperJob,
		getNewsSourceDetails,
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
