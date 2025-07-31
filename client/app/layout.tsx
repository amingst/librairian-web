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
import Header from '@/components/layout/Header';

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
		<html
			lang='en'
			suppressHydrationWarning
			className='h-full overflow-hidden'
		>
			<body className={`${inter.className} h-full overflow-hidden`}>
				{/* <AuthProvider> */}
				<ThemeProvider
					attribute='class'
					defaultTheme='dark'
					enableSystem
					disableTransitionOnChange
				>
					<div className="app-container relative">
						<DocumentGroupProvider>
							<DocumentDockProvider>
								<NewsDockProvider>
									<NewsSourcesProvider>
										<Header />
										<div className="app-content" style={{ position: 'relative', zIndex: 1 }}>
											{children}
										</div>
									</NewsSourcesProvider>
								</NewsDockProvider>
							</DocumentDockProvider>
						</DocumentGroupProvider>
					</div>
				</ThemeProvider>
				{/* </AuthProvider> */}
			</body>
		</html>
	);
}
