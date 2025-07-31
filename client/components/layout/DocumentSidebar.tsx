'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function DocumentSidebar() {
	const pathname = usePathname();

	return (
		<div className='h-full flex flex-col p-4 dark:text-white text-gray-900'>
			<div className='text-xl font-bold mb-4'>Document Explorer</div>

			<nav className='flex-1 overflow-hidden'>
				<ul
					className='space-y-2 overflow-y-auto pr-2 pb-4'
					style={{ maxHeight: 'calc(100vh - 160px)' }}
				>
					<li>
						<Link
							href='/jfk-files'
							className={`block p-2 rounded ${
								pathname === '/jfk-files'
									? 'dark:bg-gray-700 bg-gray-200'
									: 'dark:hover:bg-gray-800 hover:bg-gray-100'
							}`}
						>
							Overview
						</Link>
					</li>
					<li>
						<Link
							href='#'
							className='block p-2 rounded dark:hover:bg-gray-800 hover:bg-gray-100'
						>
							Categories
						</Link>
					</li>
					<li>
						<Link
							href='#'
							className='block p-2 rounded dark:hover:bg-gray-800 hover:bg-gray-100'
						>
							Recent Documents
						</Link>
					</li>
					<li>
						<Link
							href='#'
							className='block p-2 rounded dark:hover:bg-gray-800 hover:bg-gray-100'
						>
							Favorites
						</Link>
					</li>
				</ul>
			</nav>

			<div className='mt-auto pt-4 border-t dark:border-gray-700 border-gray-200'>
				<div className='text-sm dark:text-gray-400 text-gray-500'>
					Document Explorer v1.0
				</div>
			</div>
		</div>
	);
}

export default DocumentSidebar;
