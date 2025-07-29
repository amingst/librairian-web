import React from 'react';
import { DocumentItem } from '@/lib/context/DocumentDockContext';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export default function SortableDocumentItem({
	item,
	index,
	children,
	isDragging = false,
}: {
	item: DocumentItem;
	index: number;
	children: (dragListeners: any) => React.ReactNode;
	isDragging?: boolean;
}) {
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
		<div ref={setNodeRef} style={style} {...attributes}>
			<div
				className={`inline-block w-60 h-80 bg-card border border-border rounded-lg shadow-sm mr-3 mb-3 align-top overflow-hidden ${
					isSortableDragging ? 'border-primary' : ''
				}`}
			>
				{children(listeners)}
			</div>
		</div>
	);
}
