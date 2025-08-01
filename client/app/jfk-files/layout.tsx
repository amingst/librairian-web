'use client';

import React from 'react';
import { Inter } from 'next/font/google';
import {
	DocumentGroupProvider,
	useDocumentGroups,
} from '../../lib/context/DocumentGroupContext';
import { DocumentDockProvider } from '../../lib/context/DocumentDockContext';
import { DocumentDock } from '../../components/ui/DocumentDock';
import GlobalDocumentGroupFilter from '../../components/layout/GlobalDocumentGroupFilter';
import Button from '@mui/material/Button';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
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
	sidebar,
}: {
	children: React.ReactNode;
	sidebar: React.ReactNode;
}) {
	return (
		<DocumentGroupProvider>
			<DocumentDockProvider>
				<div className='flex flex-col h-full relative'>
					{/* Include the parallel route data */}
					{sidebar}

					{/* Main content area with bottom padding for dock */}
					<div className='flex-1 overflow-auto p-4 pb-20'>
						{children}
					</div>

					{/* Fixed dock at the bottom */}
					<div className='fixed bottom-0 left-0 right-0 z-10 border-t bg-background md:ml-64'>
						<DocumentDock />
					</div>
				</div>
			</DocumentDockProvider>
		</DocumentGroupProvider>
	);
}
