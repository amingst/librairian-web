'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function NewsSidebar() {
	const pathname = usePathname();

	return (
		<div className='h-full flex flex-col p-4 text-sidebar-foreground'>
			<div className='text-xl font-bold mb-4 text-purple-600 dark:text-purple-400'>
				PHΛROS
			</div>

			<nav className='flex-1 overflow-hidden'>
				<ul
					className='space-y-2 overflow-y-auto pr-2 pb-4'
					style={{ maxHeight: 'calc(100vh - 160px)' }}
				>
					<li>
						<Link
							href='/pharos'
							className={`block p-2 rounded transition-colors ${
								pathname === '/pharos'
									? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 font-medium'
									: 'hover:bg-muted hover:text-purple-600 dark:hover:text-purple-400'
							}`}
						>
							Headlines
						</Link>
					</li>
					<li>
						<Link
							href='/pharos/briefings'
							className={`block p-2 rounded transition-colors ${
								pathname === '/pharos/briefings'
									? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 font-medium'
									: 'hover:bg-muted hover:text-purple-600 dark:hover:text-purple-400'
							}`}
						>
							Local Briefings
						</Link>
					</li>
					<li>
						<Link
							href='#'
							className='block p-2 rounded transition-colors hover:bg-purple-50 hover:text-purple-600 dark:hover:bg-purple-900/30 dark:hover:text-purple-300'
						>
							Sources
						</Link>
					</li>
					<li>
						<Link
							href='#'
							className='block p-2 rounded transition-colors hover:bg-purple-50 hover:text-purple-600 dark:hover:bg-purple-900/30 dark:hover:text-purple-300'
						>
							Topics
						</Link>
					</li>
					<li>
						<Link
							href='#'
							className='block p-2 rounded transition-colors hover:bg-purple-50 hover:text-purple-600 dark:hover:bg-purple-900/30 dark:hover:text-purple-300'
						>
							Saved Articles
						</Link>
					</li>
				</ul>
			</nav>

			<div className='mt-auto pt-4 border-t border-sidebar-border'>
				<div className='text-sm text-muted-foreground'>
					News Navigator v1.0
				</div>
			</div>
		</div>
	);
}

export default NewsSidebar;
