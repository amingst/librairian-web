'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { NewsArticleItem } from '@/lib/context/NewsDockContext';

interface SortableNewsItemProps {
	item: NewsArticleItem;
	index: number;
	isDragging: boolean;
	children: (dragListeners: any) => React.ReactNode;
}

export default function SortableNewsItem({
	item,
	index,
	isDragging,
	children,
}: SortableNewsItemProps) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging: isSortableDragging,
	} = useSortable({ id: item.id });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging || isSortableDragging ? 0.5 : 1,
	};

	return (
		<div
			ref={setNodeRef}
			style={style}
			{...attributes}
			className='inline-block w-80 h-96 bg-background border border-border rounded-lg shadow-sm mr-4 flex-shrink-0 overflow-hidden'
		>
			{children(listeners)}
		</div>
	);
}
