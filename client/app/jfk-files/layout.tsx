'use client';

import React from 'react';
import { Inter } from 'next/font/google';
import {
	DocumentGroupProvider,
	useDocumentGroups,
} from '../../lib/context/DocumentGroupContext';
import { DocumentDock } from '../../components/ui/DocumentDock';
import GlobalDocumentGroupFilter from '../../components/layout/GlobalDocumentGroupFilter';
import Button from '@mui/material/Button';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import Header from '@/components/layout/Header';
import DocumentSidebar from '@/components/layout/DocumentSidebar';

const inter = Inter({ subsets: ['latin'] });

// Create a client component for the reset button
function ResetFilterButton() {
	const { documentGroups, toggleGroup } = useDocumentGroups();

	const resetDocumentFilters = () => {
		// Get current enabled groups from localStorage
		const storedGroups = localStorage.getItem('enabledDocumentGroups');
		let currentGroups = ['jfk', 'rfk'];

		if (storedGroups) {
			try {
				currentGroups = JSON.parse(storedGroups);
			} catch (e) {
				console.error('Error parsing stored groups', e);
			}
		}

		// First make sure both JFK and RFK are available
		localStorage.setItem(
			'availableDocumentGroups',
			JSON.stringify(['jfk', 'rfk'])
		);

		// Enable both groups by toggling their state appropriately
		// First enable any disabled ones
		['jfk', 'rfk'].forEach((group) => {
			if (!currentGroups.includes(group)) {
				toggleGroup(group); // This will add the group
			}
		});

		// Force reload to make sure changes are applied
		window.location.reload();
	};

	return (
		<Button
			variant='outlined'
			onClick={resetDocumentFilters}
			startIcon={<RestartAltIcon />}
			style={{
				borderColor: 'rgba(255,255,255,0.5)',
				color: 'white',
				textTransform: 'none',
				fontSize: '14px',
				padding: '4px 12px',
				marginLeft: '8px',
				minWidth: 'auto',
			}}
		>
			Reset Filters
		</Button>
	);
}

export default function JFKFilesLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div className='jfk-files-layout w-full h-[calc(100vh-64px)] flex flex-col'>
			<div className={`${inter.className} flex-1 flex overflow-hidden`}>
				{/* Fixed sidebar */}
				<aside className='w-56 flex-shrink-0 h-full overflow-hidden bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800'>
					<DocumentSidebar />
				</aside>

				{/* Main content area with its own scrolling */}
				<main className='flex-1 flex flex-col overflow-hidden'>
					{/* Scrollable content area */}
					<div className='flex-1 overflow-y-auto pb-16'>
						{children}
					</div>

					{/* Fixed dock at the bottom */}
					<div className='absolute bottom-0 left-56 right-0'>
						<DocumentDock />
					</div>
				</main>
			</div>
		</div>
	);
}
