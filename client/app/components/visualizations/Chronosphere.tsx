"use client";

// Add globals for window functions
declare global {
  interface Window {
    addToDocumentDock?: (item: { id: string; title?: string; url?: string; type?: string }) => boolean;
    documentDetailsCache?: { [key: string]: any };
  }
}

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { useTheme } from 'next-themes';
import { Loader2, ZoomIn, ZoomOut, Maximize2, Info, Users, Calendar, X, Play, Pause, Settings, ChevronUp, ChevronDown } from 'lucide-react';
import * as d3 from 'd3';
import { useRouter } from 'next/navigation';
import { AddToDocumentDock } from '../../../components/ui/AddToDocumentDock';

interface ChronosphereProps {
  width?: number;
  height?: number;
  onNodeClick?: (node: any) => void;
  searchType?: string;
  searchValue?: string;
  startDate?: string;
  endDate?: string;
  onSearch?: () => void;
  onDateUpdate?: (newStartDate: string, newEndDate: string) => void;
}

interface EntityMention {
  name: string;
  type: 'person' | 'place' | 'object';
  frequency: number;
}

interface DocumentNode {
  id: string;
  title: string;
  date?: string;
  agency?: string;
  summary?: string;
  people: EntityMention[];
  places: EntityMention[];
  objects: EntityMention[];
  keywords?: string[];
  contentUrl?: string;
  nodeType: string;
  // Optional visualization properties
  x?: number;
  y?: number;
  _initialX?: number;
  _initialY?: number;
  _scaleFactor?: number;
  _isExpanded?: boolean;
  _pageNumber?: number;
  pageCount?: number;
}

interface Connection {
  source: string;
  target: string;
  entity: string;
  type: 'person' | 'place';
  strength: number;
}

// Color palette for entity types
const entityColors = {
  person: '#3b82f6', // Blue for person connections
  place: '#ef4444',  // Red for place connections
  organization: '#10b981', // Green for organizations
  event: '#f59e0b',  // Amber for events
  term: '#10b981'    // emerald (for compatibility with existing code)
};

// Visual parameters
const docWidth = 220;    // Document card width
const docHeight = 150;   // Document card height
const shrinkFactor = 0.25; // Default size (smaller)
const expandedSize = 1.0;  // Size when expanded
const ringRadius = 400;    // Further reduced radius to fit in viewport

// Word cloud parameters
const cloudRadius = 120; // Cloud size
const maxFontSize = 20;  // Max font size for terms
const minFontSize = 12;   // Min font size for terms

// Helper function to consistently sanitize document IDs for CSS selectors
const getSafeDocId = (docId: string) => {
  // Create a safe ID by sanitizing the document ID
  return `doc-${docId.replace(/[^a-zA-Z0-9-_]/g, '_')}`;
};

// Utility function to ensure documents have nodeType set and handle various input formats
const ensureDocumentNodeType = (docs: any[]): DocumentNode[] => {
  if (!Array.isArray(docs) || docs.length === 0) {
    console.warn('[CHRONOSPHERE] ensureDocumentNodeType received empty or non-array input:', docs);
    return [];
  }
  
  return docs.map(doc => {
    // Create a normalized document object
    const normalizedDoc: DocumentNode = {
      id: doc.id || doc._id || doc.documentId || 'unknown-id',
      title: doc.title || doc.name || `Document ${doc.id || 'Untitled'}`,
      nodeType: 'document',
      people: [],
      places: [],
      objects: [],
    };
    
    // Process date if available
    if (doc.date) {
      normalizedDoc.date = doc.date;
    }
    
    // Process summary if available
    if (doc.summary) {
      normalizedDoc.summary = doc.summary;
    }
    
    // Process agency if available
    if (doc.agency) {
      normalizedDoc.agency = doc.agency;
    }
    
    // Process URL if available
    if (doc.url || doc.contentUrl) {
      normalizedDoc.contentUrl = doc.url || doc.contentUrl;
    }
    
    // Process page count if available
    if (doc.pageCount) {
      normalizedDoc.pageCount = doc.pageCount;
    }
    
    // Process people entities
    if (Array.isArray(doc.people)) {
      normalizedDoc.people = doc.people;
    } else if (Array.isArray(doc.names)) {
      // Convert names array to people format
      normalizedDoc.people = doc.names.map((name: string) => ({
        name,
        type: 'person' as const,
        frequency: 1
      }));
    } else if (doc.allNames && Array.isArray(doc.allNames)) {
      // Convert allNames array to people format
      normalizedDoc.people = doc.allNames.map((name: string) => ({
        name,
        type: 'person' as const,
        frequency: 1
      }));
    }
    
    // Process place entities
    if (Array.isArray(doc.places)) {
      normalizedDoc.places = doc.places;
      // Debug: Log the first place to understand structure
      if (doc.places.length > 0) {
        // console.log(`Processing place from 'places': `, JSON.stringify(doc.places[0]));
      }
    } else if (Array.isArray(doc.locations)) {
      // Convert locations array to places format
      normalizedDoc.places = doc.locations.map((name: string) => ({
        name,
        type: 'place' as const,
        frequency: 1
      }));
      // Debug: Log the first place after conversion
      if (normalizedDoc.places.length > 0) {
        // console.log(`Converted place from 'locations': `, JSON.stringify(normalizedDoc.places[0]));
      }
    } else if (doc.allPlaces && Array.isArray(doc.allPlaces)) {
      // Convert allPlaces array to places format
      normalizedDoc.places = doc.allPlaces.map((name: string) => ({
        name,
        type: 'place' as const,
        frequency: 1
      }));
      // Debug: Log the first place after conversion
      if (normalizedDoc.places.length > 0) {
        // console.log(`Converted place from 'allPlaces': `, JSON.stringify(normalizedDoc.places[0]));
      }
    }
    
    // Process keywords if available
    if (Array.isArray(doc.keywords)) {
      // normalizedDoc.keywords = doc.keywords;
    } else if (Array.isArray(doc.terms)) {
      // normalizedDoc.keywords = doc.terms;
    } else if (Array.isArray(doc.objects)) {
      // THIS IS THE ONLY ONE THAT HAS DATA IN IT
      normalizedDoc.keywords = doc.objects;
    }
    
    return normalizedDoc;
  });
};

// Sample data generator for fallback
const getSampleDocuments = (): DocumentNode[] => {
  console.log('[CHRONOSPHERE] SAMPLE DATA USED: Built-in sample data');
  
  // Calculate base API path for the content URLs
  const basePath = typeof window !== 'undefined' 
    ? `/api/jfk`
    : '/api/jfk';
  
  return ensureDocumentNodeType([
    {
      id: "sample-doc1",
      title: "JFK Assassination Report",
      date: "1963-11-22",
      agency: "FBI",
      summary: "Initial findings on the assassination of President Kennedy.",
      people: [
        { name: "John F. Kennedy", type: "person" as const, frequency: 8 },
        { name: "Lee Harvey Oswald", type: "person" as const, frequency: 12 },
        { name: "Jack Ruby", type: "person" as const, frequency: 5 },
        { name: "J. Edgar Hoover", type: "person" as const, frequency: 3 },
        { name: "Marina Oswald", type: "person" as const, frequency: 2 }
      ],
      places: [
        { name: "Dallas", type: "place" as const, frequency: 10 },
        { name: "Dealey Plaza", type: "place" as const, frequency: 7 },
        { name: "Texas School Book Depository", type: "place" as const, frequency: 6 },
        { name: "Parkland Memorial Hospital", type: "place" as const, frequency: 4 }
      ],
      objects: ["hello"],
      keywords: ["hello"],
      contentUrl: `${basePath}/documents/sample-doc1`
    },
    {
      id: "sample-doc2",
      title: "Oswald Background Investigation",
      date: "1963-11-24",
      agency: "CIA",
      summary: "Comprehensive background on Lee Harvey Oswald's history, travel to Russia, and political activities.",
      people: [
        { name: "Lee Harvey Oswald", type: "person" as const, frequency: 15 },
        { name: "Marina Oswald", type: "person" as const, frequency: 8 },
        { name: "George de Mohrenschildt", type: "person" as const, frequency: 3 },
        { name: "Ruth Paine", type: "person" as const, frequency: 2 }
      ],
      places: [
        { name: "Soviet Union", type: "place" as const, frequency: 9 },
        { name: "New Orleans", type: "place" as const, frequency: 6 },
        { name: "Dallas", type: "place" as const, frequency: 5 },
        { name: "Mexico City", type: "place" as const, frequency: 3 }
      ],
      objects: ["world"],
      keywords: ["world"],
      contentUrl: `${basePath}/documents/sample-doc2`
    },
    // {
    //   id: "sample-doc3",
    //   title: "Warren Commission Report - Conclusions",
    //   date: "1964-09-24",
    //   agency: "Warren Commission",
    //   summary: "Final conclusions of the Warren Commission investigation into the assassination of President Kennedy.",
    //   people: [
    //     { name: "Earl Warren", type: "person" as const, frequency: 7 },
    //     { name: "Lee Harvey Oswald", type: "person" as const, frequency: 14 },
    //     { name: "John F. Kennedy", type: "person" as const, frequency: 10 },
    //     { name: "Jack Ruby", type: "person" as const, frequency: 5 }
    //   ],
    //   places: [
    //     { name: "Dallas", type: "place" as const, frequency: 8 },
    //     { name: "Washington DC", type: "place" as const, frequency: 5 },
    //     { name: "Dealey Plaza", type: "place" as const, frequency: 4 }
    //   ],
    //   keywords: ["lone gunman", "evidence", "testimony", "ballistics", "autopsy"],
    //   contentUrl: `${basePath}/documents/sample-doc3`
    // }
  ]);
};

// Function that fetches real documents
const fetchDocumentsFromDatabase = async (): Promise<DocumentNode[]> => {
  try {
    const isDevelopment = process.env.NODE_ENV === 'development';
    console.log(`[CHRONOSPHERE] Environment: ${isDevelopment ? 'DEVELOPMENT' : 'PRODUCTION'}`);
    
    // Calculate base API path - handle different deployment scenarios
    // const basePath = typeof window !== 'undefined' 
    //   ? `/api/jfk`
    //   : '/api/jfk';

    const basePath = '/api/jfk';
    
    console.log(`[CHRONOSPHERE] Using API base path: ${basePath}`);
    
    // Variable to track if we've had API access issues
    let apiAccessFailed = false;
    
    // // Try approach 1: Get documents from debug API first to check database status
    // console.log('[CHRONOSPHERE] Checking database status...');
    // try {
    //   const debugResponse = await fetch(`${basePath}/debug`);
      
    //   if (debugResponse.ok) {
    //     const debugData = await debugResponse.json();
        
    //     if (debugData.status === 'success') {
    //       console.log(`[CHRONOSPHERE] Database has ${debugData.totalDocuments} total documents`);
    //     } else if (debugData.databaseConnectionError) {
    //       console.error('[CHRONOSPHERE] Database connection error detected');
    //       throw new Error('DB_CONNECTION_ERROR');
    //     } else if (debugData.databaseError) {
    //       console.error('[CHRONOSPHERE] Database client error detected');
    //       throw new Error('DB_CLIENT_ERROR');
    //     }
    //   } else {
    //     const errorText = await debugResponse.text();
    //     console.error('[CHRONOSPHERE] Debug API error:', debugResponse.status);
    //     apiAccessFailed = true;
        
    //     if (debugResponse.status !== 401) {
    //       throw new Error(`Debug API error: ${debugResponse.status} ${debugResponse.statusText}`);
    //     }
    //   }
    // } catch (error) {
    //   apiAccessFailed = true;
    //   if (String(error).includes('DB_CONNECTION_ERROR') || String(error).includes('DB_CLIENT_ERROR')) {
    //     throw error;
    //   }
    //   console.error('[CHRONOSPHERE] Error checking database status:', error);
    //   // Continue to the next approach, don't throw yet
    // }
    
    // // If debug failed and we're in development, use built-in sample data
    // if (apiAccessFailed && isDevelopment) {
    //   console.log('[CHRONOSPHERE] Multiple API failures, using built-in sample data');
    //   return getSampleDocuments();
    // }
    
    // Try to fetch real documents from our new visualization API endpoint
    try {
      console.log('[CHRONOSPHERE] Fetching documents from visualization API...');
      
      // Use our new API endpoint to get real data
      const response = await fetch(`${basePath}/visualization?limit=20`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch visualization data: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.status === 'success' && Array.isArray(data.documents) && data.documents.length > 0) {
        console.log(`[CHRONOSPHERE] Successfully fetched ${data.documents.length} real documents from database`);
        return ensureDocumentNodeType(data.documents);
      } else {
        console.warn('[CHRONOSPHERE] Visualization API returned no documents or invalid format');
        throw new Error('No documents returned from visualization API');
      }
    } catch (error) {
      console.error('[CHRONOSPHERE] Error fetching from visualization API:', error);
      
      // If we're still here, try the sample visualization API as a fallback
      try {
        console.log('[CHRONOSPHERE] Falling back to sample visualization API...');
        const sampleResponse = await fetch(`${basePath}/sample-visualization`);
        
        if (!sampleResponse.ok) {
          throw new Error(`Failed to fetch from sample API: ${sampleResponse.status} ${sampleResponse.statusText}`);
        }
        
        const sampleData = await sampleResponse.json();
        
        if (sampleData.status === 'success' && Array.isArray(sampleData.documents) && sampleData.documents.length > 0) {
          console.log(`[CHRONOSPHERE] Using ${sampleData.documents.length} documents from sample API`);
          return ensureDocumentNodeType(sampleData.documents);
        } else {
          console.warn('[CHRONOSPHERE] Sample API returned no valid documents');
          throw new Error('No valid sample documents returned');
        }
      } catch (sampleError) {
        console.error('[CHRONOSPHERE] Error fetching from sample API:', sampleError);
        
        // Last resort - use built-in sample data
        console.log('[CHRONOSPHERE] Using built-in sample documents as last resort');
        return getSampleDocuments();
      }
    }
  } catch (error) {
    console.error('[CHRONOSPHERE] Global error in fetchDocumentsFromDatabase:', error);
    
    // Use built-in sample data as the final fallback
    return getSampleDocuments();
  }
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.oip.onl';

export default function Chronosphere({
  width = 960,
  height = 600,
  onNodeClick,
  searchType = 'all',
  searchValue = '',
  startDate = '',
  endDate = '',
  onSearch,
  onDateUpdate
}: ChronosphereProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const svgRef = useRef<SVGSVGElement>(null);
  const svgGroupRef = useRef<SVGGElement | null>(null);
  const router = useRouter();
  
  // State
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [documents, setDocuments] = useState<DocumentNode[]>([]);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [svgTransform, setSvgTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [selectedTerms, setSelectedTerms] = useState<string[]>([]);
  const [isShiftKeyPressed, setIsShiftKeyPressed] = useState<boolean>(false);
  const [showSampleOption, setShowSampleOption] = useState<boolean>(false);
  const [dbConnectionError, setDbConnectionError] = useState<boolean>(false);
  const [emptyDatabase, setEmptyDatabase] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  // Add state for date range that can be updated by the history replayer
  const [currentStartDate, setCurrentStartDate] = useState<string>(startDate);
  const [currentEndDate, setCurrentEndDate] = useState<string>(endDate);

  // Update local dates when props change
  useEffect(() => {
    setCurrentStartDate(startDate);
    setCurrentEndDate(endDate);
  }, [startDate, endDate]);

  // Handler for history replayer date updates
  const handleDateUpdate = useCallback((newStart: string, newEnd: string) => {
    setCurrentStartDate(newStart);
    setCurrentEndDate(newEnd);
    
    // Call the parent component's onDateUpdate prop if it exists
    if (onDateUpdate) {
      onDateUpdate(newStart, newEnd);
    }
    
    // Update document visualization without full reload
    // This will update the dates without a complete re-render
    const updateVisualizationForNewDates = async () => {
      setIsLoading(true);
      
      // Build API query parameters based on new dates
      const params = new URLSearchParams();
      
      // Add the new date range
      params.append('startDate', newStart);
      params.append('endDate', newEnd);
      
      // Add any existing search parameters
      if (searchValue && searchType && searchType !== 'all') {
        params.append(searchType, searchValue);
      } else if (searchValue) {
        params.append('q', searchValue);
      }
      
      params.append('limit', '20'); // Keep the document limit
      
      try {
        // Fetch new documents based on updated date range
        const apiPath = `/api/jfk/search?${params.toString()}`;
        const response = await fetch(apiPath);
        
        if (response.ok) {
          const data = await response.json();
          
          // Check if we have documents
          if (data && Array.isArray(data.documents) && data.documents.length > 0) {
            // Process new documents
            const newDocuments = ensureDocumentNodeType(data.documents);
            
            // Update the state
            setDocuments(newDocuments);
      setIsLoading(false);
            
            // Run visualization update to reposition connections and nodes
            if (svgGroupRef.current) {
              // Note: The useEffect for document changes will handle the visualization update
            }
          } else if (data && Array.isArray(data.results) && data.results.length > 0) {
            // Alternative format
            setDocuments(ensureDocumentNodeType(data.results));
            setIsLoading(false);
          } else {
            // No documents found for this time range
            console.log(`No documents found for date range: ${newStart} to ${newEnd}`);
            setDocuments([]);
            setIsLoading(false);
          }
        } else {
          // API error - keep existing visualization
          console.warn(`API error when updating dates: ${response.status}`);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error updating visualization for new dates:', error);
        setIsLoading(false);
      }
    };
    
    // Update the visualization for the new dates
    updateVisualizationForNewDates();
    
    // Update any UI elements with the new dates if needed
    // This function can be expanded if we need to update more UI elements
    const updateDateInputs = () => {
      // Try to find date input elements
      const startDateInput = document.querySelector('input[type="date"][value*="-"]') as HTMLInputElement;
      const endDateInput = document.querySelectorAll('input[type="date"][value*="-"]')[1] as HTMLInputElement;
      
      if (startDateInput) {
        startDateInput.value = newStart;
      }
      
      if (endDateInput) {
        endDateInput.value = newEnd;
      }
    };
    
    updateDateInputs();
    
  }, [searchValue, searchType, onDateUpdate]);

  // Load initial data
  const loadData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Handle search parameters
      let documents: DocumentNode[] = [];
      
      // Build API query parameters based on search inputs
      const params = new URLSearchParams();
      let hasSearchParameter = false;
      
      // Log our search parameters to help debug
      console.log('[CHRONOSPHERE] Search parameters:');
      console.log(`  searchType: ${searchType}`);
      console.log(`  searchValue: ${searchValue}`);
      console.log(`  startDate: ${startDate}`);
      console.log(`  endDate: ${endDate}`);
      
      if (searchValue) {
        hasSearchParameter = true;
        // Add search query based on type
        if (searchType === 'person') {
          params.append('person', searchValue);
          console.log(`[CHRONOSPHERE] Added parameter: person=${searchValue}`);
          
          // We'll update selected terms later when search completes
        } else if (searchType === 'place') {
          params.append('place', searchValue);
          console.log(`[CHRONOSPHERE] Added parameter: place=${searchValue}`);
          
          // We'll update selected terms later when search completes
        } else if (searchType === 'text') {
          params.append('q', searchValue);
          console.log(`[CHRONOSPHERE] Added parameter: q=${searchValue}`);
          
          // We'll update selected terms later when search completes
        } else if (searchType === 'all' && searchValue.trim()) {
          // If "all" type but we have a search value, search as text
          params.append('q', searchValue);
          console.log(`[CHRONOSPHERE] Added parameter: q=${searchValue}`);
          
          // We'll update selected terms later when search completes
        }
      }
      
      // Add date range if specified
      if (startDate) {
        params.append('startDate', startDate);
        console.log(`[CHRONOSPHERE] Added parameter: startDate=${startDate}`);
        hasSearchParameter = true;
      }
      if (endDate) {
        params.append('endDate', endDate);
        console.log(`[CHRONOSPHERE] Added parameter: endDate=${endDate}`);
        hasSearchParameter = true;
      }
      
      // If no search parameters are provided, add a default date range
      if (!hasSearchParameter) {
        console.log('[CHRONOSPHERE] No search parameters provided, using default date range');
        params.append('startDate', '1963-11-01');
        console.log(`[CHRONOSPHERE] Added default parameter: startDate=1963-11-01`);
        params.append('endDate', '1963-11-30');
        console.log(`[CHRONOSPHERE] Added default parameter: endDate=1963-11-30`);
      }
      
      // Set limit for number of documents to fetch
      params.append('limit', '20');
      
      console.log(`[CHRONOSPHERE] Loading data with params: ${params.toString()}`);
      
      // First try the search endpoint if we have search parameters
      if (params.toString()) {
        try {
          // Construct the API path using the search endpoint
          const searchApiPath = `https://api.oip.onl/api/jfk/search?${params.toString()}`;
          console.log(`[CHRONOSPHERE] Searching with: ${searchApiPath}`);
          
          const response = await fetch(searchApiPath);
          
          if (response.ok) {
            const data = await response.json();
            console.log('[CHRONOSPHERE] Search API response:', data);
            
            // Check if the response contains documents in the expected format
            if (data && Array.isArray(data.documents) && data.documents.length > 0) {
              console.log(`[CHRONOSPHERE] Fetched ${data.documents.length} documents from search endpoint`);
              documents = ensureDocumentNodeType(data.documents);
              
              // Now that search was successful, update selected terms
              if (searchValue && searchType) {
                if (searchType === 'person') {
                  updateSelectedTerms('person', searchValue);
                } else if (searchType === 'place') {
                  updateSelectedTerms('place', searchValue);
                } else if (searchType === 'text' || searchType === 'all') {
                  updateSelectedTerms('text', searchValue);
                } else if (searchType === 'object') {
                  updateSelectedTerms('object', searchValue);
                }
              }
              
              // Also add date filter if dates were specified
              if (startDate && endDate) {
                const dateFilterText = `date:${startDate} to ${endDate}`;
                updateSelectedTerms('date', `${startDate} to ${endDate}`);
              }
            } else if (data && Array.isArray(data.results) && data.results.length > 0) {
              // Alternative format with 'results' key
              console.log(`[CHRONOSPHERE] Fetched ${data.results.length} documents from search endpoint (results format)`);
              documents = ensureDocumentNodeType(data.results);
              
              // Now that search was successful, update selected terms
              if (searchValue && searchType) {
                if (searchType === 'person') {
                  updateSelectedTerms('person', searchValue);
                } else if (searchType === 'place') {
                  updateSelectedTerms('place', searchValue);
                } else if (searchType === 'text' || searchType === 'all') {
                  updateSelectedTerms('text', searchValue);
                } else if (searchType === 'object') {
                  updateSelectedTerms('object', searchValue);
                }
              }
              
              // Also add date filter if dates were specified
              if (startDate && endDate) {
                const dateFilterText = `date:${startDate} to ${endDate}`;
                updateSelectedTerms('date', `${startDate} to ${endDate}`);
              }
            } else if (data && Array.isArray(data) && data.length > 0) {
              // Direct array format
              console.log(`[CHRONOSPHERE] Fetched ${data.length} documents from search endpoint (direct array format)`);
              documents = ensureDocumentNodeType(data);
            } else {
              console.log('[CHRONOSPHERE] Search returned no results, showing empty state');
              console.log('Response data structure:', JSON.stringify(data));
              // Try to identify if the response has any documents under a different key
              const possibleDocArrays = Object.keys(data || {}).filter(key => 
                Array.isArray(data[key]) && data[key].length > 0 && data[key][0]?.id
              );
              
              if (possibleDocArrays.length > 0) {
                const firstKey = possibleDocArrays[0];
                console.log(`[CHRONOSPHERE] Found documents under key: ${firstKey}`);
                documents = ensureDocumentNodeType(data[firstKey]);
              } else {
                // Keep documents empty array to show "no results" state
                // But let's check the visualization endpoint as a backup
                documents = await fetchDocumentsFromVisualizationEndpoint(params);
              }
            }
          } else {
            // Log response status and try to get error details
            console.warn(`[CHRONOSPHERE] Search endpoint failed with status: ${response.status}`);
            try {
              const errorText = await response.text();
              console.warn('[CHRONOSPHERE] Error response:', errorText);
            } catch (e) {
              console.warn('[CHRONOSPHERE] Could not read error response');
            }
            
            // Fall back to visualization endpoint if search fails
            console.warn('[CHRONOSPHERE] Trying visualization endpoint as fallback');
            documents = await fetchDocumentsFromVisualizationEndpoint(params);
          }
        } catch (searchError) {
          console.error('[CHRONOSPHERE] Search endpoint error:', searchError);
          // Fall back to visualization endpoint
          documents = await fetchDocumentsFromVisualizationEndpoint(params);
        }
      } else {
        // If no search parameters, just fetch from visualization endpoint
        documents = await fetchDocumentsFromVisualizationEndpoint(params);
      }
      
      setDocuments(documents);
      setIsLoading(false);
      
      // After data is loaded and displayed, call onSearch callback
      if (onSearch) {
        onSearch();
      }
    } catch (err) {
      console.error("Error loading data:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
      setIsLoading(false);
    }
  };

  // Helper function to update selected terms for Active Filters
  const updateSelectedTerms = (type: string, value: string) => {
    if (!value.trim()) return;
    
    // Format the term with type prefix similar to when clicking on cloud terms
    const searchKey = type !== 'all' ? `${type}:${value}` : value;
    
    // Update selected terms without replacing existing ones from the word cloud
    setSelectedTerms(prevTerms => {
      // Check if this term is already in the list
      if (prevTerms.includes(searchKey)) {
        return prevTerms;
      }
      
      // Find and remove any previous search terms of the same type
      const filteredTerms = prevTerms.filter(term => {
        // If term has a prefix (like "person:"), check if it matches the current type
        if (term.includes(':')) {
          const [termType] = term.split(':');
          return termType !== type;
        }
        // Keep terms that don't match the current pattern
        return true;
      });
      
      // Add the new term
      return [...filteredTerms, searchKey];
    });
    
    // Save to localStorage for persistence
    try {
      localStorage.setItem('chronosphereSearchTerms', JSON.stringify([...selectedTerms, searchKey]));
    } catch (e) {
      console.warn('Failed to save search terms to localStorage:', e);
    }
  };

  // Helper function to fetch from visualization endpoint
  const fetchDocumentsFromVisualizationEndpoint = async (params: URLSearchParams): Promise<DocumentNode[]> => {
    try {
      // Construct the API path
      const apiPath = `/api/jfk/visualization?${params.toString()}`;
      
      console.log(`[CHRONOSPHERE] Trying visualization endpoint: ${apiPath}`);
      
      const response = await fetch(apiPath);
      
      if (response.ok) {
        const data = await response.json();
        console.log('[CHRONOSPHERE] Visualization API response:', data);
        
        // Check for different possible data formats
        if (data.status === 'success' && Array.isArray(data.documents) && data.documents.length > 0) {
          console.log(`[CHRONOSPHERE] Fetched ${data.documents.length} documents from visualization endpoint`);
          return ensureDocumentNodeType(data.documents);
        } else if (Array.isArray(data.results) && data.results.length > 0) {
          console.log(`[CHRONOSPHERE] Fetched ${data.results.length} documents from results key`);
          return ensureDocumentNodeType(data.results);
        } else if (Array.isArray(data) && data.length > 0) {
          console.log(`[CHRONOSPHERE] Fetched ${data.length} documents from direct array`);
          return ensureDocumentNodeType(data);
        } else {
          console.warn('[CHRONOSPHERE] Visualization API returned no documents');
          console.log('Response data structure:', JSON.stringify(data));
          
          // Try to identify if the response has any documents under a different key
          const possibleDocArrays = Object.keys(data || {}).filter(key => 
            Array.isArray(data[key]) && data[key].length > 0 && data[key][0]?.id
          );
          
          if (possibleDocArrays.length > 0) {
            const firstKey = possibleDocArrays[0];
            console.log(`[CHRONOSPHERE] Found documents under key: ${firstKey}`);
            return ensureDocumentNodeType(data[firstKey]);
          } else {
            // Fall back to built-in sample data
            console.warn('[CHRONOSPHERE] No documents found in visualization API, falling back to sample data');
            return await fetchDocumentsFromDatabase();
          }
        }
      } else {
        // Log response status and try to get error details
        console.warn(`[CHRONOSPHERE] Visualization endpoint failed with status: ${response.status}`);
        try {
          const errorText = await response.text();
          console.warn('[CHRONOSPHERE] Error response:', errorText);
        } catch (e) {
          console.warn('[CHRONOSPHERE] Could not read error response');
        }
        
        // Fall back to built-in data
        console.warn('[CHRONOSPHERE] Visualization endpoint failed, using fallback data');
        return await fetchDocumentsFromDatabase();
      }
    } catch (error) {
      console.error('[CHRONOSPHERE] Error fetching from visualization endpoint:', error);
      // Fall back to default method
      return await fetchDocumentsFromDatabase();
    }
  };

  // Load data when search parameters change
  useEffect(() => {
    console.log('[CHRONOSPHERE] Search parameters changed, loading data', {
      searchType,
      searchValue,
      startDate,
      endDate
    });
    loadData();
  }, [searchType, searchValue, startDate, endDate]);
  
  // Track shift key state
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setIsShiftKeyPressed(true);
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setIsShiftKeyPressed(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);
  
  // Handle term/entity selection
  const handleTermClick = useCallback((term: string, prefix: string = '') => {
    // Create search key with optional prefix
    const searchKey = prefix ? `${prefix}:${term}` : term;
    
    setSelectedTerms(prevTerms => {
      // Check if term is already selected
      if (prevTerms.includes(searchKey)) {
        // Remove it if already selected
        return prevTerms.filter(t => t !== searchKey);
      } else {
        // Add to existing terms if shift is pressed, otherwise replace
        return isShiftKeyPressed ? [...prevTerms, searchKey] : [searchKey];
      }
    });
    
    // If onSearch is provided, trigger search with updated term
    if (onSearch) {
      // Try multiple selectors to find the search input
      const searchInput = 
        document.querySelector('input[placeholder="Search all..."]') || 
        document.querySelector('input[value*="Search"]') ||
        document.querySelector('.search-input') ||
        document.querySelector('input[type="search"]') ||
        document.querySelector('input[placeholder*="Search"]');
      
      if (searchInput && searchInput instanceof HTMLInputElement) {
        // Calculate the new search terms
        const newTerms = (prevTerms: string[]) => {
          if (prevTerms.includes(searchKey)) {
            return prevTerms.filter((t: string) => t !== searchKey);
          } else {
            return isShiftKeyPressed ? [...prevTerms, searchKey] : [searchKey];
          }
        };
        
        const updatedTerms = newTerms(selectedTerms);
        
        // Extract the search type and value from the term
        let newSearchType = 'all';
        let newSearchValue = '';
        
        if (searchKey.includes(':')) {
          const [type, value] = searchKey.split(':');
          newSearchType = type;
          newSearchValue = value;
        } else {
          newSearchType = 'text';
          newSearchValue = term;
        }
        
        // Update the input value
        searchInput.value = newSearchValue;
        
        // Create a visual flash effect on the search box to show it was updated
        const originalBackground = searchInput.style.backgroundColor;
        searchInput.style.backgroundColor = isDark ? '#0f766e' : '#d1fae5'; // Green flash
        searchInput.style.transition = 'background-color 0.5s';
        
        // Reset after animation
        setTimeout(() => {
          searchInput.style.backgroundColor = originalBackground;
        }, 500);
        
        // Focus the input so the user sees the cursor
        searchInput.focus();
        
        // Store the terms in localStorage to prevent disappearing
        try {
          localStorage.setItem('chronosphereSearchTerms', JSON.stringify(updatedTerms));
        } catch (e) {
          console.warn('Failed to save search terms to localStorage:', e);
        }
        
        // Update the search type in the UI if possible
        try {
          // Find search type buttons and update selection
          const typeButtons = document.querySelectorAll('[role="tab"]');
          typeButtons.forEach((button) => {
            if (button instanceof HTMLElement && button.textContent?.toLowerCase().includes(newSearchType)) {
              button.click();
            }
          });
        } catch (e) {
          console.warn('Failed to update search type in UI:', e);
        }
        
        // Trigger the search
        setTimeout(() => {
          onSearch();
          
          // After search is triggered, restore the search value in case it was cleared
          setTimeout(() => {
            if (searchInput.value === '' && newSearchValue) {
              searchInput.value = newSearchValue;
            }
          }, 200);
        }, 100);
        
        // Log to console for debugging
        console.log('Updated search to:', updatedTerms);
      } else {
        console.warn('Search input not found');
      }
    }
  }, [isShiftKeyPressed, onSearch, selectedTerms, isDark]);

  // Add useEffect to restore search terms from localStorage and initialize from URL params on component mount
  useEffect(() => {
    // First check if we have search values from props - if so, they should override stored terms
    if (searchValue || startDate || endDate) {
      let newSelectedTerms = [...selectedTerms];
      
      // Add search value as a term if provided
      if (searchValue) {
        const searchKey = searchType !== 'all' ? `${searchType}:${searchValue}` : searchValue;
        if (!newSelectedTerms.includes(searchKey)) {
          newSelectedTerms = newSelectedTerms.filter(term => {
            // Remove any existing terms of the same type
            if (term.includes(':')) {
              const [termType] = term.split(':');
              return termType !== searchType;
            }
            return true;
          });
          
          newSelectedTerms.push(searchKey);
        }
      }
      
      // Add date filters if provided
      if (startDate && endDate) {
        // Format as ISO date strings or date ranges for display
        const dateFilterText = `date:${startDate} to ${endDate}`;
        
        // Remove any existing date filters
        newSelectedTerms = newSelectedTerms.filter(term => !term.startsWith('date:'));
        
        // Add the new date filter
        newSelectedTerms.push(dateFilterText);
      }
      
      setSelectedTerms(newSelectedTerms);
      
      // Update localStorage with the new terms
      try {
        localStorage.setItem('chronosphereSearchTerms', JSON.stringify(newSelectedTerms));
      } catch (e) {
        console.warn('Failed to save search terms to localStorage:', e);
      }
    } else {
      // If no search parameters provided via props, try to restore from localStorage
    try {
      const savedTerms = localStorage.getItem('chronosphereSearchTerms');
      if (savedTerms) {
        const parsedTerms = JSON.parse(savedTerms);
        setSelectedTerms(parsedTerms);
      }
    } catch (e) {
      console.warn('Failed to restore search terms from localStorage:', e);
    }
    }
  }, [searchValue, searchType, startDate, endDate]);

  // Handle zoom controls
  const handleZoom = useCallback((direction: 'in' | 'out') => {
    if (!svgRef.current) return;
    
    const newZoom = direction === 'in' 
      ? Math.min(zoomLevel + 0.2, 2.5) 
      : Math.max(zoomLevel - 0.2, 0.5);
    
    // Calculate center of SVG
    const svgWidth = svgRef.current.clientWidth;
    const svgHeight = svgRef.current.clientHeight;
    const centerX = svgWidth / 2;
    const centerY = svgHeight / 2;
    
    // Calculate transformation
    const oldScale = svgTransform.scale;
    const scaleFactor = newZoom / oldScale;
    const newX = centerX - scaleFactor * (centerX - svgTransform.x);
    const newY = centerY - scaleFactor * (centerY - svgTransform.y);
    
    setZoomLevel(newZoom);
    setSvgTransform({ x: newX, y: newY, scale: newZoom });
    
    if (svgGroupRef.current) {
      d3.select(svgGroupRef.current)
        .transition()
        .duration(300)
        .attr('transform', `translate(${newX}, ${newY}) scale(${newZoom})`);
    }
  }, [zoomLevel, svgTransform]);
  
  // Reset view to default
  const resetView = useCallback(() => {
    setZoomLevel(1);
    setSvgTransform({ x: 0, y: 0, scale: 1 });
    
    if (svgGroupRef.current) {
      d3.select(svgGroupRef.current)
        .transition()
        .duration(300)
        .attr('transform', 'translate(0, 0) scale(1)');
    }
  }, []);

  // Create visualization when documents change
  useEffect(() => {
    if (!documents.length || !svgRef.current) return;
    
    // Clear any existing visualization
    d3.select(svgRef.current).selectAll('*').remove();
    
    // Create main SVG group
    const svg = d3.select(svgRef.current)
      .append('g')
      .attr('class', 'visualization-group');
    
    // Store reference
    svgGroupRef.current = svg.node() as SVGGElement;
    
    // Apply current transform
    svg.attr('transform', `translate(${svgTransform.x}, ${svgTransform.y}) scale(${svgTransform.scale})`);
    
    // Add a background path for better mouse interaction
    svg.append('rect')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', 'transparent');
    
    // Create layers for connections and documents
    // Order matters in SVG - later elements appear on top
    const connectionsGroup = svg.append('g').attr('class', 'connections-layer'); // First (bottom) layer
    const documentsGroup = svg.append('g').attr('class', 'documents-layer'); // Middle layer
    
    // Create central cloud group - directly in the SVG (not in wordCloudGroup) 
    // to ensure proper drawing order
    // We'll add the actual content later to ensure it's drawn last
    const centralCloudPlaceholder = svg.append('g')
      .attr('class', 'central-word-cloud-placeholder')
      .attr('transform', `translate(${width / 2}, ${height * 0.5})`);
    
    // Create the actual word cloud group that will be populated later
    // This technique ensures it's drawn LAST
    const wordCloudGroup = svg.append('g').attr('class', 'word-cloud-layer'); // Last (top) layer
    
    // Position documents in a ring
    const centerX = width / 2;
    const centerY = height / 2;
    const angleStep = (2 * Math.PI) / documents.length;
    
    documents.forEach((doc, index) => {
      const angle = angleStep * index;
      doc.x = centerX + ringRadius * Math.cos(angle);
      doc.y = centerY + ringRadius * Math.sin(angle);
      doc._initialX = doc.x;
      doc._initialY = doc.y;
      doc._scaleFactor = shrinkFactor;
      doc._isExpanded = false;
    });
    
    // Generate connection data based on shared entities
    const connections: Connection[] = [];
    
    for (let i = 0; i < documents.length; i++) {
      for (let j = i + 1; j < documents.length; j++) {
        const doc1 = documents[i];
        const doc2 = documents[j];
        
        // Check for shared people
        doc1.people.forEach(person1 => {
          const sharedPerson = doc2.people.find(person2 => person2.name === person1.name);
          if (sharedPerson) {
            // Ensure we have valid entity name and frequency
            const entityName = person1.name || "Unknown Person";
            const freq1 = typeof person1.frequency === 'number' ? person1.frequency : 1;
            const freq2 = typeof sharedPerson.frequency === 'number' ? sharedPerson.frequency : 1;
            const strength = Math.max(1, (freq1 + freq2) / 2);
            
            const personConnection = {
              source: doc1.id,
              target: doc2.id,
              entity: entityName,
              type: 'person' as const,
              strength: strength
            };
            
            // Debug: Log the person connection
            console.log(`[CHRONOSPHERE] Creating PERSON connection for "${entityName}" between ${doc1.id} and ${doc2.id}`);
            
            connections.push(personConnection);
          }
        });
        
        // Check for shared places
        doc1.places.forEach(place1 => {
          // Get place1 name whether it's a string or an object with name property
          const place1Name = typeof place1 === 'string' ? place1 : place1.name;
          // console.log(`[CHRONOSPHERE] Place 1: ${place1Name}`);
          
          // Find matching place in doc2 based on name, handling both formats
          const sharedPlace = doc2.places.find(place2 => {
            const place2Name = typeof place2 === 'string' ? place2 : place2.name;
            return place2Name === place1Name;
          });
          
          // Get the shared place name
          const sharedPlaceName = sharedPlace ? 
            (typeof sharedPlace === 'string' ? sharedPlace : sharedPlace.name) : 
            null;
            
          console.log(`[CHRONOSPHERE] Shared place: ${sharedPlaceName}`);
          
          if (sharedPlace) {
            console.log(`[CHRONOSPHERE] Shared place found: ${place1Name} and ${sharedPlaceName}`);
            
            // Use the extracted name
            const entityName = place1Name;
            console.log(`[CHRONOSPHERE] Entity name: ${entityName}`);
            
            // Get frequencies, default to 1 if not available
            const freq1 = typeof place1 === 'object' && typeof place1.frequency === 'number' ? place1.frequency : 1;
            const freq2 = typeof sharedPlace === 'object' && typeof sharedPlace.frequency === 'number' ? sharedPlace.frequency : 1;
            const strength = Math.max(1, (freq1 + freq2) / 2);
            
            const placeConnection = {
              source: doc1.id,
              target: doc2.id,
              entity: entityName,
              type: 'place' as const,
              strength: strength
            };
            
            // Debug: Log the place connection
            console.log(`[CHRONOSPHERE] Creating PLACE connection for "${entityName}" between ${doc1.id} and ${doc2.id}`);
            
            connections.push(placeConnection);
          }
        });
      }
    }
    
    // Log connection data to debug colors
    console.log('[CHRONOSPHERE] Connection types:', {
      total: connections.length,
      personConnections: connections.filter(c => c.type === 'person').length,
      placeConnections: connections.filter(c => c.type === 'place').length
    });

    if (connections.length > 0) {
      // Log EVERY connection type to verify data
      connections.forEach((conn, idx) => {
        if (idx < 10) { // Limit to first 10 to avoid flooding console
          console.log(`[CHRONOSPHERE] Connection ${idx}: type=${conn.type}, entity=${conn.entity}, from=${conn.source} to=${conn.target}, strength=${conn.strength}`);
        }
      });
      
      // Log person connections specifically
      const personConns = connections.filter(c => c.type === 'person');
      console.log(`[CHRONOSPHERE] Found ${personConns.length} person connections:`);
      personConns.forEach((conn, idx) => {
        console.log(`  Person connection ${idx}: entity=${conn.entity}, from=${conn.source} to=${conn.target}`);
      });
      
      console.log('[CHRONOSPHERE] Sample connection:', connections[0]);
    }
    
    // Ensure we create separate line types - COMPLETELY SEPARATED by type
    // Person connections first
    const personConnections = connections.filter(c => c.type === 'person');
    connectionsGroup
      .selectAll('.connection-person')
      .data(personConnections)
      .enter()
      .append('line')
      .attr('class', 'connection connection-person')
      .attr('stroke', '#4287f5') // Brighter blue
      .attr('stroke-width', 5) // Even thicker
      .attr('stroke-opacity', 0.6) // Slightly more opaque
      .attr('stroke-dasharray', '10,5') // Dashed line pattern
      .attr('data-entity', d => d.entity)
      .attr('data-type', 'person')
      .attr('filter', 'url(#blue-glow)') // Add glow effect
      .attr('x1', d => {
        const sourceDoc = documents.find(doc => doc.id === d.source);
        return sourceDoc?._initialX || 0;
      })
      .attr('y1', d => {
        const sourceDoc = documents.find(doc => doc.id === d.source);
        return sourceDoc?._initialY || 0;
      })
      .attr('x2', d => {
        const targetDoc = documents.find(doc => doc.id === d.target);
        return targetDoc?._initialX || 0;
      })
      .attr('y2', d => {
        const targetDoc = documents.find(doc => doc.id === d.target);
        return targetDoc?._initialY || 0;
      });

    // Add subtle animation to person connections to make them even more visible
    connectionsGroup.selectAll<SVGLineElement, Connection>('.connection-person')
      .attr('stroke-dasharray', '10,5')  // Use attr instead of style for dasharray
      .style('animation', 'dash 1s linear infinite');

    // Add animation keyframes to the defs section
    svg.select('defs')
      .append('style')
      .text(`
        @keyframes dash {
          to {
            stroke-dashoffset: 15;
          }
        }
      `);
    
    // Define glow filter in defs
    const blueGlow = svg.select('defs').append('filter')
      .attr('id', 'blue-glow')
      .attr('x', '-40%')
      .attr('y', '-40%')
      .attr('width', '180%')
      .attr('height', '180%');

    blueGlow.append('feGaussianBlur')
      .attr('stdDeviation', '6')
      .attr('result', 'coloredBlur');

    const blueGlowMerge = blueGlow.append('feMerge');
    blueGlowMerge.append('feMergeNode').attr('in', 'coloredBlur');
    blueGlowMerge.append('feMergeNode').attr('in', 'SourceGraphic');
    
    // Place connections second
    const placeConnections = connections.filter(c => c.type === 'place');
    connectionsGroup
      .selectAll('.connection-place')
      .data(placeConnections)
      .enter()
      .append('line')
      .attr('class', 'connection connection-place')
      .attr('stroke', '#ef4444')
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.3) // Reduced from 0.5 to 0.15 for much lower visibility
      .style('opacity', 0.3) // Also set opacity as a style for SVG
      .attr('data-entity', d => d.entity)
      .attr('data-type', 'place')
      .attr('x1', d => {
        const sourceDoc = documents.find(doc => doc.id === d.source);
        return sourceDoc?._initialX || 0;
      })
      .attr('y1', d => {
        const sourceDoc = documents.find(doc => doc.id === d.source);
        return sourceDoc?._initialY || 0;
      })
      .attr('x2', d => {
        const targetDoc = documents.find(doc => doc.id === d.target);
        return targetDoc?._initialX || 0;
      })
      .attr('y2', d => {
        const targetDoc = documents.find(doc => doc.id === d.target);
        return targetDoc?._initialY || 0;
      });
    
    // We will use these separate collections for highlights instead of the combined links
    // Log some connection info for debugging
    if (connections.length > 0) {
      const personConnections = connections.filter(c => c.type === 'person').length;
      const placeConnections = connections.filter(c => c.type === 'place').length;
      console.log(`[CHRONOSPHERE] Connections by type: ${personConnections} person connections (${entityColors.person}), ${placeConnections} place connections (${entityColors.place})`);
    }
    
    // Update connection positions based on document positions
    const updateConnections = () => {
      connectionsGroup.selectAll<SVGLineElement, Connection>('.connection-person').each(function(d) {
        const link = d3.select(this);
        const sourceDoc = documents.find(doc => doc.id === d.source);
        const targetDoc = documents.find(doc => doc.id === d.target);
        
        if (!sourceDoc || !targetDoc) return;
        if (!sourceDoc._initialX || !sourceDoc._initialY || 
            !targetDoc._initialX || !targetDoc._initialY) return;
        
        // Use the initial positions for connection endpoints
        link
          .attr('x1', sourceDoc._initialX)
          .attr('y1', sourceDoc._initialY)
          .attr('x2', targetDoc._initialX)
          .attr('y2', targetDoc._initialY);
      });
      
      connectionsGroup.selectAll<SVGLineElement, Connection>('.connection-place').each(function(d) {
        const link = d3.select(this);
        const sourceDoc = documents.find(doc => doc.id === d.source);
        const targetDoc = documents.find(doc => doc.id === d.target);
        
        if (!sourceDoc || !targetDoc) return;
        if (!sourceDoc._initialX || !sourceDoc._initialY || 
            !targetDoc._initialX || !targetDoc._initialY) return;
        
        // Use the initial positions for connection endpoints
        link
          .attr('x1', sourceDoc._initialX)
          .attr('y1', sourceDoc._initialY)
          .attr('x2', targetDoc._initialX)
          .attr('y2', targetDoc._initialY);
      });
    };
    
    // Initial update of connection positions
    updateConnections();
    
    // Create document nodes
    const nodes = documentsGroup
      .selectAll('.document-node')
      .data(documents)
      .enter()
      .append('g')
      .attr('class', 'document-node')
      .attr('id', d => getSafeDocId(d.id));
    
    // Add background rectangles for documents
    nodes.append('rect')
      .attr('class', 'document-bg')
      .attr('width', docWidth)
      .attr('height', docHeight)
      .attr('rx', 6)
      .attr('ry', 6)
      .attr('fill', isDark ? '#1f2937' : '#ffffff')
      .attr('fill-opacity', 0.97)
      .attr('stroke', isDark ? '#374151' : '#e5e7eb')
      .attr('stroke-width', 1.5);
    
    // Add document content with improved layout similar to DocumentDock
    nodes.each(function(d: DocumentNode) {
      const g = d3.select(this);
      const headerHeight = 24;
      const tabHeight = 20;
      const contentAreaHeight = docHeight - headerHeight - tabHeight;
      
      // Document ID header bar
      g.append('rect')
        .attr('class', 'document-header-bg')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', docWidth)
        .attr('height', headerHeight)
        .attr('fill', isDark ? '#374151' : '#f3f4f6')
        .attr('rx', 6)
        .attr('ry', 6);
      
      // Ensure bottom corners aren't rounded
      g.append('rect')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', docWidth)
        .attr('height', headerHeight/2)
        .attr('fill', isDark ? '#374151' : '#f3f4f6');
      
      // Header bottom border
      g.append('line')
        .attr('x1', 0)
        .attr('y1', headerHeight)
        .attr('x2', docWidth)
        .attr('y2', headerHeight)
        .attr('stroke', isDark ? '#4b5563' : '#e5e7eb')
        .attr('stroke-width', 1);
      
      // Document ID text
      g.append('foreignObject')
        .attr('class', 'document-id-container')
        .attr('x', 8)
        .attr('y', headerHeight/2 - 6)
        .attr('width', docWidth - 40) // Leave space for the queue button
        .attr('height', 16)
        .html(() => {
          // Make sure we have a properly formatted document ID (without leading slashes)
          const cleanDocId = d.id.replace(/^\/+/, '');
          
          return `<div xmlns="http://www.w3.org/1999/xhtml" style="width:100%; height:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
            <a href="/jfk-files/${cleanDocId}" target="_blank" rel="noopener noreferrer" style="text-decoration:none; color:${isDark ? '#e5e7eb' : '#111827'}; font-size:10px; font-weight:500; font-family:sans-serif; display:block; overflow:hidden; text-overflow:ellipsis;">
              ${cleanDocId || 'Unknown ID'}
            </a>
          </div>`;
        });
      
      // Add a clip path for the content area
      const clipId = `clip-${d.id.replace(/[^\w-]/g, '_')}`;
      g.append('clipPath')
        .attr('id', clipId)
        .append('rect')
        .attr('x', 0)
        .attr('y', headerHeight + tabHeight)
        .attr('width', docWidth)
        .attr('height', contentAreaHeight);
      
      // Content background
      g.append('rect')
        .attr('class', 'content-bg')
        .attr('x', 0)
        .attr('y', headerHeight + tabHeight)
        .attr('width', docWidth)
        .attr('height', contentAreaHeight)
        .attr('fill', isDark ? '#111827' : '#f9fafb');
      
      // Add tabs background
      g.append('rect')
        .attr('class', 'tabs-bg')
        .attr('x', 0)
        .attr('y', headerHeight)
        .attr('width', docWidth)
        .attr('height', tabHeight)
        .attr('fill', isDark ? '#1f2937' : '#ffffff');
      
      // Tab underline
      g.append('line')
        .attr('x1', 0)
        .attr('y1', headerHeight + tabHeight)
        .attr('x2', docWidth)
        .attr('y2', headerHeight + tabHeight)
        .attr('stroke', isDark ? '#4b5563' : '#e5e7eb')
        .attr('stroke-width', 1);
      
      // Tabs
      const tabs = ['Image', 'Summary'];
      const tabWidth = docWidth / tabs.length;
      
      tabs.forEach((tab, idx) => {
        // Default to first tab as active (Image)
        const isActive = idx === 0;
        
        // Tab background - add data attribute for tab name
        const tabRect = g.append('rect')
          .attr('class', `tab-${tab.toLowerCase()}`)
          .attr('x', idx * tabWidth)
          .attr('y', headerHeight)
          .attr('width', tabWidth)
          .attr('height', tabHeight)
          .attr('fill', 'transparent')
          .attr('cursor', 'pointer')
          .attr('data-tab', tab.toLowerCase());
        
        // Tab text
      g.append('text')
          .attr('class', `tab-text-${tab.toLowerCase()}`)
          .attr('x', idx * tabWidth + tabWidth/2)
          .attr('y', headerHeight + tabHeight/2 + 4)
          .attr('text-anchor', 'middle')
          .attr('fill', isActive ? (isDark ? '#3b82f6' : '#2563eb') : (isDark ? '#9ca3af' : '#6b7280'))
          .attr('font-size', '8px')
          .attr('font-weight', isActive ? 500 : 400)
          .attr('cursor', 'pointer')
          .attr('data-tab', tab.toLowerCase())
          .text(tab);
        
        // Active tab indicator - ensure Image tab has it by default
        if (isActive) {
          g.append('rect')
            .attr('class', 'active-tab-indicator')
            .attr('x', idx * tabWidth)
            .attr('y', headerHeight + tabHeight - 2)
            .attr('width', tabWidth)
            .attr('height', 2)
            .attr('fill', isDark ? '#3b82f6' : '#2563eb');
        }
        
        // Add click handler to tab rectangle
        tabRect.on('click', function(event) {
          // Stop event propagation to prevent document clicking behavior
          event.stopPropagation();
          
          // Keep document expanded
          d._isExpanded = true;
          
          // Handle tab switching
          // Remove existing active tab indicator
          g.select('.active-tab-indicator').remove();
          
          // Reset all tab text styles
          tabs.forEach(t => {
            g.select(`.tab-text-${t.toLowerCase()}`)
              .attr('fill', isDark ? '#9ca3af' : '#6b7280')
              .attr('font-weight', 400);
          });
          
          // Update the clicked tab style
          g.select(`.tab-text-${tab.toLowerCase()}`)
            .attr('fill', isDark ? '#3b82f6' : '#2563eb')
            .attr('font-weight', 500);
          
          // Add new active tab indicator
          g.append('rect')
            .attr('class', 'active-tab-indicator')
            .attr('x', idx * tabWidth)
            .attr('y', headerHeight + tabHeight - 2)
            .attr('width', tabWidth)
            .attr('height', 2)
            .attr('fill', isDark ? '#3b82f6' : '#2563eb');
          
          // Hide all content
          g.select('.summary-content').style('display', 'none');
          g.select('.image-content').style('display', 'none');
          
          // Show the selected tab content
          g.select(`.${tab.toLowerCase()}-content`).style('display', 'block');
        });
        
        // Also add click handler to tab text for better UX
        g.select(`.tab-text-${tab.toLowerCase()}`).on('click', function(event) {
          // Stop event propagation to prevent document clicking behavior
          event.stopPropagation();
          
          // Keep document expanded
          d._isExpanded = true;
          
          // Handle tab switching  
          // Remove existing active tab indicator
          g.select('.active-tab-indicator').remove();
          
          // Reset all tab text styles
          tabs.forEach(t => {
            g.select(`.tab-text-${t.toLowerCase()}`)
              .attr('fill', isDark ? '#9ca3af' : '#6b7280')
              .attr('font-weight', 400);
          });
          
          // Update the clicked tab style
          g.select(`.tab-text-${tab.toLowerCase()}`)
            .attr('fill', isDark ? '#3b82f6' : '#2563eb')
            .attr('font-weight', 500);
          
          // Add new active tab indicator
          g.append('rect')
            .attr('class', 'active-tab-indicator')
            .attr('x', idx * tabWidth)
            .attr('y', headerHeight + tabHeight - 2)
            .attr('width', tabWidth)
            .attr('height', 2)
            .attr('fill', isDark ? '#3b82f6' : '#2563eb');
          
          // Hide all content
          g.select('.summary-content').style('display', 'none');
          g.select('.image-content').style('display', 'none');
          
          // Show the selected tab content
          g.select(`.${tab.toLowerCase()}-content`).style('display', 'block');
        });
      });
      
      // Content area with a clip path to contain overflow
      const contentGroup = g.append('g')
        .attr('class', 'document-content')
        .attr('clip-path', `url(#${clipId})`);
      
      // Create containers for each tab's content
      const summaryContent = contentGroup.append('g')
        .attr('class', 'summary-content')
        .style('display', 'none'); // Initially hidden

      const imageContent = contentGroup.append('g')
        .attr('class', 'image-content')
        .style('display', 'block'); // Initially visible

      // Store current page number for this document
      if (!d._pageNumber) {
        d._pageNumber = 1;
      }

      // For the summary tab - maximize image space
      // Image preview takes up more vertical space
      const pageNum = d._pageNumber || 1;
      const imageUrl = `https://api.oip.onl/api/jfk/media?id=${d.id}&type=image&fileName=page-${String(pageNum).padStart(2, '0')}.png`;
      const imageHeight = contentAreaHeight * 0.6; // Increased image height

      // Image background/placeholder for summary tab
      summaryContent.append('rect')
        .attr('x', 5)
        .attr('y', headerHeight + tabHeight + 5)
        .attr('width', docWidth - 10)
        .attr('height', imageHeight - 10)
        .attr('fill', isDark ? '#1f2937' : '#f3f4f6')
        .attr('rx', 3)
        .attr('ry', 3);

      // Add image for summary tab
      summaryContent.append('foreignObject')
        .attr('x', 5)
        .attr('y', headerHeight + tabHeight + 5)
        .attr('width', docWidth - 10)
        .attr('height', imageHeight - 10)
        .append('xhtml:div')
        .attr('class', 'image-container')
        .style('width', '100%')
        .style('height', '100%')
        .style('overflow', 'hidden')
        .style('display', 'flex')
        .style('justify-content', 'center')
        .style('align-items', 'center')
        .style('background-color', isDark ? '#1f2937' : '#f3f4f6')
        .style('border-radius', '3px')
        .html(`<img src="${imageUrl}" style="max-width:100%; max-height:100%; object-fit:contain;" 
                onerror="this.onerror=null; this.style.display='none'; this.parentNode.innerHTML='Document Image';" />`);

      // Document date if available
      if (d.date) {
        summaryContent.append('text')
          .attr('class', 'document-date')
          .attr('x', 8)
          .attr('y', headerHeight + tabHeight + imageHeight + 15)
          .attr('fill', isDark ? '#9ca3af' : '#6b7280')
          .attr('font-size', '8px')
          .text(new Date(d.date).toLocaleDateString());
      }
      
      // Document title for summary tab (remove redundant ID)
      summaryContent.append('text')
        .attr('class', 'document-title')
        .attr('x', 8)
        .attr('y', headerHeight + tabHeight + imageHeight + 30)
        .attr('fill', isDark ? '#e5e7eb' : '#111827')
        .attr('font-size', '9px')
        .attr('font-weight', 500)
        .text(d.title && d.title !== d.id ? d.title : '');

      // Agency if available
      if (d.agency) {
        summaryContent.append('text')
          .attr('class', 'document-agency')
          .attr('x', 8)
          .attr('y', headerHeight + tabHeight + imageHeight + 45)
          .attr('fill', isDark ? '#9ca3af' : '#6b7280')
          .attr('font-size', '8px')
          .text(d.agency);
      }
      
      // Draw a simplified area for entities in summary tab that takes less space
      const entityStartY = headerHeight + tabHeight + imageHeight + 60;
      const entityAreaHeight = contentAreaHeight - (entityStartY - headerHeight - tabHeight);

      // Entity section title - People for summary tab
      summaryContent.append('text')
        .attr('class', 'entity-section-title')
        .attr('x', 8)
        .attr('y', entityStartY)
        .attr('fill', isDark ? '#d1d5db' : '#374151')
        .attr('font-size', '8px')
        .attr('font-weight', 500)
        .text(`People (${d.people?.length || 0})`);

      // Add people with click handlers for summary tab - show fewer to save space
      d.people?.slice(0, 3).forEach((person, index) => {
        summaryContent.append('text')
          .attr('class', 'entity person')
          .attr('x', 12)
          .attr('y', entityStartY + 12 + index * 12)
          .attr('fill', entityColors.person)
          .attr('font-size', '8px')
          .attr('cursor', 'pointer')
          .text(person.name)
          .on('click', (event) => {
            event.stopPropagation();
            handleTermClick(person.name, 'person');
          });
      });
      
      // Add a "more" indicator if there are more than 3 people
      if ((d.people?.length || 0) > 3) {
        summaryContent.append('text')
          .attr('class', 'more-indicator')
          .attr('x', 12)
          .attr('y', entityStartY + 12 + 3 * 12)
          .attr('fill', isDark ? '#9ca3af' : '#6b7280')
          .attr('font-size', '8px')
          .attr('font-style', 'italic')
          .text(`+${d.people!.length - 3} more...`);
      }

      // Entity section title - Places
      summaryContent.append('text')
        .attr('class', 'entity-section-title')
        .attr('x', docWidth/2 + 4)
        .attr('y', entityStartY)
        .attr('fill', isDark ? '#d1d5db' : '#374151')
        .attr('font-size', '8px')
        .attr('font-weight', 500)
        .text(`Places (${d.places?.length || 0})`);

      // Add places with click handlers - show fewer to save space
      d.places?.slice(0, 3).forEach((place, index) => {
        summaryContent.append('text')
          .attr('class', 'entity place')
          .attr('x', docWidth/2 + 8)
          .attr('y', entityStartY + 12 + index * 12)
          .attr('fill', entityColors.place)
          .attr('font-size', '8px')
          .attr('cursor', 'pointer')
          .text(place.name)
          .on('click', (event) => {
            event.stopPropagation();
            handleTermClick(place.name, 'place');
          });
      });

      // Add a "more" indicator if there are more than 3 places
      if ((d.places?.length || 0) > 3) {
        summaryContent.append('text')
          .attr('class', 'more-indicator')
          .attr('x', docWidth/2 + 8)
          .attr('y', entityStartY + 12 + 3 * 12)
          .attr('fill', isDark ? '#9ca3af' : '#6b7280')
          .attr('font-size', '8px')
          .attr('font-style', 'italic')
          .text(`+${d.places!.length - 3} more...`);
      }

      // Image tab content - full document image with page navigation
      imageContent.append('rect')
        .attr('x', 75) // Move right to make room for people list
        .attr('y', headerHeight + tabHeight + 5)
        .attr('width', docWidth - 150) // Reduce width to accommodate both lists
        .attr('height', contentAreaHeight - 45) // Leave space for page turner
        .attr('fill', isDark ? '#1f2937' : '#f3f4f6')
        .attr('rx', 3)
        .attr('ry', 3);

      imageContent.append('foreignObject')
        .attr('x', 75) // Move right to make room for people list
        .attr('y', headerHeight + tabHeight + 5)
        .attr('width', docWidth - 150) // Reduce width to accommodate both lists
        .attr('height', contentAreaHeight - 45)
        .append('xhtml:div')
        .attr('class', 'image-container')
        .style('width', '100%')
        .style('height', '100%')
        .style('overflow', 'hidden')
        .style('display', 'flex')
        .style('justify-content', 'center')
        .style('align-items', 'center')
        .style('background-color', isDark ? '#1f2937' : '#f3f4f6')
        .style('border-radius', '3px')
        .html(`<img src="${imageUrl}" style="max-width:100%; max-height:100%; object-fit:contain;" 
                onerror="this.onerror=null; this.style.display='none'; this.parentNode.innerHTML='Document Image';" />`);

      // Add page turner for image tab
      const pageControls = imageContent.append('g')
        .attr('class', 'page-controls')
        .attr('transform', `translate(0, ${headerHeight + tabHeight + contentAreaHeight - 35})`);

      // Page navigation background
      pageControls.append('rect')
        .attr('x', 75) // Align with image
        .attr('y', 0)
        .attr('width', docWidth - 150) // Match image width
        .attr('height', 30)
        .attr('fill', isDark ? '#111827' : '#e5e7eb')
        .attr('rx', 3)
        .attr('ry', 3);

      // Page count indicator
      pageControls.append('text')
        .attr('x', docWidth / 2)
        .attr('y', 19)
        .attr('text-anchor', 'middle')
        .attr('font-size', '12px')
        .attr('fill', isDark ? '#e5e7eb' : '#111827')
        .text(`Page ${pageNum}`);

      // Previous page button
      const previousPageRect = pageControls.append('rect')
        .attr('x', 85) // Align with image edge + margin
        .attr('y', 5)
        .attr('width', 20)
        .attr('height', 20)
        .attr('fill', 'transparent')
        .attr('cursor', 'pointer');

      pageControls.append('path')
        .attr('d', 'M15,15 L20,10 L20,20 Z')  // Simple triangle pointing left
        .attr('fill', isDark ? '#9ca3af' : '#4b5563')
        .attr('transform', 'translate(76, 0)'); // Adjust to match button

      // Next page button
      const nextPageRect = pageControls.append('rect')
        .attr('x', docWidth - 105) // Align with right image edge - button width - margin
        .attr('y', 5)
        .attr('width', 20)
        .attr('height', 20)
        .attr('fill', 'transparent')
        .attr('cursor', 'pointer');

      pageControls.append('path')
        .attr('d', 'M15,10 L20,15 L15,20 Z')  // Simple triangle pointing right
        .attr('fill', isDark ? '#9ca3af' : '#4b5563')
        .attr('transform', `translate(${docWidth - 104}, 0)`); // Adjust to match button

      // Handle previous page click
      previousPageRect.on('click', function(event) {
        event.stopPropagation();
        const currentPage = d._pageNumber || 1;
        if (currentPage > 1) {
          d._pageNumber = currentPage - 1;
          // Update page display and image URL
          const newPageNum = d._pageNumber;
          const newImageUrl = `https://api.oip.onl/api/jfk/media?id=${d.id}&type=image&fileName=page-${String(newPageNum).padStart(2, '0')}.png`;
          
          // Update page display text
          pageControls.select('text').text(`Page ${newPageNum}`);
          
          // Update image in container
          imageContent.select('.image-container').html(
            `<img src="${newImageUrl}" style="max-width:100%; max-height:100%; object-fit:contain;" 
              onerror="this.onerror=null; this.style.display='none'; this.parentNode.innerHTML='Document Image';" />`
          );
        }
      });

      // Handle next page click
      nextPageRect.on('click', function(event) {
        event.stopPropagation();
        // Assume max 10 pages if we don't know exact count
        const maxPages = d.pageCount || 10;
        const currentPage = d._pageNumber || 1;
        if (currentPage < maxPages) {
          d._pageNumber = currentPage + 1;
          // Update page display and image URL
          const newPageNum = d._pageNumber;
          const newImageUrl = `https://api.oip.onl/api/jfk/media?id=${d.id}&type=image&fileName=page-${String(newPageNum).padStart(2, '0')}.png`;
          
          // Update page display text
          pageControls.select('text').text(`Page ${newPageNum}`);
          
          // Update image in container
          imageContent.select('.image-container').html(
            `<img src="${newImageUrl}" style="max-width:100%; max-height:100%; object-fit:contain;" 
              onerror="this.onerror=null; this.style.display='none'; this.parentNode.innerHTML='Document Image';" />`
          );
        }
      });

      // Add "Add to Queue" button to document header
      const headerButtonG = g.append('g')
        .attr('class', 'document-queue-button')
        .attr('transform', `translate(${docWidth - 30}, ${headerHeight / 2})`)
        .html(`<foreignObject x="-25" y="-10" width="50" height="20">
          <body xmlns="http://www.w3.org/1999/xhtml" style="margin:0;padding:0;">
            <div id="queue-button-${d.id.replace(/[^a-zA-Z0-9_-]/g, '_')}" style="width:100%;height:100%;"></div>
          </body>
        </foreignObject>`);

      // Delay to ensure the element is in the DOM
      setTimeout(() => {
        const buttonContainer = document.getElementById(`queue-button-${d.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`);
        if (buttonContainer) {
          // Make sure we have a properly formatted document ID (without leading slashes)
          const cleanDocId = d.id.replace(/^\/+/, '');
          
          // Get current queue from localStorage
          let queue: Array<{id: string; title?: string; url?: string; type?: string}> = [];
          try {
            const savedQueue = localStorage.getItem('documentDockQueue');
            if (savedQueue) {
              queue = JSON.parse(savedQueue);
            }
          } catch (error) {
            console.error('Error parsing document dock queue:', error);
          }
          
          // Check if this document is already in the queue
          const isInQueue = Array.isArray(queue) && queue.some((item: {id: string}) => item.id === cleanDocId);
          
          // Create the button HTML
          buttonContainer.innerHTML = `
            <button
              class="queue-toggle-btn"
              style="
                display: inline-flex;
                align-items: center;
                gap: 2px;
                padding: 2px 4px;
                border-radius: 4px;
                font-size: 9px;
                font-weight: 500;
                cursor: pointer;
                background-color: ${isInQueue ? '#059669' : '#2563eb'};
                color: white;
                border: 1px solid ${isInQueue ? '#10b981' : '#3b82f6'};
                box-shadow: 0 1px 2px rgba(0,0,0,0.2);
                white-space: nowrap;
              "
              title="${isInQueue ? "Remove from Document Queue" : "Add to Document Queue"}"
            >
              ${isInQueue ? 
                '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> In Queue' : 
                '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> Add'}
            </button>
          `;
          
          // Add click handler to the button
          const button = buttonContainer.querySelector('.queue-toggle-btn') as HTMLButtonElement;
          if (button) {
            button.addEventListener('click', async (e) => {
              e.stopPropagation(); // Prevent the document node click from firing
              
              // Get current queue state
              let currentQueue = [];
              try {
                const savedQueue = localStorage.getItem('documentDockQueue');
                if (savedQueue) {
                  currentQueue = JSON.parse(savedQueue);
                }
              } catch (error) {
                console.error('Error parsing document dock queue:', error);
              }
              
              const itemInQueue = Array.isArray(currentQueue) && 
                currentQueue.some((item: {id: string}) => item.id === cleanDocId);
              
              // Toggle item in queue
              let newQueue = [...currentQueue]; // Initialize with current queue as default
              if (itemInQueue) {
                // Remove from queue
                newQueue = currentQueue.filter((item: {id: string}) => item.id !== cleanDocId);
                console.log(`Removed document ${cleanDocId} from queue`);
                
                // Update localStorage with the new queue state
                localStorage.setItem('documentDockQueue', JSON.stringify(newQueue));
                
                // Update button state
                button.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> Add';
                button.style.backgroundColor = '#2563eb';
                button.style.borderColor = '#3b82f6';
                button.title = "Add to Document Queue";
                
                // Dispatch custom event to tell DocumentDock about the queue update
                const event = new CustomEvent('documentDockUpdate', {
                  detail: { queue: newQueue }
                });
                window.dispatchEvent(event);
              } else {
                // Before adding to queue, fetch the latest document info
                try {
                  console.log(`Fetching latest info for document ${cleanDocId} before adding to queue`);
                  
                  // Set button to loading state
                  button.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" class="animate-spin" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>';
                  
                  // Use the external API directly since the internal API may not be set up
                  const detailsResponse = await fetch(`https://api.oip.onl/api/jfk/media?id=${cleanDocId}&type=analysis&getLatestPageData=true`);
                  let detailedDocData = null;
                  
                  if (detailsResponse.ok) {
                    detailedDocData = await detailsResponse.json();
                    console.log('Fetched detailed document data:', detailedDocData);
                  }
                  
                  // Also try the document-info API as a backup
                  const response = await fetch(`/api/jfk/document-info?id=${cleanDocId}`);
                  let docInfo = null;
                  
                  if (response.ok) {
                    docInfo = await response.json();
                    console.log('Fetched document info:', docInfo);
                  }
                  
                  // Create the new item with the best data available
                  const title = (detailedDocData && detailedDocData.title) || 
                                (docInfo && docInfo.title) || 
                                d.title || 
                                `JFK Document ${cleanDocId}`;
                  
                  const newItem = {
                    id: cleanDocId,
                    title: title,
                    url: `/jfk-files/${cleanDocId}`,
                    type: 'document'
                  };
                  
                  // Add to the queue
                  newQueue = [...currentQueue, newItem];
                  
                  // Update localStorage with the new queue state
                  localStorage.setItem('documentDockQueue', JSON.stringify(newQueue));
                  
                  console.log(`Added document ${cleanDocId} to queue with title: ${title}`);
                  
                  // Update button state
                  button.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> In Queue';
                  button.style.backgroundColor = '#059669';
                  button.style.borderColor = '#10b981';
                  button.title = "Remove from Document Queue";
                  
                  // If we got detailed data, store it in a global cache so DocumentDock can access it immediately
                  if (detailedDocData) {
                    // Create a global cache if it doesn't exist
                    if (typeof window !== 'undefined') {
                      if (!window.documentDetailsCache) {
                        window.documentDetailsCache = {};
                      }
                      
                      // Store the detailed data
                      window.documentDetailsCache[cleanDocId] = detailedDocData;
                      console.log(`Cached detailed data for ${cleanDocId} in window.documentDetailsCache`);
                    }
                  }
                  
                  // Call addToDocumentDock with the item
                  if (typeof window !== 'undefined' && window.addToDocumentDock) {
                    window.addToDocumentDock(newItem);
                    console.log('Called window.addToDocumentDock with the new item');
                  } else {
                    console.warn('window.addToDocumentDock function not available');
                    
                    // Fallback to just dispatching the event
                    const event = new CustomEvent('documentDockUpdate', {
                      detail: { queue: newQueue }
                    });
                    window.dispatchEvent(event);
                  }
                } catch (error) {
                  console.error('Error adding document to queue:', error);
                  
                  // Reset button state
                  button.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> Add';
                  button.style.backgroundColor = '#2563eb';
                  button.style.borderColor = '#3b82f6';
                }
              }
            });
          }
        } else {
          console.warn(`Could not find button container for document ${d.id}`);
        }
      }, 200); // Increase timeout to ensure DOM is ready

      // Add people and places on either side of the image
      // Create scrollable containers for entities
      // People list on the left
      const peopleListContainer = imageContent.append('g')
        .attr('class', 'entity-list people-list')
        .attr('transform', `translate(8, ${headerHeight + tabHeight + 5})`);
      
      // People header
      peopleListContainer.append('text')
        .attr('class', 'entity-list-header')
        .attr('x', 0)
        .attr('y', 12)
        .attr('fill', isDark ? '#d1d5db' : '#374151')
        .attr('font-size', '8px')
        .attr('font-weight', 500)
        .text(`People (${d.people?.length || 0})`);
      
      // People scrollable list with special handling for undefined values
      peopleListContainer.append('foreignObject')
        .attr('x', 0)
        .attr('y', 18)
        .attr('width', 65)
        .attr('height', contentAreaHeight - 70)
        .html(() => {
          // Handle the case where people might be empty or undefined
          if (!d.people || d.people.length === 0) {
            return `<div xmlns="http://www.w3.org/1999/xhtml" style="width:100%; height:100%; overflow-y:auto; overflow-x:hidden; visibility:visible;">
              <div style="color:#6b7280; font-style:italic; font-size:8px; padding:2px 0;">No people</div>
            </div>`;
          }
          
          // Build HTML manually for better control
          let itemsHtml = '';
          
          for (let i = 0; i < d.people.length; i++) {
            const person = d.people[i];
            
            // Special case: if the person itself is literally undefined but we want to show it in the list
            if (person === undefined) {
              itemsHtml += `
                <div style="padding:2px 0; color:${entityColors.person}; cursor:default; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-family:sans-serif; font-size:8px; font-style:italic;" 
                     class="entity-item">
                  undefined
                </div>`;
              continue;
            }
            
            // Normal case - extract person name
            let personName = '';
            if (typeof person === 'string') {
              personName = person;
            } else if (person && typeof person === 'object') {
              personName = person.name || '';
            }
            
            // If we still have no name, show as "unknown"
            if (!personName) {
              personName = "unknown";
            }
            
            // Escape HTML
            const escapedName = personName
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;');
            
            // Add item to HTML
            itemsHtml += `
              <div style="padding:2px 0; color:${entityColors.person}; cursor:pointer; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-family:sans-serif; font-size:8px;" 
                   data-name="${escapedName}" 
                   data-type="person"
                   class="entity-item">
                ${escapedName}
              </div>`;
          }
          
          return `<div xmlns="http://www.w3.org/1999/xhtml" style="width:100%; height:100%; overflow-y:auto; overflow-x:hidden; visibility:visible;">
            ${itemsHtml || '<div style="color:#6b7280; font-style:italic; font-size:8px; padding:2px 0;">No people</div>'}
          </div>`;
        });
      
      // Add click event listeners after the people list is added
      // Store a reference to connectionsGroup that can be accessed by event handlers
      const connectionsGroupRef = connectionsGroup;

      setTimeout(() => {
        const docNode = document.getElementById(getSafeDocId(d.id));
        if (docNode) {
          const personItems = docNode.querySelectorAll('.entity-item[data-type="person"]');
          personItems.forEach(item => {
            item.addEventListener('click', (e) => {
              e.stopPropagation();
              const name = (item as HTMLElement).dataset.name;
              const type = (item as HTMLElement).dataset.type;
              if (name && type) {
                handleTermClick(name, type as 'person' | 'place');
              }
            });
            
            // Add mouseover/out handlers for highlighting connections
            item.addEventListener('mouseenter', (e) => {
              e.stopPropagation();
              const name = (item as HTMLElement).dataset.name;
              if (name && connectionsGroupRef) {
                // Highlight connections for this person
                connectionsGroupRef.selectAll<SVGLineElement, Connection>('.connection-person')
                  .filter(conn => conn.entity === name)
                  .transition()
                  .duration(200)
                  .attr('stroke-width', 3)
                  .attr('stroke-opacity', 1.0);
                
                // Update place connections but keep them subtle with 0.3 opacity
                connectionsGroupRef.selectAll<SVGLineElement, Connection>('.connection-place')
                  .transition()
                  .duration(200)
                  .attr('stroke-width', 1.5)
                  .attr('stroke-opacity', 0.6)
                  .style('opacity', 0.6);
              }
            });
            
            item.addEventListener('mouseleave', (e) => {
              // Reset highlighting
              if (connectionsGroupRef) {
                connectionsGroupRef.selectAll('.connection-person')
                  .transition()
                  .duration(200)
                  .attr('stroke-width', 1.5)
                  .attr('stroke-opacity', 0.6);
                
                connectionsGroupRef.selectAll('.connection-place')
                  .transition()
                  .duration(200)
                  .attr('stroke-width', 1.5)
                  .attr('stroke-opacity', 0.3)
                  .style('opacity', 0.3);
              }
            });
          });
          
          // Same treatment for place items
          const placeItems = docNode.querySelectorAll('.entity-item[data-type="place"]');
          placeItems.forEach(item => {
            item.addEventListener('click', (e) => {
              e.stopPropagation();
              const name = (item as HTMLElement).dataset.name;
              const type = (item as HTMLElement).dataset.type;
              if (name && type) {
                handleTermClick(name, type as 'person' | 'place');
              }
            });
            
            // Add mouseover/out handlers for highlighting connections
            item.addEventListener('mouseenter', (e) => {
              e.stopPropagation();
              const name = (item as HTMLElement).dataset.name;
              if (name && connectionsGroupRef) {
                // Keep person connections visible but not highlighted
                connectionsGroupRef.selectAll<SVGLineElement, Connection>('.connection-person')
                  .transition()
                  .duration(200)
                  .attr('stroke-width', 1.5)
                  .attr('stroke-opacity', 0.6);
                
                // Highlight place connections but still keep them subtle
                connectionsGroupRef.selectAll<SVGLineElement, Connection>('.connection-place')
                  .filter(conn => conn.entity === name)
                  .transition()
                  .duration(200)
                  .attr('stroke-width', 3)
                  .attr('stroke-opacity', 0.6) // Highlight but still subtle
                  .style('opacity', 0.6);
              }
            });
            
            item.addEventListener('mouseleave', (e) => {
              // Reset highlighting
              if (connectionsGroupRef) {
                connectionsGroupRef.selectAll('.connection-person')
                  .transition()
                  .duration(200)
                  .attr('stroke-width', 1.5)
                  .attr('stroke-opacity', 0.6);
                
                connectionsGroupRef.selectAll('.connection-place')
                  .transition()
                  .duration(200)
                  .attr('stroke-width', 1.5)
                  .attr('stroke-opacity', 0.3)
                  .style('opacity', 0.3);
              }
            });
          });
        }
      }, 100);

      // Places list on the right
      const placesListContainer = imageContent.append('g')
        .attr('class', 'entity-list places-list')
        .attr('transform', `translate(${docWidth - 73}, ${headerHeight + tabHeight + 5})`);

      // Places header
      placesListContainer.append('text')
        .attr('class', 'entity-list-header')
        .attr('x', 0)
        .attr('y', 12)
        .attr('fill', isDark ? '#d1d5db' : '#374151')
        .attr('font-size', '8px')
        .attr('font-weight', 500)
        .text(`Places (${d.places?.length || 0})`);

      // Places scrollable list with special handling for undefined values
      placesListContainer.append('foreignObject')
        .attr('x', 0)
        .attr('y', 18)
        .attr('width', 65)
        .attr('height', contentAreaHeight - 70)
        .html(() => {
          // Handle the case where places might be empty or undefined
          if (!d.places || d.places.length === 0) {
            return `<div xmlns="http://www.w3.org/1999/xhtml" style="width:100%; height:100%; overflow-y:auto; overflow-x:hidden; visibility:visible;">
              <div style="color:#6b7280; font-style:italic; font-size:8px; padding:2px 0;">No places</div>
            </div>`;
          }
          
          // Debug log the places data
          console.log(`[CHRONOSPHERE] Document ${d.id} - Places data:`, 
            d.places ? JSON.stringify(d.places.slice(0, 2)) : 'undefined');
          
          // Build HTML manually for better control
          let itemsHtml = '';
          
          for (let i = 0; i < d.places.length; i++) {
            const place = d.places[i];
            
            // Debug log each place
            console.log(`[CHRONOSPHERE] Place ${i} type:`, typeof place, 
              typeof place === 'object' ? JSON.stringify(place) : place);
            
            // Special case: if the place itself is literally undefined but we want to show it in the list
            // This handles the specific case in your screenshot
            if (place === undefined) {
              itemsHtml += `
                <div style="padding:2px 0; color:${entityColors.place}; cursor:default; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-family:sans-serif; font-size:8px; font-style:italic;" 
                     class="entity-item">
                  undefined
                </div>`;
              continue;
            }
            
            // Normal case - extract place name
            let placeName = '';
            if (typeof place === 'string') {
              placeName = place;
            } else if (place && typeof place === 'object') {
              placeName = place.name || '';
              
              // Use type assertion to try other properties
              const placeObj = place as any;
              if (!placeName && placeObj.place) placeName = placeObj.place;
              if (!placeName && placeObj.location) placeName = placeObj.location;
            }
            
            // Debug log the extracted place name
            console.log(`[CHRONOSPHERE] Extracted place name: "${placeName}"`);
            
            // If we still have no name, show as "unknown"
            if (!placeName) {
              placeName = "unknown";
            }
            
            // Escape HTML
            const escapedName = placeName
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;');
            
            // Add item to HTML
            itemsHtml += `
              <div style="padding:2px 0; color:${entityColors.place}; cursor:pointer; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-family:sans-serif; font-size:8px;" 
                   data-name="${escapedName}" 
                   data-type="place"
                   class="entity-item">
                ${escapedName}
              </div>`;
          }
          
          return `<div xmlns="http://www.w3.org/1999/xhtml" style="width:100%; height:100%; overflow-y:auto; overflow-x:hidden; visibility:visible;">
            ${itemsHtml || '<div style="color:#6b7280; font-style:italic; font-size:8px; padding:2px 0;">No places</div>'}
          </div>`;
        });

      // Add click event listeners after the places list is added
      // This is necessary because the HTML is added as a string
      setTimeout(() => {
        const docNode = document.getElementById(getSafeDocId(d.id));
        if (docNode) {
          const placeItems = docNode.querySelectorAll('.entity-item[data-type="place"]');
          placeItems.forEach(item => {
            item.addEventListener('click', (e) => {
              e.stopPropagation();
              const name = (item as HTMLElement).dataset.name;
              const type = (item as HTMLElement).dataset.type;
              if (name && type) {
                handleTermClick(name, type as 'person' | 'place');
              }
            });
          });
        }
      }, 100);
    });
    
    // Position document nodes with initial transform
    nodes.attr('transform', (d: any) => {
      const halfWidth = docWidth / 2;
      const halfHeight = docHeight / 2;
      const scaledHalfWidth = halfWidth * shrinkFactor;
      const scaledHalfHeight = halfHeight * shrinkFactor;
      
      return `translate(${d._initialX - scaledHalfWidth}, ${d._initialY - scaledHalfHeight}) scale(${shrinkFactor})`;
    });
    
    // Add hover behavior to document nodes - ONLY SCALING, NO MOVEMENT
    nodes.on('mouseenter', function(event: MouseEvent, d: DocumentNode) {
      if (!d._initialX || !d._initialY) return;
      
      d._isExpanded = true;
      
      // Calculate scaled dimensions for proper centering
      const halfWidth = docWidth / 2;
      const halfHeight = docHeight / 2;
      
      // Scale up the document AT THE SAME POSITION
      d3.select(this)
        .transition()
        .duration(200)
        .attr('transform', `translate(${d._initialX - halfWidth}, ${d._initialY - halfHeight}) scale(${expandedSize})`)
        .style('filter', 'drop-shadow(0 4px 8px rgba(0,0,0,0.2))');
      
      // Also bring this document to the front
      this.parentNode?.appendChild(this);
      
      // Highlight connections
      connectionsGroup.selectAll<SVGLineElement, Connection>('.connection-person').filter(function(conn) {
        return conn.source === d.id || conn.target === d.id;
      })
      .transition()
      .duration(200)
      .attr('stroke-width', 2.5);
      
      connectionsGroup.selectAll<SVGLineElement, Connection>('.connection-place').filter(function(conn) {
        return conn.source === d.id || conn.target === d.id;
      })
      .transition()
      .duration(200)
      .attr('stroke-width', 2.5)
      .attr('stroke-opacity', 0.6) // Increase opacity slightly, but not to full
      .style('opacity', 0.6); // Match the style opacity
    })
    .on('mouseleave', function(event: MouseEvent, d: DocumentNode) {
      // We need to determine if the mouse is really leaving the document
      // or just moving to another part of the document like a tab
      const relatedTarget = event.relatedTarget as Element;
      
      // Check if the mouse is moving to a child element of this document node
      // by walking up the DOM tree from the related target
      let currentElement = relatedTarget;
      let stillInDocument = false;
      
      // Helper function to check if an element is part of this document node
      const isPartOfThisNode = (el: Element | null): boolean => {
        if (!el) return false;
        
        // Get the document node ID
        const safeDocId = getSafeDocId(d.id);
        
        // Check if this element or any parent has the same ID as our document node
        if (el.id === safeDocId) return true;
        
        // Check if part of this document's group (like a tab)
        if (el.closest(`#${safeDocId}`)) return true;
        
        return false;
      };
      
      // If mouse is still in the document, don't collapse
      if (isPartOfThisNode(currentElement)) {
        return;
      }
      
      if (!d._initialX || !d._initialY) return;
      
      d._isExpanded = false;
      
      // Calculate scaled dimensions for proper centering
      const halfWidth = docWidth / 2;
      const halfHeight = docHeight / 2;
      const scaledHalfWidth = halfWidth * shrinkFactor;
      const scaledHalfHeight = halfHeight * shrinkFactor;
      
      // Escape special characters in document ID for CSS selector
      const safeDocId = getSafeDocId(d.id);
      d3.select(`#${safeDocId}`)
        .style('filter', null)
        .transition()
        .duration(200)
        .attr('transform', `translate(${d._initialX - scaledHalfWidth}, ${d._initialY - scaledHalfHeight}) scale(${shrinkFactor})`);
      
      // Reset connection highlighting
      connectionsGroup.selectAll('.connection-person')
        .transition()
        .duration(200)
        .attr('stroke-width', 1.5)
        .attr('stroke-opacity', 0.6); // Reset to original opacity
      
      connectionsGroup.selectAll('.connection-place')
        .transition()
        .duration(200)
        .attr('stroke-width', 1.5)
        .attr('stroke-opacity', 0.3) // Reset to very low opacity
        .style('opacity', 0.3); // Also reset the style opacity
    });
    
    // Add click handler to entire node to prevent bubbling
    nodes.on('click', function(event: MouseEvent, d: DocumentNode) {
      if (!d._isExpanded) {
        // If not expanded, expand first
        d._isExpanded = true;
        
        // Check for initialX and initialY
        if (!d._initialX || !d._initialY) return;
        
        // Calculate scaled dimensions for proper centering
        const halfWidth = docWidth / 2;
        const halfHeight = docHeight / 2;
        
        // Scale up the document AT THE SAME POSITION
        d3.select(this)
          .transition()
          .duration(200)
          .attr('transform', `translate(${d._initialX - halfWidth}, ${d._initialY - halfHeight}) scale(${expandedSize})`)
          .style('filter', 'drop-shadow(0 4px 8px rgba(0,0,0,0.2))');
          
        // Also bring this document to the front
        this.parentNode?.appendChild(this);
        
        return;
      }
      
      // If there's a click handler provided and we're not clicking on a tab or control area, call it
      if (onNodeClick) {
        // Get the clicked element
        const target = event.target as Element;
        
        // Check if we're clicking on a tab or control
        const isTabOrControl = target.classList?.contains('tab') || 
          target.parentElement?.classList?.contains('page-controls') ||
          target.closest('.page-controls');
          
        if (!isTabOrControl) {
          event.stopPropagation();
          onNodeClick(d);
        }
      }
    });
    
    // Create central word cloud
    const centralCloudGroup = wordCloudGroup.append('g')
      .attr('class', 'central-word-cloud')
      .attr('transform', `translate(${width / 2}, ${height * 0.5})`);
    
    // Bring word cloud to front by reordering SVG elements
    // svg.node()?.appendChild(wordCloudGroup.node() as SVGGElement);
    
    // Add filters for term styling
    const defs = svg.append('defs');
    
    // Add a gradient background for the central word cloud
    const gradient = defs.append('radialGradient')
      .attr('id', 'cloud-background')
      .attr('cx', '50%')
      .attr('cy', '50%')
      .attr('r', '50%');
    
    gradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', isDark ? 'rgba(17, 24, 39, 0.4)' : 'rgba(249, 250, 251, 0.4)');
    
    gradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', isDark ? 'rgba(17, 24, 39, 0)' : 'rgba(249, 250, 251, 0)');
    
    // Add glow filter for terms on hover
    const filter = defs.append('filter')
      .attr('id', 'cloud-term-glow')
      .attr('x', '-50%')
      .attr('y', '-50%')
      .attr('width', '200%')
      .attr('height', '200%');
    
    filter.append('feGaussianBlur')
      .attr('stdDeviation', '2')
      .attr('result', 'coloredBlur');
    
    const filterMerge = filter.append('feMerge');
    filterMerge.append('feMergeNode').attr('in', 'coloredBlur');
    filterMerge.append('feMergeNode').attr('in', 'SourceGraphic');
    
    // Add the background circle with gradient
    centralCloudGroup.append('circle')
      .attr('r', 225)
      .attr('fill', 'url(#cloud-background)');
    
    // Track which documents contain each term for interactivity
    const termToDocuments: { [key: string]: string[] } = {};
    
    // Build mapping of terms to documents that contain them
    documents.forEach(doc => {
      if (doc.keywords && doc.keywords.length) {
        doc.keywords.forEach((word: string) => {
          if (word) {
            if (!termToDocuments[word]) {
              termToDocuments[word] = [];
            }
            termToDocuments[word].push(doc.id);
          }
        });
      }
    });
    
    // Add the terms to the central word cloud with better spacing
    interface TermPosition {
      x: number;
      y: number;
    }

    const termPositions: Record<string, TermPosition> = {}; // Track term positions to avoid overlaps
    Object.keys(termToDocuments).forEach((term, i) => {
      // Use spiral layout for better distribution
      const angle = 0.1 + (i * 2.4); // More spacing between angles
      const radius = 5 * Math.sqrt(i) * Math.max(3, Math.min(12, term.length / 2));
      let x = radius * Math.cos(angle);
      let y = radius * Math.sin(angle);
      
      // Check for overlaps with existing terms and adjust position
      let attempts = 0;
      const padding = 15; // Minimum distance between terms
      
      while (attempts < 10) { // Try a few times to find non-overlapping position
        let overlapping = false;
        
        // Check against all existing term positions
        Object.keys(termPositions).forEach(existingTerm => {
          const pos = termPositions[existingTerm];
          const dx = x - pos.x;
          const dy = y - pos.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          // If too close, mark as overlapping
          if (distance < padding) {
            overlapping = true;
          }
        });
        
        if (!overlapping) {
          break; // Found a good position
        }
        
        // Adjust position and try again
        const jitter = attempts * 5;
        x += Math.random() * jitter * (Math.random() > 0.5 ? 1 : -1);
        y += Math.random() * jitter * (Math.random() > 0.5 ? 1 : -1);
        attempts++;
      }
      
      // Save the position
      termPositions[term] = { x, y };
      
      const frequency = termToDocuments[term].length;
      const fontSize = Math.max(minFontSize, Math.min(maxFontSize, 10 + frequency));
      const opacity = 0.4 + Math.min(0.6, frequency * 0.1);
      
      // Check if term is selected
      const isSelected = selectedTerms.includes(term);
      
      // Create term group for better organization
      const termGroup = centralCloudGroup.append('g')
        .attr('class', 'cloud-term-group')
        .attr('transform', `translate(${x}, ${y})`);
      
      // Add subtle shadow/depth effect with slightly offset dark copy
      termGroup.append('text')
        .attr('class', 'cloud-term-shadow')
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', fontSize)
        .attr('font-weight', frequency > 1 ? 500 : 400)
        .attr('fill', isDark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.1)')
        .attr('transform', 'translate(0.5, 0.5)')
        .text(term);
      
      // Add main term with filters
      const termElement = termGroup.append('text')
        .attr('class', 'cloud-term')
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', fontSize)
        .attr('font-weight', frequency > 1 ? 500 : 400)
        .attr('fill', isSelected ? 
          entityColors.term : 
          (isDark ? 
            `rgba(229, 231, 235, ${opacity})` : 
            `rgba(31, 41, 55, ${opacity})`))
        .style('filter', isSelected ? 'url(#cloud-term-glow)' : 'none')
        .style('cursor', 'pointer')
        .text(term);
      
      // Add click handler for search functionality
      termGroup.on('click', (event) => {
        event.stopPropagation();
        handleTermClick(term, 'text');
      });
      
      // Add hover interactivity
      if (termToDocuments[term] && termToDocuments[term].length > 0) {
        termGroup
          .on('mouseenter', function(event) {
            const termElement = d3.select(this);
            const termText = termElement.select('.cloud-term').text();
            
            // Add glow effect to term
            termElement.select('.cloud-term')
              .style('filter', 'url(#cloud-term-glow)')
              .transition()
              .duration(200)
              .attr('font-size', fontSize * 1.2)
              .attr('fill', isDark ? 
                'rgba(229, 231, 235, 1)' : 
                'rgba(31, 41, 55, 1)');
            
            // Scale shadow
            termElement.select('.cloud-term-shadow')
              .transition()
              .duration(200)
              .attr('font-size', fontSize * 1.2);
            
            // Highlight connected documents and connections
            const connectedDocIds = termToDocuments[termText] || [];
            
            // Highlight document nodes
            connectedDocIds.forEach(docId => {
              // Escape special characters in document ID for CSS selector
              const safeDocId = getSafeDocId(docId);
              const docNode = d3.select(`#${safeDocId}`);
              
              docNode.style('filter', 'drop-shadow(0 4px 8px rgba(0,0,0,0.2))');
              
              // Get document data
              const doc = documents.find(d => d.id === docId);
              if (!doc || !doc._initialX || !doc._initialY) return;
              
              // Scale up the connected document in place
              const halfWidth = docWidth / 2;
              const halfHeight = docHeight / 2;
              
              docNode.transition()
                .duration(200)
                .attr('transform', `translate(${doc._initialX - halfWidth}, ${doc._initialY - halfHeight}) scale(${expandedSize})`);
              
              doc._isExpanded = true;
            });
            
            // Highlight ALL connections to/from documents that contain this term
            connectionsGroup.selectAll<SVGLineElement, Connection>('.connection-person').filter(function(conn) {
              return connectedDocIds.includes(conn.source) || connectedDocIds.includes(conn.target);
            })
            .transition()
            .duration(200)
            .attr('stroke-width', 3)
            .attr('stroke-opacity', 1.0);
            
            connectionsGroup.selectAll<SVGLineElement, Connection>('.connection-place').filter(function(conn) {
              return connectedDocIds.includes(conn.source) || connectedDocIds.includes(conn.target);
            })
            .transition()
            .duration(200)
            .attr('stroke-width', 3)
            .attr('stroke-opacity', 0.3) // Increase opacity slightly, but not to full
            .style('opacity', 0.3); // Match the style opacity
            
            // Draw temporary connections from word cloud to documents
            connectedDocIds.forEach(docId => {
              const doc = documents.find(d => d.id === docId);
              if (!doc || !doc._initialX || !doc._initialY) return;
              
              // Create a temporary path from term to document
              svg.append('line')
                .attr('class', 'temp-connection')
                .attr('x1', width / 2 + x)
                .attr('y1', height * 0.5 + y)
                .attr('x2', doc._initialX)
                .attr('y2', doc._initialY)
                .attr('stroke', entityColors.term)
                .attr('stroke-width', 2)
                .attr('stroke-dasharray', '5,5')
                .attr('stroke-opacity', 0)
                .transition()
                .duration(200)
                .attr('stroke-opacity', 0.8);
            });
          })
          .on('mouseleave', function(event) {
            const termElement = d3.select(this);
            const termText = termElement.select('.cloud-term').text();
            
            // Reset term styling
            termElement.select('.cloud-term')
              .style('filter', null)
              .transition()
              .duration(200)
              .attr('font-size', fontSize)
              .attr('fill', isDark ? 
                `rgba(229, 231, 235, ${opacity})` : 
                `rgba(31, 41, 55, ${opacity})`);
            
            // Reset shadow
            termElement.select('.cloud-term-shadow')
              .transition()
              .duration(200)
              .attr('font-size', fontSize);
            
            // Reset connected documents
            const connectedDocIds = termToDocuments[termText] || [];
            
            connectedDocIds.forEach(docId => {
              const doc = documents.find(d => d.id === docId);
              if (!doc || !doc._initialX || !doc._initialY) return;
              
              doc._isExpanded = false;
              
              // Reset to original size
              const halfWidth = docWidth / 2;
              const halfHeight = docHeight / 2;
              const scaledHalfWidth = halfWidth * shrinkFactor;
              const scaledHalfHeight = halfHeight * shrinkFactor;
              
              // Escape special characters in document ID for CSS selector
              const safeDocId = getSafeDocId(docId);
              d3.select(`#${safeDocId}`)
                .style('filter', null)
                .transition()
                .duration(200)
                .attr('transform', `translate(${doc._initialX - scaledHalfWidth}, ${doc._initialY - scaledHalfHeight}) scale(${shrinkFactor})`);
            });
            
            // Reset connection lines
            connectionsGroup.selectAll('.connection-person')
              .transition()
              .duration(200)
              .attr('stroke-width', 1.5)
              .attr('stroke-opacity', 0.6); // Person connections maintain higher opacity
            
            connectionsGroup.selectAll('.connection-place')
              .transition()
              .duration(200)
              .attr('stroke-width', 1.5)
              .attr('stroke-opacity', 0.3) // Place connections reset to very low opacity
              .style('opacity', 0.3); // Also reset the style opacity
            
            // Remove temporary connections
            svg.selectAll('.temp-connection')
              .transition()
              .duration(150)
              .attr('stroke-opacity', 0)
              .remove();
          });
      }
    });
    
    // Add mouse drag behavior for panning
    const handlePan = (event: MouseEvent) => {
      if (event.button !== 0) return; // Only left mouse button
      
      const startX = event.clientX;
      const startY = event.clientY;
      const initialTransform = { ...svgTransform };
      
      const handleMove = (e: MouseEvent) => {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const newTransform = {
          x: initialTransform.x + dx,
          y: initialTransform.y + dy,
          scale: initialTransform.scale
        };
        
        setSvgTransform(newTransform);
        
        if (svgGroupRef.current) {
          svg.attr('transform', `translate(${newTransform.x}, ${newTransform.y}) scale(${newTransform.scale})`);
        }
      };
      
      const handleUp = () => {
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', handleUp);
      };
      
      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleUp);
    };
    
    if (svgRef.current) {
      svgRef.current.addEventListener('mousedown', handlePan);
    }
    
    // Clean up event listeners
    return () => {
      if (svgRef.current) {
        svgRef.current.removeEventListener('mousedown', handlePan);
      }
    };
  }, [documents, isDark, width, height, svgTransform, selectedTerms, handleTermClick]);

  // Add an initialZoom effect to scale the visualization properly when it first loads
  useEffect(() => {
    // Call this after the documents are loaded and the SVG has been created
    if (documents.length > 0 && svgGroupRef.current) {
      // Set initial zoom level to ensure everything is visible
      const initialZoom = 1; // Start zoomed out to see more
      setZoomLevel(initialZoom);
      setSvgTransform({ x: 0, y: 0, scale: initialZoom });
      
      d3.select(svgGroupRef.current)
        .transition()
        .duration(300)
        .attr('transform', `translate(0, 0) scale(${initialZoom})`);
    }
  }, [documents.length]); // Only run when documents change

  if (dbConnectionError && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[600px] p-8 text-center bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg">
        <h2 className="text-xl font-semibold mb-4 text-red-600 dark:text-red-400">Database Connection Error</h2>
        <p className="mb-6 text-slate-700 dark:text-slate-300">
          We're having trouble connecting to the database. This could be due to configuration issues or the database may be offline.
        </p>
        <div className="mb-6 text-left p-4 bg-slate-100 dark:bg-slate-800 rounded text-sm font-mono max-w-2xl overflow-x-auto">
          <p>Possible issues:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Database connection string is incorrect</li>
            <li>Database server is not running</li>
            <li>Network connectivity issues</li>
            <li>Prisma client initialization failed</li>
          </ul>
        </div>
        <div className="flex gap-4">
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            onClick={() => {
              // Reset errors and try loading again
              setDbConnectionError(false);
              setIsLoading(true);
              window.location.reload();
            }}
          >
            Retry Connection
          </button>
          <button
            className="px-4 py-2 bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            onClick={() => {
              // Reset database error and show sample data
              setDbConnectionError(false);
              setIsLoading(true);
              setDocuments(getSampleDocuments());
              setIsLoading(false);
            }}
          >
            View Sample Visualization
          </button>
        </div>
      </div>
    );
  }

  if (emptyDatabase && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[600px] p-8 text-center bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg">
        <h2 className="text-xl font-semibold mb-4 text-blue-600 dark:text-blue-400">No Documents in Database</h2>
        <p className="mb-6 text-slate-700 dark:text-slate-300">
          We successfully connected to the database, but there are no JFK documents stored yet.
        </p>
        <div className="mb-6 text-left p-4 bg-slate-100 dark:bg-slate-800 rounded text-sm font-mono max-w-2xl overflow-x-auto">
          <p>Possible next steps:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Upload documents through the document upload page</li>
            <li>Process existing documents with the document processor</li>
            <li>Check that the document processing pipeline is working correctly</li>
            <li>Ensure documents are being saved with the correct document schema</li>
          </ul>
        </div>
        <div className="flex gap-4">
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            onClick={() => {
              // Reset errors and try loading again
              setEmptyDatabase(false);
              setIsLoading(true);
              window.location.reload();
            }}
          >
            Check Again
          </button>
          <button
            className="px-4 py-2 bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            onClick={() => {
              // Show sample data
              setEmptyDatabase(false);
              setIsLoading(true);
              setDocuments(getSampleDocuments());
              setIsLoading(false);
            }}
          >
            View Sample Visualization
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full min-h-[600px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <span className="ml-2">Loading visualization...</span>
      </div>
    );
  }
  
  return (
    <div 
      className="relative w-full h-full overflow-hidden border border-gray-200 dark:border-gray-700 rounded-lg"
      style={{ maxHeight: '100%', display: 'flex', flexDirection: 'column', margin: 0, padding: 0 }}
    >
      {/* Active Search Filters */}
      {selectedTerms.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          padding: '12px',
          backgroundColor: isDark ? 'rgba(30, 41, 59, 0.9)' : 'rgba(255, 255, 255, 0.9)',
          borderRadius: '6px',
          boxShadow: '0 2px 5px rgba(0, 0, 0, 0.1)',
          maxWidth: '300px'
        }}>
          <div style={{ 
            fontSize: '14px', 
            fontWeight: 'bold', 
            color: isDark ? '#e5e7eb' : '#111827',
            marginBottom: '4px'
          }}>
            Active Filters:
          </div>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {selectedTerms.map(term => {
              // Parse the term to determine its type
              let label = term;
              let color = entityColors.term;
              let type = '';
              
              if (term.startsWith('person:')) {
                label = term.substring(7);
                color = entityColors.person;
                type = 'person';
              } else if (term.startsWith('place:')) {
                label = term.substring(6);
                color = entityColors.place;
                type = 'place';
              } else if (term.startsWith('text:')) {
                label = term.substring(5);
                color = entityColors.term;
                type = 'text';
              } else if (term.startsWith('date:')) {
                label = term.substring(5);
                color = '#9333ea'; // Purple for dates
                type = 'date';
              }
              
              return (
                <span 
                  key={term} 
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    backgroundColor: color + '22', // 13% opacity
                    border: `1px solid ${color}66`, // 40% opacity 
                    color: isDark ? '#e5e7eb' : '#1f2937',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    maxWidth: '100%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                  onClick={() => {
                    // Remove filter when clicked
                    setSelectedTerms(prev => prev.filter(t => t !== term));
                    
                    // If this was a date filter, reset the date inputs
                    if (type === 'date') {
                      // We can't directly modify props, so we need the parent to handle this
                      // For now, we can just remove the filter and let the parent component
                      // decide what to do with the date inputs
                    } else if (type && term.includes(':')) {
                      // If this was a regular search term, find the search input and update it
                      const searchInput = document.querySelector('.search-input') as HTMLInputElement;
                      if (searchInput) {
                        searchInput.value = '';
                        
                        // Create a visual flash effect to show the input was cleared
                        const originalBackground = searchInput.style.backgroundColor;
                        searchInput.style.backgroundColor = isDark ? '#fecaca' : '#fee2e2'; // Red flash
                        searchInput.style.transition = 'background-color 0.5s';
                        
                        setTimeout(() => {
                          searchInput.style.backgroundColor = originalBackground;
                        }, 500);
                      }
                    }
                    
                    // Trigger a search without the removed filter
                    if (onSearch) {
                      setTimeout(() => {
                        onSearch();
                      }, 100);
                    }
                    
                    // Update localStorage
                    try {
                      const updatedTerms = selectedTerms.filter(t => t !== term);
                      localStorage.setItem('chronosphereSearchTerms', JSON.stringify(updatedTerms));
                    } catch (e) {
                      console.warn('Failed to save search terms to localStorage:', e);
                    }
                  }}
                  title={`Remove filter: ${label}`}
                >
                  {label}
                  <X size={14} />
                </span>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Controls */}
      <div style={{ 
        position: 'absolute', 
        top: '16px', 
        right: '16px',
        zIndex: 10,
        display: 'flex',
        gap: '8px',
        padding: '8px',
        backgroundColor: isDark ? 'rgba(30, 41, 59, 0.9)' : 'rgba(255, 255, 255, 0.9)',
        borderRadius: '6px',
        boxShadow: '0 2px 5px rgba(0, 0, 0, 0.1)'
      }}>
        <button
          onClick={() => handleZoom('out')}
          style={{ 
            padding: '4px', 
            borderRadius: '4px', 
            cursor: 'pointer',
            backgroundColor: 'transparent',
            border: 'none',
            color: isDark ? '#e5e7eb' : '#1f2937',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title="Zoom out"
        >
          <ZoomOut size={18} />
        </button>
        <div style={{ 
          paddingLeft: '8px', 
          paddingRight: '8px', 
          display: 'flex', 
          alignItems: 'center', 
          fontSize: '14px',
          fontWeight: 500
        }}>
          {Math.round(zoomLevel * 100)}%
        </div>
        <button
          onClick={() => handleZoom('in')}
          style={{ 
            padding: '4px', 
            borderRadius: '4px', 
            cursor: 'pointer',
            backgroundColor: 'transparent',
            border: 'none',
            color: isDark ? '#e5e7eb' : '#1f2937',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title="Zoom in"
        >
          <ZoomIn size={18} />
        </button>
        <button
          onClick={resetView}
          style={{ 
            padding: '4px', 
            borderRadius: '4px', 
            cursor: 'pointer',
            backgroundColor: 'transparent',
            border: 'none',
            color: isDark ? '#e5e7eb' : '#1f2937',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title="Reset view"
        >
          <Maximize2 size={18} />
        </button>
      </div>
      
      {/* Main visualization */}
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        className="bg-slate-50 dark:bg-slate-900"
        style={{ display: 'block', flexGrow: 1 }}
      >
        <defs>
          <radialGradient id="bg-gradient" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor={isDark ? 'rgba(30, 41, 59, 0.5)' : 'rgba(255, 255, 255, 0.5)'} />
            <stop offset="100%" stopColor={isDark ? 'rgba(15, 23, 42, 0)' : 'rgba(248, 250, 252, 0)'} />
          </radialGradient>
        </defs>
      </svg>
      
      {/* Status bar */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '32px',
        padding: '0 16px',
        display: 'flex',
        alignItems: 'center',
        fontSize: '12px',
        backgroundColor: isDark ? 'rgba(30, 41, 59, 0.9)' : 'rgba(255, 255, 255, 0.9)',
        borderTop: isDark ? '1px solid #374151' : '1px solid #e5e7eb'
      }}>
        <span style={{ marginRight: 'auto' }}>{documents.length} documents</span>
        <span>
          {selectedTerms.length > 0 ? 
            `${selectedTerms.length} active filters` : 
            'Click on words, people, or places to search. Shift+click to select multiple.'
          }
        </span>
      </div>
    </div>
  );
}
