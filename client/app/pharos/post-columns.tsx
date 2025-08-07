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
		accessorKey: 'title',
		header: 'Title',
		size: 300, // Width for title
		cell: ({ row }) => {
			const title = row.getValue('title') as string;
			const fallbackTitle =
				stripHtmlAndClean(row.original.articleText)?.split('\n')[0] ||
				'Untitled Article';
			const displayTitle = title || fallbackTitle;

			return (
				<div>
					<span
						className='text-sm font-medium text-gray-900 block truncate'
						title={displayTitle}
					>
						{truncateText(displayTitle, 50)}
					</span>
				</div>
			);
		},
	},
	{
		accessorKey: 'sourceId',
		header: 'Source ID',
		size: 150, // Width for source ID
		cell: ({ row }) => {
			const sourceId = row.getValue('sourceId') as string;
			const fallbackSource =
				row.original.bylineWritersLocation || 'Unknown';
			const displaySource = sourceId || fallbackSource;

			return (
				<div>
					<span
						className='text-sm text-gray-600 block truncate'
						title={displaySource}
					>
						{truncateText(displaySource, 20)}
					</span>
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
		size: 300, // Reduced width since we now have title column
		cell: ({ row }) => {
			const rawText = row.getValue('articleText') as string;
			const cleanText = stripHtmlAndClean(rawText);
			const truncatedText = truncateText(cleanText, 80); // Reduced characters

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
