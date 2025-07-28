import React from 'react';
import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
// import { AuthProvider } from '../lib/context/AuthContext';
import { DocumentDockProvider } from '../lib/context/DocumentDockContext';
import { DocumentDock } from '../components/ui/DocumentDock';
import Link from 'next/link';
import { DocumentGroupProvider } from '../lib/context/DocumentGroupContext';
import { ThemeProvider } from '../lib/context/ThemeContext';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
	title: 'ΛLΞXΛNDRIΛ LIBRΛIRIΛN',
	description: 'Your digital library of web content',
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang='en' suppressHydrationWarning>
			<body className={`${inter.className}`}>
				{/* <AuthProvider> */}
				<ThemeProvider
					attribute='class'
					defaultTheme='dark'
					enableSystem
					disableTransitionOnChange
				>
					<DocumentGroupProvider>
						<DocumentDockProvider>
							{children}
							<DocumentDock />
						</DocumentDockProvider>
					</DocumentGroupProvider>
				</ThemeProvider>
				{/* </AuthProvider> */}
			</body>
		</html>
	);
}
