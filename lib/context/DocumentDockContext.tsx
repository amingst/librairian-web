"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Define the document item interface
export interface DocumentItem {
  id: string;
  title: string;
  url: string;
  type: 'document' | 'page';
}

// Define the context interface
interface DocumentDockContextType {
  queue: DocumentItem[];
  addToQueue: (item: DocumentItem) => void;
  removeFromQueue: (id: string) => void;
  clearQueue: () => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  setQueue: (items: DocumentItem[]) => void;
}

// Create the context with default values
const DocumentDockContext = createContext<DocumentDockContextType>({
  queue: [],
  addToQueue: () => {},
  removeFromQueue: () => {},
  clearQueue: () => {},
  reorderQueue: () => {},
  setQueue: () => {},
});

// Create a provider component
export function DocumentDockProvider({ children }: { children: ReactNode }) {
  // Initialize state from localStorage if available
  const [queue, setQueue] = useState<DocumentItem[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('documentDockQueue');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error('Failed to parse document dock queue from localStorage', e);
        }
      }
    }
    return [];
  });

  // Save to localStorage whenever queue changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('documentDockQueue', JSON.stringify(queue));
    }
  }, [queue]);

  // Add an item to the queue
  const addToQueue = (item: DocumentItem) => {
    // Avoid adding duplicates
    if (!queue.some(existingItem => existingItem.id === item.id)) {
      setQueue(prev => [...prev, item]);
    }
  };

  // Remove an item from the queue
  const removeFromQueue = (id: string) => {
    setQueue(prev => prev.filter(item => item.id !== id));
  };

  // Clear the entire queue
  const clearQueue = () => {
    setQueue([]);
  };

  // Reorder items in the queue (for drag and drop)
  const reorderQueue = (fromIndex: number, toIndex: number) => {
    setQueue(prev => {
      const result = Array.from(prev);
      const [removed] = result.splice(fromIndex, 1);
      result.splice(toIndex, 0, removed);
      return result;
    });
  };

  return (
    <DocumentDockContext.Provider value={{ queue, addToQueue, removeFromQueue, clearQueue, reorderQueue, setQueue }}>
      {children}
    </DocumentDockContext.Provider>
  );
}

// Create a custom hook for using the context
export function useDocumentDock() {
  return useContext(DocumentDockContext);
} 