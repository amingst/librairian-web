'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function DocumentSidebar() {
	const pathname = usePathname();

	return (
		<div className='h-full flex flex-col p-4 text-sidebar-foreground'>
			<div className='text-xl font-bold mb-4 text-indigo-600 dark:text-indigo-400'>
				LIBRΛIRIΛN
			</div>

			<nav className='flex-1 overflow-hidden'>
				<ul
					className='space-y-2 overflow-y-auto pr-2 pb-4'
					style={{ maxHeight: 'calc(100vh - 160px)' }}
				>
					<li>
						<Link
							href='/jfk-files'
							className={`block p-2 rounded transition-colors ${
								pathname === '/jfk-files'
									? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 font-medium'
									: 'hover:bg-muted hover:text-indigo-600 dark:hover:text-indigo-400'
							}`}
						>
							Overview
						</Link>
					</li>
					<li>
						<Link
							href='#'
							className='block p-2 rounded transition-colors hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-300'
						>
							Categories
						</Link>
					</li>
					<li>
						<Link
							href='#'
							className='block p-2 rounded transition-colors hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-300'
						>
							Recent Documents
						</Link>
					</li>
					<li>
						<Link
							href='#'
							className='block p-2 rounded transition-colors hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-300'
						>
							Favorites
						</Link>
					</li>
				</ul>
			</nav>

			<div className='mt-auto pt-4 border-t border-sidebar-border'>
				<div className='text-sm text-muted-foreground'>
					Document Explorer v1.0
				</div>
			</div>
		</div>
	);
}

export default DocumentSidebar;
