import { Inter } from 'next/font/google';
import { NewsDockProvider } from '../../lib/context/NewsDockContext';
import { NewsSourcesProvider } from '@/lib/context/NewsSourceContext';
import { NewsDock } from '@/components/ui/NewsDock';
import PharosSidebar from '@/components/layout/PharosSidebar';

const inter = Inter({ subsets: ['latin'] });

export default function PharosLayout({
	children,
	sidebar,
}: {
	children: React.ReactNode;
	sidebar: React.ReactNode;
}) {
	return (
		<NewsDockProvider>
			<NewsSourcesProvider>
				<div className='flex flex-col h-full relative'>
					{/* Include the parallel route data */}
					{sidebar}

					{/* Main content area with bottom padding for dock */}
					<div className='flex-1 overflow-auto p-4 pb-20'>
						{children}
					</div>

					{/* Fixed dock at the bottom */}
					<div className='fixed bottom-0 left-0 right-0 z-10 border-t bg-background md:ml-64'>
						<NewsDock />
					</div>
				</div>
			</NewsSourcesProvider>
		</NewsDockProvider>
	);
}
