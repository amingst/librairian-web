'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

// Define the document groups available in the system
export type DocumentGroupString = 'jfk' | 'rfk' | string;

// Define the document group object structure
export interface DocumentGroup {
  id: string;
  name: string;
}

// The shape of our context
interface DocumentGroupContextType {
  enabledGroups: DocumentGroupString[];
  documentGroups: DocumentGroup[];
  toggleGroup: (group: DocumentGroupString) => void;
  isGroupEnabled: (group: DocumentGroupString) => boolean;
  addDocumentGroup: (group: DocumentGroupString) => void;
}

// Create the context with a default value
const DocumentGroupContext = createContext<DocumentGroupContextType>({
  enabledGroups: ['jfk', 'rfk'],
  documentGroups: [
    { id: 'jfk', name: 'jfk' },
    { id: 'rfk', name: 'rfk' }
  ],
  toggleGroup: () => {},
  isGroupEnabled: () => false,
  addDocumentGroup: () => {},
});

// Create a provider component
export function DocumentGroupProvider({ children }: { children: ReactNode }) {
  // Initialize with both JFK and RFK enabled by default
  const [enabledGroups, setEnabledGroups] = useState<DocumentGroupString[]>(['jfk', 'rfk']);
  const [availableGroups, setAvailableGroups] = useState<DocumentGroupString[]>(['jfk', 'rfk']);
  
  // Load from localStorage on initial render (client-side only)
  useEffect(() => {
    try {
      const storedGroups = localStorage.getItem('enabledDocumentGroups');
      if (storedGroups) {
        setEnabledGroups(JSON.parse(storedGroups));
      }
      
      const storedAvailableGroups = localStorage.getItem('availableDocumentGroups');
      if (storedAvailableGroups) {
        setAvailableGroups(JSON.parse(storedAvailableGroups));
      }
    } catch (error) {
      console.error('Error loading document groups from localStorage:', error);
    }
  }, []);
  
  // Save to localStorage whenever enabledGroups changes
  useEffect(() => {
    try {
      localStorage.setItem('enabledDocumentGroups', JSON.stringify(enabledGroups));
    } catch (error) {
      console.error('Error saving document groups to localStorage:', error);
    }
  }, [enabledGroups]);
  
  // Save available groups to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('availableDocumentGroups', JSON.stringify(availableGroups));
    } catch (error) {
      console.error('Error saving available document groups to localStorage:', error);
    }
  }, [availableGroups]);

  // Toggle a document group on/off
  const toggleGroup = (group: DocumentGroupString) => {
    setEnabledGroups(prevGroups => {
      if (prevGroups.includes(group)) {
        // If this would disable all groups, don't allow it
        if (prevGroups.length === 1) {
          return prevGroups;
        }
        return prevGroups.filter(g => g !== group);
      } else {
        return [...prevGroups, group];
      }
    });
  };

  // Check if a document group is enabled
  const isGroupEnabled = (group: DocumentGroupString) => {
    return enabledGroups.includes(group);
  };
  
  // Add a new document group to the available list
  const addDocumentGroup = (group: DocumentGroupString) => {
    if (!availableGroups.includes(group)) {
      setAvailableGroups(prev => [...prev, group]);
      // Also enable it by default
      if (!enabledGroups.includes(group)) {
        setEnabledGroups(prev => [...prev, group]);
      }
    }
  };

  // Convert string groups to DocumentGroup objects
  const documentGroups: DocumentGroup[] = availableGroups.map(group => ({
    id: group,
    name: group
  }));

  return (
    <DocumentGroupContext.Provider value={{ 
      enabledGroups, 
      documentGroups,
      toggleGroup, 
      isGroupEnabled,
      addDocumentGroup
    }}>
      {children}
    </DocumentGroupContext.Provider>
  );
}

// Create a custom hook for using the context
export function useDocumentGroups() {
  return useContext(DocumentGroupContext);
} 