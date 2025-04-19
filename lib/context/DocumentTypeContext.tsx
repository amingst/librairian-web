'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

// Define the document groups available in the system
export type DocumentGroup = 'jfk' | 'rfk' | string;

// The shape of our context
interface DocumentGroupContextType {
  enabledGroups: DocumentGroup[];
  toggleGroup: (group: DocumentGroup) => void;
  isGroupEnabled: (group: DocumentGroup) => boolean;
  addDocumentGroup: (group: DocumentGroup) => void;
}

// Create the context with a default value
const DocumentGroupContext = createContext<DocumentGroupContextType>({
  enabledGroups: ['jfk', 'rfk'],
  toggleGroup: () => {},
  isGroupEnabled: () => false,
  addDocumentGroup: () => {},
});

// Create a provider component
export function DocumentGroupProvider({ children }: { children: ReactNode }) {
  // Initialize with both JFK and RFK enabled by default
  const [enabledGroups, setEnabledGroups] = useState<DocumentGroup[]>(['jfk', 'rfk']);
  const [availableGroups, setAvailableGroups] = useState<DocumentGroup[]>(['jfk', 'rfk']);
  
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
  const toggleGroup = (group: DocumentGroup) => {
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
  const isGroupEnabled = (group: DocumentGroup) => {
    return enabledGroups.includes(group);
  };
  
  // Add a new document group to the available list
  const addDocumentGroup = (group: DocumentGroup) => {
    if (!availableGroups.includes(group)) {
      setAvailableGroups(prev => [...prev, group]);
      // Also enable it by default
      if (!enabledGroups.includes(group)) {
        setEnabledGroups(prev => [...prev, group]);
      }
    }
  };

  return (
    <DocumentGroupContext.Provider value={{ 
      enabledGroups, 
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