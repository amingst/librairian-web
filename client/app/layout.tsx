import React from 'react';
import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '../lib/context/ThemeContext';
import { AppSidebar } from '@/components/app-sidebar';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
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
		<html lang='en' suppressHydrationWarning className='h-full'>
			<body className={`${inter.className} h-full`}>
				<ThemeProvider
					attribute='class'
					defaultTheme='dark'
					enableSystem
					disableTransitionOnChange
				>
					<SidebarProvider>
						<AppSidebar />
						<SidebarInset className='flex flex-col h-full'>
							<div className='sticky top-0 z-10 bg-background border-b'>
								<Header />
							</div>
							<div className='flex-1 overflow-auto'>
								{children}
							</div>
						</SidebarInset>
					</SidebarProvider>
				</ThemeProvider>
			</body>
		</html>
	);
}
