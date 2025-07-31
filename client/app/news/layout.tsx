import { Inter } from 'next/font/google';
import { NewsDock } from '@/components/ui/NewsDock';
import NewsSidebar from '@/components/layout/NewsSidebar';

const inter = Inter({ subsets: ['latin'] });

export default function Layout({ children }: { children: React.ReactNode }) {
	return (
		<div className='news-layout w-full h-[calc(100vh-64px)] flex flex-col'>
			<div className={`${inter.className} flex-1 flex overflow-hidden`}>
				{/* Fixed sidebar */}
				<aside className='w-56 flex-shrink-0 h-full overflow-hidden bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800'>
					<NewsSidebar />
				</aside>

				{/* Main content area with its own scrolling */}
				<main className='flex-1 flex flex-col overflow-hidden'>
					{/* Scrollable content area */}
					<div className='flex-1 overflow-y-auto pb-16'>
						{children}
					</div>

					{/* Fixed dock at the bottom */}
					<div className='absolute bottom-0 left-56 right-0'>
						<NewsDock />
					</div>
				</main>
			</div>
		</div>
	);
}
