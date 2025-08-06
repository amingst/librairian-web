import { useState, useEffect, useRef, useCallback } from 'react';
import { JFKDocument } from '../../utils/jfk/types';
import { useDocumentGroups } from '../../lib/context/DocumentGroupContext';

interface UseJfkDocumentsReturn {
  documents: JFKDocument[];
  isLoading: boolean;
  totalDocuments: number;
  currentPage: number;
  totalPages: number;
  setCurrentPage: (page: number) => void;
  documentIdMap: Record<string, string>;
  goToNextPage: () => void;
  goToPrevPage: () => void;
  refreshDocuments: () => Promise<void>;
}

export function useJfkDocuments(itemsPerPage: number = 10): UseJfkDocumentsReturn {
  const [documents, setDocuments] = useState<JFKDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalDocuments, setTotalDocuments] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [documentIdMap, setDocumentIdMap] = useState<Record<string, string>>({});
  
  // Get current document groups from context
  const { enabledGroups } = useDocumentGroups();
  
  // Prevent setState during render by moving initial fetching to an effect with a ref guard
  const initialFetchRef = useRef(false);

  // Function to fetch documents from API
  const fetchDocuments = useCallback(async (page: number) => {
    try {
      // Add document group filtering to API request
      const queryParams = new URLSearchParams({
        page: page.toString(),
        size: itemsPerPage.toString(),
        groups: enabledGroups.join(',')
      });
      
      // Use the document-status API with filter
      const response = await fetch(`/api/jfk/document-status?${queryParams.toString()}`);
      if (!response.ok) throw new Error(`Failed to fetch documents: ${response.statusText}`);
      
      const data = await response.json();
      
      // Handle response format
      setDocuments(data.documents || []);
      setTotalDocuments(data.totalCount || 0);
      setTotalPages(data.totalPages || Math.ceil((data.totalCount || 0) / itemsPerPage));
      
      // Update document ID mapping from database information
      const newDocIdMap: Record<string, string> = {};
      data.documents.forEach((doc: JFKDocument) => {
        if (doc.status === 'completed' && doc.dbId) {
          newDocIdMap[doc.id] = doc.dbId;
        }
      });
      
      // Only update if there are new mappings
      if (Object.keys(newDocIdMap).length > 0) {
        setDocumentIdMap(prev => ({
          ...prev,
          ...newDocIdMap
        }));
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error("Error fetching JFK documents:", error);
      setIsLoading(false);
    }
  }, [itemsPerPage, enabledGroups]);

  // Initial fetch on mount
  useEffect(() => {
    if (initialFetchRef.current) return;
    initialFetchRef.current = true;
    
    setIsLoading(true);
    fetchDocuments(currentPage);
  }, [fetchDocuments, currentPage]);

  // Fetch when page changes
  useEffect(() => {
    if (!initialFetchRef.current) return; // Skip if initial fetch hasn't happened
    
    setIsLoading(true);
    fetchDocuments(currentPage);
  }, [fetchDocuments, currentPage]);

  // Load document ID mappings from localStorage on initial render
  useEffect(() => {
    try {
      const savedMapping = localStorage.getItem('jfk-document-id-map');
      if (savedMapping) {
        setDocumentIdMap(JSON.parse(savedMapping));
      }
    } catch (error) {
      console.error('Error loading document ID mappings from localStorage:', error);
    }
  }, []);

  // Save document ID mappings to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('jfk-document-id-map', JSON.stringify(documentIdMap));
    } catch (error) {
      console.error('Error saving document ID mappings to localStorage:', error);
    }
  }, [documentIdMap]);

  // Update document statuses based on mappings
  useEffect(() => {
    if (!isLoading && documents.length > 0) {
      // For each document, check if we have a mapping - if so, it's ready
      const updatedDocuments = documents.map(doc => {
        if (documentIdMap[doc.id]) {
          return {
            ...doc,
            status: 'ready', // Use ready state instead of completed
            analysisComplete: true,
            processingStatus: null, // No active processing
            lastUpdated: doc.lastUpdated || new Date().toISOString()
          };
        }
        return doc;
      });
      
      // Only update if there are changes
      if (JSON.stringify(updatedDocuments) !== JSON.stringify(documents)) {
        setDocuments(updatedDocuments);
      }
    }
  }, [documents, documentIdMap, isLoading]);

  // Load document statuses from localStorage
  useEffect(() => {
    try {
      const savedStatuses = JSON.parse(localStorage.getItem('document-statuses') || '{}');
      const ids = Object.keys(savedStatuses);
      
      if (ids.length > 0) {
        console.log(`Found ${ids.length} saved document statuses in localStorage`);
        
        // Update documents with saved statuses
        setDocuments(prev => {
          const updated = prev.map(doc => {
            if (savedStatuses[doc.id] && savedStatuses[doc.id].status === 'ready') {
              // Update documents marked as ready in localStorage
              return {
                ...doc,
                status: 'ready',
                analysisComplete: true,
                processingStatus: null
              };
            }
            return doc;
          });
          return updated;
        });
      }
    } catch (error) {
      console.error('Error loading document statuses from localStorage:', error);
    }
  }, []);

  // Save document statuses to localStorage
  useEffect(() => {
    if (documents.length > 0) {
      // Log all documents with 'ready' status for debugging
      const readyDocs = documents.filter(doc => doc.status === 'ready');
      console.log(`Currently have ${readyDocs.length} documents with 'ready' status`);
      
      // Ensure ready documents are stored in localStorage
      if (readyDocs.length > 0) {
        try {
          // Get existing document statuses from localStorage
          const savedStatuses = JSON.parse(localStorage.getItem('document-statuses') || '{}');
          
          // Update with current ready documents
          readyDocs.forEach(doc => {
            savedStatuses[doc.id] = {
              status: 'ready',
              analysisComplete: true,
              lastUpdated: doc.lastUpdated || new Date().toISOString()
            };
          });
          
          // Save back to localStorage
          localStorage.setItem('document-statuses', JSON.stringify(savedStatuses));
          console.log(`Saved ${readyDocs.length} 'ready' documents to localStorage`);
        } catch (error) {
          console.error('Error saving document statuses to localStorage:', error);
        }
      }
    }
  }, [documents]);

  // Navigation functions
  const goToNextPage = useCallback(() => {
    setCurrentPage(prev => prev + 1);
  }, []);

  const goToPrevPage = useCallback(() => {
    setCurrentPage(prev => Math.max(1, prev - 1));
  }, []);

  // Function to manually refresh documents
  const refreshDocuments = useCallback(async () => {
    setIsLoading(true);
    await fetchDocuments(currentPage);
  }, [fetchDocuments, currentPage]);

  return {
    documents,
    isLoading,
    totalDocuments,
    currentPage,
    totalPages,
    setCurrentPage,
    documentIdMap,
    goToNextPage,
    goToPrevPage,
    refreshDocuments
  };
} 