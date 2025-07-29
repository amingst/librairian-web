'use client';

import React, {
	createContext,
	useContext,
	useState,
	useEffect,
	ReactNode,
} from 'react';

// Define the news article item interface
export interface NewsArticleItem {
	id: string;
	title: string;
	url: string;
	type: 'article' | 'news' | 'homepage';
	source?: {
		site?: string;
		domain?: string;
		name?: string;
	};
	publishedAt?: string;
	excerpt?: string;
	summary?: string;
	media?: Array<{
		type: 'image' | 'video';
		url: string;
		title?: string;
		caption?: string;
	}>;
}

// Define the context interface
interface NewsDockContextType {
	queue: NewsArticleItem[];
	addToQueue: (item: NewsArticleItem) => void;
	addArticleToQueue: (article: any) => void;
	removeFromQueue: (id: string) => void;
	clearQueue: () => void;
	reorderQueue: (fromIndex: number, toIndex: number) => void;
	setQueue: (items: NewsArticleItem[]) => void;
}

// Create the context with default values
const NewsDockContext = createContext<NewsDockContextType>({
	queue: [],
	addToQueue: () => {},
	addArticleToQueue: () => {},
	removeFromQueue: () => {},
	clearQueue: () => {},
	reorderQueue: () => {},
	setQueue: () => {},
});

// Create a provider component
export function NewsDockProvider({ children }: { children: ReactNode }) {
	// Initialize state from localStorage if available
	const [queue, setQueue] = useState<NewsArticleItem[]>(() => {
		if (typeof window !== 'undefined') {
			const saved = localStorage.getItem('newsDockQueue');
			if (saved) {
				try {
					return JSON.parse(saved);
				} catch (e) {
					console.error(
						'Failed to parse news dock queue from localStorage',
						e
					);
				}
			}
		}
		return [];
	});

	// Save to localStorage whenever queue changes
	useEffect(() => {
		if (typeof window !== 'undefined') {
			localStorage.setItem('newsDockQueue', JSON.stringify(queue));
		}
	}, [queue]);

	// Add an article to the queue (helper function)
	const addArticleToQueue = (article: any) => {
		// Convert article to NewsArticleItem format
		const newsArticleItem: NewsArticleItem = {
			id: article.id || article.link || new Date().getTime().toString(),
			title: article.title,
			url: article.link || article.url || article.documentUrl,
			type: 'article',
			source: article.source,
			publishedAt:
				article.publishedAt || article.timestamp || article.publishDate,
			excerpt: article.excerpt || article.summary,
			summary: article.summary,
			media: article.media,
		};

		addToQueue(newsArticleItem);
	};

	// Add an item to the queue
	const addToQueue = (item: NewsArticleItem) => {
		// Avoid adding duplicates
		if (!queue.some((existingItem) => existingItem.id === item.id)) {
			setQueue((prev) => [...prev, item]);
		}
	};

	// Remove an item from the queue
	const removeFromQueue = (id: string) => {
		setQueue((prev) => prev.filter((item) => item.id !== id));
	};

	// Clear the entire queue
	const clearQueue = () => {
		setQueue([]);
	};

	// Reorder items in the queue (for drag and drop)
	const reorderQueue = (fromIndex: number, toIndex: number) => {
		setQueue((prev) => {
			const result = Array.from(prev);
			const [removed] = result.splice(fromIndex, 1);
			result.splice(toIndex, 0, removed);
			return result;
		});
	};

	return (
		<NewsDockContext.Provider
			value={{
				queue,
				addToQueue,
				addArticleToQueue,
				removeFromQueue,
				clearQueue,
				reorderQueue,
				setQueue,
			}}
		>
			{children}
		</NewsDockContext.Provider>
	);
}

// Create a custom hook for using the context
export function useNewsDock() {
	return useContext(NewsDockContext);
}
