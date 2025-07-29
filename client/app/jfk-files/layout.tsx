'use client';

import React from 'react';
import { Inter } from 'next/font/google';
// import { AuthProvider } from '../../lib/context/AuthContext';
import {
	DocumentGroupProvider,
	useDocumentGroups,
} from '../../lib/context/DocumentGroupContext';
import { DocumentDock } from '../../components/ui/DocumentDock';
import GlobalDocumentGroupFilter from '../../components/layout/GlobalDocumentGroupFilter';
import Button from '@mui/material/Button';
import RestartAltIcon from '@mui/icons-material/RestartAlt';

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
		<div className='jfk-files-layout'>
			{/* <AuthProvider> */}
			<DocumentGroupProvider>
				<div
					className={`${inter.className} flex flex-col min-h-screen`}
				>
					<header
						style={{
							background:
								'linear-gradient(to right, #4f46e5, #9333ea)',
							color: 'white',
							padding: '12px 16px',
							boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
							position: 'relative',
							width: '100%',
						}}
					>
						<div
							style={{
								display: 'flex',
								alignItems: 'center',
								maxWidth: '1280px',
								margin: '0 auto',
								width: '100%',
								position: 'relative',
							}}
						>
							<a
								href='/jfk-files'
								style={{
									display: 'block',
									flexShrink: 0,
									marginRight: '16px',
									fontSize: '28px',
									fontWeight: 200,
									letterSpacing: '0.05em',
									textTransform: 'uppercase',
									textDecoration: 'none',
									color: 'white',
								}}
							>
								LIBRΛIRIΛN
							</a>
							<div
								style={{
									marginLeft: 'auto',
									display: 'flex',
									alignItems: 'center',
									gap: '8px',
								}}
							>
								<GlobalDocumentGroupFilter />
								<ResetFilterButton />
							</div>
						</div>
					</header>
					{children}
					<DocumentDock />
				</div>
			</DocumentGroupProvider>
			{/* </AuthProvider> */}
		</div>
	);
}
