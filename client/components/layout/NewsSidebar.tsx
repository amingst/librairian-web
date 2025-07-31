'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function NewsSidebar() {
	const pathname = usePathname();

	return (
		<div className='h-full flex flex-col p-4 dark:text-gray-100 text-gray-800'>
			<div className='text-xl font-bold mb-4'>News Navigator</div>

			<nav className='flex-1 overflow-hidden'>
				<ul
					className='space-y-2 overflow-y-auto pr-2 pb-4'
					style={{ maxHeight: 'calc(100vh - 160px)' }}
				>
					<li>
						<Link
							href='/news'
							className={`block p-2 rounded ${
								pathname === '/news'
									? 'dark:bg-blue-900 bg-blue-100 dark:text-blue-200 text-blue-700'
									: 'dark:hover:bg-gray-700 hover:bg-gray-200'
							}`}
						>
							Headlines
						</Link>
					</li>
					<li>
						<Link
							href='#'
							className='block p-2 rounded dark:hover:bg-gray-700 hover:bg-gray-200'
						>
							Sources
						</Link>
					</li>
					<li>
						<Link
							href='#'
							className='block p-2 rounded dark:hover:bg-gray-700 hover:bg-gray-200'
						>
							Topics
						</Link>
					</li>
					<li>
						<Link
							href='#'
							className='block p-2 rounded dark:hover:bg-gray-700 hover:bg-gray-200'
						>
							Saved Articles
						</Link>
					</li>
				</ul>
			</nav>

			<div className='mt-auto pt-4 border-t dark:border-gray-700 border-gray-300'>
				<div className='text-sm dark:text-gray-400 text-gray-500'>
					News Navigator v1.0
				</div>
			</div>
		</div>
	);
}

export default NewsSidebar;
