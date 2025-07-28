'use client';

import React, {
	createContext,
	useContext,
	useState,
	useEffect,
	ReactNode,
} from 'react';

// Define the document item interface
export interface DocumentItem {
	id: string;
	title: string;
	url: string;
	type: 'document' | 'page' | 'article';
	source?: {
		site?: string;
		domain?: string;
	};
	publishDate?: string;
	excerpt?: string;
}

// Define the context interface
interface DocumentDockContextType {
	queue: DocumentItem[];
	addToQueue: (item: DocumentItem) => void;
	addArticleToQueue: (article: any) => void;
	removeFromQueue: (id: string) => void;
	clearQueue: () => void;
	reorderQueue: (fromIndex: number, toIndex: number) => void;
	setQueue: (items: DocumentItem[]) => void;
}

// Create the context with default values
const DocumentDockContext = createContext<DocumentDockContextType>({
	queue: [],
	addToQueue: () => {},
	addArticleToQueue: () => {},
	removeFromQueue: () => {},
	clearQueue: () => {},
	reorderQueue: () => {},
	setQueue: () => {},
});

// Create a provider component
export function DocumentDockProvider({ children }: { children: ReactNode }) {
	// Initialize state from localStorage if available
	const [queue, setQueue] = useState<DocumentItem[]>(() => {
		if (typeof window !== 'undefined') {
			const saved = localStorage.getItem('documentDockQueue');
			if (saved) {
				try {
					return JSON.parse(saved);
				} catch (e) {
					console.error(
						'Failed to parse document dock queue from localStorage',
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
			localStorage.setItem('documentDockQueue', JSON.stringify(queue));
		}
	}, [queue]);

	// Add an article to the queue (helper function)
	const addArticleToQueue = (article: any) => {
		// Convert article to DocumentItem format
		const documentItem: DocumentItem = {
			id: article.id || article.link || new Date().getTime().toString(),
			title: article.title,
			url: article.link || article.url,
			type: 'article',
			source: article.source,
			publishDate: article.timestamp || article.publishDate,
			excerpt: article.excerpt || article.summary,
		};

		addToQueue(documentItem);
	};

	// Add an item to the queue
	const addToQueue = (item: DocumentItem) => {
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
		<DocumentDockContext.Provider
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
		</DocumentDockContext.Provider>
	);
}

// Create a custom hook for using the context
export function useDocumentDock() {
	return useContext(DocumentDockContext);
}
