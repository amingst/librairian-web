'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

export interface SidebarData {
	navMain: Array<{
		title: string;
		url: string;
		icon: string;
		isActive?: boolean;
		items?: Array<{
			title: string;
			url: string;
		}>;
	}>;
	projects: Array<{
		name: string;
		url: string;
		icon: string;
	}>;
	recentDocuments?: Array<{
		id: string;
		title: string;
		lastAccessed: string;
	}>;
	recentArticles?: Array<{
		id: string;
		title: string;
		source: string;
		lastAccessed: string;
	}>;
	stats?: {
		totalDocuments?: number;
		processedToday?: number;
		pendingReview?: number;
		totalArticles?: number;
		sourcesMonitored?: number;
		articlesProcessedToday?: number;
	};
}

export function useSidebarData(): SidebarData | null {
	const [data, setData] = useState<SidebarData | null>(null);
	const pathname = usePathname();

	useEffect(() => {
		// Determine which script tag to read based on current route
		const scriptId = pathname.startsWith('/news')
			? 'news-sidebar-data'
			: 'jfk-sidebar-data';

		// Try to get data from the script tag injected by server component
		const scriptElement = document.getElementById(scriptId);

		if (scriptElement) {
			try {
				const sidebarData = JSON.parse(scriptElement.innerHTML);
				setData(sidebarData);
			} catch (error) {
				console.error('Failed to parse sidebar data:', error);
			}
		}
	}, [pathname]);

	return data;
}

// Fallback data for when server data isn't available
export const fallbackSidebarData: { [key: string]: SidebarData } = {
	librarian: {
		navMain: [
			{
				title: 'LIBRΛIRIΛN',
				url: '/jfk-files',
				icon: 'Library',
				isActive: false,
				items: [
					{
						title: 'Overview',
						url: '/jfk-files',
					},
					{
						title: 'Categories',
						url: '/jfk-files/categories',
					},
					{
						title: 'Recent Documents',
						url: '/jfk-files/recent',
					},
					{
						title: 'Favorites',
						url: '/jfk-files/favorites',
					},
					{
						title: 'Browse Documents',
						url: '/browse',
					},
					{
						title: 'Dashboard',
						url: '/dashboard',
					},
				],
			},
		],
		projects: [
			{
				name: 'Document Analysis',
				url: '/projects/analysis',
				icon: 'FileText',
			},
			{
				name: 'JFK Files Research',
				url: '/projects/jfk-research',
				icon: 'BookOpen',
			},
		],
	},
	pharos: {
		navMain: [
			{
				title: 'PHΛROS',
				url: '/news',
				icon: 'Newspaper',
				items: [
					{
						title: 'Headlines',
						url: '/news',
					},
					{
						title: 'Sources',
						url: '/news/sources',
					},
					{
						title: 'Topics',
						url: '/news/topics',
					},
					{
						title: 'Analysis',
						url: '/news/analysis',
					},
				],
			},
		],
		projects: [
			{
				name: 'News Intelligence',
				url: '/projects/intelligence',
				icon: 'Newspaper',
			},
			{
				name: 'Source Monitoring',
				url: '/projects/monitoring',
				icon: 'Search',
			},
		],
	},
};
