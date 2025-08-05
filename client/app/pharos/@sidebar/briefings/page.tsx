import { Suspense } from 'react';

// Server component to fetch pharos sidebar data for briefings page
async function getPharosSidebarData() {
	// This could fetch from your database, API, etc.
	// For now, I'll return static data, but you can replace with actual server calls

	// Simulate API call delay
	await new Promise((resolve) => setTimeout(resolve, 100));

	return {
		navMain: [
			{
				title: 'PHΛROS',
				url: '/pharos',
				icon: 'Newspaper',
				items: [
					{
						title: 'Headlines',
						url: '/pharos',
					},
					{
						title: 'Local Briefings',
						url: '/pharos/briefings',
					},
					{
						title: 'Sources',
						url: '/pharos/sources',
					},
					{
						title: 'Topics',
						url: '/pharos/topics',
					},
					{
						title: 'Analysis',
						url: '/pharos/analysis',
					},
				],
			},
		],
		projects: [
			{
				name: 'Pharos Intelligence',
				url: '/projects/intelligence',
				icon: 'Newspaper',
			},
			{
				name: 'Source Monitoring',
				url: '/projects/monitoring',
				icon: 'Search',
			},
		],
		recentArticles: [
			{
				id: 'pharos-001',
				title: 'Breaking News Update',
				source: 'Reuters',
				lastAccessed: new Date().toISOString(),
			},
			// Add more recent articles from server
		],
		stats: {
			totalArticles: 8742,
			sourcesMonitored: 156,
			articlesProcessedToday: 234,
		},
	};
}

function PharosSidebarDataSkeleton() {
	return (
		<div className='animate-pulse space-y-4 p-4'>
			<div className='h-4 bg-gray-200 rounded w-3/4'></div>
			<div className='h-4 bg-gray-200 rounded w-1/2'></div>
			<div className='h-4 bg-gray-200 rounded w-2/3'></div>
		</div>
	);
}

async function PharosSidebarData() {
	const data = await getPharosSidebarData();

	return (
		<div className='hidden'>
			{/* This component provides data context but doesn't render UI */}
			{/* The data will be available through context or props */}
			<script
				id='pharos-sidebar-data'
				type='application/json'
				dangerouslySetInnerHTML={{
					__html: JSON.stringify(data),
				}}
			/>
		</div>
	);
}

export default function PharosSidebarBriefingsPage() {
	return (
		<Suspense fallback={<PharosSidebarDataSkeleton />}>
			<PharosSidebarData />
		</Suspense>
	);
}
