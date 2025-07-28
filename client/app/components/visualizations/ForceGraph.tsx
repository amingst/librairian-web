"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Loader2, Filter, Search, User } from 'lucide-react';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import * as d3 from 'd3';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.oip.onl';

// Dynamically import ForceGraph2D with ssr: false to prevent window issues during server rendering
const ForceGraph2D = dynamic(
  () => import('react-force-graph-2d'),
  { ssr: false }
);

// Add a new DocumentHoverCard component
interface DocumentHoverCardProps {
  documentId: string;
  initialData?: any;
}

const DocumentHoverCard = ({ documentId, initialData }: DocumentHoverCardProps) => {
  const [documentData, setDocumentData] = useState<any>(initialData);
  const [isLoading, setIsLoading] = useState<boolean>(!initialData);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Reset state when document ID changes
    if (!initialData) {
      setIsLoading(true);
      setError(null);
    } else {
      setDocumentData(initialData);
      setIsLoading(false);
    }
    
    if (!documentId || initialData) return;

    const fetchDocumentData = async () => {
      try {
        console.log(`Fetching document data for hover card: ${documentId}`);
        const response = await fetch(`${API_BASE_URL}/api/jfk/media?id=${documentId}&type=analysis`);
        
        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Received document data for hover card:', data);
        setDocumentData(data);
      } catch (err: any) {
        console.error("Error fetching document data:", err);
        setError(err instanceof Error ? err.message : "Failed to load document details");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDocumentData();
  }, [documentId, initialData]);

  if (isLoading) {
    return (
      <div className="min-w-[300px] max-w-[320px] p-3 flex flex-col items-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-500"></div>
        <p className="text-xs mt-2">Loading document details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-w-[300px] max-w-[320px] p-3">
        <p className="text-xs text-red-500">Error: {error}</p>
      </div>
    );
  }

  if (!documentData) {
    return (
      <div className="min-w-[300px] max-w-[320px] p-3">
        <p className="text-xs">No document details available</p>
      </div>
    );
  }

  return (
    <div className="min-w-[300px] max-w-[320px] p-3 overflow-hidden">
      <h4 className="font-semibold mb-2 text-sm">{documentData.documentId}</h4>
      
      {documentData.summary && (
        <p className="text-xs mb-2 line-clamp-3 text-gray-700 dark:text-gray-300">{documentData.summary}</p>
      )}
      
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div>
          <h5 className="text-xs font-semibold text-gray-500">Names</h5>
          <ul className="text-xs max-h-[80px] overflow-y-auto">
            {documentData.allNames?.slice(0, 4).map((name: string, idx: number) => (
              <li key={idx} className="truncate text-gray-700 dark:text-gray-300">{name}</li>
            ))}
            {documentData.allNames?.length > 4 && (
              <li className="text-gray-400">+{documentData.allNames.length - 4} more</li>
            )}
          </ul>
        </div>
        
        <div>
          <h5 className="text-xs font-semibold text-gray-500">Places</h5>
          <ul className="text-xs max-h-[80px] overflow-y-auto">
            {documentData.allPlaces?.slice(0, 4).map((place: string, idx: number) => (
              <li key={idx} className="truncate text-gray-700 dark:text-gray-300">{place}</li>
            ))}
            {documentData.allPlaces?.length > 4 && (
              <li className="text-gray-400">+{documentData.allPlaces.length - 4} more</li>
            )}
          </ul>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div>
          <h5 className="text-xs font-semibold text-gray-500">Dates</h5>
          <ul className="text-xs max-h-[80px] overflow-y-auto">
            {documentData.allDates?.slice(0, 4).map((date: string, idx: number) => (
              <li key={idx} className="truncate text-gray-700 dark:text-gray-300">{date}</li>
            ))}
            {documentData.allDates?.length > 4 && (
              <li className="text-gray-400">+{documentData.allDates.length - 4} more</li>
            )}
          </ul>
        </div>
        
        <div>
          <h5 className="text-xs font-semibold text-gray-500">Objects</h5>
          <ul className="text-xs max-h-[80px] overflow-y-auto">
            {documentData.allObjects?.slice(0, 4).map((object: string, idx: number) => (
              <li key={idx} className="truncate text-gray-700 dark:text-gray-300">{object}</li>
            ))}
            {documentData.allObjects?.length > 4 && (
              <li className="text-gray-400">+{documentData.allObjects.length - 4} more</li>
            )}
          </ul>
        </div>
      </div>
      
      <a 
        href={`/jfk-files/${documentData.documentId}`}
        className="text-xs text-blue-500 hover:underline mt-2 block"
        target="_blank"
        rel="noopener noreferrer"
      >
        View document details →
      </a>
    </div>
  );
};

// Node types in our visualization
type NodeType = 'document' | 'person' | 'place' | 'object';
type NodeGroup = 'source' | 'related' | 'entity' | 'secondary';

// Link types in our visualization
type LinkType = 'mentions_person' | 'mentions_place' | 'mentions_object' | 'related_entity';

interface GraphNode {
  id: string;
  type: NodeType;
  group: string;
  data: any;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

interface GraphLink {
  source: string;
  target: string;
  type: LinkType;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

interface NodeWithCoordinates extends GraphNode {
  x?: number;
  y?: number;
}

export interface ForceGraphProps {
  documentId?: string;
  width?: number;
  height?: number;
  onNodeClick?: (node: GraphNode) => void;
}

export default function ForceGraphVisualization({ 
  documentId, 
  width = 960,
  height = 500,
  onNodeClick
}: ForceGraphProps) {
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [originalGraphData, setOriginalGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [showOnlyOverlaps, setShowOnlyOverlaps] = useState<boolean>(false);
  const [personName, setPersonName] = useState<string>('');
  const [isPersonMode, setIsPersonMode] = useState<boolean>(false);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [connectionLayers, setConnectionLayers] = useState<number>(2);
  const [isGeographicMode, setIsGeographicMode] = useState<boolean>(false);
  
  const fgRef = useRef<any>(null);

  useEffect(() => {
    if (documentId) {
      fetchDocumentNetwork();
    } else {
      setIsLoading(false);
      setError('Please enter a document ID or search for a person');
    }
  }, [documentId, connectionLayers]);

  const fetchDocumentNetwork = async (forceRefresh = false) => {
    if (!documentId) {
      setIsLoading(false);
      setError('Please enter a document ID to visualize connections');
      return;
    }

    setIsLoading(true);
    setError(null);
    setIsPersonMode(false);
    
    if (forceRefresh) {
      setIsRefreshing(true);
    }
    
    try {
      // Directly try to fetch network data with the provided document ID
      console.log(`Fetching network data for document ID: ${documentId}${forceRefresh ? ' (force refresh)' : ''}`);
      
      // Add a cache-busting parameter if forceRefresh is true
      const cacheBuster = forceRefresh ? `&_cb=${Date.now()}` : '';
      const response = await fetch(`${API_BASE_URL}/api/jfk/connections?type=network&documentId=${documentId}&layers=${connectionLayers}${cacheBuster}`);
      
      if (!response.ok) {
        // If network fetch fails, try to get more info from debug endpoint
        console.log('Network fetch failed, checking debug endpoint...');
        const debugResponse = await fetch(`${API_BASE_URL}/api/jfk/connections/debug?documentId=${documentId}`);
        
        if (debugResponse.ok) {
          const debugData = await debugResponse.json();
          setDebugInfo(debugData);
          
          if (!debugData.documentExists) {
            throw new Error(`Document with ID "${documentId}" not found in database`);
          }
        }
        
        // Try to parse the error message from the original response
        try {
          const errorData = await response.json();
          throw new Error(errorData.error || `Error ${response.status}: ${response.statusText}`);
        } catch (parseError) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
      }
      
      const data = await response.json();
      console.log('Network data fetched successfully:', data.results);
      setOriginalGraphData(data.results);
      setGraphData(data.results);
    } catch (err: any) {
      console.error("Error fetching network data:", err);
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const fetchPersonNetwork = async (name: string) => {
    if (!name.trim()) {
      setError('Please enter a person name to search');
      return;
    }

    setIsLoading(true);
    setIsSearching(true);
    setError(null);
    setIsPersonMode(true);
    
    try {
      console.log(`Searching for documents mentioning: ${name}`);
      // Add cache-busting parameter to avoid browser caching
      const cacheBuster = `_cb=${Date.now()}`;
      const response = await fetch(`${API_BASE_URL}/api/jfk/search?person=${encodeURIComponent(name)}&limit=20&layers=${connectionLayers}&${cacheBuster}`);
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Person search results:', data);
      
      if (!data.documents || data.documents.length === 0) {
        setError(`No documents found mentioning '${name}'`);
        setIsLoading(false);
        setIsSearching(false);
        return;
      }
      
      // Deduplicate documents based on title and content similarity
      const uniqueDocuments = deduplicateDocuments(data.documents);
      console.log(`Removed ${data.documents.length - uniqueDocuments.length} duplicate documents from person search results`);
      
      // Build a network graph centered on the person
      const personNetwork = buildPersonCentricNetwork(name, uniqueDocuments);
      setOriginalGraphData(personNetwork);
      setGraphData(personNetwork);
      
    } catch (err: any) {
      console.error("Error searching for person:", err);
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setIsLoading(false);
      setIsSearching(false);
    }
  };

  // Add a helper function to deduplicate documents
  const deduplicateDocuments = (documents: any[]) => {
    console.log('Starting document deduplication process...');
    console.log(`Input: ${documents.length} documents`);
    
    // Map to track documents by title for deduplication
    const titleMap = new Map();
    const idPrefixMap = new Map();
    const duplicateTracker = new Set();
    
    // First pass - group by title
    documents.forEach(doc => {
      const titleKey = (doc.title || doc.name || doc.id || '').trim();
      if (!titleMap.has(titleKey)) {
        titleMap.set(titleKey, []);
      }
      titleMap.get(titleKey).push(doc);
      
      // Also track if this doc ID could be related to other docs by ID pattern
      if (doc.id) {
        // For dash-format IDs (new format), store without the suffix
        if (doc.id.includes('-')) {
          const prefix = doc.id.split('-')[0] + '-' + doc.id.split('-')[1];
          if (!idPrefixMap.has(prefix)) {
            idPrefixMap.set(prefix, []);
          }
          idPrefixMap.get(prefix).push(doc);
        } 
        // For old-format IDs (10 chars alphanumeric), store as is
        else if (/^[a-zA-Z0-9]{10}$/.test(doc.id)) {
          if (!idPrefixMap.has(doc.id)) {
            idPrefixMap.set(doc.id, []);
          }
          idPrefixMap.get(doc.id).push(doc);
        }
      }
    });
    
    console.log(`Found ${titleMap.size} unique titles among ${documents.length} documents`);
    
    // Second pass - mark duplicates based on title
    titleMap.forEach((docs, title) => {
      if (docs.length > 1) {
        // If multiple docs with same title, prefer dash-format IDs
        console.log(`Found ${docs.length} documents with duplicate title: "${title}"`);
        console.log('Document IDs:', docs.map((d: any) => d.id).join(', '));
        
        // Check if any have dash-format IDs (new format)
        const dashDoc = docs.find((d: any) => d.id && d.id.includes('-'));
        const docToKeep = dashDoc || docs[0]; // Keep dash format if found, otherwise first one
        
        console.log(`Keeping document with ID: ${docToKeep.id}`);
        
        docs.forEach((d: any) => {
          if (d.id !== docToKeep.id) {
            duplicateTracker.add(d.id);
            console.log(`  Marking as duplicate by title: ${d.id}`);
          }
        });
      }
    });
    
    // Third pass - check for documents with related ID patterns
    idPrefixMap.forEach((docs, prefix) => {
      if (docs.length > 1) {
        console.log(`Found ${docs.length} documents with related ID pattern: ${prefix}`);
        console.log('Related document IDs:', docs.map((d: any) => d.id).join(', '));
        
        // Always prefer the dash-format ID version
        const dashDocs = docs.filter((d: any) => d.id.includes('-'));
        
        if (dashDocs.length > 0) {
          // If we have dash-format IDs, keep only one of them (first one)
          const docToKeep = dashDocs[0];
          console.log(`Keeping document with ID: ${docToKeep.id}`);
          
          docs.forEach((d: any) => {
            if (d.id !== docToKeep.id) {
              duplicateTracker.add(d.id);
              console.log(`  Marking as duplicate by ID pattern: ${d.id}`);
            }
          });
        }
      }
    });
    
    // Special case - check for old ID and new ID relationships
    // This helps catch documents where the old ID format matches part of the new ID
    documents.forEach(doc => {
      if (doc.id && doc.id.includes('-')) {
        // This is a new format ID, check if we have matches with old format
        const parts = doc.id.split('-');
        if (parts.length >= 3) {
          // Check if any old-format ID is contained in this new ID
          const potentialOldIds = documents
            .filter(d => d.id && !d.id.includes('-') && d.id.length === 10)
            .map(d => d.id);
          
          potentialOldIds.forEach(oldId => {
            // If the old ID appears in any part of the new ID, mark it as duplicate
            if (parts.some((part: string) => part.includes(oldId) || oldId.includes(part))) {
              console.log(`Old ID ${oldId} appears to be related to new ID ${doc.id}`);
              duplicateTracker.add(oldId);
            }
          });
        }
      }
    });
    
    // Filter out duplicates
    const result = documents.filter(doc => !duplicateTracker.has(doc.id));
    console.log(`Deduplication complete. Removed ${documents.length - result.length} duplicates.`);
    console.log(`Output: ${result.length} unique documents`);
    
    return result;
  };

  // Build a network with the person as the central node connected to documents
  const buildPersonCentricNetwork = (personName: string, documents: any[]) => {
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    const addedNodeIds = new Set<string>();
    
    // Create the central person node
    const personId = `person-${personName.toLowerCase().replace(/\s+/g, '-')}`;
    nodes.push({
      id: personId,
      type: 'person',
      group: 'source', // Mark as source to highlight it
      data: { name: personName }
    });
    addedNodeIds.add(personId);
    
    // Track document IDs to fetch full data for
    const documentIdsToFetch: string[] = [];
    
    // Add document nodes and connections to the person
    documents.forEach(doc => {
      // Add document node
      if (!addedNodeIds.has(doc.id)) {
        nodes.push({
          id: doc.id,
          type: 'document',
          group: 'related',
          data: { 
            title: doc.title || doc.name || `Document ${doc.id}`,
            summary: doc.summary,
            names: doc.names || doc.allNames,
            places: doc.places || doc.allPlaces,
            dates: doc.dates || doc.allDates,
            objects: doc.objects || doc.allObjects,
            prefetchFullData: true,
            // If document already has full data from API, include it
            fullData: doc.fullData || null
          }
        });
        addedNodeIds.add(doc.id);
        documentIdsToFetch.push(doc.id);
      }
      
      // Link person to document
      links.push({
        source: personId,
        target: doc.id,
        type: 'mentions_person'
      });
      
      // Add other people from this document
      if (doc.names && Array.isArray(doc.names)) {
        doc.names.forEach((name: string) => {
          // Skip the main person we're already showing
          if (name.toLowerCase() === personName.toLowerCase()) return;
          
          const otherPersonId = `person-${name.toLowerCase().replace(/\s+/g, '-')}`;
          
          // Add the person node if not already added
          if (!addedNodeIds.has(otherPersonId)) {
            nodes.push({
              id: otherPersonId,
              type: 'person',
              group: 'entity',
              data: { name: name }
            });
            addedNodeIds.add(otherPersonId);
          }
          
          // Link document to person
          links.push({
            source: doc.id,
            target: otherPersonId,
            type: 'mentions_person'
          });
        });
      }
      
      // Add places from this document
      if (doc.places && Array.isArray(doc.places)) {
        doc.places.forEach((place: string) => {
          const placeId = `place-${place.toLowerCase().replace(/\s+/g, '-')}`;
          
          // Add the place node if not already added
          if (!addedNodeIds.has(placeId)) {
            nodes.push({
              id: placeId,
              type: 'place',
              group: 'entity',
              data: { place: place }
            });
            addedNodeIds.add(placeId);
          }
          
          // Link document to place
          links.push({
            source: doc.id,
            target: placeId,
            type: 'mentions_place'
          });
        });
      }
      
      // Add objects from this document
      if (doc.objects && Array.isArray(doc.objects)) {
        doc.objects.forEach((object: string) => {
          const objectId = `object-${object.toLowerCase().replace(/\s+/g, '-')}`;
          
          // Add the object node if not already added
          if (!addedNodeIds.has(objectId)) {
            nodes.push({
              id: objectId,
              type: 'object',
              group: 'entity',
              data: { object: object }
            });
            addedNodeIds.add(objectId);
          }
          
          // Link document to object
          links.push({
            source: doc.id,
            target: objectId,
            type: 'mentions_object'
          });
        });
      }
    });
    
    // Add everything to secondary groups to highlight central connections
    nodes.forEach(node => {
      if (node.group !== 'source' && node.id !== personId) {
        node.group = 'secondary';
      }
    });
    
    // Prefetch full data for the first few documents (up to 5) for better hover performance
    if (documentIdsToFetch.length > 0) {
      console.log(`Prefetching data for ${Math.min(5, documentIdsToFetch.length)} documents`);
      // Only prefetch the first 5 to avoid too many requests
      const docsToFetch = documentIdsToFetch.slice(0, 5);
      
      // Prefetch in the background
      Promise.allSettled(
        docsToFetch.map(docId => 
          fetch(`${API_BASE_URL}/api/jfk/media?id=${docId}&type=analysis`)
            .then(response => {
              if (!response.ok) throw new Error('Failed to fetch document data');
              return response.json();
            })
            .then(data => {
              // Find the document node and update its data
              const docNode = nodes.find(node => node.id === docId);
              if (docNode) {
                console.log(`Successfully prefetched data for document ${docId}`);
                docNode.data.fullData = data;
              }
            })
            .catch(err => {
              console.error(`Error prefetching data for document ${docId}:`, err);
            })
        )
      );
    }
    
    return { nodes, links };
  };

  // Filter graph data when showOnlyOverlaps changes
  useEffect(() => {
    if (!originalGraphData.nodes.length) return;
    
    if (showOnlyOverlaps) {
      filterOverlappingConnections();
    } else {
      // Reset to original data
      setGraphData(originalGraphData);
    }
  }, [showOnlyOverlaps, originalGraphData]);

  // Filter to show only entities connected to multiple documents
  const filterOverlappingConnections = () => {
    // Step 1: Identify which entities are connected to multiple documents
    const entityToDocumentCount: Record<string, Set<string>> = {};
    
    // Count how many documents each entity is connected to
    originalGraphData.links.forEach(link => {
      // Handle cases where source/target can be either string IDs or objects
      // Extract source and target IDs
      // @ts-ignore - Force Graph can use both string IDs and object references
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      // @ts-ignore - Force Graph can use both string IDs and object references
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      
      // Find the actual nodes
      const sourceNode = originalGraphData.nodes.find(n => n.id === sourceId);
      const targetNode = originalGraphData.nodes.find(n => n.id === targetId);
      
      if (!sourceNode || !targetNode) return;
      
      // If link connects person to document
      if (sourceNode.type === 'person' && targetNode.type === 'document') {
        if (!entityToDocumentCount[sourceNode.id]) {
          entityToDocumentCount[sourceNode.id] = new Set();
        }
        entityToDocumentCount[sourceNode.id].add(targetNode.id);
      }
      // Or if link connects document to person
      else if (sourceNode.type === 'document' && targetNode.type === 'person') {
        if (!entityToDocumentCount[targetNode.id]) {
          entityToDocumentCount[targetNode.id] = new Set();
        }
        entityToDocumentCount[targetNode.id].add(sourceNode.id);
      }
    });
    
    // Debug: Log entity connections to see if any have multiple documents
    console.log('Entity connections:', Object.entries(entityToDocumentCount).map(([entityId, docSet]) => ({
      entityId,
      documentCount: docSet.size,
      documents: Array.from(docSet)
    })));
    
    // Step 2: Get IDs of entities that are connected to multiple documents
    const multiDocEntities = Object.entries(entityToDocumentCount)
      .filter(([_, docSet]) => docSet.size > 1)
      .map(([entityId]) => entityId);
    
    console.log('Entities in multiple documents:', multiDocEntities);
    
    // If in person mode, always keep the central person node
    if (isPersonMode && personName) {
      const centralPersonId = `person-${personName.toLowerCase().replace(/\s+/g, '-')}`;
      if (!multiDocEntities.includes(centralPersonId)) {
        multiDocEntities.push(centralPersonId);
      }
    }
    
    // Step 3: Filter the nodes to keep only:
    // - All documents
    // - Entities that are connected to multiple documents
    const filteredNodes = originalGraphData.nodes.filter(node => 
      node.type === 'document' || multiDocEntities.includes(node.id)
    );
    
    console.log('Filtered nodes count:', filteredNodes.length, 'of', originalGraphData.nodes.length);
    
    // Step 4: Filter the links to keep only those connecting our filtered nodes
    const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
    
    const filteredLinks = originalGraphData.links.filter(link => {
      // Extract source and target IDs whether they're strings or objects
      // @ts-ignore - Force Graph can use both string IDs and object references
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      // @ts-ignore - Force Graph can use both string IDs and object references
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      
      return filteredNodeIds.has(sourceId) && filteredNodeIds.has(targetId);
    });
    
    console.log('Filtered links count:', filteredLinks.length, 'of', originalGraphData.links.length);
    
    // If there are no overlapping entities, show a message and don't filter
    if (multiDocEntities.length === 0) {
      alert("No entities found that appear in multiple documents. Showing all connections.");
      setShowOnlyOverlaps(false);
      return;
    }
    
    // Update the graph data with filtered nodes and links
    setGraphData({
      nodes: filteredNodes,
      links: filteredLinks
    });
    
    // Apply zoom to fit after filtering
    setTimeout(() => {
      if (fgRef.current) {
        fgRef.current.zoomToFit(400, 50);
      }
    }, 500);
  };

  // Apply zoom to fit on first render or data change
  useEffect(() => {
    if (fgRef.current && graphData.nodes.length > 0) {
      // Add a delay to ensure the graph is fully rendered
      setTimeout(() => {
        fgRef.current.zoomToFit(400, 50);
      }, 500);
    }
  }, [graphData]);

  const handleNodeClicked = (node: any) => {
    if (onNodeClick) {
      onNodeClick(node);
    }
  };

  const handleNodeHover = (node: any) => {
    setHoveredNode(node);
  };
  
  const toggleOverlapFilter = () => {
    setShowOnlyOverlaps(!showOnlyOverlaps);
  };
  
  const handlePersonSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    fetchPersonNetwork(personName);
  };
  
  const handlePersonNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPersonName(e.target.value);
  };
  
  const handleReset = () => {
    if (documentId) {
      fetchDocumentNetwork();
    } else {
      setGraphData({ nodes: [], links: [] });
      setOriginalGraphData({ nodes: [], links: [] });
      setIsPersonMode(false);
      setPersonName('');
      setError('Please enter a document ID or search for a person');
    }
  };

  // Update the handleForceRefresh function to support both document and person modes
  const handleForceRefresh = () => {
    if (isPersonMode && personName) {
      console.log('Forcing refresh of person search visualization...');
      setIsRefreshing(true);
      fetchPersonNetwork(personName);
    } else if (documentId) {
      console.log('Forcing refresh of document visualization...');
      setIsRefreshing(true);
      fetchDocumentNetwork(true);
    }
  };

  // Place this near the top of the component
  // Add a more prominent refresh button that's always visible
  const RefreshButton = () => (
    <Button
      variant={isRefreshing ? "default" : "outline"}
      size="sm"
      onClick={handleForceRefresh}
      disabled={isRefreshing}
      className="flex items-center text-xs py-0 h-7"
    >
      {isRefreshing ? (
        <>
          <Loader2 className="h-3 w-3 animate-spin mr-1" />
          Refreshing...
        </>
      ) : (
        <>
          <svg className="h-3 w-3 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 4v6h6" />
            <path d="M3.5 12a9 9 0 0 0 14.5 3 9 9 0 0 0 2-9.5" />
          </svg>
          Refresh
        </>
      )}
    </Button>
  );

  const toggleGeographicMode = () => {
    if (!isGeographicMode) {
      // Switching to geographic mode
      const newGraphData = { ...graphData };
      let hasLocations = false;
      
      // Group locations by region
      interface RegionInfo {
        names: string[];
        angle: number;
        radius: number;
      }
      
      const regions: Record<string, RegionInfo> = {
        "north_america": {
          names: ["washington", "dallas", "new orleans", "miami", "chicago", "new york", 
                 "los angeles", "u.s.", "united states", "canada", "texas", "florida", 
                 "california", "washington dc"],
          angle: 0, // Top
          radius: 0.8
        },
        "caribbean_central_america": {
          names: ["cuba", "havana", "matanzas", "mexico", "costa rica", "panama", 
                 "puerto rico", "jamaica", "dominican", "caribbean", "central america"],
          angle: Math.PI * 0.25, // Top-right
          radius: 0.8
        },
        "south_america": {
          names: ["brazil", "argentina", "chile", "colombia", "venezuela", "peru", 
                 "bolivia", "ecuador", "south america"],
          angle: Math.PI * 0.5, // Right
          radius: 0.8
        },
        "europe": {
          names: ["london", "uk", "paris", "france", "berlin", "madrid", "rome", "czech", 
                 "europe", "england", "britain", "italy", "spain", "germany", "switzerland", 
                 "austria", "belgium", "netherlands", "ireland", "scotland"],
          angle: Math.PI * 0.75, // Bottom-right
          radius: 0.8
        },
        "russia_ussr": {
          names: ["moscow", "soviet", "ussr", "russia", "kgb", "kremlin", "leningrad"],
          angle: Math.PI, // Bottom
          radius: 0.8
        },
        "asia": {
          names: ["tokyo", "beijing", "hong kong", "vietnam", "china", "japan", "korea", 
                 "thailand", "asia", "philippines", "asian"],
          angle: Math.PI * 1.25, // Bottom-left
          radius: 0.8
        },
        "middle_east": {
          names: ["middle east", "israel", "iraq", "iran", "syria", "saudi", "egypt", 
                 "lebanon", "jordan", "palestine", "turkish", "turkey"],
          angle: Math.PI * 1.5, // Left
          radius: 0.8
        },
        "africa": {
          names: ["africa", "algeria", "morocco", "nigeria", "kenya", "south africa"],
          angle: Math.PI * 1.75, // Top-left
          radius: 0.8
        },
        "other": {
          names: ["australia", "new zealand", "pacific", "antarctica"],
          angle: Math.PI * 1.85, // Near top-left
          radius: 0.8
        }
      };
      
      // Keep track of locations and their regions
      const placeNodes: GraphNode[] = [];
      const placeNodeRegions: Record<string, string> = {};
      
      // First, identify all place nodes and their regions
      newGraphData.nodes.forEach(node => {
        if (node.type === 'place') {
          hasLocations = true;
          placeNodes.push(node);
          
          const placeName = (node.data.place || '').toLowerCase();
          let assignedRegion = 'other';
          
          // Determine which region this place belongs to
          for (const [region, details] of Object.entries(regions)) {
            if (details.names.some(name => placeName.includes(name))) {
              assignedRegion = region;
              break;
            }
          }
          
          placeNodeRegions[node.id] = assignedRegion;
        }
      });
      
      if (hasLocations) {
        // Set state first for UI updates
        setIsGeographicMode(true);
        
        // First, reorganize nodes in their original positions to prevent jumps
        newGraphData.nodes.forEach(node => {
          // Remove any fixed positions that might exist
          delete (node as any).fx;
          delete (node as any).fy;
        });
        
        // Apply the updated graph data
        setGraphData(newGraphData);
        
        // Adjust force parameters for geographic layout
        setTimeout(() => {
          if (fgRef.current) {
            // Add a radial force to group nodes by region
            fgRef.current.d3Force('radial', d3.forceRadial(
              // Radius function based on node type and region
              (node: any) => {
                if (node.type !== 'place') {
                  // Non-place nodes stay closer to center
                  return width * 0.2;
                }
                
                const region = placeNodeRegions[node.id];
                if (!region) return width * 0.25;
                
                // Use the defined region radius
                const regionInfo = regions[region];
                return width * 0.38 * regionInfo.radius;
              },
              // Center x coordinate
              width / 2,
              // Center y coordinate
              height / 2
            ).strength((node: any) => {
              // Stronger force for place nodes to keep them in position
              return node.type === 'place' ? 0.3 : 0.05;
            }));
            
            // Add a custom angular force to position by region
            const angularForce = (alpha: number) => {
              for (const node of newGraphData.nodes) {
                if (node.type !== 'place') continue;
                
                const region = placeNodeRegions[node.id];
                if (!region) continue;
                
                const regionInfo = regions[region];
                const targetAngle = regionInfo.angle;
                
                // Calculate current angle from center
                const dx = (node.x || 0) - width / 2;
                const dy = (node.y || 0) - height / 2;
                let currentAngle = Math.atan2(dy, dx);
                
                // Normalize angle to 0-2π range
                if (currentAngle < 0) currentAngle += 2 * Math.PI;
                
                // Calculate the shortest path to target angle
                let deltaAngle = targetAngle - currentAngle;
                if (Math.abs(deltaAngle) > Math.PI) {
                  deltaAngle = deltaAngle > 0 ? deltaAngle - 2 * Math.PI : deltaAngle + 2 * Math.PI;
                }
                
                // Distance from center
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // Apply the force - stronger when further from target
                if (distance > 0) {
                  // Scale based on how far we are from target
                  const angleDiff = Math.abs(deltaAngle) / Math.PI;
                  const strength = 0.2 * alpha * (angleDiff < 0.1 ? 0.5 : 1.0);
                  
                  // Force components based on perpendicular direction
                  const fx = strength * deltaAngle * dy / distance;
                  const fy = -strength * deltaAngle * dx / distance;
                  
                  // Apply velocity changes
                  node.vx = (node.vx || 0) + fx;
                  node.vy = (node.vy || 0) + fy;
                }
              }
            };
            
            // Register custom force
            fgRef.current.d3Force('angle', angularForce);
            
            // Optimize other forces for geographic layout
            fgRef.current.d3Force('charge')
              .strength((node: any) => node.type === 'place' ? -150 : -50);
              
            fgRef.current.d3Force('link')
              .distance((link: any) => {
                // Shorter links for connections between places and their related entities
                const source = link.source;
                const target = link.target;
                if (source.type === 'place' || target.type === 'place') {
                  return 30;
                }
                return 60;
              });
              
            // Reduce center force to allow regional positioning
            fgRef.current.d3Force('center').strength(0.03);
            
            // Adjust alphaDecay for smoother transition
            fgRef.current.alphaDecay(0.01);
            
            // Restart with higher energy
            fgRef.current.alpha(1).restart();
            
            // Wait for simulation to stabilize, then center the view
            setTimeout(() => {
              fgRef.current.zoomToFit(400, 20);
            }, 1000);
          }
        }, 100);
      } else {
        alert("No location nodes found in the current visualization.");
      }
    } else {
      // Switching back to force-directed layout mode
      setIsGeographicMode(false);
      
      // Reset force parameters
      setTimeout(() => {
        if (fgRef.current) {
          // Remove custom geographic forces
          fgRef.current.d3Force('radial', null);
          fgRef.current.d3Force('angle', null);
          
          // Reset standard forces
          fgRef.current.d3Force('charge').strength(-100);
          fgRef.current.d3Force('link').distance(30);
          fgRef.current.d3Force('center').strength(0.1);
          
          // Restart with higher energy for reorganization
          fgRef.current.alpha(1).restart();
          
          // Re-center the graph after it's had time to reorganize
          setTimeout(() => {
            fgRef.current.zoomToFit(400, 50);
          }, 800);
        }
      }, 100);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
        <span className="ml-2 text-lg">
          {isSearching ? `Searching for documents mentioning '${personName}'...` : 'Loading network data...'}
        </span>
      </div>
    );
  }

  if (error && !graphData.nodes.length) {
    return (
      <div className="flex flex-col justify-center items-center h-full p-6">
        <div className="text-red-500 mb-4 text-center text-lg">
          {error}
        </div>
        
        <div className="text-gray-600 text-sm max-w-md text-center mb-6">
          <p>Try searching for a person instead:</p>
        </div>
        
        <form onSubmit={handlePersonSearch} className="flex space-x-2 w-full max-w-md mb-6">
          <div className="relative grow">
            <Input
              value={personName}
              onChange={handlePersonNameChange}
              placeholder="Enter person name (e.g., Kennedy)"
              className="pl-10"
            />
            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          </div>
          <Button type="submit" disabled={!personName.trim()}>Search</Button>
        </form>
        
        {debugInfo && (
          <div className="mt-4 p-4 bg-gray-100 rounded-md text-left w-full max-w-md">
            <p><strong>Debug Info:</strong></p>
            <ul className="list-disc list-inside">
              <li>Database Connected: {debugInfo.dbConnected ? 'Yes' : 'No'}</li>
              <li>Total Documents: {debugInfo.documentCount || 0}</li>
              {debugInfo.sampleDocumentId && (
                <li>
                  <p>Try this sample document ID: <code className="bg-gray-200 p-1 rounded">{debugInfo.sampleDocumentId}</code></p>
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
    );
  }

  // Define node colors by type and group
  const getNodeColor = (node: GraphNode) => {
    // For person mode, highlight the central person node
    if (isPersonMode && node.type === 'person' && node.group === 'source') {
      return '#2ca02c'; // Changed to green for the central person (was orange)
    }
    
    // Primary color by node type
    let baseColor: string;
    switch(node.type) {
      case 'document':
        baseColor = node.id === documentId ? '#ff7700' : '#1f77b4';
        break;
      case 'person':
        baseColor = isPersonMode ? '#ff7700' : '#2ca02c'; // Changed to orange for other persons (was green)
        break;
      case 'place':
        baseColor = '#d62728';
        break;
      case 'object':
        baseColor = '#9467bd';
        break;
      default:
        baseColor = '#7f7f7f';
    }

    // Adjust color based on node group
    if (node.group === 'secondary') {
      // Make secondary nodes lighter
      return lightenColor(baseColor, 0.3);
    }
    
    return baseColor;
  };

  // Helper function to lighten a color
  const lightenColor = (color: string, factor: number) => {
    // Convert hex to RGB
    let r = parseInt(color.substring(1, 3), 16);
    let g = parseInt(color.substring(3, 5), 16);
    let b = parseInt(color.substring(5, 7), 16);
    
    // Lighten
    r = Math.min(255, Math.round(r + (255 - r) * factor));
    g = Math.min(255, Math.round(g + (255 - g) * factor));
    b = Math.min(255, Math.round(b + (255 - b) * factor));
    
    // Convert back to hex
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  };

  // Get link color based on type
  const getLinkColor = (link: GraphLink) => {
    if (link.type === 'related_entity') {
      return 'rgba(150, 150, 150, 0.6)'; // Subtle grey for entity-entity connections
    }
    
    // Default link colors by type
    switch(link.type) {
      case 'mentions_person':
        return 'rgba(44, 160, 44, 0.6)'; // Green
      case 'mentions_place':
        return 'rgba(214, 39, 40, 0.6)'; // Red
      case 'mentions_object':
        return 'rgba(148, 103, 189, 0.6)'; // Purple
      default:
        return 'rgba(150, 150, 150, 0.6)'; // Grey
    }
  };

  // Determine node size based on type and importance
  const getNodeSize = (node: GraphNode): number => {
    const baseSize = 7;
    
    switch (node.type) {
      case 'document':
        return node.group === 'source' ? baseSize * 1.7 : baseSize * 1.2;
      case 'person':
        return node.group === 'source' ? baseSize * 1.7 : baseSize * 1.2;
      case 'place':
        return baseSize * 2; // Reduced from 3x to 2x
      case 'object':
        return baseSize;
      default:
        return baseSize;
    }
  };

  // Custom node rendering function to draw different shapes based on node type
  const nodeCanvasObject = (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const typedNode = node as GraphNode;
    const size = getNodeSize(typedNode) as number;
    
    // Scale the size of the node based on the zoom level (globalScale)
    // Apply a 2x size multiplier to make all icons larger
    const adjustedSize = (size * 2) / globalScale;
    
    // Get the node color
    const color = getNodeColor(typedNode);
    
    // Set common properties
    ctx.fillStyle = color;
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 1.5 / globalScale;
    
    switch(typedNode.type) {
      case 'document': {
        // Document icon (page with corner folded)
        const x = node.x - adjustedSize/2;
        const y = node.y - adjustedSize/2;
        const width = adjustedSize;
        const height = adjustedSize * 1.2;
        const cornerSize = width * 0.3;
        
        // Draw the main page
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + width - cornerSize, y);
        ctx.lineTo(x + width, y + cornerSize);
        ctx.lineTo(x + width, y + height);
        ctx.lineTo(x, y + height);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Draw the page fold with stronger styling
        ctx.beginPath();
        ctx.moveTo(x + width - cornerSize, y);
        ctx.lineTo(x + width - cornerSize, y + cornerSize);
        ctx.lineTo(x + width, y + cornerSize);
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 2 / globalScale;
        ctx.stroke();
        
        // Reset stroke style for text lines
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 0.5 / globalScale;
        
        // Draw horizontal lines for text (optional)
        const lineSpacing = height / 5;
        for (let i = 1; i < 4; i++) {
          ctx.beginPath();
          ctx.moveTo(x + width * 0.2, y + lineSpacing * i);
          ctx.lineTo(x + width * 0.8, y + lineSpacing * i);
          ctx.stroke();
        }
        
        // Reset stroke style for next node
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 1.5 / globalScale;
        break;
      }
      
      case 'person': {
        // Simplify person icon to be more visible
        const radius = adjustedSize / 2;
        
        // Save context
        ctx.save();
        
        // Draw solid circle with color fill
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
        ctx.fill();
        
        // Add white border
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 1.5 / globalScale;
        ctx.stroke();
        
        // Check if this is the central person in person mode
        const isCentralPerson = isPersonMode && typedNode.group === 'source';
        
        // For central person, add an outer ring
        if (isCentralPerson) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius * 1.3, 0, 2 * Math.PI);
          ctx.strokeStyle = color;
          ctx.lineWidth = 2 / globalScale;
          ctx.stroke();
        }
        
        // Restore context
        ctx.restore();
        break;
      }
      
      case 'place': {
        // Location pin
        const radius = adjustedSize / 2;
        
        // Save context to restore after drawing
        ctx.save();
        
        // Use thicker outline for location pins
        ctx.strokeStyle = color;
        ctx.lineWidth = 3 / globalScale;
        
        // Draw the pin body
        ctx.beginPath();
        ctx.arc(node.x, node.y - radius * 0.5, radius * 0.7, Math.PI, Math.PI * 2);
        ctx.lineTo(node.x, node.y + radius * 0.7);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Inner circle for pin center with white fill
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(node.x, node.y - radius * 0.5, radius * 0.35, 0, 2 * Math.PI);
        ctx.fill();
        
        // Optional: add an inner border to the white circle
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 1 / globalScale;
        ctx.stroke();
        
        // Restore context
        ctx.restore();
        break;
      }
      
      case 'object': {
        // Object icon (cube)
        const size = adjustedSize;
        const depth = size * 0.4;
        
        // Draw the front face
        ctx.beginPath();
        ctx.rect(node.x - size/2, node.y - size/2, size, size);
        ctx.fill();
        ctx.stroke();
        
        // Draw the top face
        ctx.beginPath();
        ctx.moveTo(node.x - size/2, node.y - size/2);
        ctx.lineTo(node.x - size/2 + depth, node.y - size/2 - depth);
        ctx.lineTo(node.x + size/2, node.y - size/2 - depth);
        ctx.lineTo(node.x + size/2, node.y - size/2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Draw the right face
        ctx.beginPath();
        ctx.moveTo(node.x + size/2, node.y - size/2);
        ctx.lineTo(node.x + size/2, node.y + size/2);
        ctx.lineTo(node.x + size/2 - depth, node.y + size/2 - depth);
        ctx.lineTo(node.x + size/2 - depth, node.y - size/2 - depth);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      }
      
      default: {
        // Default to a circle for any unknown type
        ctx.beginPath();
        ctx.arc(node.x, node.y, adjustedSize/2, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
      }
    }
    
    // If this is the highlighted/central node, add a glow effect
    if ((isPersonMode && typedNode.type === 'person' && typedNode.group === 'source') || 
        (typedNode.type === 'document' && typedNode.id === documentId)) {
      ctx.save();
      // Use green highlight for central person in person mode, orange for source document in document mode
      const highlightColor = isPersonMode && typedNode.type === 'person' ? '#2ca02c' : '#ff7700';
      ctx.strokeStyle = highlightColor;
      ctx.lineWidth = 2.5 / globalScale;
      ctx.shadowColor = highlightColor;
      ctx.shadowBlur = 15 / globalScale;
      
      // Draw a highlight ring - increase radius to match the larger node size
      ctx.beginPath();
      ctx.arc(node.x, node.y, adjustedSize * 0.9, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.restore();
    }

    // Node label if zoomed in enough (globalScale < 0.5 means we're zoomed out)
    if (globalScale > 1.5) {
      let label = '';
      if (typedNode.type === 'document') {
        label = typedNode.data.title || typedNode.id;
      } else if (typedNode.type === 'person') {
        label = typedNode.data.name;
      } else if (typedNode.type === 'place') {
        label = typedNode.data.place;
      } else if (typedNode.type === 'object') {
        label = typedNode.data.object;
      }
      
      // Only show label if we have one
      if (label) {
        // Increase font size to match larger nodes
        ctx.font = `${14 / globalScale}px Sans-Serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.lineWidth = 3 / globalScale;
        // Position label further down to account for larger nodes
        ctx.strokeText(label, node.x, node.y + adjustedSize + (8 / globalScale));
        ctx.fillText(label, node.x, node.y + adjustedSize + (8 / globalScale));
      }
    }
  };

  return (
    <Card className="w-full h-full">
      <CardContent className="p-2">
        <div className="relative w-full h-full">
          {/* Person Search Input */}
          <div className="absolute top-4 left-4 z-10 bg-white dark:bg-gray-800 p-2 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 flex items-center space-x-2 max-w-[50%]">
            {isPersonMode ? (
              <div className="flex flex-col space-y-2 w-full">
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-orange-500 mr-2"></div>
                  <span className="text-xs font-medium">{personName}</span>
                </div>
                <div className="flex space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleReset} 
                    className="text-xs py-0 h-7"
                  >
                    Reset
                  </Button>
                  <Button
                    variant={showOnlyOverlaps ? "default" : "outline"}
                    size="sm"
                    onClick={toggleOverlapFilter}
                    className="flex items-center text-xs py-0 h-7"
                  >
                    <Filter className="h-3 w-3 mr-1" />
                    {showOnlyOverlaps ? "Shared only" : "Show shared"}
                  </Button>
                  <RefreshButton />
                </div>
                {/* Connection layers dropdown - Person mode */}
                <div className="flex items-center mt-1">
                  <label htmlFor="connection-layers-person" className="text-xs mr-2">Connection Depth:</label>
                  <select
                    id="connection-layers-person"
                    value={connectionLayers}
                    onChange={(e) => setConnectionLayers(Number(e.target.value))}
                    className="text-xs py-0 h-7 border border-gray-200 dark:border-gray-700 rounded grow"
                  >
                    <option value="1">1 Layer</option>
                    <option value="2">2 Layers</option>
                    <option value="3">3 Layers</option>
                    <option value="4">4 Layers</option>
                    <option value="5">5 Layers</option>
                  </select>
                </div>

                {/* Map It button - Person mode */}
                {graphData.nodes.length > 0 && (
                  <Button
                    variant={isGeographicMode ? "default" : "outline"}
                    size="sm"
                    onClick={toggleGeographicMode}
                    className="flex items-center text-xs py-0 h-7 mt-2"
                  >
                    <svg className="h-3 w-3 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="10" r="3" />
                      <path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 6.9 8 11.7z" />
                    </svg>
                    {isGeographicMode ? "Reset Layout" : "Map It"}
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex flex-col space-y-2 w-full">
                <form onSubmit={handlePersonSearch} className="flex space-x-1">
                  <div className="relative grow">
                    <Input
                      value={personName}
                      onChange={handlePersonNameChange}
                      placeholder="Search by person name..."
                      className="h-7 text-xs pl-7"
                    />
                    <User className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-gray-400" />
                  </div>
                  <Button type="submit" size="sm" disabled={!personName.trim()} className="h-7 py-0 text-xs">
                    <Search className="h-3 w-3 mr-1" />
                    Search
                  </Button>
                </form>
                <div className="flex space-x-2">
                  {!isPersonMode && graphData.nodes.length > 0 && (
                    <Button
                      variant={showOnlyOverlaps ? "default" : "outline"}
                      size="sm"
                      onClick={toggleOverlapFilter}
                      className="flex items-center text-xs py-0 h-7"
                    >
                      <Filter className="h-3 w-3 mr-1" />
                      {showOnlyOverlaps ? "Showing overlaps only" : "Show overlapping connections"}
                    </Button>
                  )}
                  {(documentId || personName) && graphData.nodes.length > 0 && (
                    <RefreshButton />
                  )}
                </div>
                {/* Connection layers dropdown - Document mode */}
                <div className="flex items-center mt-1">
                  <label htmlFor="connection-layers-doc" className="text-xs mr-2">Connection Depth:</label>
                  <select
                    id="connection-layers-doc"
                    value={connectionLayers}
                    onChange={(e) => setConnectionLayers(Number(e.target.value))}
                    className="text-xs py-0 h-7 border border-gray-200 dark:border-gray-700 rounded grow"
                  >
                    <option value="1">1 Layer</option>
                    <option value="2">2 Layers</option>
                    <option value="3">3 Layers</option>
                    <option value="4">4 Layers</option>
                    <option value="5">5 Layers</option>
                  </select>
                </div>

                {/* Map It button - Document mode */}
                {graphData.nodes.length > 0 && (
                  <Button
                    variant={isGeographicMode ? "default" : "outline"}
                    size="sm"
                    onClick={toggleGeographicMode}
                    className="flex items-center text-xs py-0 h-7 mt-2"
                  >
                    <svg className="h-3 w-3 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="10" r="3" />
                      <path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 6.9 8 11.7z" />
                    </svg>
                    {isGeographicMode ? "Reset Layout" : "Map It"}
                  </Button>
                )}
              </div>
            )}
          </div>

          <ForceGraph2D
            ref={fgRef}
            graphData={graphData}
            width={width}
            height={height}
            nodeColor={(node: any) => getNodeColor(node as GraphNode)}
            nodeVal={(node: any) => getNodeSize(node as GraphNode)}
            nodeCanvasObject={(node, ctx, globalScale) => nodeCanvasObject(node, ctx, globalScale)}
            linkColor={(link: any) => getLinkColor(link as GraphLink)}
            linkWidth={(link: any) => {
              const typedLink = link as GraphLink;
              return typedLink.type === 'related_entity' ? 0.5 : 1;
            }}
            linkDirectionalArrowLength={3}
            linkDirectionalArrowRelPos={1}
            onNodeClick={(node: any) => handleNodeClicked(node)}
            onNodeHover={(node: any) => handleNodeHover(node)}
            nodeRelSize={6}
            nodeLabel={() => ''}
            d3AlphaDecay={0.02}
            cooldownTicks={100}
          />

          {/* Geographic mode indicator */}
          {isGeographicMode && (
            <div className="absolute top-4 right-4 bg-white/80 dark:bg-gray-800/80 text-xs p-2 rounded-lg border border-blue-300 shadow">
              <div className="font-medium text-blue-600 dark:text-blue-400">Geographic Mode</div>
              <div className="text-gray-600 dark:text-gray-300">Locations are arranged by region</div>
            </div>
          )}

          {/* Super simple tooltip with direct node data */}
          {hoveredNode?.type === 'document' && (
            <div className="absolute top-2 left-2 bg-white/95 dark:bg-gray-800/95 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-4 max-w-[320px] z-9999">
              <div className="flex items-center mb-2">
                <div
                  className="w-3 h-3 rounded-full mr-2"
                  style={{ backgroundColor: getNodeColor(hoveredNode) }}
                ></div>
                <h4 className="font-semibold text-sm">Document</h4>
              </div>
              
              <div className="space-y-2">
                <h3 className="font-medium text-sm">{hoveredNode.data.title || hoveredNode.id}</h3>
                {hoveredNode.data.summary && (
                  <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-3">{hoveredNode.data.summary}</p>
                )}
                
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {hoveredNode.data.names && hoveredNode.data.names.length > 0 && (
                    <div>
                      <h5 className="font-bold text-gray-500">People</h5>
                      <p className="text-gray-700 dark:text-gray-300 line-clamp-2">
                        {hoveredNode.data.names.slice(0, 3).join(', ')}
                        {hoveredNode.data.names.length > 3 ? '...' : ''}
                      </p>
                    </div>
                  )}
                  
                  {hoveredNode.data.places && hoveredNode.data.places.length > 0 && (
                    <div>
                      <h5 className="font-bold text-gray-500">Places</h5>
                      <p className="text-gray-700 dark:text-gray-300 line-clamp-2">
                        {hoveredNode.data.places.slice(0, 3).join(', ')}
                        {hoveredNode.data.places.length > 3 ? '...' : ''}
                      </p>
                    </div>
                  )}
                </div>
                
                <a 
                  href={`/jfk-files/${hoveredNode.id}`}
                  className="text-xs text-blue-500 hover:underline block"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View document →
                </a>
              </div>
            </div>
          )}
          
          {/* Simple tooltip for other node types */}
          {hoveredNode && hoveredNode.type !== 'document' && (
            <div className="absolute top-2 left-2 bg-white/95 dark:bg-gray-800/95 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-3 max-w-[250px] z-9999">
              <div className="flex items-center mb-2">
                <div
                  className="w-3 h-3 rounded-full mr-2"
                  style={{ backgroundColor: getNodeColor(hoveredNode) }}
                ></div>
                <h4 className="font-semibold text-sm">
                  {hoveredNode.type.charAt(0).toUpperCase() + hoveredNode.type.slice(1)}
                </h4>
              </div>
              <p className="text-sm">
                {hoveredNode.type === 'person' && hoveredNode.data.name}
                {hoveredNode.type === 'place' && hoveredNode.data.place}
                {hoveredNode.type === 'object' && hoveredNode.data.object}
              </p>
            </div>
          )}

          {/* Legend for network explanation */}
          <div className="text-xs text-gray-600 dark:text-gray-300 absolute bottom-1 right-1 bg-white/80 dark:bg-gray-800/80 p-2 rounded-lg border border-gray-200 dark:border-gray-700 grid grid-cols-2 gap-x-4 gap-y-1">
            <div className="col-span-2 font-semibold mb-1">Legend:</div>
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full mr-1 border border-white" style={{ backgroundColor: '#1f77b4' }}></div>
              <span className="text-xs">Document</span>
            </div>
            <div className="flex items-center">
              {isPersonMode ? (
                <>
                  <div className="w-3 h-3 rounded-full mr-1 border border-white" style={{ backgroundColor: '#2ca02c' }}></div>
                  <span className="text-xs">Central Person</span>
                </>
              ) : (
                <>
                  <div className="w-3 h-3 rounded-full mr-1 border border-white" style={{ backgroundColor: '#ff7700' }}></div>
                  <span className="text-xs">Source Document</span>
                </>
              )}
            </div>
            <div className="flex items-center">
              {isPersonMode ? (
                <>
                  <div className="w-3 h-3 rounded-full mr-1 border border-white" style={{ backgroundColor: '#ff7700' }}></div>
                  <span className="text-xs">Person</span>
                </>
              ) : (
                <>
                  <div className="w-3 h-3 rounded-full mr-1 border border-white" style={{ backgroundColor: '#2ca02c' }}></div>
                  <span className="text-xs">Person</span>
                </>
              )}
            </div>
            <div className="flex items-center">
              <div className="h-3 w-3 rounded-full mr-1 border border-white" style={{ backgroundColor: '#d62728' }}></div>
              <span className="text-xs">Location</span>
            </div>
            <div className="flex items-center">
              <div className="h-3 w-3 rounded-full mr-1 border border-white" style={{ backgroundColor: '#9467bd' }}></div>
              <span className="text-xs">Object</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 