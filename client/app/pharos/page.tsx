import PharosScraperExample from '../../components/pharos/PharosScraperExample';
import { DataTable } from './data-table';
import { columns } from './post-columns';
import { getPosts } from './actions';

export default async function PharosHomePage() {
	// Fetch posts using server action
	const result = await getPosts(100); // Fetch up to 100 posts

	return (
		<div className='min-h-screen'>
			<div className='container mx-auto p-4'>
				<PharosScraperExample />
				{result.success ? (
					<DataTable columns={columns} data={result.posts} />
				) : (
					<div className='p-4 bg-red-50 border border-red-200 rounded-md'>
						<p className='text-red-600'>
							Error loading posts: {result.error}
						</p>
					</div>
				)}
			</div>
		</div>
	);
}
