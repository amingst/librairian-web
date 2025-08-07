'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Post } from '@prisma/client';

// Helper function to truncate text
const truncateText = (text: string | null, maxLength: number = 50) => {
	if (!text) return '';
	if (text.length <= maxLength) return text;
	return text.substring(0, maxLength) + '...';
};

// Helper function to strip HTML tags and clean up text
const stripHtmlAndClean = (html: string | null) => {
	if (!html) return '';

	// Remove HTML tags
	const withoutTags = html.replace(/<[^>]*>/g, '');

	// Decode common HTML entities
	const decoded = withoutTags
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#x27;/g, "'")
		.replace(/&nbsp;/g, ' ')
		.replace(/&mdash;/g, '—')
		.replace(/&ndash;/g, '–');

	// Clean up extra whitespace and normalize
	return decoded.replace(/\s+/g, ' ').trim();
};

export const columns: ColumnDef<Post>[] = [
	{
		accessorKey: 'id',
		header: 'Post ID',
		size: 120, // Increased width for ID
		cell: ({ row }) => {
			return (
				<div className='text-sm font-mono truncate'>
					{row.getValue('id')}
				</div>
			);
		},
	},
	{
		accessorKey: 'webUrl',
		header: 'URL',
		size: 250, // Increased width for URL
		cell: ({ row }) => {
			const url = row.getValue('webUrl') as string;
			return (
				<div>
					<a
						href={url}
						target='_blank'
						rel='noopener noreferrer'
						className='text-blue-600 hover:text-blue-800 underline text-sm block truncate'
						title={url}
					>
						{truncateText(url, 40)}
					</a>
				</div>
			);
		},
	},
	{
		accessorKey: 'articleText',
		header: 'Text',
		size: 400, // Larger width for text content
		cell: ({ row }) => {
			const rawText = row.getValue('articleText') as string;
			const cleanText = stripHtmlAndClean(rawText);
			const truncatedText = truncateText(cleanText, 100); // More characters for readability

			return (
				<div>
					<span
						className='text-sm text-gray-700 leading-relaxed block truncate'
						title={cleanText} // Show full clean text in tooltip
					>
						{truncatedText}
					</span>
				</div>
			);
		},
	},
	{
		accessorKey: 'bylineWriter',
		header: 'Writer',
		size: 180, // Increased width for writer
		cell: ({ row }) => {
			const writer = row.getValue('bylineWriter') as string;
			return (
				<div>
					<span
						className='text-sm font-medium text-gray-900 block truncate'
						title={writer}
					>
						{truncateText(writer, 25)}
					</span>
				</div>
			);
		},
	},
];
