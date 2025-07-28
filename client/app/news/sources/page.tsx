import NewsDocumentsView from '@/components/news/NewsDocumentsView';
import { DocumentDockProvider } from '@/lib/context/DocumentDockContext';

export default function NewsPage() {
	return (
		<DocumentDockProvider>
			<div className='min-h-screen'>
				<div className='container mx-auto p-4'>
					<NewsDocumentsView />
				</div>
			</div>
		</DocumentDockProvider>
	);
}
