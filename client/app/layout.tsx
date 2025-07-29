import React from 'react';
import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
// import { AuthProvider } from '../lib/context/AuthContext';
import { DocumentDockProvider } from '../lib/context/DocumentDockContext';
import { NewsDockProvider } from '../lib/context/NewsDockContext';
import Link from 'next/link';
import { DocumentGroupProvider } from '../lib/context/DocumentGroupContext';
import { ThemeProvider } from '../lib/context/ThemeContext';
import { NewsSourcesProvider } from '@/lib/context/NewsSourceContext';

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
							<NewsDockProvider>
								<NewsSourcesProvider>
									{children}
								</NewsSourcesProvider>
							</NewsDockProvider>
						</DocumentDockProvider>
					</DocumentGroupProvider>
				</ThemeProvider>
				{/* </AuthProvider> */}
			</body>
		</html>
	);
}
