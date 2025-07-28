"use client";

import React, { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Download, Info, Users, MapPin, Calendar, Package, Stamp, FileText, ChevronDown, ChevronUp, Maximize2, X, Clock } from 'lucide-react';
import { Card, CardContent } from '../../../components/ui/card';
import EnhancedTimelineVisualization from '../../components/custom-visualizations/EnhancedTimelineVisualization';
import EnhancedMapVisualization from '../../components/custom-visualizations/EnhancedMapVisualization';
import ChatInterface from '../../../components/ui/ChatInterface';
import { AddToDocumentDock } from '../../../components/ui/AddToDocumentDock';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.oip.onl';

// Keep these for fallback if needed
function SimplifiedTimelineVisualization({ startDate, endDate, events = [] }: { startDate: string | null, endDate: string | null, events?: Array<{date: string, label: string}> }) {
  if (!startDate) return <p className="text-center text-gray-500 text-xs italic">No date information available</p>;
  
  const formatShortDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div className="w-full p-4 rounded-lg border-4 border-blue-500 bg-white mb-4">
      <h3 className="font-bold text-lg text-blue-800 mb-4">UPDATED Timeline</h3>
      
      {/* Super Simple Horizontal Timeline */}
      <div className="relative">
        {/* Base line */}
        <div className="absolute left-0 right-0 h-2 bg-blue-500 top-6"></div>
        
        <div className="pt-2">
          {/* Event list with forced horizontal layout */}
          <div className="flex justify-between items-start pt-8 pb-4">
            {/* Start date */}
            <div className="text-center shrink-0 mr-2">
              <div className="w-4 h-4 rounded-full bg-blue-600 mx-auto mb-1"></div>
              <div className="text-xs bg-blue-100 px-2 py-1 rounded font-bold text-blue-800">
                {formatShortDate(startDate)}
              </div>
            </div>
            
            {/* Events */}
            {events.map((event, index) => (
              <div key={index} className="text-center shrink-0 mx-2">
                <div className="w-4 h-4 rounded-full bg-red-500 mx-auto mb-1"></div>
                <div className="text-xs bg-red-100 px-2 py-1 rounded font-bold text-red-800 whitespace-nowrap">
                  {formatShortDate(event.date)}
                </div>
                <div className="text-xs text-gray-700 mt-1 whitespace-nowrap">{event.label}</div>
              </div>
            ))}
            
            {/* End date (if different) */}
            {endDate && endDate !== startDate && (
              <div className="text-center shrink-0 ml-2">
                <div className="w-4 h-4 rounded-full bg-blue-600 mx-auto mb-1"></div>
                <div className="text-xs bg-blue-100 px-2 py-1 rounded font-bold text-blue-800">
                  {formatShortDate(endDate)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Simple map component for fallback
function SimplePlacesVisualization({ places = [] }: { places: string[] }) {
  // Simplified places display
  return (
    <div className="w-full p-4 rounded-lg border-4 border-green-500 bg-white mb-4">
      <h3 className="font-bold text-lg text-green-800 mb-4">UPDATED Map</h3>

      {/* Map container */}
      <div className="relative w-full aspect-2/1 border-2 border-green-300 overflow-hidden rounded-lg mb-3">
        {/* Map image */}
        <img 
          src="/world-map-simple.png" 
          alt="World Map" 
          className="absolute inset-0 w-full h-full object-cover"
        />
        
        {/* Simplified Pin Markers - using fixed coordinates for key locations */}
        {places.slice(0, 10).map((place, index) => {
          // Fixed positions for common places
          const positions: Record<string, {x: number, y: number}> = {
            "Washington": {x: 25, y: 40},
            "Moscow": {x: 60, y: 35},
            "Dallas": {x: 22, y: 40},
            "Cuba": {x: 25, y: 45},
            "Mexico City": {x: 20, y: 48},
            "New Orleans": {x: 24, y: 43},
            "Miami": {x: 26, y: 43},
            "Chicago": {x: 24, y: 38},
            "New York": {x: 27, y: 38},
            "Los Angeles": {x: 15, y: 40},
            "Berlin": {x: 50, y: 35},
            "Paris": {x: 48, y: 37},
            "London": {x: 46, y: 35},
            "Tokyo": {x: 80, y: 40},
            "Beijing": {x: 75, y: 38},
            "Hong Kong": {x: 75, y: 45},
            "Vietnam": {x: 75, y: 48},
            "ODOYNE": {x: 47, y: 32},
            "UK": {x: 46, y: 35},
            "Czech": {x: 52, y: 36},
            "Soviet": {x: 60, y: 30},
            "USSR": {x: 65, y: 32},
            "Havana": {x: 25, y: 45},
            "Costa Rica": {x: 23, y: 48},
            "Panama": {x: 24, y: 49},
            "Matanzas": {x: 25, y: 46}
          };
          
          // Default position for unknown places
          let x = 20 + (index * 6) % 60; // Spread them out horizontally
          let y = 35 + (index * 3) % 20; // And vertically
          
          // Use known position if available
          if (positions[place]) {
            x = positions[place].x;
            y = positions[place].y;
          }
          
          return (
            <div
              key={`pin-${index}`}
              className="absolute"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                transform: 'translate(-50%, -50%)',
                zIndex: 20
              }}
            >
              {/* Extra large, obvious pin design */}
              <div className="w-8 h-8 rounded-full bg-red-600 border-2 border-white shadow-lg flex items-center justify-center text-white text-xs font-bold">
                {index + 1}
              </div>
              
              {/* Always visible label */}
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 bg-black text-white text-xs rounded py-1 px-2 mt-1 whitespace-nowrap">
                {place}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Location list */}
      <div className="flex flex-wrap gap-2 mt-3">
        {places.slice(0, 10).map((place, idx) => (
          <div key={`place-tag-${idx}`} className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold flex items-center">
            <span className="w-4 h-4 rounded-full bg-red-600 mr-1 flex items-center justify-center text-white text-[8px] font-bold">{idx+1}</span>
            {place}
          </div>
        ))}
      </div>
    </div>
  );
}

function DocumentSummarySection({ 
  document, 
  currentPage, 
  isArchiveId,
  isHashedId,
  showFullSummary,
  setShowFullSummary
}: { 
  document: any; 
  currentPage: number;
  isArchiveId?: boolean;
  isHashedId?: boolean;
  showFullSummary: boolean;
  setShowFullSummary: (value: boolean) => void;
}) {
  // ... existing code ...
  
  return (
    <div 
      className="bg-gray-50 rounded-lg p-4 mb-4 shadow-sm" 
      style={{ 
        backgroundColor: '#f9fafb', /* Replace bgColor with a fixed color value */
        padding: '1.5rem', 
        borderRadius: '0.5rem',
        position: 'relative' 
      }}
    >
      <div className="flex justify-between items-start mb-2">
        <h2 className="text-xl font-bold text-gray-800 grow">{document?.title || 'JFK Document'}</h2>
        <button
          onClick={() => setShowFullSummary(!showFullSummary)}
          className="text-blue-600 hover:text-blue-800 text-sm flex items-center"
        >
          {showFullSummary ? 'Show Less' : 'Show Full Summary'}
          {showFullSummary ? 
            <ChevronUp style={{ width: '1rem', height: '1rem' }} /> : 
            <ChevronDown style={{ width: '1rem', height: '1rem' }} />
          }
        </button>
      </div>
      
      {/* Display ID information */}
      <div className="text-sm text-gray-600 mb-3 flex flex-col gap-1">
        {isArchiveId && (
          <div className="flex items-center">
            <span className="font-medium mr-2">Archive ID:</span> 
            <span>{document?.originalId || document?.archiveId}</span>
            <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">External ID</span>
          </div>
        )}
        {isHashedId && (
          <div className="flex items-center">
            <span className="font-medium mr-2">Archive ID:</span> 
            <span>{document?.originalId}</span>
            <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-xs">Found via Hash</span>
          </div>
        )}
        <div className="flex items-center">
          <span className="font-medium mr-2">Database ID:</span> 
          <span className="font-mono">{document?.id}</span>
        </div>
      </div>
      
      {/* ... existing code ... */}
    </div>
  );
}

// Main document page component
export default function DocumentPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const { id } = params;
  const [document, setDocument] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [imageSrc, setImageSrc] = useState<string>('');
  const [imageError, setImageError] = useState<string | null>(null);
  const [useProxy, setUseProxy] = useState<boolean>(true);

  // UI state variables
  const [showFullSummary, setShowFullSummary] = useState<boolean>(false);
  const [expandedImageIdx, setExpandedImageIdx] = useState<number | null>(null);

  // UPDATING - Add state to track image loading
  const [isMapImageLoaded, setIsMapImageLoaded] = useState<boolean>(false);

  // Add state to track how the document was found
  const [isArchiveId, setIsArchiveId] = useState<boolean>(false);
  const [isHashedId, setIsHashedId] = useState<boolean>(false);
  const [originalId, setOriginalId] = useState<string | null>(null);

  // Define timeline event type
  type TimelineEvent = {
    date: string;
    label: string;
  };

  // Define page content type
  type PageContent = {
    pageNumber: number;
    imagePath: string;
    summary: string;
    fullText: string;
    dates?: string[];
    names?: string[];
    places?: string[];
    objects?: string[];
  };

  // Add state for all document dates and current page dates
  const [allDocumentDates, setAllDocumentDates] = useState<string[]>([]);
  const [currentPageDates, setCurrentPageDates] = useState<string[]>([]);

  // Add state for tracking current page entities and mapping entities to their pages
  const [currentPageNames, setCurrentPageNames] = useState<string[]>([]);
  const [currentPagePlaces, setCurrentPagePlaces] = useState<string[]>([]);
  const [currentPageObjects, setCurrentPageObjects] = useState<string[]>([]);
  const [entityToPageMap, setEntityToPageMap] = useState<{
    names: Record<string, number[]>,
    places: Record<string, number[]>,
    objects: Record<string, number[]>
  }>({
    names: {},
    places: {},
    objects: {}
  });

  // Mock data for timeline
  const mockEvents: TimelineEvent[] = [
    // { date: '1963-08-10', label: 'Memo drafted' },
    // { date: '1963-09-21', label: 'Report filed' },
    // { date: '1963-11-02', label: 'Follow-up' },
    // { date: '1963-11-22', label: 'Assassination' },
    // { date: '1963-12-15', label: 'Investigation' },
  ];

  // Mock locations
  const mockPlaces: string[] = [
    // "Washington", "Moscow", "Dallas", "Cuba", "Mexico City", 
    // "New Orleans", "Miami", "Chicago", "New York", "Los Angeles",
    // "Berlin", "Paris", "London", "Tokyo"
  ];

  // Add state for page tabs
  const [activeTab, setActiveTab] = useState<'pageSummary' | 'pageText'>('pageSummary');
  const [pageContent, setPageContent] = useState<PageContent | null>(null);
  const [isLoadingPageContent, setIsLoadingPageContent] = useState<boolean>(false);
  const [pageContentError, setPageContentError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDocument() {
      try {
        setIsLoading(true);
        setError(null);
        
        console.log(`Fetching document with ID: ${id}`);
        
        // First try to fetch the document directly
        const response = await fetch(`/api/jfk/documents/${id}`);
        
        if (response.ok) {
          const data = await response.json();
          console.log("Document found:", data);
          // Add this detailed log to inspect document structure
          console.log("Document structure debug:", {
            hasAllNames: !!data.allNames,
            hasNames: data.names ? true : false,
            allNamesLength: data.allNames?.length || 0,
            documentDataType: typeof data,
            documentKeys: Object.keys(data),
            documentAllNamesType: data.allNames ? typeof data.allNames : 'undefined',
            documentObjectType: typeof data.document,
            documentObjectKeys: data.document ? Object.keys(data.document) : []
          });
          
          // Enhanced debugging for RFK documents
          const isRfkDocument = id.toLowerCase().includes('rfk') || 
                              (data.documentGroup && data.documentGroup.toLowerCase() === 'rfk') || 
                              (data.documentType && data.documentType.toLowerCase() === 'rfk');
          
          if (isRfkDocument) {
            console.log("RFK Document detected, debugging entity data:", {
              id: id,
              // Check all possible entity locations
              docAllNames: data.allNames,
              docAllPlaces: data.allPlaces,
              docAllObjects: data.allObjects,
              nestedDocAllNames: data.document?.allNames,
              nestedDocNames: data.document?.names,
              nestedPlaces: data.document?.places || data.document?.allPlaces,
              nestedObjects: data.document?.objects || data.document?.allObjects,
              // Check if data exists in the raw document field
              rawDocument: typeof data.document === 'string' ? "String - needs parsing" : "Object structure"
            });
          }
          
          // Fix: Combine data with nested document properties to ensure allNames, allPlaces, and allObjects are available
          let documentData = {
            ...data,
            // If the response has a nested document object with the arrays, pull them up to the top level
            ...(data.document && {
              allNames: data.document.names || data.document.allNames || data.names || data.allNames || [],
              allPlaces: data.document.places || data.document.allPlaces || data.places || data.allPlaces || [],
              allObjects: data.document.objects || data.document.allObjects || data.objects || data.allObjects || []
            })
          };
          
          // Handle case where entity data might be stored in string JSON form
          if (typeof data.document === 'string') {
            try {
              const parsedDoc = JSON.parse(data.document);
              console.log("Parsed string document data:", Object.keys(parsedDoc));
              
              // Merge with existing documentData
              documentData = {
                ...documentData,
                allNames: documentData.allNames?.length ? documentData.allNames : (parsedDoc.names || parsedDoc.allNames || []),
                allPlaces: documentData.allPlaces?.length ? documentData.allPlaces : (parsedDoc.places || parsedDoc.allPlaces || []),
                allObjects: documentData.allObjects?.length ? documentData.allObjects : (parsedDoc.objects || parsedDoc.allObjects || [])
              };
            } catch (e) {
              console.error("Failed to parse document JSON string:", e);
            }
          }
          
          // Final check if entity arrays exist, are valid, and initialize if needed
          if (!Array.isArray(documentData.allNames)) documentData.allNames = [];
          if (!Array.isArray(documentData.allPlaces)) documentData.allPlaces = [];
          if (!Array.isArray(documentData.allObjects)) documentData.allObjects = [];
          
          console.log("Final prepared document data:", {
            namesCount: documentData.allNames.length,
            placesCount: documentData.allPlaces.length,
            objectsCount: documentData.allObjects.length
          });
          
          setDocument(documentData);
          setIsArchiveId(false);
          setIsHashedId(false);
          setIsLoading(false);
          return;
        }
        
        // If not found (404), try the lookup endpoint which handles hash fallback
        if (response.status === 404) {
          console.log("Document not found by direct ID, trying lookup API...");
          const lookupResponse = await fetch(`/api/jfk/lookup?id=${id}`);
          
          if (lookupResponse.ok) {
            const lookupData = await lookupResponse.json();
            console.log("Document found via lookup:", lookupData);
            
            // Check if this is an RFK document
            const isRfkLookup = id.toLowerCase().includes('rfk') || 
                              (lookupData.documentGroup && lookupData.documentGroup.toLowerCase() === 'rfk') || 
                              (lookupData.documentType && lookupData.documentType.toLowerCase() === 'rfk');
            
            if (isRfkLookup) {
              console.log("RFK Document detected in lookup, debugging entity data:", {
                id: id,
                docAllNames: lookupData.allNames,
                docAllPlaces: lookupData.allPlaces,
                docAllObjects: lookupData.allObjects,
                nestedDocAllNames: lookupData.document?.allNames,
                nestedDocNames: lookupData.document?.names,
                nestedPlaces: lookupData.document?.places || lookupData.document?.allPlaces,
                nestedObjects: lookupData.document?.objects || lookupData.document?.allObjects,
                rawDocument: typeof lookupData.document === 'string' ? "String - needs parsing" : "Object structure"
              });
            }
            
            // Apply the same fix to extract entity data
            let documentData = {
              ...lookupData,
              // If the response has a nested document object with the arrays, pull them up to the top level
              ...(lookupData.document && {
                allNames: lookupData.document.names || lookupData.document.allNames || lookupData.names || lookupData.allNames || [],
                allPlaces: lookupData.document.places || lookupData.document.allPlaces || lookupData.places || lookupData.allPlaces || [],
                allObjects: lookupData.document.objects || lookupData.document.allObjects || lookupData.objects || lookupData.allObjects || []
              })
            };
            
            // Handle case where entity data might be stored in string JSON form
            if (typeof lookupData.document === 'string') {
              try {
                const parsedDoc = JSON.parse(lookupData.document);
                console.log("Parsed string document data from lookup:", Object.keys(parsedDoc));
                
                // Merge with existing documentData
                documentData = {
                  ...documentData,
                  allNames: documentData.allNames?.length ? documentData.allNames : (parsedDoc.names || parsedDoc.allNames || []),
                  allPlaces: documentData.allPlaces?.length ? documentData.allPlaces : (parsedDoc.places || parsedDoc.allPlaces || []),
                  allObjects: documentData.allObjects?.length ? documentData.allObjects : (parsedDoc.objects || parsedDoc.allObjects || [])
                };
              } catch (e) {
                console.error("Failed to parse document JSON string from lookup:", e);
              }
            }
            
            // Final check if entity arrays exist, are valid, and initialize if needed
            if (!Array.isArray(documentData.allNames)) documentData.allNames = [];
            if (!Array.isArray(documentData.allPlaces)) documentData.allPlaces = [];
            if (!Array.isArray(documentData.allObjects)) documentData.allObjects = [];
            
            console.log("Final prepared lookup document data:", {
              namesCount: documentData.allNames.length,
              placesCount: documentData.allPlaces.length,
              objectsCount: documentData.allObjects.length
            });
            
            setDocument(documentData);
            
            // Check if the document was found through archive ID or hash
            if (lookupData.isHashedId) {
              console.log("Document was found via hash lookup");
              setIsHashedId(true);
              setOriginalId(lookupData.originalId);
            }
            
            if (lookupData.originalId && lookupData.originalId === id) {
              setIsArchiveId(true);
            }
            
            setIsLoading(false);
            return;
          }
          
          // If all lookups fail, set error
          setError("Document not found. Please check the ID and try again.");
        } else {
          // Handle other errors
          setError(`Error fetching document: ${response.statusText}`);
        }
      } catch (err) {
        console.error("Error fetching document:", err);
        setError("An error occurred while fetching the document. Please try again later.");
      }
      
      setIsLoading(false);
    }

    fetchDocument();
  }, [id]);

  // Add function to fetch page content whenever the page changes
  useEffect(() => {
    async function fetchPageContent() {
      if (!document || !currentPage) return;
      
      // Use document.id (internal ID) if available, otherwise fall back to URL id param
      const effectiveId = document.id || id;
      
      setIsLoadingPageContent(true);
      setPageContentError(null);
      
      try {
        // First attempt to fetch without getLatestPageData
        const cleanId = typeof effectiveId === 'string' ? effectiveId.replace(/^\/+/, '') : effectiveId;
        
        // Determine if this is an RFK document
        const isRfkDocument = 
          (document?.documentGroup && document.documentGroup.toLowerCase() === 'rfk') ||
          (document?.documentType && document.documentType.toLowerCase() === 'rfk') ||
          (typeof cleanId === 'string' && cleanId.toLowerCase().includes('rfk'));
        
        // Add collection parameter for RFK documents
        const collectionParam = isRfkDocument ? '&collection=rfk' : '';
        
        console.log(`Fetching page content for ${isRfkDocument ? 'RFK' : 'JFK'} document: ${cleanId}`);
        
        const initialAnalysisUrl = useProxy 
          ? `/api/jfk/proxy?url=${encodeURIComponent(`${API_BASE_URL}/api/jfk/media?id=${cleanId}&type=analysis${collectionParam}`)}`
          : `${API_BASE_URL}/api/jfk/media?id=${cleanId}&type=analysis${collectionParam}`;
        
        let response = await fetch(initialAnalysisUrl);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch page content: ${response.status} ${response.statusText}`);
        }
        
        let data = await response.json();
        let needFullPageData = false;
        
        // Check if all pages have dates arrays
        if (data.pages && Array.isArray(data.pages)) {
          // Check if any page is missing the dates array
          needFullPageData = data.pages.some((page: PageContent) => !page.dates || !Array.isArray(page.dates));
        } else {
          // If pages array doesn't exist or isn't an array, we need full data
          needFullPageData = true;
        }
        
        // If we need full page data, make a second request with getLatestPageData=true
        if (needFullPageData) {
          console.log("Some pages missing dates array - fetching full page data...");
          const fullAnalysisUrl = useProxy 
            ? `/api/jfk/proxy?url=${encodeURIComponent(`${API_BASE_URL}/api/jfk/media?id=${cleanId}&type=analysis&getLatestPageData=true${collectionParam}`)}`
            : `${API_BASE_URL}/api/jfk/media?id=${cleanId}&type=analysis&getLatestPageData=true${collectionParam}`;
          
          response = await fetch(fullAnalysisUrl);
          
          if (!response.ok) {
            throw new Error(`Failed to fetch full page content: ${response.status} ${response.statusText}`);
          }
          
          data = await response.json();
        } else {
          console.log("All pages already have dates - using cached data");
        }
        
        // Collect all dates from all pages for the timeline
        const allDates: string[] = [];
        // Initialize entity to page maps
        const namesMap: Record<string, number[]> = {};
        const placesMap: Record<string, number[]> = {};
        const objectsMap: Record<string, number[]> = {};

        if (data.pages && Array.isArray(data.pages)) {
          data.pages.forEach((page: PageContent) => {
            const pageNum = page.pageNumber;
            
            // Process dates
            if (page.dates && Array.isArray(page.dates)) {
              page.dates.forEach(date => {
                if (!allDates.includes(date)) {
                  allDates.push(date);
                }
              });
            }
            
            // Process names
            if (page.names && Array.isArray(page.names)) {
              page.names.forEach(name => {
                if (!namesMap[name]) {
                  namesMap[name] = [];
                }
                if (!namesMap[name].includes(pageNum)) {
                  namesMap[name].push(pageNum);
                }
              });
            }
            
            // Process places
            if (page.places && Array.isArray(page.places)) {
              page.places.forEach(place => {
                if (!placesMap[place]) {
                  placesMap[place] = [];
                }
                if (!placesMap[place].includes(pageNum)) {
                  placesMap[place].push(pageNum);
                }
              });
            }
            
            // Process objects
            if (page.objects && Array.isArray(page.objects)) {
              page.objects.forEach(object => {
                if (!objectsMap[object]) {
                  objectsMap[object] = [];
                }
                if (!objectsMap[object].includes(pageNum)) {
                  objectsMap[object].push(pageNum);
                }
              });
            }
          });
          
          setAllDocumentDates(allDates);
          setEntityToPageMap({
            names: namesMap,
            places: placesMap,
            objects: objectsMap
          });
        }
        
        // Find the current page in the pages array
        if (data.pages && Array.isArray(data.pages)) {
          const pageData = data.pages.find((p: PageContent) => p.pageNumber === currentPage);
          
          if (pageData) {
            // Enhanced entity field extraction
            // Some implementations might use different field names, so check multiple possibilities
            const pageNames = pageData.names || pageData.allNames || pageData.people || [];
            const pagePlaces = pageData.places || pageData.allPlaces || pageData.locations || [];
            const pageDates = pageData.dates || pageData.allDates || [];
            const pageObjects = pageData.objects || pageData.allObjects || [];
            
            // Ensure all arrays are valid
            const ensureArray = (possibleArray: any): any[] => {
              if (Array.isArray(possibleArray)) return possibleArray;
              return [];
            };
            
            // Debug log for RFK document page content
            if (document?.documentGroup?.toLowerCase() === 'rfk' || document?.documentType?.toLowerCase() === 'rfk' || 
                (document?.id && document.id.toString().toLowerCase().includes('rfk'))) {
              console.log(`RFK document page ${currentPage} content debug:`, {
                rawPageData: pageData,
                extractedNames: pageNames,
                extractedPlaces: pagePlaces,
                extractedDates: pageDates,
                extractedObjects: pageObjects
              });
            }
            
            setPageContent(pageData);
            // Set current page entities for highlighting
            setCurrentPageDates(ensureArray(pageDates));
            setCurrentPageNames(ensureArray(pageNames));
            setCurrentPagePlaces(ensureArray(pagePlaces));
            setCurrentPageObjects(ensureArray(pageObjects));
          } else {
            setPageContentError(`No content available for page ${currentPage}`);
            setPageContent(null);
            setCurrentPageDates([]);
            setCurrentPageNames([]);
            setCurrentPagePlaces([]);
            setCurrentPageObjects([]);
          }
        } else {
          setPageContentError("Page content data is not available in the expected format");
          setPageContent(null);
          setCurrentPageDates([]);
          setCurrentPageNames([]);
          setCurrentPagePlaces([]);
          setCurrentPageObjects([]);
        }
      } catch (err) {
        console.error("Error fetching page content:", err);
        setPageContentError(err instanceof Error ? err.message : "Unknown error fetching page content");
        setPageContent(null);
        setCurrentPageDates([]);
        setCurrentPageNames([]);
        setCurrentPagePlaces([]);
        setCurrentPageObjects([]);
      } finally {
        setIsLoadingPageContent(false);
      }
    }

    if (document) {
      fetchPageContent();
    }
  }, [currentPage, document, id, useProxy]);

  // Update image source when page changes
  useEffect(() => {
    if (document) {
      // Use document.id (internal ID) if available, otherwise fall back to URL id param
      const effectiveId = document.id || id;
      // Remove any leading slashes from the ID
      const cleanId = typeof effectiveId === 'string' ? effectiveId.replace(/^\/+/, '') : effectiveId;
      
      // Determine if this is an RFK document
      const isRfkDocument = 
        (document?.documentGroup && document.documentGroup.toLowerCase() === 'rfk') ||
        (document?.documentType && document.documentType.toLowerCase() === 'rfk') ||
        (typeof cleanId === 'string' && cleanId.toLowerCase().includes('rfk'));
      
      // Add collection parameter for RFK documents
      const collectionParam = isRfkDocument ? '&collection=rfk' : '';
      
      console.log(`Document is ${isRfkDocument ? 'an RFK' : 'a JFK'} document`);
      
      const baseUrl = useProxy 
        ? `/api/jfk/proxy?url=${encodeURIComponent(`${API_BASE_URL}/api/jfk/media?id=${cleanId}&type=image&filename=page-${currentPage}.png${collectionParam}`)}`
        : `${API_BASE_URL}/api/jfk/media?id=${cleanId}&type=image&filename=page-${currentPage}.png${collectionParam}`;
        
      const newImageSrc = baseUrl;
      setImageSrc(newImageSrc);
      setImageError(null);
      console.log(`Loading image from: ${newImageSrc}`);
      
      // Test the image URL directly
      const testUrl = useProxy ? newImageSrc : `${API_BASE_URL}/api/jfk/media?id=${cleanId}&type=image&filename=page-${currentPage}.png${collectionParam}`;
      fetch(testUrl, { method: 'HEAD' })
        .then(response => {
          console.log(`Image HEAD request status: ${response.status}`);
          if (!response.ok) {
            setImageError(`Server returned error ${response.status}: ${response.statusText}`);
          }
        })
        .catch(err => {
          console.error('Error testing image URL:', err);
          setImageError(`Network error: ${err.message}`);
        });
    }
  }, [currentPage, document, id, useProxy]);

  // Helper functions for media URLs
  const getDocumentJsonUrl = () => {
    // Always use document.id (internal ID) for media URLs
    const effectiveId = document?.id;
    
    if (!effectiveId) return '';
    
    // Remove any leading slashes from the ID
    const cleanId = typeof effectiveId === 'string' ? effectiveId.replace(/^\/+/, '') : effectiveId;
    
    // Determine if this is an RFK document
    const isRfkDocument = 
      (document?.documentGroup && document.documentGroup.toLowerCase() === 'rfk') ||
      (document?.documentType && document.documentType.toLowerCase() === 'rfk') ||
      (typeof cleanId === 'string' && cleanId.toLowerCase().includes('rfk'));
    
    // Add collection parameter for RFK documents
    const collectionParam = isRfkDocument ? '&collection=rfk' : '';
    
    return useProxy 
      ? `/api/jfk/proxy?url=${encodeURIComponent(`${API_BASE_URL}/api/jfk/media?id=${cleanId}&type=analysis${collectionParam}`)}`
      : `${API_BASE_URL}/api/jfk/media?id=${cleanId}&type=analysis${collectionParam}`;
  };

  const getDocumentPdfUrl = () => {
    // Always use document.id (internal ID) for media URLs
    const effectiveId = document?.id;
    
    if (!effectiveId) return '';
    
    // Remove any leading slashes from the ID
    const cleanId = typeof effectiveId === 'string' ? effectiveId.replace(/^\/+/, '') : effectiveId;
    
    // Determine if this is an RFK document
    const isRfkDocument = 
      (document?.documentGroup && document.documentGroup.toLowerCase() === 'rfk') ||
      (document?.documentType && document.documentType.toLowerCase() === 'rfk') ||
      (typeof cleanId === 'string' && cleanId.toLowerCase().includes('rfk'));
    
    // Add collection parameter for RFK documents
    const collectionParam = isRfkDocument ? '&collection=rfk' : '';
    
    return useProxy
      ? `/api/jfk/proxy?url=${encodeURIComponent(`${API_BASE_URL}/api/jfk/media?id=${cleanId}&type=pdf${collectionParam}`)}`
      : `${API_BASE_URL}/api/jfk/media?id=${cleanId}&type=pdf${collectionParam}`;
  };

  const getPageImageUrl = (pageNum: number) => {
    // Always use document.id (internal ID) for media URLs
    const effectiveId = document?.id;
    
    if (!effectiveId) return '';
    
    // Remove any leading slashes from the ID
    const cleanId = typeof effectiveId === 'string' ? effectiveId.replace(/^\/+/, '') : effectiveId;
    
    // Determine if this is an RFK document
    const isRfkDocument = 
      (document?.documentGroup && document.documentGroup.toLowerCase() === 'rfk') ||
      (document?.documentType && document.documentType.toLowerCase() === 'rfk') ||
      (typeof cleanId === 'string' && cleanId.toLowerCase().includes('rfk'));
    
    // Add collection parameter for RFK documents
    const collectionParam = isRfkDocument ? '&collection=rfk' : '';
    
    return useProxy
      ? `/api/jfk/proxy?url=${encodeURIComponent(`${API_BASE_URL}/api/jfk/media?id=${cleanId}&type=image&filename=page-${pageNum}.png${collectionParam}`)}`
      : `${API_BASE_URL}/api/jfk/media?id=${cleanId}&type=image&filename=page-${pageNum}.png${collectionParam}`;
  };

  // Function to handle image load errors
  const handleImageError = (pageNum: number, event: React.SyntheticEvent<HTMLImageElement>) => {
    const targetUrl = getPageImageUrl(pageNum);
    console.error(`Failed to load image for page ${pageNum}: ${targetUrl}`);
    setImageError(`Failed to load image for page ${pageNum}`);
    
    // Log additional details about the error
    const imgElement = event.target as HTMLImageElement;
    console.log('Image element:', {
      naturalWidth: imgElement.naturalWidth,
      naturalHeight: imgElement.naturalHeight,
      complete: imgElement.complete,
      currentSrc: imgElement.currentSrc
    });
  };

  // Function to handle successful image load
  const handleImageLoad = (pageNum: number) => {
    console.log(`Successfully loaded image for page ${pageNum}`);
    setImageError(null);
  };

  // Function to handle map image load
  const handleMapImageLoad = () => {
    console.log("Map image loaded successfully");
    setIsMapImageLoaded(true);
  };

  // Function to format dates nicely
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Unknown';
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }).format(date);
    } catch (e) {
      return dateString;
    }
  };

  // Page navigation
  const goToNextPage = () => {
    if (document && document.pageCount && currentPage < document.pageCount) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const goToPrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  };

  // Function to toggle image full-screen view
  const toggleExpandImage = (pageNum: number | null) => {
    setExpandedImageIdx(pageNum);
  };

  // Create a formatted timeline event array from all document dates
  const timelineEvents = (() => {
    // First, parse all dates and sort them chronologically
    const parsedDates = allDocumentDates.map(dateStr => {
      // Parse different date formats
      let parsedDate: Date | null = null;
      let formattedLabel = dateStr;
      
      try {
        // Enhanced date parsing with more patterns
        
        // Try with standard Date object first
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          parsedDate = date;
        } 
        // Handle formats like 1998.02.07 or 1998.02.07.11:28:56:590031
        else if (dateStr.includes('.')) {
          const parts = dateStr.split('.');
          if (parts.length >= 3) {
            const year = parseInt(parts[0]);
            const month = parseInt(parts[1]) - 1; // 0-based month
            const day = parseInt(parts[2].split(':')[0] || parts[2]);
            
            if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
              const newDate = new Date(year, month, day);
              if (!isNaN(newDate.getTime())) {
                parsedDate = newDate;
              }
            }
          }
        }
        // Handle formats like "April 1963" or "Apr 1963"
        else if (/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* (\d{4})$/i.test(dateStr)) {
          const match = dateStr.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* (\d{4})$/i);
          if (match) {
            const monthMap: Record<string, number> = {
              jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
              jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
            };
            
            const monthStr = match[1].toLowerCase().substring(0, 3);
            const year = parseInt(match[2]);
            const month = monthMap[monthStr];
            
            if (!isNaN(month) && !isNaN(year)) {
              const newDate = new Date(year, month, 1);
              if (!isNaN(newDate.getTime())) {
                parsedDate = newDate;
              }
            }
          }
        }
        // Handle formats like "1 January 1963" or "1 Jan 1963" or European formats
        else if (/^(\d{1,2})[ \-\.](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[ \-\.](\d{4})$/i.test(dateStr)) {
          const match = dateStr.match(/^(\d{1,2})[ \-\.](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[ \-\.](\d{4})$/i);
          if (match) {
            const monthMap: Record<string, number> = {
              jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
              jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
            };
            
            const day = parseInt(match[1]);
            const monthStr = match[2].toLowerCase().substring(0, 3);
            const year = parseInt(match[3]);
            const month = monthMap[monthStr];
            
            if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
              const newDate = new Date(year, month, day);
              if (!isNaN(newDate.getTime())) {
                parsedDate = newDate;
              }
            }
          }
        }
        // Handle other European formats like "01.06.1963" (day.month.year)
        else if (/^(\d{1,2})[\.\-\/](\d{1,2})[\.\-\/](\d{4})$/.test(dateStr)) {
          const match = dateStr.match(/^(\d{1,2})[\.\-\/](\d{1,2})[\.\-\/](\d{4})$/);
          if (match) {
            // Assuming European format day.month.year
            const day = parseInt(match[1]);
            const month = parseInt(match[2]) - 1; // 0-based month
            const year = parseInt(match[3]);
            
            if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
              const newDate = new Date(year, month, day);
              if (!isNaN(newDate.getTime())) {
                parsedDate = newDate;
              }
            }
          }
        }
        // Handle formats like "enero 1963" (Spanish months)
        else if (/^(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre) (\d{4})$/i.test(dateStr)) {
          const match = dateStr.match(/^(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre) (\d{4})$/i);
          if (match) {
            const monthMap: Record<string, number> = {
              enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
              julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11
            };
            
            const monthStr = match[1].toLowerCase();
            const year = parseInt(match[2]);
            const month = monthMap[monthStr];
            
            if (!isNaN(month) && !isNaN(year)) {
              const newDate = new Date(year, month, 1);
              if (!isNaN(newDate.getTime())) {
                parsedDate = newDate;
              }
            }
          }
        }
        
        // Format the date label if we have a valid date
        if (parsedDate) {
          // Format the date as MM/DD/YY or YYYY based on year
          const year = parsedDate.getFullYear();
          if (year >= 2000) {
            formattedLabel = year.toString();
          } else {
            const month = parsedDate.getMonth() + 1; // getMonth() is 0-based
            const day = parsedDate.getDate();
            formattedLabel = `${month}/${day}/${year.toString().slice(2)}`;
          }
        }
      } catch (e) {
        console.log(`Failed to parse date: ${dateStr}`);
      }
      
      return {
        originalStr: dateStr,
        parsedDate,
        formattedLabel,
        isHighlighted: currentPageDates.includes(dateStr)
      };
    });
    
    // Sort dates chronologically (null dates at the end)
    parsedDates.sort((a, b) => {
      if (!a.parsedDate && !b.parsedDate) return 0;
      if (!a.parsedDate) return 1;
      if (!b.parsedDate) return -1;
      return a.parsedDate.getTime() - b.parsedDate.getTime();
    });
    
    // Determine if we need more aggressive grouping based on the number of dates
    const needsAggregation = parsedDates.length > 20;
    
    // Choose grouping strategy based on the date range
    let groupingStrategy: 'decade' | 'year' | 'quarter' | 'month' = 'month';
    
    if (parsedDates.length > 2 && parsedDates[0].parsedDate && parsedDates[parsedDates.length-1].parsedDate) {
      const firstDate = parsedDates[0].parsedDate;
      const lastDate = parsedDates[parsedDates.length-1].parsedDate;
      const yearsDiff = lastDate && firstDate ? lastDate.getFullYear() - firstDate.getFullYear() : 0;
      
      if (yearsDiff > 10) {
        groupingStrategy = 'decade';
      } else if (yearsDiff > 3 || parsedDates.length > 40) {
        groupingStrategy = 'year';
      } else if (yearsDiff > 1 || parsedDates.length > 20) {
        groupingStrategy = 'quarter';
      }
    }
    
    // Function to determine group key based on chosen strategy
    const getGroupKey = (date: Date): string => {
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      
      if (groupingStrategy === 'decade') {
        const decade = Math.floor(year / 10) * 10;
        return `${decade}s`;
      } else if (groupingStrategy === 'year') {
        return `${year}`;
      } else if (groupingStrategy === 'quarter') {
        const quarter = Math.floor((month - 1) / 3) + 1;
        return `${year} Q${quarter}`;
      } else {
        return `${year}-${month.toString().padStart(2, '0')}`;
      }
    };
    
    // Format the group label based on strategy
    const formatGroupLabel = (key: string): string => {
      if (groupingStrategy === 'decade') {
        return key; // Already formatted as "1960s"
      } else if (groupingStrategy === 'year') {
        // Just the year for year grouping
        return key;
      } else if (groupingStrategy === 'quarter') {
        // Format like "Q1 '63"
        const [year, quarter] = key.split(' ');
        return `${quarter} '${year.slice(2)}`;
      } else {
        // For month grouping, format like "Sep '63"
        const [year, month] = key.split('-');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthIdx = parseInt(month) - 1;
        return `${monthNames[monthIdx]} '${year.slice(2)}`;
      }
    };
    
    // Group dates based on the chosen strategy
    const groupedDates: Record<string, {
      dateStr: string,
      label: string,
      isHighlighted: boolean,
      count: number,
      dates: string[],
      firstDate: Date | null,
      uniqueLabels: Set<string>
    }> = {};
    
    for (const dateInfo of parsedDates) {
      // Skip dates that couldn't be parsed
      if (!dateInfo.parsedDate) continue;
      
      const groupKey = getGroupKey(dateInfo.parsedDate);
      
      if (!groupedDates[groupKey]) {
        groupedDates[groupKey] = {
          dateStr: dateInfo.originalStr,
          label: formatGroupLabel(groupKey),
          isHighlighted: dateInfo.isHighlighted,
          count: 1,
          dates: [dateInfo.originalStr],
          firstDate: dateInfo.parsedDate,
          uniqueLabels: new Set([dateInfo.formattedLabel])
        };
      } else {
        groupedDates[groupKey].count++;
        groupedDates[groupKey].dates.push(dateInfo.originalStr);
        groupedDates[groupKey].uniqueLabels.add(dateInfo.formattedLabel);
        
        // If this date is highlighted, make the whole group highlighted
        if (dateInfo.isHighlighted) {
          groupedDates[groupKey].isHighlighted = true;
        }
      }
    }
    
    // Convert the groups object to an array
    const groupsArray = Object.values(groupedDates);
    
    // Sort the groups by date
    groupsArray.sort((a, b) => {
      if (!a.firstDate || !b.firstDate) return 0;
      return a.firstDate.getTime() - b.firstDate.getTime();
    });
    
    // Handle dates that couldn't be parsed (add them at the end)
    const unparsedDates = parsedDates.filter(d => !d.parsedDate);
    for (const unparsed of unparsedDates) {
      groupsArray.push({
        dateStr: unparsed.originalStr,
        label: unparsed.formattedLabel,
        isHighlighted: unparsed.isHighlighted,
        count: 1,
        dates: [unparsed.originalStr],
        firstDate: null,
        uniqueLabels: new Set([unparsed.formattedLabel])
      });
    }
    
    return groupsArray;
  })();

  // Show the loading state while we fetch data
  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        height: '100vh',
        flexDirection: 'column',
        backgroundColor: '#f8f9fa'
      }}>
        <div style={{ 
          width: '50px', 
          height: '50px', 
          border: '5px solid #e9ecef',
          borderTopColor: '#6c757d',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: '1rem'
        }}></div>
        <h2 style={{ color: '#6c757d', fontWeight: 'normal', textAlign: 'center' }}>
          Loading document {id}...
        </h2>
        <style jsx>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Show the error state if something went wrong
  if (error) {
    return (
      <div style={{ 
        padding: '2rem', 
        backgroundColor: '#f8d7da', 
        color: '#721c24',
        borderRadius: '0.5rem',
        maxWidth: '600px',
        margin: '2rem auto',
        textAlign: 'center'
      }}>
        <h2>Error Loading Document</h2>
        <p>{error}</p>
        <p style={{ marginTop: '1rem' }}>
          <a 
            href="/jfk-files" 
            style={{ 
              backgroundColor: '#721c24', 
              color: 'white', 
              padding: '0.5rem 1rem', 
              borderRadius: '0.25rem',
              textDecoration: 'none',
              display: 'inline-block'
            }}
          >
            Return to Documents
          </a>
        </p>
      </div>
    );
  }

  // If the document can't be found, show a 404 error
  if (!document) {
    return (
      <div style={{ 
        padding: '2rem', 
        backgroundColor: '#f8f9fa', 
        color: '#343a40',
        borderRadius: '0.5rem',
        maxWidth: '600px',
        margin: '2rem auto',
        textAlign: 'center'
      }}>
        <h2>Document Not Found</h2>
        <p>The document with ID "{id}" could not be found.</p>
        <p style={{ marginTop: '1rem' }}>
          <a 
            href="/jfk-files" 
            style={{ 
              backgroundColor: '#343a40', 
              color: 'white', 
              padding: '0.5rem 1rem', 
              borderRadius: '0.25rem',
              textDecoration: 'none',
              display: 'inline-block'
            }}
          >
            Return to Documents
          </a>
        </p>
      </div>
    );
  }

  // Determine if we're looking at a document by archive ID (for backward compatibility)
  // const isArchiveId = document && document.id !== id && document.archiveId === id;
  // const displayId = isArchiveId ? `${document.archiveId} (DB ID: ${document.id})` : document.id;

  // The return statement with ChatInterface replacing the old chat code
  return (
    <div className="container mx-auto px-4 py-4">
      {/* Debug Banner - will make it very obvious if changes are coming through */}
      <div className="bg-red-500 text-white p-4 mb-4 text-center animate-pulse rounded-lg text-lg font-bold">
        Updated at {new Date().toLocaleTimeString()}
      </div>
      
      {/* Page Header with Navigation */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '1rem',
        padding: '0.75rem',
        backgroundColor: '#374151',
        color: 'white',
        borderRadius: '0.5rem',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
      }}>
        <Link href="/jfk-files" style={{ 
          display: 'flex', 
          alignItems: 'center', 
          color: 'white',
          fontWeight: 'bold'
        }}>
          <ArrowLeft style={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }} /> Back to Files
        </Link>
        
        <div style={{ fontWeight: 'bold', fontSize: '1.25rem' }}>
          {document?.title || `Document ${id}`}
        </div>
        
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <AddToDocumentDock
            item={{
              id: document?.id || id,
              title: document?.title || `Document ${id}`,
              url: `/jfk-files/${document?.id || id}`,
              type: 'document'
            }}
          />
          <a
            href={getDocumentPdfUrl()}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#6b7280',
              color: 'white',
              padding: '0.5rem 0.75rem',
              borderRadius: '0.25rem',
              fontSize: '0.875rem',
              fontWeight: '500'
            }}
          >
            <Download style={{ width: '0.875rem', height: '0.875rem', marginRight: '0.25rem' }} /> PDF
          </a>
          <a
            href={getDocumentJsonUrl()}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#4b5563',
              color: 'white',
              padding: '0.5rem 0.75rem',
              borderRadius: '0.25rem',
              fontSize: '0.875rem',
              fontWeight: '500'
            }}
          >
            <Download style={{ width: '0.875rem', height: '0.875rem', marginRight: '0.25rem' }} /> JSON
          </a>
        </div>
      </div>
      
      {/* Dashboard Grid Layout */}
      <div style={{ 
        display: 'grid',
        gridTemplateColumns: 'repeat(12, 1fr)',
        gridTemplateRows: 'auto',
        gap: '1rem',
        marginBottom: '1rem'
      }}>
        {/* Timeline Chart - Spans full width at the top */}
        <div style={{ 
          gridColumn: 'span 12 / span 12', 
          backgroundColor: '#f9fafb', /* Very light grey */
          borderRadius: '0.5rem',
          padding: '0.75rem 1rem', // Slightly reduced padding
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          marginBottom: '1.75rem' // Add extra margin at the bottom to prevent overlap
        }}>
          <h2 style={{ 
            color: '#4b5563', 
            fontWeight: 'bold', 
            fontSize: '1rem',
            display: 'flex',
            alignItems: 'center',
            marginBottom: '0.25rem', // Further reduced margin
            borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
            paddingBottom: '0.25rem' // Reduced padding
          }}>
            <Calendar style={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }} />
            Dates Referenced in Document
          </h2>
          
          <div style={{ height: '110px' }}> {/* Increased height to ensure dates fit */}
            {/* Custom timeline visualization using document dates */}
            <div style={{ 
              position: 'relative',
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-start'
            }}>
              {/* Base timeline */}
              <div style={{ 
                height: '4px', 
                backgroundColor: '#e5e7eb',
                width: '100%',
                position: 'relative',
                margin: '55px 0 15px 0' // Adjusted margins to center the timeline
              }}>
                {/* Date markers */}
                {timelineEvents.map((event, index) => (
                  <div 
                    key={`date-${index}`}
                    style={{
                      position: 'absolute',
                      left: `${(index / (timelineEvents.length - 1 || 1)) * 100}%`,
                      transform: 'translateX(-50%)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      transition: 'opacity 0.3s ease',
                      height: '80px' // Adjusted height for marker container
                    }}
                    title={event.dates.length > 1 
                      ? `Group of ${event.dates.length} dates: ${Array.from(event.uniqueLabels).join(', ')}` 
                      : event.dateStr}
                  >
                    {/* Date point - positioned on the timeline */}
                    <div style={{
                      width: event.count > 1 ? `${Math.min(16, 9 + Math.sqrt(event.count))}px` : '9px',
                      height: event.count > 1 ? `${Math.min(16, 9 + Math.sqrt(event.count))}px` : '9px',
                      borderRadius: '50%',
                      backgroundColor: event.isHighlighted ? '#ef4444' : '#6b7280',
                      position: 'absolute',
                      top: '0px',
                      border: '2px solid white',
                      boxShadow: event.isHighlighted ? '0 0 0 2px rgba(239, 68, 68, 0.3)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: event.count > 9 ? '6px' : '7px',
                      fontWeight: 'bold'
                    }}>
                      {event.count > 1 ? event.count : ''}
                    </div>
                    
                    {/* Fixed date label - directly below dots with better visibility */}
                    <div style={{
                      position: 'absolute',
                      top: '12px', // Position below the dot
                      left: '-25px', // Center the label under the dot
                      right: '-25px', 
                      display: 'flex',
                      justifyContent: 'center',
                      fontSize: '0.65rem',
                      fontWeight: event.isHighlighted ? 'bold' : 'normal',
                      color: event.isHighlighted ? '#ef4444' : '#6b7280',
                      opacity: event.isHighlighted ? 1 : 0.7,
                      textAlign: 'center',
                    }}>
                      <span
                        style={{
                          background: 'rgba(255,255,255,0.9)', 
                          padding: '2px 4px', 
                          borderRadius: '3px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: '50px',
                          display: 'inline-block',
                          border: event.isHighlighted ? '1px solid rgba(239, 68, 68, 0.3)' : 'none'
                        }}
                      >
                        {event.label}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        {/* Summary Panel - Now on the left side (3 columns) */}
        <div style={{ 
          gridColumn: 'span 3 / span 3', 
          backgroundColor: '#f7f2e9', /* Light manila color */
          borderRadius: '0.5rem',
          padding: '1rem',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '650px', // Match document viewer height
          overflow: 'hidden' // Prevent overflow
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '0.5rem',
            borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
            paddingBottom: '0.25rem'
          }}>
            <h2 style={{ color: '#4b5563', fontWeight: 'bold', fontSize: '1rem' }}>
              <Info style={{ display: 'inline', width: '1rem', height: '1rem', marginRight: '0.5rem' }} />
              Document Summary
            </h2>
            <button 
              onClick={() => setShowFullSummary(!showFullSummary)}
              style={{
                color: '#4b5563',
                padding: '0.25rem',
                borderRadius: '0.25rem',
                backgroundColor: 'rgba(75, 85, 99, 0.1)'
              }}
            >
              {showFullSummary ? 
                <ChevronUp style={{ width: '1rem', height: '1rem' }} /> : 
                <ChevronDown style={{ width: '1rem', height: '1rem' }} />
              }
            </button>
          </div>
          
          {/* Document ID information */}
          {document && (
            <div style={{ 
              fontSize: '0.75rem', 
              marginBottom: '0.5rem', 
              padding: '0.25rem 0.5rem',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              borderRadius: '0.25rem',
              border: '1px solid rgba(59, 130, 246, 0.3)'
            }}>
              {isHashedId && (
                <div style={{ marginBottom: '0.25rem' }}>
                  <strong>Archive ID:</strong> {originalId || document.originalId}
                  <span style={{ 
                    marginLeft: '0.5rem', 
                    backgroundColor: 'rgba(245, 158, 11, 0.1)', 
                    color: 'rgb(194, 65, 12)',
                    padding: '0.125rem 0.25rem',
                    borderRadius: '0.25rem',
                    fontSize: '0.65rem',
                    fontWeight: 'bold'
                  }}>
                    Found via Hash
                  </span>
                </div>
              )}
              {isArchiveId && !isHashedId && (
                <div style={{ marginBottom: '0.25rem' }}>
                  <strong>Archive ID:</strong> {document.archiveId}
                </div>
              )}
              <div>
                <strong>Database ID:</strong> {document.id}
              </div>
            </div>
          )}
          
          {/* Tab navigation */}
          <div style={{ 
            display: 'flex',
            borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
            marginBottom: '0.5rem'
          }}>
            <button
              onClick={() => setActiveTab('pageSummary')}
              style={{
                padding: '0.25rem 0.5rem',
                borderBottom: activeTab === 'pageSummary' ? '2px solid #4b5563' : 'none',
                backgroundColor: 'transparent',
                color: '#4b5563',
                fontWeight: activeTab === 'pageSummary' ? 'bold' : 'normal',
                cursor: 'pointer',
                border: 'none',
                fontSize: '0.75rem'
              }}
            >
              Page Summary
            </button>
            <button
              onClick={() => setActiveTab('pageText')}
              style={{
                padding: '0.25rem 0.5rem',
                borderBottom: activeTab === 'pageText' ? '2px solid #4b5563' : 'none',
                backgroundColor: 'transparent',
                color: '#4b5563',
                fontWeight: activeTab === 'pageText' ? 'bold' : 'normal',
                cursor: 'pointer',
                border: 'none',
                fontSize: '0.75rem'
              }}
            >
              Page Text
            </button>
          </div>
          
          {/* Page-specific content panel */}
          <div style={{ 
            backgroundColor: 'rgba(255, 255, 255, 0.7)',
            borderRadius: '0.25rem',
            padding: '0.5rem',
            marginBottom: '0.5rem',
            height: '200px',
            overflowY: 'auto'
          }}>
            {isLoadingPageContent ? (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                height: '100%',
                color: '#6b7280'
              }}>
                Loading page content...
              </div>
            ) : pageContentError ? (
              <div style={{ 
                color: '#6b7280',
                fontStyle: 'italic',
                textAlign: 'center',
                padding: '1rem'
              }}>
                {pageContentError}
              </div>
            ) : pageContent ? (
              activeTab === 'pageSummary' ? (
                <div>
                  <h3 style={{ fontSize: '0.875rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                    Page {currentPage} Summary
                  </h3>
                  <p style={{ fontSize: '0.875rem' }}>
                    {pageContent.summary}
                  </p>
                </div>
              ) : (
                <div>
                  <h3 style={{ fontSize: '0.875rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                    Page {currentPage} Text
                  </h3>
                  <pre style={{ 
                    fontSize: '0.75rem', 
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontFamily: 'monospace'
                  }}>
                    {pageContent.fullText}
                  </pre>
                </div>
              )
            ) : (
              <div style={{ 
                color: '#6b7280',
                fontStyle: 'italic',
                textAlign: 'center',
                padding: '1rem'
              }}>
                No page content available
              </div>
            )}
          </div>
          
          {/* Document summary (at the bottom) */}
          <div style={{ 
            overflowY: 'auto',
            maxHeight: showFullSummary ? '250px' : '130px', // Adjusted heights
            transition: 'max-height 0.3s ease',
            backgroundColor: 'rgba(255, 255, 255, 0.7)',
            borderRadius: '0.25rem',
            padding: '0.5rem',
            flex: 1,
            position: 'relative'
          }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              Full Document Summary
            </h3>
            
            {document && (
              <p style={{ fontSize: '0.875rem' }}>
                {document.summary || 'No summary available for this document.'}
              </p>
            )}
            
            {/* Expand/collapse button */}
            <button
              onClick={() => setShowFullSummary(!showFullSummary)}
              style={{
                position: 'absolute',
                bottom: '0.5rem',
                right: '0.5rem',
                backgroundColor: 'rgba(75, 85, 99, 0.1)',
                color: '#4b5563',
                padding: '0.25rem 0.5rem',
                borderRadius: '0.25rem',
                fontSize: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              {showFullSummary ? (
                <>Show Less <ChevronUp style={{ width: '0.75rem', height: '0.75rem' }} /></>
              ) : (
                <>Show More <ChevronDown style={{ width: '0.75rem', height: '0.75rem' }} /></>
              )}
            </button>
          </div>
        </div>

        {/* Document Viewer - Now in the center (6 columns) */}
        <div style={{ 
          gridColumn: 'span 6 / span 6',
          backgroundColor: '#1f2937',
          borderRadius: '0.5rem',
          padding: '1rem',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '0.75rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            paddingBottom: '0.5rem'
          }}>
            <h2 style={{ color: 'white', fontWeight: 'bold', fontSize: '1rem' }}>
              <FileText style={{ display: 'inline', width: '1rem', height: '1rem', marginRight: '0.5rem' }} />
              Document Viewer
            </h2>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem',
              color: 'white'
            }}>
              <button 
                onClick={goToPrevPage} 
                disabled={currentPage === 1}
                style={{ 
                  opacity: currentPage === 1 ? 0.5 : 1,
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                }}
              >
                <ArrowLeft style={{ width: '1rem', height: '1rem' }} />
              </button>
              <span style={{ fontSize: '0.875rem' }}>Page {currentPage} of {document.pageCount}</span>
              <button 
                onClick={goToNextPage} 
                disabled={currentPage === document.pageCount}
                style={{ 
                  opacity: currentPage === document.pageCount ? 0.5 : 1,
                  cursor: currentPage === document.pageCount ? 'not-allowed' : 'pointer'
                }}
              >
                <ArrowRight style={{ width: '1rem', height: '1rem' }} />
              </button>
            </div>
          </div>
          
          {/* Current page display - Optimized for 8.5x11 portrait documents */}
          <div style={{ 
            backgroundColor: 'white', 
            padding: '0.25rem',
            borderRadius: '0.25rem',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '550px', // Increased height for better proportion
            position: 'relative',
            width: '100%', // Explicit width to ensure proper aspect ratio
            aspectRatio: '8.5/11', // Set aspect ratio to match letter size paper
            margin: '0 auto'
          }}>
            {imageSrc && !imageError ? (
              <img
                src={imageSrc}
                alt={`Page ${currentPage}`}
                style={{ 
                  maxWidth: '100%', 
                  maxHeight: '100%', 
                  objectFit: 'contain',
                  cursor: 'pointer'
                }}
                onError={(e) => handleImageError(currentPage, e)}
                onLoad={() => handleImageLoad(currentPage)}
                onClick={() => toggleExpandImage(currentPage)}
              />
            ) : (
              <div style={{ 
                height: '100%', 
                width: '100%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                color: '#6b7280',
                flexDirection: 'column',
                gap: '0.5rem'
              }}>
                {imageError || 'Loading document page...'}
                <button
                  onClick={() => setUseProxy(!useProxy)}
                  style={{
                    padding: '0.25rem 0.5rem',
                    borderRadius: '0.25rem',
                    backgroundColor: '#f3f4f6',
                    border: '1px solid #d1d5db',
                    fontSize: '0.75rem'
                  }}
                >
                  {useProxy ? 'Disable' : 'Enable'} Proxy
                </button>
              </div>
            )}
            
            {/* Fullscreen button */}
            <button
              onClick={() => toggleExpandImage(currentPage)}
              style={{
                position: 'absolute',
                bottom: '0.5rem',
                right: '0.5rem',
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                color: 'white',
                borderRadius: '9999px',
                width: '2rem',
                height: '2rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Maximize2 style={{ width: '1rem', height: '1rem' }} />
            </button>
          </div>
          
          {/* Thumbnails row */}
          <div style={{ 
            marginTop: '0.5rem',
            overflowX: 'auto',
            display: 'flex',
            gap: '0.25rem',
            padding: '0.5rem',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '0.25rem'
          }}>
            {Array.from({ length: Math.min(document.pageCount || 0, 15) }, (_, i) => i + 1).map(pageNum => (
              <button 
                key={`thumb-${pageNum}`} 
                onClick={() => setCurrentPage(pageNum)}
                style={{ 
                  width: '40px', 
                  height: '56px', 
                  flexShrink: 0,
                  border: pageNum === currentPage ? '2px solid #9ca3af' : '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '0.25rem',
                  overflow: 'hidden',
                  position: 'relative',
                  padding: 0
                }}
              >
                <img 
                  src={getPageImageUrl(pageNum)}
                  alt={`Thumbnail ${pageNum}`}
                  style={{ 
                    width: '100%', 
                    height: '100%', 
                    objectFit: 'cover'
                  }}
                  onError={(e) => console.log(`Thumbnail ${pageNum} failed to load`)}
                />
                <span style={{ 
                  position: 'absolute', 
                  bottom: 0, 
                  right: 0, 
                  backgroundColor: 'rgba(0, 0, 0, 0.7)', 
                  color: 'white', 
                  fontSize: '6px',
                  padding: '0 4px', 
                  borderTopLeftRadius: '2px' 
                }}>
                  {pageNum}
                </span>
              </button>
            ))}
            {document.pageCount && document.pageCount > 15 && (
              <span style={{ 
                display: 'flex', 
                alignItems: 'center', 
                color: 'rgba(255, 255, 255, 0.8)', 
                fontSize: '0.75rem', 
                padding: '0 8px' 
              }}>
                +{document.pageCount - 15} more
              </span>
            )}
          </div>
        </div>
        
        {/* Right side panels for People, Places and Objects (3 columns) - arranged vertically */}
        <div style={{ 
          gridColumn: 'span 3 / span 3',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          maxHeight: '650px' // Match document viewer height
        }}>
          {/* People Panel */}
          <div style={{ 
            backgroundColor: '#f3f4f6', /* Light grey */
            borderRadius: '0.5rem',
            padding: '0.75rem',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            flex: '1 1 33%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <h2 style={{ 
              color: '#4b5563', 
              fontWeight: 'bold', 
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              marginBottom: '0.5rem',
              borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
              paddingBottom: '0.25rem'
            }}>
              <Users style={{ width: '0.875rem', height: '0.875rem', marginRight: '0.5rem' }} />
              People Mentioned
            </h2>
            
            <div style={{ 
              backgroundColor: 'rgba(255, 255, 255, 0.7)',
              borderRadius: '0.25rem',
              padding: '0.5rem',
              overflowY: 'auto',
              flex: 1
            }}>
              {document.allNames && document.allNames.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {document.allNames.map((name: string, idx: number) => {
                    const isHighlighted = currentPageNames.includes(name);
                    const pageNumbers = entityToPageMap.names[name] || [];
                    const firstPageNumber = pageNumbers.length > 0 ? pageNumbers[0] : null;
                    
                    return (
                      <button 
                        key={`person-${idx}`} 
                        style={{
                          padding: '0.25rem 0.5rem',
                          backgroundColor: isHighlighted ? '#fecaca' : '#e5e7eb',
                          color: isHighlighted ? '#b91c1c' : '#374151',
                          fontWeight: isHighlighted ? 'bold' : 'normal',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          border: isHighlighted ? '1px solid rgba(239, 68, 68, 0.3)' : 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          transition: 'all 0.2s'
                        }}
                        onClick={() => {
                          if (!isHighlighted && firstPageNumber) {
                            // Navigate to the page containing this entity
                            setCurrentPage(firstPageNumber);
                          } else {
                            // Open entity visualization in new tab
                            window.open(`/jfk-files/person/${encodeURIComponent(name)}`, '_blank');
                          }
                        }}
                        title={isHighlighted ? 
                          `View information about ${name}` : 
                          `View ${name} on page ${firstPageNumber}`}
                      >
                        {name}
                        {!isHighlighted && firstPageNumber && (
                          <span style={{ 
                            fontSize: '0.65rem',
                            backgroundColor: '#d1d5db',
                            color: '#1f2937',
                            borderRadius: '9999px',
                            width: '16px',
                            height: '16px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            {firstPageNumber}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p style={{ 
                  color: '#6b7280', 
                  fontStyle: 'italic', 
                  fontSize: '0.75rem',
                  textAlign: 'center'
                }}>
                  No people identified
                </p>
              )}
            </div>
          </div>
          
          {/* Places Mentioned Panel with Map */}
          <div style={{ 
            backgroundColor: '#e6dfd1', /* Medium manila */
            borderRadius: '0.5rem',
            padding: '0.75rem',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            flex: '1 1 33%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <h2 style={{ 
              color: '#4b5563', 
              fontWeight: 'bold', 
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              marginBottom: '0.5rem',
              borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
              paddingBottom: '0.25rem'
            }}>
              <MapPin style={{ width: '0.875rem', height: '0.875rem', marginRight: '0.5rem' }} />
              Places Mentioned
            </h2>
            
            {/* Compact map visualization */}
            <div style={{ height: '120px', marginBottom: '0.5rem' }}>
              <EnhancedMapVisualization places={document?.allPlaces || mockPlaces} />
            </div>
            
            {/* Places list under map */}
            <div style={{ 
              backgroundColor: 'rgba(255, 255, 255, 0.7)',
              borderRadius: '0.25rem',
              padding: '0.5rem',
              overflowY: 'auto',
              flex: 1
            }}>
              {document.allPlaces && document.allPlaces.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {document.allPlaces.map((place: string, idx: number) => {
                    const isHighlighted = currentPagePlaces.includes(place);
                    const pageNumbers = entityToPageMap.places[place] || [];
                    const firstPageNumber = pageNumbers.length > 0 ? pageNumbers[0] : null;
                    
                    return (
                      <button 
                        key={`place-${idx}`} 
                        style={{
                          padding: '0.25rem 0.5rem',
                          backgroundColor: isHighlighted ? '#bbf7d0' : '#d3c8b4',
                          color: isHighlighted ? '#166534' : '#4b5563',
                          fontWeight: isHighlighted ? 'bold' : 'normal',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          border: isHighlighted ? '1px solid rgba(22, 163, 74, 0.3)' : 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          transition: 'all 0.2s'
                        }}
                        onClick={() => {
                          if (!isHighlighted && firstPageNumber) {
                            // Navigate to the page containing this entity
                            setCurrentPage(firstPageNumber);
                          } else {
                            // Open entity visualization in new tab
                            window.open(`/jfk-files/visualizations?entity=${encodeURIComponent(place)}&type=place`, '_blank');
                          }
                        }}
                        title={isHighlighted ? 
                          `View information about ${place}` : 
                          `View ${place} on page ${firstPageNumber}`}
                      >
                        {place}
                        {!isHighlighted && firstPageNumber && (
                          <span style={{ 
                            fontSize: '0.65rem',
                            backgroundColor: '#b5a282',
                            color: '#ffffff',
                            borderRadius: '9999px',
                            width: '16px',
                            height: '16px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            {firstPageNumber}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p style={{ 
                  color: '#6b7280', 
                  fontStyle: 'italic', 
                  fontSize: '0.75rem',
                  textAlign: 'center'
                }}>
                  No places identified
                </p>
              )}
            </div>
          </div>
          
          {/* Objects Panel */}
          <div style={{ 
            backgroundColor: '#f8fafc', /* Lightest grey */
            borderRadius: '0.5rem',
            padding: '0.75rem',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            flex: '1 1 33%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <h2 style={{ 
              color: '#4b5563', 
              fontWeight: 'bold', 
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              marginBottom: '0.5rem',
              borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
              paddingBottom: '0.25rem'
            }}>
              <Package style={{ width: '0.875rem', height: '0.875rem', marginRight: '0.5rem' }} />
              Objects Mentioned
            </h2>
            
            <div style={{ 
              backgroundColor: 'rgba(255, 255, 255, 0.7)',
              borderRadius: '0.25rem',
              padding: '0.5rem',
              overflowY: 'auto',
              flex: 1
            }}>
              {document.allObjects && document.allObjects.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {document.allObjects.map((object: string, idx: number) => {
                    const isHighlighted = currentPageObjects.includes(object);
                    const pageNumbers = entityToPageMap.objects[object] || [];
                    const firstPageNumber = pageNumbers.length > 0 ? pageNumbers[0] : null;
                    
                    return (
                      <button 
                        key={`object-${idx}`} 
                        style={{
                          padding: '0.25rem 0.5rem',
                          backgroundColor: isHighlighted ? '#c7d2fe' : '#e5e7eb',
                          color: isHighlighted ? '#4338ca' : '#374151',
                          fontWeight: isHighlighted ? 'bold' : 'normal',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          border: isHighlighted ? '1px solid rgba(79, 70, 229, 0.3)' : 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          transition: 'all 0.2s'
                        }}
                        onClick={() => {
                          if (!isHighlighted && firstPageNumber) {
                            // Navigate to the page containing this entity
                            setCurrentPage(firstPageNumber);
                          } else {
                            // Open entity visualization in new tab
                            window.open(`/jfk-files/visualizations?entity=${encodeURIComponent(object)}&type=object`, '_blank');
                          }
                        }}
                        title={isHighlighted ? 
                          `View information about ${object}` : 
                          `View ${object} on page ${firstPageNumber}`}
                      >
                        {object}
                        {!isHighlighted && firstPageNumber && (
                          <span style={{ 
                            fontSize: '0.65rem',
                            backgroundColor: '#9ca3af',
                            color: '#ffffff',
                            borderRadius: '9999px',
                            width: '16px',
                            height: '16px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            {firstPageNumber}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p style={{ 
                  color: '#6b7280', 
                  fontStyle: 'italic', 
                  fontSize: '0.75rem',
                  textAlign: 'center'
                }}>
                  No objects identified
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Expanded Image Modal */}
      {expandedImageIdx !== null && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
          padding: '1rem'
        }}>
          <div style={{
            position: 'relative',
            backgroundColor: 'white',
            borderRadius: '0.5rem',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            maxWidth: '80vw',
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0.75rem',
              borderBottom: '1px solid #e5e7eb'
            }}>
              <h3 style={{ fontWeight: '600' }}>Page {expandedImageIdx} of {document.pageCount}</h3>
              <button 
                onClick={() => toggleExpandImage(null)}
                style={{
                  color: '#6b7280',
                  borderRadius: '9999px',
                  padding: '0.25rem',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                <X style={{ width: '1.25rem', height: '1.25rem' }} />
              </button>
            </div>
            <div style={{
              padding: '1rem',
              flex: 1,
              overflow: 'auto',
              display: 'flex',
              justifyContent: 'center'
            }}>
              <img 
                src={getPageImageUrl(expandedImageIdx)}
                alt={`Page ${expandedImageIdx}`}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain'
                }}
                onError={(e) => handleImageError(expandedImageIdx, e)}
              />
            </div>
            <div style={{
              padding: '0.75rem',
              borderTop: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between'
            }}>
              <button 
                onClick={() => {
                  if (expandedImageIdx > 1) {
                    toggleExpandImage(expandedImageIdx - 1);
                  }
                }}
                disabled={expandedImageIdx === 1}
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.25rem',
                  backgroundColor: expandedImageIdx === 1 ? '#f3f4f6' : '#e5e7eb',
                  color: expandedImageIdx === 1 ? '#9ca3af' : '#374151',
                  border: 'none',
                  cursor: expandedImageIdx === 1 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <ArrowLeft style={{ width: '1rem', height: '1rem', marginRight: '0.25rem' }} /> Previous
              </button>
              <button 
                onClick={() => {
                  if (document.pageCount && expandedImageIdx < document.pageCount) {
                    toggleExpandImage(expandedImageIdx + 1);
                  }
                }}
                disabled={expandedImageIdx === document.pageCount}
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.25rem',
                  backgroundColor: expandedImageIdx === document.pageCount ? '#f3f4f6' : '#e5e7eb',
                  color: expandedImageIdx === document.pageCount ? '#9ca3af' : '#374151',
                  border: 'none',
                  cursor: expandedImageIdx === document.pageCount ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                Next <ArrowRight style={{ width: '1rem', height: '1rem', marginLeft: '0.25rem' }} />
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* External Chat Component */}
      <ChatInterface 
        documentId={id} 
        elevenlabsAgentId="KjDgYl0ieMTsIcSRpEcP" 
        pageContent={pageContent}
        documentSummary={document?.summary || ''}
        currentPage={currentPage}
      />
    </div>
  );
} 