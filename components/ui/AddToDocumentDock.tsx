"use client";

import React from 'react';
import { Plus, Check } from 'lucide-react';
import { useDocumentDock, DocumentItem } from '../../lib/context/DocumentDockContext';

interface AddToDocumentDockProps {
  item: {
    id: string;
    title: string;
    url: string;
    type: 'document' | 'page';
  };
  className?: string;
}

export function AddToDocumentDock({ item, className = '' }: AddToDocumentDockProps) {
  const { queue, addToQueue, removeFromQueue } = useDocumentDock();
  
  const isInQueue = queue.some(queueItem => queueItem.id === item.id);
  
  const toggleItem = () => {
    if (isInQueue) {
      removeFromQueue(item.id);
    } else {
      addToQueue(item);
    }
  };
  
  return (
    <button
      onClick={toggleItem}
      className={`inline-flex items-center gap-1 px-2 py-1 text-sm rounded-md transition-colors shadow-sm
        ${isInQueue 
          ? 'bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-400' 
          : 'bg-blue-600 hover:bg-blue-700 text-white border border-blue-400'}
        ${className}`}
      title={isInQueue ? "Remove from Document Queue" : "Add to Document Queue"}
      style={{
        fontSize: '0.75rem', // Ensure minimum readable size
        minWidth: '28px',
        minHeight: '20px',
        fontWeight: '500'
      }}
    >
      {isInQueue ? (
        <>
          <Check size={12} />
          <span className="whitespace-nowrap">In Queue</span>
        </>
      ) : (
        <>
          <Plus size={12} />
          <span className="whitespace-nowrap">Add</span>
        </>
      )}
    </button>
  );
} 