'use client';

import React, {
	createContext,
	useContext,
	useState,
	useCallback,
	useEffect,
} from 'react';
import { mcpClient, type NewsSource } from '../mcp-client';

interface SourceSettings {
	enabled: boolean;
	priority: number; // For ordering sources
}

interface NewsSourcesContextType {
	// Sources data
	sources: NewsSource[];
	sourceSettings: Record<string, SourceSettings>;

	// Loading states
	isLoading: boolean;
	error: string | null;

	// Actions
	refreshSources: () => Promise<void>;
	toggleSource: (sourceId: string) => void;
	enableSource: (sourceId: string) => void;
	disableSource: (sourceId: string) => void;
	enableAllSources: () => void;
	disableAllSources: () => void;

	// Category actions
	enableCategory: (category: string) => void;
	disableCategory: (category: string) => void;

	// Getters
	getEnabledSources: () => NewsSource[];
	getEnabledSourceIds: () => string[];
	getSourcesByCategory: (category: string) => NewsSource[];
	isSourceEnabled: (sourceId: string) => boolean;
	getEnabledCount: () => number;
	getTotalCount: () => number;

	// Settings persistence
	saveSourcesToStorage: () => void;
	loadSourcesFromStorage: () => void;
	resetToDefaults: () => void;
}

const NewsSourcesContext = createContext<NewsSourcesContextType | undefined>(
	undefined
);

const STORAGE_KEY = 'news-scraper-source-settings';
const DEFAULT_ENABLED_CATEGORIES = ['conservative', 'centrist', 'liberal']; // Default categories to enable

interface NewsSourcesProviderProps {
	children: React.ReactNode;
	autoLoad?: boolean; // Whether to automatically load sources on mount
}

export function NewsSourcesProvider({
	children,
	autoLoad = true,
}: NewsSourcesProviderProps) {
	const [sources, setSources] = useState<NewsSource[]>([]);
	const [sourceSettings, setSourceSettings] = useState<
		Record<string, SourceSettings>
	>({});
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Initialize default settings for a source
	const createDefaultSettings = useCallback(
		(source: NewsSource): SourceSettings => {
			return {
				enabled: DEFAULT_ENABLED_CATEGORIES.includes(source.category),
				priority: 1,
			};
		},
		[]
	);

	// Load sources from the MCP server
	const refreshSources = useCallback(async () => {
		setIsLoading(true);
		setError(null);

		try {
			const fetchedSources = await mcpClient.getNewsSources();
			setSources(fetchedSources);

			// Initialize settings for new sources
			setSourceSettings((current) => {
				const updated = { ...current };

				fetchedSources.forEach((source) => {
					if (!updated[source.id]) {
						updated[source.id] = createDefaultSettings(source);
					}
				});

				return updated;
			});
		} catch (err) {
			const errorMessage =
				err instanceof Error
					? err.message
					: 'Failed to load news sources';
			setError(errorMessage);
			console.error('Failed to refresh sources:', err);
		} finally {
			setIsLoading(false);
		}
	}, [createDefaultSettings]);

	// Toggle a single source
	const toggleSource = useCallback((sourceId: string) => {
		setSourceSettings((current) => ({
			...current,
			[sourceId]: {
				...current[sourceId],
				enabled: !current[sourceId]?.enabled,
			},
		}));
	}, []);

	// Enable a single source
	const enableSource = useCallback((sourceId: string) => {
		setSourceSettings((current) => ({
			...current,
			[sourceId]: {
				...current[sourceId],
				enabled: true,
			},
		}));
	}, []);

	// Disable a single source
	const disableSource = useCallback((sourceId: string) => {
		setSourceSettings((current) => ({
			...current,
			[sourceId]: {
				...current[sourceId],
				enabled: false,
			},
		}));
	}, []);

	// Enable all sources
	const enableAllSources = useCallback(() => {
		setSourceSettings((current) => {
			const updated = { ...current };
			sources.forEach((source) => {
				updated[source.id] = {
					...updated[source.id],
					enabled: true,
				};
			});
			return updated;
		});
	}, [sources]);

	// Disable all sources
	const disableAllSources = useCallback(() => {
		setSourceSettings((current) => {
			const updated = { ...current };
			sources.forEach((source) => {
				updated[source.id] = {
					...updated[source.id],
					enabled: false,
				};
			});
			return updated;
		});
	}, [sources]);

	// Enable all sources in a category
	const enableCategory = useCallback(
		(category: string) => {
			setSourceSettings((current) => {
				const updated = { ...current };
				sources
					.filter((source) => source.category === category)
					.forEach((source) => {
						updated[source.id] = {
							...updated[source.id],
							enabled: true,
						};
					});
				return updated;
			});
		},
		[sources]
	);

	// Disable all sources in a category
	const disableCategory = useCallback(
		(category: string) => {
			setSourceSettings((current) => {
				const updated = { ...current };
				sources
					.filter((source) => source.category === category)
					.forEach((source) => {
						updated[source.id] = {
							...updated[source.id],
							enabled: false,
						};
					});
				return updated;
			});
		},
		[sources]
	);

	// Get enabled sources
	const getEnabledSources = useCallback(() => {
		return sources.filter((source) => sourceSettings[source.id]?.enabled);
	}, [sources, sourceSettings]);

	// Get enabled source IDs
	const getEnabledSourceIds = useCallback(() => {
		return getEnabledSources().map((source) => source.id);
	}, [getEnabledSources]);

	// Get sources by category
	const getSourcesByCategory = useCallback(
		(category: string) => {
			return sources.filter((source) => source.category === category);
		},
		[sources]
	);

	// Check if source is enabled
	const isSourceEnabled = useCallback(
		(sourceId: string) => {
			return sourceSettings[sourceId]?.enabled ?? false;
		},
		[sourceSettings]
	);

	// Get count of enabled sources
	const getEnabledCount = useCallback(() => {
		return getEnabledSources().length;
	}, [getEnabledSources]);

	// Get total count of sources
	const getTotalCount = useCallback(() => {
		return sources.length;
	}, [sources]);

	// Save settings to localStorage
	const saveSourcesToStorage = useCallback(() => {
		try {
			const dataToSave = {
				sourceSettings,
				lastUpdated: new Date().toISOString(),
			};
			localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
		} catch (err) {
			console.warn(
				'Failed to save source settings to localStorage:',
				err
			);
		}
	}, [sourceSettings]);

	// Load settings from localStorage
	const loadSourcesFromStorage = useCallback(() => {
		try {
			const saved = localStorage.getItem(STORAGE_KEY);
			if (saved) {
				const data = JSON.parse(saved);
				if (data.sourceSettings) {
					setSourceSettings(data.sourceSettings);
				}
			}
		} catch (err) {
			console.warn(
				'Failed to load source settings from localStorage:',
				err
			);
		}
	}, []);

	// Reset to default settings
	const resetToDefaults = useCallback(() => {
		const defaultSettings: Record<string, SourceSettings> = {};
		sources.forEach((source) => {
			defaultSettings[source.id] = createDefaultSettings(source);
		});
		setSourceSettings(defaultSettings);
	}, [sources, createDefaultSettings]);

	// Auto-save settings when they change
	useEffect(() => {
		if (Object.keys(sourceSettings).length > 0) {
			saveSourcesToStorage();
		}
	}, [sourceSettings, saveSourcesToStorage]);

	// Load from storage and fetch sources on mount
	useEffect(() => {
		loadSourcesFromStorage();

		if (autoLoad) {
			refreshSources();
		}
	}, [autoLoad, refreshSources, loadSourcesFromStorage]);

	const contextValue: NewsSourcesContextType = {
		// Data
		sources,
		sourceSettings,
		isLoading,
		error,

		// Actions
		refreshSources,
		toggleSource,
		enableSource,
		disableSource,
		enableAllSources,
		disableAllSources,
		enableCategory,
		disableCategory,

		// Getters
		getEnabledSources,
		getEnabledSourceIds,
		getSourcesByCategory,
		isSourceEnabled,
		getEnabledCount,
		getTotalCount,

		// Storage
		saveSourcesToStorage,
		loadSourcesFromStorage,
		resetToDefaults,
	};

	return (
		<NewsSourcesContext.Provider value={contextValue}>
			{children}
		</NewsSourcesContext.Provider>
	);
}

// Hook to use the context
export function useNewsSources() {
	const context = useContext(NewsSourcesContext);
	if (context === undefined) {
		throw new Error(
			'useNewsSources must be used within a NewsSourcesProvider'
		);
	}
	return context;
}

// Hook for category management
export function useSourceCategories() {
	const context = useNewsSources();

	// Get unique categories
	const categories = React.useMemo(() => {
		const cats = [
			...new Set(context.sources.map((source) => source.category)),
		];
		return cats.sort();
	}, [context.sources]);

	// Get category stats
	const getCategoryStats = useCallback(
		(category: string) => {
			const categorySourcesAll = context.getSourcesByCategory(category);
			const categorySourcesEnabled = categorySourcesAll.filter((source) =>
				context.isSourceEnabled(source.id)
			);

			return {
				total: categorySourcesAll.length,
				enabled: categorySourcesEnabled.length,
				allEnabled:
					categorySourcesEnabled.length === categorySourcesAll.length,
				noneEnabled: categorySourcesEnabled.length === 0,
			};
		},
		[context]
	);

	return {
		categories,
		getCategoryStats,
		enableCategory: context.enableCategory,
		disableCategory: context.disableCategory,
	};
}

// Export types for use in other components
export type { NewsSourcesContextType, SourceSettings };
