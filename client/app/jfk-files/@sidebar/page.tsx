import { Suspense } from 'react';

// Server component to fetch sidebar data
async function getSidebarData() {
	// This could fetch from your database, API, etc.
	// For now, I'll return static data, but you can replace with actual server calls

	// Simulate API call delay
	await new Promise((resolve) => setTimeout(resolve, 100));

	return {
		navMain: [
			{
				title: 'LIBRΛIRIΛN',
				url: '/jfk-files',
				icon: 'Library',
				isActive: false,
				items: [],
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
		recentDocuments: [
			{
				id: '104-10003-10041',
				title: 'JFK Assassination Records',
				lastAccessed: new Date().toISOString(),
			},
			// Add more recent documents from server
		],
		stats: {
			totalDocuments: 12543,
			processedToday: 23,
			pendingReview: 45,
		},
	};
}

function SidebarDataSkeleton() {
	return (
		<div className='animate-pulse space-y-4 p-4'>
			<div className='h-4 bg-gray-200 rounded w-3/4'></div>
			<div className='h-4 bg-gray-200 rounded w-1/2'></div>
			<div className='h-4 bg-gray-200 rounded w-2/3'></div>
		</div>
	);
}

async function SidebarData() {
	const data = await getSidebarData();

	return (
		<div className='hidden'>
			{/* This component provides data context but doesn't render UI */}
			{/* The data will be available through context or props */}
			<script
				id='jfk-sidebar-data'
				type='application/json'
				dangerouslySetInnerHTML={{
					__html: JSON.stringify(data),
				}}
			/>
		</div>
	);
}

export default function JFKSidebarPage() {
	return (
		<Suspense fallback={<SidebarDataSkeleton />}>
			<SidebarData />
		</Suspense>
	);
}
