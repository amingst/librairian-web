// Add type declaration at the top of the file
declare global {
  interface Window {
    updateDocumentDock?: () => void;
    documentDetailsCache?: Record<string, any>;
  }
}

"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useDocumentDock, DocumentItem } from '../../lib/context/DocumentDockContext';
import { X, GripVertical, ChevronUp, ChevronDown, Mic, Radio, MessageSquare, FileText, Image, AlignLeft, Play, Pause, Loader, FileSearch, User, MapPin, Package, ChevronLeft, ChevronRight } from 'lucide-react';
import type { DropResult, DroppableProvided, DraggableProvided } from 'react-beautiful-dnd';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import dynamic from 'next/dynamic';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.oip.onl';

// Use dynamic import with ssr: false to avoid hydration issues
export const DocumentDock = dynamic(() => Promise.resolve(DocumentDockImpl), {
  ssr: false
});

// The actual implementation
function DocumentDockImpl() {
  const { queue, removeFromQueue, clearQueue, reorderQueue, setQueue, addToQueue } = useDocumentDock();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [documentDetails, setDocumentDetails] = useState<Record<string, any>>({});
  const [activeTab, setActiveTab] = useState<Record<string, string>>({});
  const [expandedSection, setExpandedSection] = useState<Record<string, string | null>>({});
  const [currentPage, setCurrentPage] = useState<Record<string, number>>({});
  const [podcastStatus, setPodcastStatus] = useState<'idle' | 'generating' | 'ready' | 'error'>('idle');
  const [podcastUrl, setPodcastUrl] = useState<string | null>(null);
  const [podcastProgress, setPodcastProgress] = useState<string>('');
  const [reportStatus, setReportStatus] = useState<'idle' | 'generating' | 'ready' | 'error'>('idle');
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const [reportProgress, setReportProgress] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPlayer, setCurrentPlayer] = useState<'podcast' | 'report' | null>(null);
  const [tokenCount, setTokenCount] = useState<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [pageContentLoading, setPageContentLoading] = useState<Record<string, boolean>>({});
  const [pageContent, setPageContent] = useState<Record<string, any>>({});
  const [playlist, setPlaylist] = useState<Array<{
    id: string;
    title: string;
    showName: string;
    tags: string[];
    documentIds: string[];
    audioUrl: string;
    timestamp: string;
  }>>([]);
  const [currentPlaylistItem, setCurrentPlaylistItem] = useState<number | null>(null);
  const [showPlaylist, setShowPlaylist] = useState<boolean>(false);
  const [pageImageUrls, setPageImageUrls] = useState<Record<string, string>>({});

  // Effect to load image URLs when document or page changes
  useEffect(() => {
    const loadImageUrls = async () => {
      for (const item of queue) {
        const pageNum = currentPage[item.id] || 1;
        if (!pageImageUrls[`${item.id}-${pageNum}`]) {
          const url = await getPageImageUrl(item.id, pageNum);
          setPageImageUrls(prev => ({
            ...prev,
            [`${item.id}-${pageNum}`]: url
          }));
        }
      }
    };
    
    loadImageUrls();
  }, [queue, currentPage]);

  // Handle drag and drop reordering
  const onDragEnd = (result: DropResult) => {
    // Dropped outside the list
    if (!result.destination) {
      return;
    }

    reorderQueue(result.source.index, result.destination.index);
  };

  // Fetch document details for items in queue
  useEffect(() => {
    const fetchDocumentDetails = async () => {
      const details: Record<string, any> = {};
      
      for (const item of queue) {
        if (!documentDetails[item.id]) {
          try {
            // First check if there's cached data available from window.documentDetailsCache
            if (typeof window !== 'undefined' && window.documentDetailsCache && window.documentDetailsCache[item.id]) {
              console.log(`Using cached document details for ${item.id}`);
              details[item.id] = window.documentDetailsCache[item.id];
            } else {
              // No cached data, fetch from API
              console.log(`Fetching document details for ${item.id}`);
              
              // Check if it's an RFK document
              const isRfkDocument = item.id.toLowerCase().includes('rfk');
              
              // Try to fetch from the internal API first
              const response = await fetch(`${API_BASE_URL}/api/jfk/documents/${item.id}${isRfkDocument ? '?collection=rfk' : ''}`);
              
              if (response.ok) {
                const data = await response.json();
                details[item.id] = data;
              } else {
                // If internal API fails, try the external API
                console.log(`Internal API failed for ${item.id}, trying external API`);
                const externalResponse = await fetch(`${API_BASE_URL}/api/jfk/media?id=${item.id}&type=analysis&getLatestPageData=true${isRfkDocument ? '&collection=rfk' : ''}`);
                
                if (externalResponse.ok) {
                  const data = await externalResponse.json();
                  details[item.id] = data;
                } else {
                  // If it's not already identified as RFK, try again with collection=rfk
                  if (!isRfkDocument) {
                    console.log(`External API failed for ${item.id}, trying as RFK document`);
                    const rfkResponse = await fetch(`${API_BASE_URL}/api/jfk/media?id=${item.id}&type=analysis&getLatestPageData=true&collection=rfk`);
                    
                    if (rfkResponse.ok) {
                      const data = await rfkResponse.json();
                      details[item.id] = data;
                      console.log(`Successfully retrieved ${item.id} as RFK document`);
                    } else {
                      console.error(`Failed to fetch details for document ${item.id} from all APIs`);
                    }
                  } else {
                    console.error(`Failed to fetch details for document ${item.id} from both APIs`);
                  }
                }
              }
            }
            
            // Initialize tabs and current page if not set
            if (!activeTab[item.id]) {
              setActiveTab(prev => ({ ...prev, [item.id]: 'summary' }));
            }
            if (!currentPage[item.id]) {
              setCurrentPage(prev => ({ ...prev, [item.id]: 1 }));
            }
          } catch (error) {
            console.error(`Error fetching details for document ${item.id}:`, error);
          }
        }
      }
      
      if (Object.keys(details).length > 0) {
        setDocumentDetails(prev => ({ ...prev, ...details }));
      }
    };
    
    fetchDocumentDetails();
  }, [queue, documentDetails, activeTab, currentPage]);

  // Function to get full document data
  const getFullDocumentData = async (docId: string) => {
    try {
      // Check if it's an RFK document
      const isRfkDocument = docId.toLowerCase().includes('rfk');
      
      const response = await fetch(`${API_BASE_URL}/api/jfk/media?id=${docId}&type=analysis&getLatestPageData=true${isRfkDocument ? '&collection=rfk' : ''}`);
      if (response.ok) {
        return await response.json();
      } else {
        // If not already identified as RFK, try again with collection=rfk parameter
        if (!isRfkDocument) {
          console.log(`Failed to fetch data for ${docId}, trying as RFK document`);
          const rfkResponse = await fetch(`${API_BASE_URL}/api/jfk/media?id=${docId}&type=analysis&getLatestPageData=true&collection=rfk`);
          
          if (rfkResponse.ok) {
            console.log(`Successfully retrieved ${docId} as RFK document`);
            return await rfkResponse.json();
          }
        }
        
        console.error(`Failed to fetch full data for document ${docId}`);
        return null;
      }
    } catch (error) {
      console.error(`Error fetching full data for document ${docId}:`, error);
      return null;
    }
  };

  // Function to estimate tokens in text
  const estimateTokens = (text: string): number => {
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  };

  // Function to calculate total tokens for investigative report
  const calculateReportTokens = async () => {
    if (queue.length === 0) {
      setTokenCount(0);
      return;
    }

    try {
      // Get full data for each document in the queue
      const fullDocumentsData = await Promise.all(
        queue.map(async (item) => {
          const fullData = await getFullDocumentData(item.id);
          console.log('fullData', fullData);
          return { item, fullData };
        })
      );

      let totalTokens = 0;
      
      for (const { fullData } of fullDocumentsData) {
        if (!fullData) continue;
        
        // Count tokens in summary
        if (fullData.summary) {
          totalTokens += estimateTokens(fullData.summary);
        }

        // Count tokens in pages
        if (fullData.pages && Array.isArray(fullData.pages)) {
          for (const page of fullData.pages) {
            // Count page summary
            if (page.summary) {
              totalTokens += estimateTokens(page.summary);
            }
            
            // Count page content
            if (fullData.fullText) {
              const pageMarker = `--- PAGE ${page.pageNumber} ---`;
              const nextPageMarker = `--- PAGE ${page.pageNumber + 1} ---`;
              
              const startIndex = fullData.fullText.indexOf(pageMarker);
              if (startIndex !== -1) {
                const endIndex = fullData.fullText.indexOf(nextPageMarker, startIndex);
                const pageContent = endIndex !== -1 
                  ? fullData.fullText.substring(startIndex, endIndex) 
                  : fullData.fullText.substring(startIndex);
                totalTokens += estimateTokens(pageContent);
              }
            }
          }
        }
      }

      setTokenCount(totalTokens);
    } catch (error) {
      console.error('Error calculating tokens:', error);
      setTokenCount(0);
    }
  };

  // Update token count when queue changes
  useEffect(() => {
    calculateReportTokens();
  }, [queue]);

  // Function to handle metadata from report generation
  const handleReportMetadata = (metadataEvent: any) => {
    try {
      console.log('Received metadata message:', metadataEvent);
      
      if (metadataEvent.reportTitle) {
        // Get current report URL to use as ID
        const reportId = currentPlayer === 'report' && reportUrl ? 
          reportUrl.split('id=')[1] : 
          `report-${Date.now()}`;
        
        // Clean up tags - remove prefix instructions that might be in the first tags
        const cleanTags = Array.isArray(metadataEvent.reportTags) ? 
          metadataEvent.reportTags.filter((tag: string) => 
            !tag.includes('Based on the dialogue provided') && 
            !tag.includes('here is a comma-separated list of relevant tags') &&
            tag.trim().length > 0
          ) : [];
        
        const reportMetadata = {
          id: reportId,
          title: metadataEvent.reportTitle,
          showName: metadataEvent.showName || 'Investigative Report',
          tags: cleanTags,
          documentIds: queue.map(item => item.id),
          audioUrl: '',
          timestamp: new Date().toISOString()
        };
        
        console.log('Creating report metadata:', reportMetadata);
        
        // Only add if we have a valid audioUrl
        if (reportMetadata.audioUrl) {
          // Add to playlist state
          setPlaylist(prev => {
            // Check if this report is already in the playlist (by audioUrl)
            const exists = prev.some(item => item.audioUrl === reportMetadata.audioUrl);
            if (!exists) {
              const updatedPlaylist = [...prev, reportMetadata];
              
              // Save to localStorage
              try {
                localStorage.setItem('investigativeReportPlaylists', JSON.stringify(updatedPlaylist));
                console.log('Saved updated playlist to localStorage:', updatedPlaylist);
              } catch (storageErr) {
                console.error('Error saving to localStorage:', storageErr);
              }
              
              // Set as current playlist item and show the playlist
              setTimeout(() => {
                setCurrentPlaylistItem(updatedPlaylist.length - 1);
                setShowPlaylist(true);
                
                // Prepare audio for playing in the sidebar instead of full-width player
                if (audioRef.current) {
                  audioRef.current.src = reportMetadata.audioUrl;
                  audioRef.current.load();
                }
              }, 100);
              
              return updatedPlaylist;
            }
            return prev;
          });
          
          console.log('Added report to playlist:', reportMetadata);
        } else {
          console.warn('No audio URL found for report, skipping playlist addition');
        }
      }
    } catch (err) {
      console.error('Error processing metadata:', err);
    }
  };

  // Function to generate podcast
  const generatePodcast = async () => {
    if (queue.length === 0) return;
    
    setPodcastStatus('generating');
    setPodcastProgress('Starting podcast generation...');
    setPodcastUrl(null);
    
    // Create an abort controller for the fetch
    const controller = new AbortController();
    const signal = controller.signal;
    
    try {
      // Get full data for each document in the queue
      const fullDocuments = await Promise.all(
        queue.map(async (item) => {
          const fullData = await getFullDocumentData(item.id);
          return {
            id: item.id,
            title: item.title || item.id,
            url: `/jfk-files/${item.id}`,
            type: 'document',
            content: fullData?.fullText || '',  // Important: Backend expects 'content' field
            summary: fullData?.summary || '',
            fullText: fullData?.fullText || '',
            pageCount: fullData?.pageCount || 1
          };
        })
      );
      
      // Filter out any documents that failed to fetch
      const articles = fullDocuments.filter(doc => doc.content && doc.content.length > 0);
      
      if (articles.length === 0) {
        throw new Error('Failed to fetch document data');
      }
      
      // Use named hosts that match what the backend expects - based on the browser extension
      const selectedHosts = ['hypatia', 'socrates'];
      
      // Prepare the request body
      const requestBody = {
        articles,
        selectedHosts,
        targetLengthSeconds: 300 // 5 minutes default
      };
      
      console.log('Sending podcast request:', JSON.stringify(requestBody));
      
      // Set up event source to process the SSE response directly from the POST request
      const eventSource = new EventSource(`${API_BASE_URL}/api/generate/podcast`);
      
      // Send the POST request
      fetch(`${API_BASE_URL}/api/generate/podcast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal
      }).catch(error => {
        console.error('Error with podcast fetch:', error);
        setPodcastStatus('error');
        setPodcastProgress('Error starting podcast generation');
        eventSource.close();
        // No need to throw here as we're handling the error
      });
      
      // Handle SSE events
      eventSource.addEventListener('generatingPodcast', (event) => {
        try {
          const data = typeof event.data === 'string' ? 
            event.data.replace(/^"/, '').replace(/"$/, '') : 
            event.data;
          setPodcastProgress(data);
        } catch (e) {
          setPodcastProgress('Generating podcast...');
        }
      });
      
      eventSource.addEventListener('progress', (event) => {
        try {
          const data = typeof event.data === 'string' ? 
            event.data.replace(/^"/, '').replace(/"$/, '') : 
            event.data;
          setPodcastProgress(data);
        } catch (e) {
          setPodcastProgress('Processing...');
        }
      });
      
      eventSource.addEventListener('podcastComplete', (event) => {
        try {
          let data;
          if (typeof event.data === 'string') {
            // Try to parse the data, removing any extra quotes
            data = JSON.parse(event.data.replace(/^"/, '').replace(/"$/, ''));
          } else {
            data = event.data;
          }
          
          setPodcastStatus('ready');
          setPodcastUrl(`${API_BASE_URL}/api/generate/media?id=${data.podcastFile}`);
        } catch (e) {
          console.error('Error parsing podcast complete event:', e);
          setPodcastStatus('error');
          setPodcastProgress('Error processing podcast data');
        } finally {
          eventSource.close();
          controller.abort(); // Abort the fetch request if it's still ongoing
        }
      });
      
      eventSource.addEventListener('error', (event) => {
        console.error('Podcast generation error:', event);
        setPodcastStatus('error');
        setPodcastProgress('Error generating podcast');
        eventSource.close();
        controller.abort(); // Abort the fetch request if it's still ongoing
      });
      
      eventSource.addEventListener('ping', (event) => {
        console.log('Podcast generation connection alive:', event.data);
      });
      
      // Handle connection errors
      eventSource.onerror = () => {
        console.error('EventSource connection error');
        setPodcastStatus('error');
        setPodcastProgress('Connection error');
        eventSource.close();
        controller.abort(); // Abort the fetch request if it's still ongoing
      };
      
    } catch (error) {
      console.error('Error initiating podcast generation:', error);
      setPodcastStatus('error');
      setPodcastProgress(error instanceof Error ? error.message : 'Unknown error');
    }
  };

  // Function to generate investigative report
  const generateInvestigativeReport = async () => {
    if (queue.length === 0) return;
    
    setReportStatus('generating');
    setReportProgress('Starting investigative report generation...');
    setReportUrl(null);
    
    // Create an abort controller for the fetch
    const controller = new AbortController();
    const signal = controller.signal;
    
    try {
      // Get full data for each document in the queue
      const fullDocumentsData = await Promise.all(
        queue.map(async (item) => {
          const fullData = await getFullDocumentData(item.id);
          return { item, fullData };
        })
      );
      
      // Format data for the investigative report API
      // First, we'll create individual document entries for each page
      let documents = [];
      let allNames = new Set<string>();
      let allDates = new Set<string>();
      let allPlaces = new Set<string>();
      let allObjects = new Set<string>();
      
      for (const { item, fullData } of fullDocumentsData) {
        if (!fullData) continue;
        
        // Add to metadata collections
        if (fullData.allNames) fullData.allNames.forEach((name: string) => allNames.add(name));
        if (fullData.allDates) fullData.allDates.forEach((date: string) => allDates.add(date));
        if (fullData.allPlaces) fullData.allPlaces.forEach((place: string) => allPlaces.add(place));
        if (fullData.allObjects) fullData.allObjects.forEach((object: string) => allObjects.add(object));
        
        // Create page-level entries
        if (fullData.pages && Array.isArray(fullData.pages)) {
          for (const page of fullData.pages) {
            // Extract page text from fullText if available
            let pageContent = "";
            if (fullData.fullText) {
              const pageMarker = `--- PAGE ${page.pageNumber} ---`;
              const nextPageMarker = `--- PAGE ${page.pageNumber + 1} ---`;
              
              const startIndex = fullData.fullText.indexOf(pageMarker);
              if (startIndex !== -1) {
                const endIndex = fullData.fullText.indexOf(nextPageMarker, startIndex);
                pageContent = endIndex !== -1 
                  ? fullData.fullText.substring(startIndex, endIndex) 
                  : fullData.fullText.substring(startIndex);
              }
            }
            
            documents.push({
              documentId: `${item.id}`,
              url: `/jfk-files/${item.id}`,
              summary: fullData.summary || "",
              pageSummary: page.summary || "",
              content: pageContent || "",
              names: page.names || [],
              dates: page.dates || [],
              places: page.places || [],
              objects: page.objects || [],
              pageNumber: page.pageNumber,
              date: fullData.date || ""
            });
          }
        }
      }
      
      // Only proceed if we have at least one page with content
      if (documents.length === 0) {
        throw new Error('Failed to fetch document data or no pages found');
      }
      
      // Prepare the request body
      const requestBody = {
        documents,
        investigation: "The JFK Files Investigation",
        selectedInvestigators: ['reporter', 'privateEye'],
        targetLengthSeconds: 600 // 10 minutes default
      };
      
      console.log('Sending investigative report request:', JSON.stringify(requestBody));
      
      // NEW APPROACH: Use a single fetch with streaming to handle SSE
      const response = await fetch(`${API_BASE_URL}/api/generate/investigative-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to start report generation: ${errorData}`);
      }
      
      // Track if we've completed successfully to prevent duplicate handlers
      let hasCompleted = false;
      
      // Process the stream directly
      if (!response.body) {
        throw new Error('Response body is null, cannot read stream');
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      
      // Set a timeout to prevent hanging forever
      const timeoutId = setTimeout(() => {
        try {
          console.log(`Report generation timeout reached, aborting fetch`);
          controller.abort();
          
          if (!hasCompleted) {
            setReportStatus('error');
            setReportProgress('Report generation timed out after 5 minutes');
          }
        } catch (err) {
          console.error('Error in timeout handler:', err);
        }
      }, 300000); // 5 minutes timeout
      
      // Improved message handling in generateInvestigativeReport function
      const processEvents = () => {
        // Split buffer into events
        const events = buffer.split('\n\n');
        // Keep the last incomplete event in the buffer
        buffer = events.pop() || '';
        
        for (const eventText of events) {
          if (!eventText.trim()) continue;
          
          // Parse the event
          let eventName = 'message';
          let eventData = '';
          
          const lines = eventText.split('\n');
          for (const line of lines) {
            if (line.startsWith('event:')) {
              eventName = line.substring(6).trim();
            } else if (line.startsWith('data:')) {
              eventData = line.substring(5).trim();
            }
          }
          
          console.log(`Received event: ${eventName}`, eventData);
          
          // Handle different event types
          try {
            // Try to parse JSON data if it's JSON
            let data;
            try {
              // Handle quote-wrapped JSON strings
              if (eventData.startsWith('"') && eventData.endsWith('"')) {
                const unwrapped = eventData.substring(1, eventData.length - 1).replace(/\\"/g, '"');
                data = JSON.parse(unwrapped);
              } else {
                data = JSON.parse(eventData);
              }
            } catch (e) {
              // Use as string if it's not JSON
              data = eventData;
            }
            
            // Handle different event types
            if (eventName === 'generatingReport' || eventName === 'progress' || eventName === 'investigationUpdate') {
              setReportProgress(typeof data === 'string' ? data : JSON.stringify(data));
            } else if (eventName === 'reportComplete' || eventName === 'complete') {
              hasCompleted = true;
              setReportStatus('ready');
              
              let reportFileId = null;
              let audioUrl = '';
              
              // Create a better title based on documents in the queue
              const docCount = queue.length;
              const firstDocId = queue.length > 0 ? queue[0].id : '';
              const firstDocTitle = queue.length > 0 && queue[0].title ? 
                (queue[0].title.length > 30 ? queue[0].title.substring(0, 30) + '...' : queue[0].title) : 
                firstDocId;
              
              // Get current date in a readable format
              const now = new Date();
              const dateStr = now.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              });
                
              // More descriptive title based on document count
              const reportTitle = docCount === 1 ? 
                `Investigation: ${firstDocTitle} (${dateStr})` : 
                `Investigation: ${firstDocTitle} +${docCount-1} more (${dateStr})`;
              
              // Create the report metadata object
              const reportMetadata = {
                id: '',
                title: reportTitle,
                showName: 'JFK Files Investigation',
                tags: ['JFK Files', 'Investigative Report'],
                documentIds: queue.map(item => item.id),
                audioUrl: '',
                timestamp: new Date().toISOString()
              };
              
              if (typeof data === 'object') {
                if (data.reportFile) {
                  reportFileId = data.reportFile;
                  audioUrl = `${API_BASE_URL}/api/generate/media?id=${data.reportFile}`;
                } else if (data.documentDidTx) {
                  reportFileId = data.documentDidTx;
                  audioUrl = `${API_BASE_URL}/api/generate/media?id=${data.documentDidTx}`;
                }
                
                if (audioUrl) {
                  // Update the reportUrl state
                  setReportUrl(audioUrl);
                  
                  // Update the report metadata with the correct IDs and URLs
                  reportMetadata.id = reportFileId || '';
                  reportMetadata.audioUrl = audioUrl;
                  
                  // Always add the report to the playlist when complete
                  console.log('Adding completed report to playlist:', reportMetadata);
                  setPlaylist(prev => {
                    // Check if this report is already in the playlist (by id)
                    const exists = prev.some(item => item.id === reportMetadata.id);
                    if (!exists) {
                      const updatedPlaylist = [...prev, reportMetadata];
                      
                      // Save to localStorage
                      try {
                        localStorage.setItem('investigativeReportPlaylists', JSON.stringify(updatedPlaylist));
                        console.log('Saved updated playlist to localStorage:', updatedPlaylist);
                      } catch (storageErr) {
                        console.error('Error saving to localStorage:', storageErr);
                      }
                      
                      // Set as current playlist item and show the playlist
                      setTimeout(() => {
                        const newIndex = updatedPlaylist.length - 1;
                        setCurrentPlaylistItem(newIndex);
                        setShowPlaylist(true);
                        
                        // Prepare audio for playing in the sidebar instead of full-width player
                        if (audioRef.current) {
                          audioRef.current.src = audioUrl;
                          audioRef.current.load();
                          audioRef.current.play().catch(e => console.error('Error auto-playing audio:', e));
                          setIsPlaying(true);
                        }
                      }, 100);
                      
                      return updatedPlaylist;
                    }
                    return prev;
                  });
                }
              }
              
              clearTimeout(timeoutId);
            } else if (eventName === 'error') {
              if (!hasCompleted) {
                setReportStatus('error');
                setReportProgress(typeof data === 'string' ? data : JSON.stringify(data));
              }
              
              clearTimeout(timeoutId);
              return; // Exit the event processing loop immediately
            } else if (eventName === 'ping') {
              console.log('Report generation connection alive:', data);
            } else if (eventName === 'message') {
              // This could be the metadata message with report details
              console.log('Received generic message event:', data);
              
              // Check if this is a metadata message
              if (data && typeof data === 'object' && data.reportTitle) {
                console.log('Identified metadata message:', data);
                handleReportMetadata(data);
              }
            } else if (eventName === 'reportMetadata') {
              // Direct handling of the reportMetadata event type
              console.log('Received reportMetadata event:', data);
              handleReportMetadata(data);
            }
          } catch (error) {
            console.error('Error processing event:', error, eventText);
          }
        }
      };
      
      // Start reading the stream
      try {
        let shouldContinue = true;
        while (shouldContinue) {
          const { done, value } = await reader.read();
          
          if (done || hasCompleted) {
            console.log('Stream complete or processing completed');
            shouldContinue = false;
            break;
          }
          
          // Add new data to buffer and process
          buffer += decoder.decode(value, { stream: true });
          processEvents();
          
          // Check if we've completed (set in processEvents)
          if (hasCompleted) {
            shouldContinue = false;
            controller.abort(); // Now abort after breaking out of the loop
            break;
          }
        }
      } catch (streamError) {
        // If we get an abort error after successful completion, ignore it
        if (hasCompleted && (streamError as Error).name === 'AbortError') {
          console.log('Stream was aborted after successful completion');
        } else {
          throw streamError; // Re-throw other errors
        }
      } finally {
        // Make sure to finish decoder
        try {
          buffer += decoder.decode();
          processEvents();
        } catch (finalError) {
          if (hasCompleted) {
            console.log('Error in final decode but report was completed successfully');
          } else {
            console.error('Error in final decode:', finalError);
          }
        }
      }
      
      // If we haven't received a completion event but the stream ended
      if (!hasCompleted) {
        setReportStatus('error');
        setReportProgress('Report generation ended unexpectedly');
      }
      
    } catch (error) {
      console.error('Error initiating investigative report generation:', error);
      setReportStatus('error');
      setReportProgress(error instanceof Error ? error.message : 'Unknown error');
      controller.abort(); // Abort any ongoing fetch if there's an error
    }
  };

  // Handle audio playback for either podcast or report
  const togglePlayPause = (playerType: 'podcast' | 'report') => {
    if (!audioRef.current) return;
    
    if (isPlaying && currentPlayer === playerType) {
      audioRef.current.pause();
    } else {
      // If switching between players, update audio source
      if (currentPlayer !== playerType) {
        setCurrentPlayer(playerType);
        if (playerType === 'podcast' && podcastUrl) {
          audioRef.current.src = podcastUrl;
        } else if (playerType === 'report' && reportUrl) {
          audioRef.current.src = reportUrl;
        }
      }
      audioRef.current.play();
    }
    
    setIsPlaying(currentPlayer === playerType ? !isPlaying : true);
  };
  
  // Update audio source when URLs change
  useEffect(() => {
    console.log('Audio URLs or player changed:', { podcastUrl, reportUrl, currentPlayer });
    if (audioRef.current) {
      if (currentPlayer === 'podcast' && podcastUrl) {
        console.log('Setting audio source to podcast URL:', podcastUrl);
        audioRef.current.src = podcastUrl;
        audioRef.current.load(); // Explicitly load the audio
      } else if (currentPlayer === 'report' && reportUrl) {
        console.log('Setting audio source to report URL:', reportUrl);
        audioRef.current.src = reportUrl;
        audioRef.current.load(); // Explicitly load the audio
      }
    }
    setIsPlaying(false);
  }, [podcastUrl, reportUrl, currentPlayer]);
  
  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  // Update the page change handler to fetch page content
  const handlePageChange = async (docId: string, pageNum: number) => {
    setCurrentPage((prev) => ({ ...prev, [docId]: pageNum }));
    
    if (!pageContent[docId] || !pageContent[docId][pageNum]) {
      setPageContentLoading((prev) => ({ ...prev, [docId]: true }));
      
      try {
        // Determine if it's an RFK document based on ID
        const isRfkDocument = docId.toLowerCase().includes('rfk');
        let collection = isRfkDocument ? 'rfk' : 'jfk';
        
        // First attempt using the determined collection
        let response = await fetch(`${API_BASE_URL}/api/jfk/media?id=${docId}&type=text&filename=page-${pageNum}.txt&collection=${collection}`);
        
        // If first attempt fails and it wasn't identified as RFK, try with RFK collection
        if (!response.ok && collection === 'jfk') {
          console.log(`Failed to fetch page ${pageNum} for document ${docId} with JFK collection, trying RFK collection`);
          collection = 'rfk';
          response = await fetch(`${API_BASE_URL}/api/jfk/media?id=${docId}&type=text&filename=page-${pageNum}.txt&collection=${collection}`);
        }
        
        if (response.ok) {
          const text = await response.text();
          setPageContent((prev) => ({
            ...prev,
            [docId]: {
              ...prev[docId],
              [pageNum]: text,
            },
          }));
          
          // Update the cached collection for this document for future requests
          if (collection === 'rfk' && !isRfkDocument) {
            console.log(`Document ${docId} is actually an RFK document, updating cached info`);
            // Update any other functions that might need this information
          }
        } else {
          console.error(`Failed to fetch page ${pageNum} for document ${docId} from all attempted collections`);
        }
      } catch (error) {
        console.error(`Error fetching page ${pageNum} for document ${docId}:`, error);
      } finally {
        setPageContentLoading((prev) => ({ ...prev, [docId]: false }));
      }
    }
  };

  // Listen for custom events from the visualization
  useEffect(() => {
    const handleDocumentDockUpdate = (event: CustomEvent) => {
      if (event.detail && Array.isArray(event.detail.queue)) {
        // Update our queue directly from the event data
        console.log('DocumentDock: Received documentDockUpdate event');
        
        try {
          // Instead of clearing and replacing, we'll just add items that aren't already in the queue
          // First get the existing IDs in the queue to check against
          const existingIds = queue.map(item => item.id);
          
          // Then add each item that's not already in the queue
          const newQueue = event.detail.queue.map((item: any) => ({
            id: item.id,
            title: item.title || `Document ${item.id}`,
            url: item.url || `/jfk-files/${item.id}`,
            type: item.type || 'document'
          }));
          
          // Filter for items not already in the queue
          const itemsToAdd = newQueue.filter((item: DocumentItem) => !existingIds.includes(item.id));
          
          // Add them individually
          if (itemsToAdd.length > 0) {
            setTimeout(() => {
              itemsToAdd.forEach((item: DocumentItem) => {
                addToQueue(item);
              });
              console.log(`Added ${itemsToAdd.length} new items to the queue`);
            }, 0);
          }
        } catch (error) {
          console.error('Error updating queue from event:', error);
        }
      }
    };

    // Add event listener
    window.addEventListener('documentDockUpdate', handleDocumentDockUpdate as EventListener);
    
    // Expose a refresh function on the window object for direct calls
    window.updateDocumentDock = () => {
      try {
        const savedQueue = localStorage.getItem('documentDockQueue');
        if (savedQueue) {
          const parsedQueue = JSON.parse(savedQueue);
          if (Array.isArray(parsedQueue)) {
            // Get existing IDs to prevent duplicates
            const existingIds = queue.map(item => item.id);
            
            // Only add items that aren't already in the queue
            const itemsToAdd = parsedQueue.filter(item => !existingIds.includes(item.id))
              .map(item => ({
                id: item.id,
                title: item.title || `Document ${item.id}`,
                url: item.url || `/jfk-files/${item.id}`,
                type: item.type || 'document'
              }));
            
            // Add each new item
            itemsToAdd.forEach(item => {
              addToQueue(item);
            });
            
            console.log(`Added ${itemsToAdd.length} items from localStorage to queue`);
          }
        }
      } catch (error) {
        console.error('Error updating DocumentDock from localStorage:', error);
      }
    };
    
    // Clean up
    return () => {
      window.removeEventListener('documentDockUpdate', handleDocumentDockUpdate as EventListener);
      // @ts-ignore - Clean up window object
      window.updateDocumentDock = undefined;
    };
  }, [queue, addToQueue]);

  // Load saved playlists from localStorage
  useEffect(() => {
    try {
      const savedPlaylists = JSON.parse(localStorage.getItem('investigativeReportPlaylists') || '[]');
      setPlaylist(savedPlaylists);
    } catch (err) {
      console.error('Error loading saved playlists:', err);
    }
  }, []);

  // Helper functions for document display
  const handleTabChange = (itemId: string, tab: string) => {
    setActiveTab(prev => ({ ...prev, [itemId]: tab }));
  };
  
  const getPageImageUrl = async (docId: string, pageNum: number) => {
    // Determine if it's an RFK document based on ID
    const isRfkDocument = docId.toLowerCase().includes('rfk');
    let collection = isRfkDocument ? 'rfk' : 'jfk';
    
    // Create URL with the determined collection
    let imageUrl = `${API_BASE_URL}/api/jfk/media?id=${docId}&type=image&filename=page-${pageNum}.png&collection=${collection}`;
    
    // Check if the image exists with this collection
    try {
      const response = await fetch(imageUrl, { method: 'HEAD' });
      
      // If first attempt fails and it wasn't identified as RFK, try with RFK collection
      if (!response.ok && collection === 'jfk') {
        console.log(`Failed to fetch image for page ${pageNum} of document ${docId} with JFK collection, trying RFK collection`);
        collection = 'rfk';
        imageUrl = `${API_BASE_URL}/api/jfk/media?id=${docId}&type=image&filename=page-${pageNum}.png&collection=${collection}`;
        
        // We don't need to check if this works - if both fail, we'll just return the last URL
      }
    } catch (error) {
      console.error(`Error checking image availability for document ${docId}, page ${pageNum}:`, error);
    }
    
    // Return the URL with the appropriate collection parameter
    return imageUrl;
  };

  const toggleExpandedSection = (itemId: string, section: string) => {
    setExpandedSection(prev => ({
      ...prev,
      [itemId]: prev[itemId] === section ? null : section
    }));
  };
  
  // Extract the Investigations panel into a separate component
  // This allows it to be rendered alongside the main document dock
  const InvestigationsPanel = () => {
    if (!showPlaylist) return null;
    
    return (
      <div style={{
        position: 'fixed',
        right: 0,
        top: 0,
        bottom: 0,
        width: '300px',
        backgroundColor: '#f3f4f6',
        borderLeft: '1px solid #e5e7eb',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        zIndex: 9200 // Higher z-index to stay on top
      }}>
        <div style={{
          padding: '12px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Investigations</h4>
          <div style={{ display: 'flex', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: '#6b7280' }}>{playlist.length} Reports</span>
            <button
              onClick={() => setShowPlaylist(false)}
              style={{ 
                padding: '4px',
                borderRadius: '4px',
                cursor: 'pointer',
                backgroundColor: 'transparent',
                border: 'none'
              }}
              aria-label="Close investigations"
            >
              <X size={16} />
            </button>
          </div>
        </div>
        
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px'
        }}>
          {playlist.length === 0 ? (
            <div style={{ 
              padding: '16px', 
              textAlign: 'center', 
              color: '#6b7280',
              fontSize: '14px'
            }}>
              No investigative reports yet. Generate reports to add them to your investigations.
            </div>
          ) : (
            playlist.map((item, index) => (
              <div 
                key={item.id}
                style={{
                  padding: '8px',
                  backgroundColor: currentPlaylistItem === index ? '#e5e7eb' : 'white',
                  borderRadius: '4px',
                  marginBottom: '8px',
                  cursor: 'pointer'
                }}
                onClick={() => {
                  setCurrentPlaylistItem(index);
                  if (audioRef.current) {
                    audioRef.current.src = item.audioUrl;
                    audioRef.current.load();
                    audioRef.current.play();
                    setIsPlaying(true);
                    setCurrentPlayer('report');
                  }
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>
                  {item.title}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                  {item.showName}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '4px' }}>
                  {item.documentIds.map(docId => (
                    <a
                      key={docId}
                      href={`/jfk-files/${docId}`}
                      style={{
                        fontSize: '11px',
                        padding: '2px 6px',
                        backgroundColor: '#e5e7eb',
                        borderRadius: '12px',
                        color: '#4b5563',
                        textDecoration: 'none'
                      }}
                    >
                      {docId}
                    </a>
                  ))}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {item.tags.slice(0, 3).map((tag, i) => (
                    <span
                      key={i}
                      style={{
                        fontSize: '11px',
                        padding: '2px 6px',
                        backgroundColor: '#f3f4f6',
                        borderRadius: '12px',
                        color: '#6b7280'
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                  {item.tags.length > 3 && (
                    <span style={{ fontSize: '11px', color: '#6b7280' }}>
                      +{item.tags.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
        
        {/* Audio player at the bottom if playing from playlist */}
        {currentPlaylistItem !== null && playlist[currentPlaylistItem] && (
          <div style={{
            padding: '8px',
            borderTop: '1px solid #e5e7eb',
            backgroundColor: '#f3f4f6'
          }}>
            <div style={{ 
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '8px'
            }}>
              <button 
                onClick={() => {
                  if (audioRef.current) {
                    if (isPlaying) {
                      audioRef.current.pause();
                    } else {
                      audioRef.current.play();
                    }
                    setIsPlaying(!isPlaying);
                  }
                }}
                style={{ 
                  padding: '8px',
                  backgroundColor: '#dc2626',
                  color: 'white',
                  borderRadius: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              </button>
              
              <div style={{ fontSize: '12px', fontWeight: 500, flex: 1 }}>
                {playlist[currentPlaylistItem].title.length > 40 
                  ? playlist[currentPlaylistItem].title.substring(0, 40) + '...'
                  : playlist[currentPlaylistItem].title}
              </div>
            </div>
            
            <audio 
              ref={audioRef}
              src={playlist[currentPlaylistItem].audioUrl}
              onEnded={() => {
                if (currentPlaylistItem < playlist.length - 1) {
                  // Auto-play next track
                  setCurrentPlaylistItem(currentPlaylistItem + 1);
                  if (audioRef.current) {
                    audioRef.current.src = playlist[currentPlaylistItem + 1].audioUrl;
                    audioRef.current.load();
                    audioRef.current.play();
                  }
                } else {
                  setIsPlaying(false);
                }
              }}
              style={{ width: '100%' }}
              controls
            />
          </div>
        )}
      </div>
    );
  };

  // Even when queue is empty, show dock if we have a non-empty playlist
  if (queue.length === 0 && !showPlaylist && playlist.length > 0) {
    // Show a minimal dock to access investigations
    return (
      <>
        <div style={{ 
          position: 'fixed',
          bottom: 0,
          right: 0,
          padding: '8px',
          backgroundColor: '#f3f4f6',
          borderTop: '1px solid #e5e7eb',
          borderLeft: '1px solid #e5e7eb',
          borderTopLeftRadius: '8px',
          boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.1)',
          zIndex: 9100,
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <button 
            onClick={() => setShowPlaylist(true)}
            style={{ 
              padding: '6px 12px',
              backgroundColor: '#f3f4f6',
              color: '#374151',
              borderRadius: '4px',
              fontSize: '0.875rem',
              border: '1px solid #d1d5db',
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer'
            }}
          >
            <Radio size={14} style={{ marginRight: '4px' }} />
            <span>Investigations ({playlist.length})</span>
          </button>
        </div>
        <InvestigationsPanel />
      </>
    );
  }
  
  // If there are no items in the queue and no playlists, don't show anything
  if (queue.length === 0 && playlist.length === 0) {
    return null;
  }

  // Main audio player component that will be shown in header when player is active
  const AudioPlayerHeader = () => {
    // Show if we're playing OR if we have a current playlist item selected
    if ((!isPlaying && currentPlayer === null) && currentPlaylistItem === null) return null;
    
    const playerType = currentPlayer === 'podcast' ? 'podcast' : 'report';
    const audioUrl = playerType === 'podcast' ? podcastUrl : reportUrl;
    const bgColor = playerType === 'podcast' ? '#2563eb' : '#dc2626';
    const title = playerType === 'podcast' ? 'Generated Podcast' : 
                 (currentPlaylistItem !== null && playlist[currentPlaylistItem] ? 
                 (playlist[currentPlaylistItem].title.length > 30 ? 
                  playlist[currentPlaylistItem].title.substring(0, 30) + '...' : 
                  playlist[currentPlaylistItem].title) : 
                 'Investigative Report');
    
    // Get the current audio URL either from player state or playlist
    const currentAudioUrl = currentPlaylistItem !== null && playlist[currentPlaylistItem] 
      ? playlist[currentPlaylistItem].audioUrl 
      : audioUrl;
    
    if (!currentAudioUrl) return null;
    
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        maxWidth: '300px',
        overflow: 'hidden'
      }}>
        <button 
          onClick={() => {
            // If playing from playlist, handle directly
            if (currentPlaylistItem !== null) {
              if (audioRef.current) {
                if (isPlaying) {
                  audioRef.current.pause();
                } else {
                  audioRef.current.play().catch(e => console.error('Error playing audio:', e));
                }
                setIsPlaying(!isPlaying);
              }
            } else {
              togglePlayPause(playerType as 'podcast' | 'report');
            }
          }}
          style={{ 
            padding: '6px',
            backgroundColor: bgColor,
            color: 'white',
            borderRadius: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            cursor: 'pointer',
            flexShrink: 0
          }}
        >
          {isPlaying ? <Pause size={14} /> : <Play size={14} />}
        </button>
        
        <div style={{ 
          fontSize: '12px', 
          fontWeight: 500, 
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {title}
        </div>
        
        {(currentPlayer === 'report' || currentPlaylistItem !== null) && (
          <button 
            onClick={() => setShowPlaylist(true)}
            style={{ 
              padding: '4px',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              flexShrink: 0
            }}
            title="View all investigations"
          >
            <Radio size={14} />
          </button>
        )}
      </div>
    );
  };

  // Render both the main dock and the investigations panel
  return (
    <>
      {/* Main Document Dock */}
      <div style={{ 
        position: 'fixed',
        bottom: 0,
        left: 0,
        width: showPlaylist ? 'calc(100% - 300px)' : '100%', // Adjust width instead of using padding
        maxHeight: isCollapsed ? '50px' : (podcastStatus === 'ready' || reportStatus === 'ready' ? '450px' : '400px'),
        zIndex: 9000, // Lower z-index so sidebar appears on top
        backgroundColor: '#f9fafb',
        color: '#374151',
        borderTop: '1px solid #e5e7eb',
        boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.1)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Hidden audio element for playback */}
        <audio 
          ref={audioRef}
          src={currentPlayer === 'podcast' ? podcastUrl || '' : reportUrl || ''}
          onEnded={() => setIsPlaying(false)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          style={{ display: 'none' }}
        />
        
        {/* Header bar with audio player */}
        <div style={{ 
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          backgroundColor: '#f9fafb',
          borderBottom: isCollapsed ? 'none' : '1px solid #e5e7eb'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h3 style={{ 
              fontWeight: 600, 
              margin: 0, 
              fontSize: '14px',
              color: '#111827'
            }}>
              Document Queue ({queue.length})
            </h3>
            <AudioPlayerHeader />
          </div>
          
          <div style={{ display: 'flex', gap: '8px' }}>
            {playlist.length > 0 && (
              <button
                onClick={() => setShowPlaylist(!showPlaylist)}
                style={{ 
                  padding: '4px 8px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  backgroundColor: showPlaylist ? '#e5e7eb' : '#f3f4f6',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '12px'
                }}
                aria-label={showPlaylist ? "Hide investigations" : "Show investigations"}
              >
                <Radio size={14} />
                <span>{playlist.length}</span>
              </button>
            )}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              style={{ 
                padding: '4px',
                borderRadius: '4px',
                cursor: 'pointer',
                backgroundColor: 'transparent',
                border: 'none'
              }}
              aria-label={isCollapsed ? "Expand" : "Collapse"}
            >
              {isCollapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            <button
              onClick={clearQueue}
              style={{ 
                padding: '4px',
                borderRadius: '4px',
                cursor: 'pointer',
                backgroundColor: 'transparent',
                border: 'none'
              }}
              aria-label="Clear all"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Rest of the DocumentDock content */}
        {!isCollapsed && (
          <>
            {/* Document queue */}
            <div style={{ 
              padding: '8px',
              flex: 1,
              height: (podcastStatus === 'ready' || reportStatus === 'ready') ? 'calc(450px - 110px)' : 'calc(400px - 110px)',
              overflowX: 'auto',
              overflowY: 'auto',
              whiteSpace: 'nowrap',
              backgroundColor: '#f9fafb',
              display: 'block'
            }}>
              {queue.map((item, index) => {
                const docDetails = documentDetails[item.id];
                const currentTab = activeTab[item.id] || 'summary';
                const pageNum = currentPage[item.id] || 1;
                const pageCount = docDetails?.pageCount || 1;
                const expandedSec = expandedSection[item.id];
                const pageKey = `${item.id}-p${pageNum}`;
                const currentPageData = pageContent[pageKey];
                const isLoadingPageData = pageContentLoading[pageKey];
                
                return (
                  <div
                    key={item.id}
                    style={{
                      display: 'inline-block',
                      width: '240px',
                      height: '320px',
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                      marginRight: '12px',
                      marginBottom: '12px',
                      verticalAlign: 'top',
                      overflow: 'hidden'
                    }}
                  >
                    {/* Header with ID and controls */}
                    <div style={{ 
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px',
                      backgroundColor: '#f3f4f6',
                      borderBottom: '1px solid #e5e7eb'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <div style={{ cursor: 'move', marginRight: '8px' }}>
                          <GripVertical size={14} />
                        </div>
                        <a 
                          href={item.url}
                          style={{ 
                            fontWeight: 500,
                            color: '#2563eb',
                            textDecoration: 'none',
                            fontSize: '0.875rem',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: '130px',
                            display: 'block'
                          }}
                          title={item.title}
                        >
                          {item.id}
                        </a>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {pageCount > 1 && (
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '2px',
                            marginRight: '8px'
                          }}>
                            <button
                              onClick={() => handlePageChange(item.id, Math.max(1, pageNum - 1))}
                              disabled={pageNum <= 1}
                              style={{
                                border: 'none', 
                                background: 'none', 
                                cursor: pageNum <= 1 ? 'default' : 'pointer',
                                opacity: pageNum <= 1 ? 0.5 : 1,
                                padding: '2px'
                              }}
                            >
                              <ChevronLeft size={12} />
                            </button>
                            <span style={{ fontWeight: 500, fontSize: '0.7rem' }}>{pageNum}/{pageCount}</span>
                            <button
                              onClick={() => handlePageChange(item.id, Math.min(pageCount, pageNum + 1))}
                              disabled={pageNum >= pageCount}
                              style={{
                                border: 'none', 
                                background: 'none', 
                                cursor: pageNum >= pageCount ? 'default' : 'pointer',
                                opacity: pageNum >= pageCount ? 0.5 : 1,
                                padding: '2px'
                              }}
                            >
                              <ChevronRight size={12} />
                            </button>
                          </div>
                        )}
                        <button
                          onClick={() => removeFromQueue(item.id)}
                          style={{ 
                            padding: '4px',
                            borderRadius: '4px',
                            backgroundColor: 'transparent',
                            border: 'none',
                            cursor: 'pointer'
                          }}
                          aria-label="Remove item"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                    
                    {/* Tabs */}
                    <div style={{ 
                      display: 'flex',
                      borderBottom: '1px solid #e5e7eb',
                      padding: '0 8px'
                    }}>
                      <button 
                        onClick={() => handleTabChange(item.id, 'summary')}
                        style={{ 
                          padding: '4px 6px',
                          fontSize: '0.75rem',
                          borderBottom: currentTab === 'summary' ? '2px solid #3b82f6' : 'none',
                          color: currentTab === 'summary' ? '#2563eb' : '#6b7280',
                          backgroundColor: 'transparent',
                          border: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        Doc
                      </button>
                      <button 
                        onClick={() => handleTabChange(item.id, 'page')}
                        style={{ 
                          padding: '4px 6px',
                          fontSize: '0.75rem',
                          borderBottom: currentTab === 'page' ? '2px solid #3b82f6' : 'none',
                          color: currentTab === 'page' ? '#2563eb' : '#6b7280',
                          backgroundColor: 'transparent',
                          border: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        Page
                      </button>
                      <button 
                        onClick={() => handleTabChange(item.id, 'entities')}
                        style={{ 
                          padding: '4px 6px',
                          fontSize: '0.75rem',
                          borderBottom: currentTab === 'entities' ? '2px solid #3b82f6' : 'none',
                          color: currentTab === 'entities' ? '#2563eb' : '#6b7280',
                          backgroundColor: 'transparent',
                          border: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        Entities
                      </button>
                      <button 
                        onClick={() => handleTabChange(item.id, 'image')}
                        style={{ 
                          padding: '4px 6px',
                          fontSize: '0.75rem',
                          borderBottom: currentTab === 'image' ? '2px solid #3b82f6' : 'none',
                          color: currentTab === 'image' ? '#2563eb' : '#6b7280',
                          backgroundColor: 'transparent',
                          border: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        Image
                      </button>
                      <button 
                        onClick={() => handleTabChange(item.id, 'text')}
                        style={{ 
                          padding: '4px 6px',
                          fontSize: '0.75rem',
                          borderBottom: currentTab === 'text' ? '2px solid #3b82f6' : 'none',
                          color: currentTab === 'text' ? '#2563eb' : '#6b7280',
                          backgroundColor: 'transparent',
                          border: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        Text
                      </button>
                    </div>
                    
                    {/* Tab content */}
                    <div style={{ 
                      height: '260px',
                      overflow: 'auto',
                      padding: '8px',
                      backgroundColor: '#f9fafb'
                    }}>
                      {/* Document summary tab */}
                      {currentTab === 'summary' && (
                        <div style={{ 
                          fontSize: '0.75rem',
                          color: '#374151',
                          height: '100%',
                          overflowY: 'auto',
                          whiteSpace: 'normal',
                          wordBreak: 'break-word'
                        }}>
                          {docDetails?.summary || "Loading summary..."}
                        </div>
                      )}
                      
                      {/* Page summary tab - Now properly shows the page-specific summary */}
                      {currentTab === 'page' && (
                        <div style={{ 
                          fontSize: '0.75rem',
                          color: '#374151',
                          height: '100%',
                          overflowY: 'auto',
                          whiteSpace: 'normal',
                          wordBreak: 'break-word'
                        }}>
                          <div style={{ marginBottom: '4px', fontWeight: 500 }}>
                            Page {pageNum} Summary
                          </div>
                          {isLoadingPageData ? (
                            <div>Loading page data...</div>
                          ) : currentPageData?.summary ? (
                            <div>{currentPageData.summary}</div>
                          ) : docDetails && docDetails.pages && docDetails.pages[pageNum - 1]?.summary ? (
                            <div>{docDetails.pages[pageNum - 1].summary}</div>
                          ) : (
                            <div>No page summary available.</div>
                          )}
                        </div>
                      )}
                      
                      {/* Entities tab - Now showing complete lists with proper scrolling */}
                      {currentTab === 'entities' && (
                        <div style={{ 
                          fontSize: '0.75rem',
                          color: '#374151',
                          height: '100%',
                          overflowY: 'auto'
                        }}>
                          {docDetails && (
                            <>
                              <div style={{ marginBottom: '8px' }}>
                                <button 
                                  onClick={() => toggleExpandedSection(item.id, 'people')}
                                  style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '4px',
                                    fontSize: '0.75rem',
                                    fontWeight: 500,
                                    padding: '2px 4px',
                                    backgroundColor: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: '#4b5563',
                                    width: '100%',
                                    justifyContent: 'space-between'
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <User size={12} />
                                    <span>People ({docDetails.allNames?.length || 0})</span>
                                  </div>
                                  {expandedSec === 'people' ? 
                                    <ChevronUp size={10} /> : 
                                    <ChevronDown size={10} />}
                                </button>
                                {expandedSec === 'people' && docDetails.allNames && (
                                  <div style={{ 
                                    paddingLeft: '16px', 
                                    fontSize: '0.7rem', 
                                    marginTop: '2px',
                                    maxHeight: '120px',
                                    overflowY: 'auto'
                                  }}>
                                    {docDetails.allNames.map((name: string, idx: number) => (
                                      <div key={`name-${idx}`} style={{ 
                                        marginBottom: '2px',
                                        whiteSpace: 'normal',
                                        wordBreak: 'break-word'
                                      }}>
                                        {name}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div style={{ marginBottom: '8px' }}>
                                <button 
                                  onClick={() => toggleExpandedSection(item.id, 'places')}
                                  style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '4px',
                                    fontSize: '0.75rem',
                                    fontWeight: 500,
                                    padding: '2px 4px',
                                    backgroundColor: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: '#4b5563',
                                    width: '100%',
                                    justifyContent: 'space-between'
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <MapPin size={12} />
                                    <span>Places ({docDetails.allPlaces?.length || 0})</span>
                                  </div>
                                  {expandedSec === 'places' ? 
                                    <ChevronUp size={10} /> : 
                                    <ChevronDown size={10} />}
                                </button>
                                {expandedSec === 'places' && docDetails.allPlaces && (
                                  <div style={{ 
                                    paddingLeft: '16px', 
                                    fontSize: '0.7rem', 
                                    marginTop: '2px',
                                    maxHeight: '120px',
                                    overflowY: 'auto'
                                  }}>
                                    {docDetails.allPlaces.map((place: string, idx: number) => (
                                      <div key={`place-${idx}`} style={{ 
                                        marginBottom: '2px',
                                        whiteSpace: 'normal',
                                        wordBreak: 'break-word'
                                      }}>
                                        {place}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div>
                                <button 
                                  onClick={() => toggleExpandedSection(item.id, 'objects')}
                                  style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '4px',
                                    fontSize: '0.75rem',
                                    fontWeight: 500,
                                    padding: '2px 4px',
                                    backgroundColor: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: '#4b5563',
                                    width: '100%',
                                    justifyContent: 'space-between'
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Package size={12} />
                                    <span>Objects ({docDetails.allObjects?.length || 0})</span>
                                  </div>
                                  {expandedSec === 'objects' ? 
                                    <ChevronUp size={10} /> : 
                                    <ChevronDown size={10} />}
                                </button>
                                {expandedSec === 'objects' && docDetails.allObjects && (
                                  <div style={{ 
                                    paddingLeft: '16px', 
                                    fontSize: '0.7rem', 
                                    marginTop: '2px',
                                    maxHeight: '120px',
                                    overflowY: 'auto'
                                  }}>
                                    {docDetails.allObjects.map((object: string, idx: number) => (
                                      <div key={`object-${idx}`} style={{ 
                                        marginBottom: '2px',
                                        whiteSpace: 'normal',
                                        wordBreak: 'break-word'
                                      }}>
                                        {object}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                      
                      {/* Image tab */}
                      {currentTab === 'image' && (
                        <div style={{ 
                          display: 'flex',
                          flexDirection: 'column',
                          height: '100%',
                          justifyContent: 'center',
                          alignItems: 'center'
                        }}>
                          {docDetails ? (
                            <img 
                              className="max-w-full h-auto"
                              alt={`Page ${pageNum} of document ${item.id}`}
                              src={pageImageUrls[`${item.id}-${pageNum}`] || '/images/loading.gif'}
                            />
                          ) : (
                            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Loading image...</div>
                          )}
                        </div>
                      )}
                      
                      {/* Text tab */}
                      {currentTab === 'text' && (
                        <div style={{ 
                          fontSize: '0.75rem',
                          color: '#374151',
                          height: '100%',
                          overflowY: 'auto',
                          fontFamily: 'monospace',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word'
                        }}>
                          {docDetails?.fullText ? 
                            docDetails.fullText.substring(0, 500) + "..." :
                            "Text not available."
                          }
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Controls area at bottom */}
            <div style={{
              width: '100%',
              backgroundColor: '#f3f4f6',
              borderTop: '1px solid #e5e7eb',
              padding: '8px',
              display: 'flex',
              justifyContent: 'center',
              gap: '16px',
              position: 'absolute',
              bottom: 0,
              left: 0
            }}>
              {(podcastStatus as string) === 'generating' ? (
                <div style={{ 
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%'
                }}>
                  <Loader size={16} className="animate-spin" />
                  <div style={{ flex: 1, fontSize: '0.875rem' }}>
                    {podcastProgress || 'Generating podcast...'}
                  </div>
                </div>
              ) : (reportStatus as string) === 'generating' ? (
                <div style={{ 
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%'
                }}>
                  <Loader size={16} className="animate-spin" />
                  <div style={{ flex: 1, fontSize: '0.875rem' }}>
                    {reportProgress || 'Generating investigative report...'}
                  </div>
                </div>
              ) : (podcastStatus as string) === 'ready' && podcastUrl && currentPlayer === 'podcast' ? (
                <div style={{ 
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%'
                }}>
                  <button 
                    onClick={() => togglePlayPause('podcast')}
                    style={{ 
                      padding: '8px',
                      backgroundColor: '#2563eb',
                      color: 'white',
                      borderRadius: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                  </button>
                  
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>
                      Generated Podcast
                    </div>
                    <audio 
                      src={podcastUrl}
                      onEnded={() => setIsPlaying(false)}
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      style={{ width: '100%', marginTop: '4px' }}
                      controls
                    />
                  </div>
                </div>
              ) : (reportStatus as string) === 'ready' && reportUrl && currentPlayer === 'report' && !showPlaylist ? (
                <div style={{ 
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%'
                }}>
                  <button 
                    onClick={() => togglePlayPause('report')}
                    style={{ 
                      padding: '8px',
                      backgroundColor: '#dc2626',
                      color: 'white',
                      borderRadius: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                  </button>
                  
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, fontSize: '0.875rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>Investigative Report</span>
                      <button 
                        onClick={() => setShowPlaylist(true)}
                        style={{ 
                          padding: '2px 6px',
                          fontSize: '12px',
                          backgroundColor: '#f3f4f6',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Radio size={12} />
                        <span>Investigations</span>
                      </button>
                    </div>
                    <audio 
                      src={reportUrl}
                      onEnded={() => setIsPlaying(false)}
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      style={{ width: '100%', marginTop: '4px' }}
                      controls
                    />
                  </div>
                </div>
              ) : (
                /* Default: Action buttons - Simple fixed layout */
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button 
                      onClick={generatePodcast}
                      disabled={(podcastStatus as string) === 'generating' || (reportStatus as string) === 'generating' || queue.length === 0}
                      style={{ 
                        padding: '8px 16px',
                        backgroundColor: '#2563eb',
                        color: 'white',
                        borderRadius: '4px',
                        fontSize: '0.875rem',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        cursor: 'pointer'
                      }}
                    >
                      <Mic size={14} style={{ marginRight: '4px' }} />
                      <span>Podcast</span>
                    </button>
                    <button 
                      onClick={generateInvestigativeReport}
                      disabled={(reportStatus as string) === 'generating' || (podcastStatus as string) === 'generating' || queue.length === 0}
                      style={{ 
                        padding: '8px 16px',
                        backgroundColor: '#dc2626',
                        color: 'white',
                        borderRadius: '4px',
                        fontSize: '0.875rem',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        cursor: 'pointer'
                      }}
                    >
                      <FileSearch size={14} style={{ marginRight: '4px' }} />
                      <span>Investigative Report</span>
                    </button>
                    <button style={{ 
                      padding: '8px 16px',
                      backgroundColor: '#16a34a',
                      color: 'white',
                      borderRadius: '4px',
                      fontSize: '0.875rem',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      cursor: 'pointer'
                    }}>
                      <MessageSquare size={14} style={{ marginRight: '4px' }} />
                      <span>Dialog</span>
                    </button>
                    {playlist.length > 0 && (
                      <button 
                        onClick={() => setShowPlaylist(true)}
                        style={{ 
                          padding: '8px 16px',
                          backgroundColor: '#f3f4f6',
                          color: '#374151',
                          borderRadius: '4px',
                          fontSize: '0.875rem',
                          border: '1px solid #d1d5db',
                          display: 'flex',
                          alignItems: 'center',
                          cursor: 'pointer'
                        }}
                      >
                        <Radio size={14} style={{ marginRight: '4px' }} />
                        <span>Investigations ({playlist.length})</span>
                      </button>
                    )}
                    {tokenCount > 0 && (
                      <div style={{
                        padding: '4px 8px',
                        backgroundColor: '#f3f4f6',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        color: '#4b5563',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <span>Tokens:</span>
                        <span style={{ fontWeight: 500 }}>{tokenCount.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Render Investigations panel with higher z-index */}
      <InvestigationsPanel />
    </>
  );
}