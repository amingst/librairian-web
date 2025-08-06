import { useState, useEffect, useRef, useCallback } from 'react';
import { JFKDocument, ProcessingUpdate, DocumentStatus } from '../../utils/jfk/types';
import { checkDocumentStatus, checkIfDocumentNeedsRepair } from '../../utils/jfk/statusUtils';

interface UseJfkProcessingReturn {
  processingUpdates: Record<string, ProcessingUpdate>;
  isProcessingAll: boolean;
  processedCount: number;
  totalToProcess: number;
  processingAllStatus: string;
  activeProcessingCount: number;
  concurrencyLimit: number;
  setConcurrencyLimit: (limit: number) => void;
  limitToImageAnalysis: boolean;
  setLimitToImageAnalysis: (limit: boolean) => void;
  processDocument: (documentId: string) => Promise<void>;
  processAllDocuments: () => Promise<void>;
  repairDocument: (documentId: string) => Promise<void>;
  repairAllBrokenDocuments: () => Promise<void>;
  stopProcessing: () => void;
}

export function useJfkProcessing(
  documents: JFKDocument[],
  documentIdMap: Record<string, string>,
  setDocuments: (updater: JFKDocument[] | ((prev: JFKDocument[]) => JFKDocument[])) => void,
  setDocumentIdMap: (updater: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void
): UseJfkProcessingReturn {
  const [processingUpdates, setProcessingUpdates] = useState<Record<string, ProcessingUpdate>>({});
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [totalToProcess, setTotalToProcess] = useState(0);
  const [processingAllStatus, setProcessingAllStatus] = useState<string>('');
  const [activeProcessingCount, setActiveProcessingCount] = useState<number>(0);
  const [concurrencyLimit, setConcurrencyLimit] = useState(5);
  const [limitToImageAnalysis, setLimitToImageAnalysis] = useState(true);
  const [repairingDocuments, setRepairingDocuments] = useState(false);
  
  // Add a ref to track active XHR requests and connections
  const activeXhrRequestsRef = useRef<XMLHttpRequest[]>([]);
  const intervalsRef = useRef<NodeJS.Timeout[]>([]);
  const activeConnectionsRef = useRef<Map<string, EventSource>>(new Map());

  // Add a new ref to allow stopping the processing
  const shouldStopProcessingRef = useRef<boolean>(false);

  // Add cleanup effect to abort any active XHR requests and clear intervals on unmount
  useEffect(() => {
    return () => {
      // Abort all active XHR requests
      activeXhrRequestsRef.current.forEach(xhr => {
        if (xhr && xhr.readyState !== 4) { // 4 = DONE
          xhr.abort();
        }
      });
      
      // Clear all intervals
      intervalsRef.current.forEach(intervalId => {
        clearInterval(intervalId);
      });
      
      // Close all active event source connections
      activeConnectionsRef.current.forEach((connection, docId) => {
        console.log(`Closing connection for ${docId} on unmount`);
        connection.close();
      });
      
      // Empty the refs
      activeXhrRequestsRef.current = [];
      intervalsRef.current = [];
      activeConnectionsRef.current.clear();
    };
  }, []);

  // Process a single document
  const processDocument = useCallback(async (documentId: string): Promise<void> => {
    return new Promise<void>(async (resolve, reject) => {
      // Prevent multiple processing of the same document
      if (processingUpdates[documentId]) {
        console.log('Already processing document:', documentId);
        resolve(); // Resolve immediately if already processing
        return;
      }
      
      // Additional check to prevent duplicate processing
      const existingConnection = activeConnectionsRef.current.get(documentId);
      if (existingConnection) {
        console.log(`Found existing EventSource connection for ${documentId}, not starting another process`);
        resolve();
        return;
      }
      
      try {
        // No need to modify the ID - real JFK document IDs don't have leading slashes
        // They're already in the format "104-10004-10143"
        const actualId = documentId;
        
        // Determine document type (JFK vs RFK) to use correct URL format
        const isRfkDocument = documentId.toLowerCase().includes('rfk') || 
                             documents.some(doc => {
                              const docWithType = doc as JFKDocument & { documentType?: string, documentGroup?: string };
                              return doc.id === documentId && 
                                (docWithType.documentGroup === 'rfk' || docWithType.documentType === 'rfk');
                             });

        // Format URL based on document type
        let documentUrl: string;
        
        if (isRfkDocument) {
          // RFK URL pattern
          documentUrl = `https://www.archives.gov/files/research/rfk/releases/2025/0418/${actualId}.pdf`;
          console.log('Processing RFK document with ID:', actualId, 'URL:', documentUrl);
        } else {
          // JFK URL pattern
          documentUrl = `https://www.archives.gov/files/research/jfk/releases/2025/0318/${actualId}.pdf`;
          console.log('Processing JFK document with ID:', actualId, 'URL:', documentUrl);
        }
        
        // Update processing status
        setProcessingUpdates(prev => ({
          ...prev,
          [documentId]: { status: 'starting', message: 'Checking document status...', type: 'processing' }
        }));
        
        // Check current document status to determine needed steps
        const documentStatus = await checkDocumentStatus(actualId, isRfkDocument ? 'rfk' : 'jfk');
        console.log('Document status:', documentStatus);
        
        // Build processing parameters based on status check
        const processingParams: any = {
          documentId: actualId,
          documentUrl,
          archiveId: actualId,
          steps: [],
          // Add document type to processing params
          documentType: isRfkDocument ? 'rfk' : 'jfk',
          documentGroup: isRfkDocument ? 'rfk' : 'jfk'
        };
        
        // Determine which steps need to be performed
        if (!documentStatus.hasFolder) processingParams.steps.push('createFolder');
        if (!documentStatus.hasPdf) processingParams.steps.push('downloadPdf');
        if (!documentStatus.hasPngs) processingParams.steps.push('createPngs');
        if (!documentStatus.hasAnalysis) processingParams.steps.push('analyzeImages');
        
        // If we're limiting processing, don't include these steps
        if (!limitToImageAnalysis) {
          if (!documentStatus.hasArweave) processingParams.steps.push('publishArweave');
          if (!documentStatus.hasLatestSummary) processingParams.steps.push('updateSummary');
          if (!documentStatus.isIndexed) processingParams.steps.push('indexDatabase');
        }
        
        // If document has all necessary steps completed based on limitToImageAnalysis setting
        if (processingParams.steps.length === 0) {
          setProcessingUpdates(prev => ({
            ...prev,
            [documentId]: { 
              status: 'completed', 
              message: 'Document already fully processed', 
              type: 'complete' 
            }
          }));
          
          // Update documents list
          setDocuments(prev => {
            return prev.map(doc => 
              doc.id === documentId 
                ? { 
                    ...doc, 
                    status: 'completed',
                    stages: doc.stages || ['complete'],
                    lastUpdated: new Date().toISOString()
                  }
                : doc
            );
          });
          
          resolve();
          return;
        }
        
        // Update UI with steps that will be performed
        setProcessingUpdates(prev => ({
          ...prev,
          [documentId]: { 
            status: 'starting', 
            message: `Starting processing with steps: ${processingParams.steps.join(', ')}`, 
            type: 'processing' 
          }
        }));
        
        console.log('Starting processing with params:', processingParams);
        
        // Use the EventSource API for SSE instead of XHR for better handling
        try {
          // First make the POST request to initialize processing
          const initResponse = await fetch('/api/jfk/process', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'X-Archive-ID': actualId
            },
            body: JSON.stringify({
              ...processingParams,
              documentId: `/${actualId}` // Add leading slash for consistent ID format
            })
          });
          
          if (!initResponse.ok) {
            const errorData = await initResponse.json();
            throw new Error(`Failed to start processing: ${errorData.error || initResponse.statusText}`);
          }
          
          const responseData = await initResponse.json();
          console.log('Process initialization response:', responseData);
          
          // Update UI with initialization status
          setProcessingUpdates(prev => ({
            ...prev,
            [documentId]: { 
              status: responseData.status || 'processing', 
              message: responseData.message || 'Processing started',
              steps: responseData.steps || [],
              type: 'processing'
            }
          }));
          
          // If the status is already completed, we're done
          if (responseData.status === 'completed' || responseData.status === 'ready') {
            // Update the document with the final status
            const isAnalysisComplete = responseData.analysisComplete === true;
            
            setDocuments(prev => {
              return prev.map(doc => 
                doc.id === documentId 
                  ? { 
                      ...doc, 
                      status: isAnalysisComplete ? 'ready' : 'waitingForAnalysis',
                      processingStatus: null, // No active processing
                      analysisComplete: isAnalysisComplete,
                      stages: doc.stages?.includes('complete') 
                        ? doc.stages 
                        : [...(doc.stages || []), 'complete'],
                      lastUpdated: new Date().toISOString()
                    }
                  : doc
              );
            });
            
            resolve();
            return;
          }
          
          // Now connect to the processing endpoint through our own API proxy to avoid mixed content errors
          const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.oip.onl';
          const sseUrl = `${apiBaseUrl}/api/jfk/process/status?documentId=${actualId}&collection=${isRfkDocument ? 'rfk' : 'jfk'}`;
          console.log('Connecting to SSE endpoint:', sseUrl);
          
          const evtSource = new EventSource(sseUrl);
          // Track the connection
          activeConnectionsRef.current.set(documentId, evtSource);
          let hasCompleted = false;
        
          // Set a timeout to prevent hanging forever
          const timeoutId = setTimeout(() => {
            try {
              console.log(`Processing timeout reached for ${documentId}, closing connection`);
              evtSource.close();
              // Remove from tracking
              activeConnectionsRef.current.delete(documentId);
              
              if (!hasCompleted) {
                reject(new Error('Processing timed out after 15 minutes'));
              }
            } catch (err) {
              console.error('Error in timeout handler:', err);
              reject(new Error('Error in timeout handling'));
            }
          }, 900000); // 15 minutes timeout
          
          // Debug all incoming messages regardless of event type
          evtSource.onmessage = (e) => {
            console.log(`[${documentId}] SSE generic message:`, e.type, e.data);
            try {
              const data = JSON.parse(e.data);
              
              // If we receive any message indicating completion
              if (data.status === 'complete' || 
                  data.status === 'success' || 
                  data.documentDidTx || 
                  data.txid || 
                  (data.message && (
                    data.message.includes('published successfully') ||
                    data.message.includes('Process complete') ||
                    data.message.includes('Document published') ||
                    data.message.includes('already exists')
                  ))) {
                console.log(`[${documentId}] Detected completion from generic message:`, data);
                
                if (!hasCompleted) {
                  handleCompletion(data);
                }
              }
            } catch (err) {
              console.log(`[${documentId}] Error processing generic message:`, err);
            }
          };
          
          // Handler for all events including "message", "publishing", etc.
          const handleAnyEvent = (e: MessageEvent<string>) => {
            console.log(`[${documentId}] SSE event received:`, e.type, e.data);
            try {
              const data = JSON.parse(e.data);
              
              // Check for any indication of completion
              if (data.status === 'complete' || 
                  data.status === 'success' || 
                  data.documentDidTx || 
                  data.txid || 
                  (data.message && (
                    data.message.includes('published successfully') ||
                    data.message.includes('Process complete') ||
                    data.message.includes('Document published') ||
                    data.message.includes('already exists')
                  ))) {
                console.log(`[${documentId}] Detected completion from ${e.type} event:`, data);
                
                if (!hasCompleted) {
                  handleCompletion(data);
                }
              }
            } catch (err) {
              console.log(`[${documentId}] Error processing ${e.type} event:`, err);
            }
          };
          
          // Listen for all possible event types
          ['message', 'complete', 'publishing', 'heartbeat', 'connected'].forEach(eventType => {
            evtSource.addEventListener(eventType, handleAnyEvent);
          });
          
          // Helper function to handle completion
          const handleCompletion = (data: any) => {
            hasCompleted = true;
            clearTimeout(timeoutId);
            clearTimeout(publishingTimeoutId);
            
            // Update the processing status
            setProcessingUpdates(prev => ({
              ...prev,
              [documentId]: {
                status: 'completed',
                message: data.message || 'Document published successfully',
                type: 'complete'
              }
            }));
            
            // Update document in the documents list
            setDocuments(prev => 
              prev.map(doc => 
                doc.id === documentId 
                  ? { 
                      ...doc, 
                      status: data.dbId || data.documentDidTx ? 'ready' : 'waitingForAnalysis',
                      processingStatus: null, // No active processing
                      analysisComplete: !!(data.dbId || data.documentDidTx),
                      stages: [...(doc.stages || []), 'complete'],
                      lastUpdated: new Date().toISOString(),
                      dbId: data.dbId || doc.dbId
                    }
                  : doc
              )
            );
            
            // Update document ID mapping if we have a new database ID
            if (data.dbId || data.documentDidTx) {
              setDocumentIdMap(prev => ({
                ...prev,
                [documentId]: data.dbId || data.documentDidTx
              }));
            }
            
            // Close the connection
            evtSource.close();
            activeConnectionsRef.current.delete(documentId);
            
            resolve();
          };
          
          // Handle processing updates
          evtSource.addEventListener('processing', (e) => {
            try {
              const update = JSON.parse(e.data);
              console.log(`[${documentId}] Processing update:`, update);
              
              // Auto-complete if stuck in publishing_from_disk for more than 15 seconds
              if (update.status === 'publishing_from_disk') {
                console.log(`[${documentId}] Document in publishing_from_disk state, setting short timeout`);
                
                // Set a short timeout to request completion status
                setTimeout(async () => {
                  if (!hasCompleted) {
                    console.log(`[${documentId}] Checking document database status after publishing_from_disk`);
                    try {
                      // Make direct API call to check document status
                      const response = await fetch(`/api/jfk/document-status?documentId=${actualId}`);
                      if (response.ok) {
                        const statusData = await response.json();
                        console.log(`[${documentId}] Document status check result:`, statusData);
                        
                        if (statusData.status === 'success' && statusData.document) {
                          console.log(`[${documentId}] Document found in database, completing`);
                          handleCompletion({
                            status: 'completed',
                            message: 'Document published to database',
                            documentDidTx: statusData.document.oip?.didTx
                          });
                        }
                      }
                    } catch (err) {
                      console.error(`[${documentId}] Error checking document status:`, err);
                    }
                  }
                }, 15000); // Check after 15 seconds
              }
              
              // If we get a processing update that indicates document is published to Arweave
              if ((update.status === 'publishing_from_disk' && update.arweaveTx) || 
                  (update.status === 'complete') || 
                  (update.status === 'publishing' && update.status === 'complete')) {
                console.log(`[${documentId}] Document appears to be published, completing:`, update);
                
                // Handle as completion
                handleCompletion(update);
                return;
              }
              
              // Update the processing status
              setProcessingUpdates(prev => ({
                ...prev,
                [documentId]: {
                  ...prev[documentId],
                  ...update,
                  type: 'processing'
                }
              }));
              
              // Update document in the documents list to show processing status
              setDocuments(prev => 
                prev.map(doc => 
                  doc.id === documentId 
                    ? { 
                        ...doc, 
                        status: 'processing',
                        processingStatus: 'processing',
                        processingProgress: update.progress || 0
                      }
                    : doc
                )
              );
            } catch (error) {
              console.error(`[${documentId}] Error processing update:`, error);
            }
          });
          
          // Handle publishing events
          evtSource.addEventListener('publishing', (e) => {
            try {
              const data = JSON.parse(e.data);
              console.log(`[${documentId}] Publishing update:`, data);
              
              // If publishing is complete, handle as completion
              if (data.status === 'complete') {
                handleCompletion(data);
                return;
              }
              
              // Update processing status
              setProcessingUpdates(prev => ({
                ...prev,
                [documentId]: {
                  ...prev[documentId],
                  status: `publishing_${data.status}`,
                  message: data.message || 'Publishing document',
                  type: 'processing',
                  txid: data.documentTxid || data.txid
                }
              }));
            } catch (error) {
              console.error(`[${documentId}] Error processing publishing event:`, error);
            }
          });
          
          // Handle completion event
          evtSource.addEventListener('complete', (e) => {
            try {
              console.log(`[${documentId}] Received complete event:`, e.data);
              const data = JSON.parse(e.data);
              console.log(`[${documentId}] Processing complete:`, data);
              
              handleCompletion(data);
            } catch (error) {
              console.error(`[${documentId}] Error processing completion event:`, error);
              reject(error);
            }
          });
          
          // Add a fallback timeout to complete if stuck in publishing_from_disk
          const publishingTimeoutId = setTimeout(() => {
            if (!hasCompleted) {
              console.log(`[${documentId}] Document processing timeout reached, forcing completion`);
              
              // Force completion with our known publishing_from_disk state
              const lastUpdate = processingUpdates[documentId];
              handleCompletion({
                status: 'completed',
                message: 'Document processing complete (timeout forced)',
                type: 'complete'
              });
            }
          }, 120000); // 2 minute timeout for any state
          
          // Handle error event
          evtSource.addEventListener('error', (e) => {
            console.error(`[${documentId}] SSE error:`, e);
            clearTimeout(timeoutId);
            clearTimeout(publishingTimeoutId);
            
            // If error occurs after being in publishing_from_disk state, assume success
            const lastUpdate = processingUpdates[documentId];
            if (lastUpdate && lastUpdate.status === 'publishing_from_disk') {
              console.log(`[${documentId}] Error occurred after publishing_from_disk, assuming success`);
              
              handleCompletion({
                status: 'completed',
                message: 'Document likely published successfully (connection error after publishing started)',
                type: 'complete'
              });
              return;
            }
            
            // Close the connection
            evtSource.close();
            activeConnectionsRef.current.delete(documentId);
            
            // Update the processing status
            setProcessingUpdates(prev => ({
              ...prev,
              [documentId]: {
                status: 'error',
                message: 'Error during processing',
                type: 'error'
              }
            }));
            
            // Update document in the documents list to show error
            setDocuments(prev => 
              prev.map(doc => 
                doc.id === documentId 
                  ? { 
                      ...doc, 
                      status: doc.processingStatus === 'processing' ? 'error' : doc.status,
                      processingStatus: 'failed',
                      lastUpdated: new Date().toISOString()
                    }
                  : doc
              )
            );
            
            reject(new Error('Error during processing'));
          });
          
        } catch (error) {
          console.error('Error setting up EventSource:', error);
          
          // Update UI with error status
          setProcessingUpdates(prev => ({
            ...prev,
            [documentId]: { 
              status: 'error', 
              message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
              type: 'error'
            }
          }));
          
          reject(error);
        }
        
      } catch (error: unknown) {
        console.error('Error processing document:', error);
        
        const errorMessage = error instanceof Error 
          ? error.message 
          : (typeof error === 'string' ? error : 'Unknown error');
        
        // Update UI with error status
        setProcessingUpdates(prev => ({
          ...prev,
          [documentId]: { 
            status: 'error', 
            message: errorMessage, 
            type: 'error' 
          }
        }));
        
        // Update document status to show error
        setDocuments(prev => 
          prev.map(doc => 
            doc.id === documentId 
              ? { 
                  ...doc, 
                  processingStatus: 'failed',
                  lastUpdated: new Date().toISOString() 
                }
              : doc
          )
        );
        
        reject(new Error(errorMessage));
      }
    });
  }, [
    documentIdMap, 
    limitToImageAnalysis, 
    processingUpdates, 
    setDocuments
  ]);

  // Process all documents in batches
  const processAllDocuments = useCallback(async () => {
    if (isProcessingAll) return;
    
    // Track queue interval for proper cleanup
    let queueInterval: NodeJS.Timeout | null = null;
    
    try {
      setIsProcessingAll(true);
      setProcessedCount(0);
      setProcessingAllStatus("Starting batch processing...");
      setActiveProcessingCount(0);
      
      // Keep track of pagination for continuous processing
      let processedDocIds = new Set<string>(); // Track all processed docs across batches
      let currentScanPage = 1;
      let totalDocsProcessedSoFar = 0;
      
      // Add a map to track active connections for each document
      const activeConnections = new Map<string, EventSource>();
      
      // Main processing loop - continue until no more documents to process
      while (true) {
        // Improved approach: Get document IDs in batches, process, then get more
        let currentBatchDocIds: string[] = [];
        let hasMorePages = true;
        let scanStartPage = currentScanPage;
        
        // First phase: scan and collect pending document IDs for this batch
        setProcessingAllStatus(`Scanning for pending documents starting from page ${scanStartPage}...`);
        
        // Scan pages until we have enough documents to process or no more pages
        while (hasMorePages && currentBatchDocIds.length < 500) {
          try {
            const response = await fetch(`/api/jfk/document-status?page=${currentScanPage}&size=50`);
            if (!response.ok) throw new Error(`Failed to fetch page ${currentScanPage}`);
              
            const data = await response.json();
            const pageDocuments = data.documents || [];
            
            // Filter for documents that need processing
            const pendingIds = await Promise.all(
              pageDocuments.map(async (doc: JFKDocument) => {
                // Skip documents we've already processed in previous batches
                if (processedDocIds.has(doc.id)) return null;
                
                // Skip already processing documents
                if (doc?.status === 'processing') return null;
                
                // Check for documents that need repair first
                if ((doc.status === 'ready' && doc.pageCount === 0) || 
                    (doc.status && doc.status.includes('published to database')) || 
                    (doc.processingStatus && doc.processingStatus.includes('published to database'))) {
                  
                  try {
                    console.log(`Found document ${doc.id} that might need repair: status=${doc.status}, pageCount=${doc.pageCount}`);
                    
                    // Update processing status for this document
                    setProcessingUpdates(prev => ({
                      ...prev,
                      [doc.id]: { 
                        status: 'checking', 
                        message: 'Checking if document needs repair...', 
                        type: 'processing' 
                      }
                    }));
                    
                    // Get document info to verify it needs repair
                    const needsRepair = await checkIfDocumentNeedsRepair(doc.id);
                    
                    if (needsRepair) {
                      return `repair:${doc.id}`;
                    }
                  } catch (error) {
                    console.error(`Error checking if document ${doc.id} needs repair:`, error);
                  }
                }
                
                // Quick check if document is pending by status
                if (doc.status === 'pending' || !doc.stages || doc.stages.length < 5) {
                  try {
                    const docStatus = await checkDocumentStatus(doc.id, doc.id.toLowerCase().includes('rfk') ? 'rfk' : 'jfk');
                    
                    // Determine needed steps
                    const neededSteps = [];
                    if (!docStatus.hasFolder) neededSteps.push('createFolder');
                    if (!docStatus.hasPdf) neededSteps.push('downloadPdf');
                    if (!docStatus.hasPngs) neededSteps.push('createPngs');
                    if (!docStatus.hasAnalysis) neededSteps.push('analyzeImages');
                    
                    const remainingSteps = [];
                    if (!docStatus.hasArweave) remainingSteps.push('publishArweave');
                    if (!docStatus.hasLatestSummary) remainingSteps.push('updateSummary');
                    if (!docStatus.isIndexed) remainingSteps.push('indexDatabase');
                    
                    if (!limitToImageAnalysis) {
                      neededSteps.push(...remainingSteps);
                    } else if (docStatus.hasAnalysis && neededSteps.length === 0) {
                      return null;
                    }
                    
                    return neededSteps.length > 0 ? doc.id : null;
                  } catch (error) {
                    console.error(`Error checking status for ${doc.id}:`, error);
                    return doc.id;
                  }
                }
                
                return null;
              })
            );
            
            // Filter out null values and add to pending IDs
            const validPendingIds = pendingIds.filter(Boolean) as string[];
            currentBatchDocIds = [...currentBatchDocIds, ...validPendingIds];
            
            // Update scan status
            setProcessingAllStatus(`Scanning page ${currentScanPage}/${data.totalPages}... Found ${currentBatchDocIds.length} documents that need processing`);
            
            // Check if there are more pages
            currentScanPage++;
            hasMorePages = currentScanPage <= (data.totalPages || Math.ceil(data.totalCount / 50));
            
            // If we've collected a good batch size, we can start processing
            if (currentBatchDocIds.length >= 500 || !hasMorePages) {
              break;
            }
          } catch (error) {
            console.error(`Error scanning page ${currentScanPage}:`, error);
            // Try the next page after a short delay
            await new Promise(resolve => setTimeout(resolve, 2000));
            currentScanPage++;
          }
        }
        
        // If we didn't find any documents to process, we're done
        if (currentBatchDocIds.length === 0) {
          setProcessingAllStatus("No more documents found that need processing. Batch processing complete.");
          setIsProcessingAll(false);
          break;
        }
        
        // Second phase: Process the collected document IDs
        setTotalToProcess(prev => prev + currentBatchDocIds.length);
        setProcessingAllStatus(`Found ${currentBatchDocIds.length} documents to process. Starting batch processing...`);
        
        // Variables to track progress for this batch
        let activeProcessingCount = 0;
        let processedInBatch = 0;
        
        // Process documents with concurrency control
        const processChunk = async () => {
          // Process as long as there are IDs left
          while ((currentBatchDocIds.length > 0 || activeProcessingCount > 0) && !shouldStopProcessingRef.current) {
            // Start new processes if we're under the concurrency limit
            while (activeProcessingCount < concurrencyLimit && currentBatchDocIds.length > 0 && !shouldStopProcessingRef.current) {
              const docId = currentBatchDocIds.shift();
              if (!docId) continue;
              
              // Check if this is a repair task
              const isRepair = docId.startsWith('repair:');
              const actualDocId = isRepair ? docId.substring(7) : docId;
              
              // Skip if already processed in previous batches
              if (processedDocIds.has(actualDocId)) continue;
              
              // Start processing this document
              activeProcessingCount++;
              setActiveProcessingCount(activeProcessingCount);
              
              // Add to our processed set to avoid duplicate processing
              processedDocIds.add(actualDocId);
              
              // Process in a non-blocking way
              (async () => {
                try {
                  // Check if we should stop before processing this document
                  if (shouldStopProcessingRef.current) {
                    console.log(`Skipping document ${actualDocId} due to stop request`);
                    return;
                  }

                  if (isRepair) {
                    await repairDocument(actualDocId);
                  } else {
                    await processDocument(actualDocId);
                  }
                  
                  // Update counts
                  processedInBatch++;
                  setProcessedCount(totalDocsProcessedSoFar + processedInBatch);
                  setProcessingAllStatus(`Processed ${processedInBatch}/${currentBatchDocIds.length + processedInBatch} in current batch. Total: ${totalDocsProcessedSoFar + processedInBatch}`);
                  
                } catch (error) {
                  console.error(`Error processing document ${actualDocId}:`, error);
                } finally {
                  // Always decrement the active count
                  activeProcessingCount--;
                  setActiveProcessingCount(activeProcessingCount);
                }
              })();
            }
            
            // Wait before checking again
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
          // Check if processing was stopped
          if (shouldStopProcessingRef.current) {
            setProcessingAllStatus(`Processing stopped manually after processing ${totalDocsProcessedSoFar + processedInBatch} documents`);
            setIsProcessingAll(false);
            if (queueInterval) clearInterval(queueInterval);
            return;
          }
          
          // Update total processed count for the next batch
          totalDocsProcessedSoFar += processedInBatch;
          setProcessingAllStatus(`Batch complete. Total documents processed: ${totalDocsProcessedSoFar}`);
          
          // If we've reached the end of scanning pages, we're done
          if (!hasMorePages && currentBatchDocIds.length === 0) {
            setProcessingAllStatus(`Processing complete. Total documents processed: ${totalDocsProcessedSoFar}`);
            setIsProcessingAll(false);
            if (queueInterval) clearInterval(queueInterval);
            return;
          }
          
          // Otherwise, start the next batch
          currentBatchDocIds = [];
          processedInBatch = 0;
        };
        
        // Start processing this batch
        await processChunk();
      }
    } catch (error) {
      console.error("Error in processAllDocuments:", error);
      setProcessingAllStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsProcessingAll(false);
    } finally {
      if (queueInterval) clearInterval(queueInterval);
    }
  }, [
    isProcessingAll, 
    concurrencyLimit, 
    limitToImageAnalysis, 
    processDocument
  ]);

  // Force repair/update of a document
  const repairDocument = useCallback(async (documentId: string): Promise<void> => {
    try {
      // Update processing status
      setProcessingUpdates(prev => ({
        ...prev,
        [documentId]: { 
          status: 'repairing', 
          message: 'Repairing document data...', 
          type: 'processing' 
        }
      }));
      
      // Send repair request to API
      const response = await fetch(`/api/jfk/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentId,
          processType: 'repair',
          forceDataUpdate: true,
        }),
      });
      
      const data = await response.json();
      
      if (response.ok && data.status === 'success') {
        // Update UI with success status
        setProcessingUpdates(prev => ({
          ...prev,
          [documentId]: { 
            status: 'completed', 
            message: data.message || 'Document repaired successfully', 
            type: 'complete' 
          }
        }));
        
        // Update document in the list
        setDocuments(prev => 
          prev.map(doc => 
            doc.id === documentId 
              ? { 
                  ...doc, 
                  status: 'ready',
                  processingStatus: null,
                  analysisComplete: true,
                  lastUpdated: new Date().toISOString(),
                  dbId: data.dbId || doc.dbId
                }
              : doc
          )
        );
        
        // Update document ID mapping if needed
        if (data.dbId) {
          setDocumentIdMap(prev => ({
            ...prev,
            [documentId]: data.dbId
          }));
        }
      } else {
        throw new Error(data.message || response.statusText || 'Repair failed');
      }
    } catch (error) {
      console.error(`Error repairing document ${documentId}:`, error);
      
      // Update UI with error status
      setProcessingUpdates(prev => ({
        ...prev,
        [documentId]: { 
          status: 'error', 
          message: `Repair failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 
          type: 'error' 
        }
      }));
      
      // Update document status to show repair failure
      setDocuments(prev => 
        prev.map(doc => 
          doc.id === documentId 
            ? { 
                ...doc, 
                processingStatus: 'repairFailed',
                lastUpdated: new Date().toISOString() 
              }
            : doc
        )
      );
      
      throw error;
    }
  }, [setDocuments, documentIdMap]);

  // Repair all broken documents
  const repairAllBrokenDocuments = useCallback(async () => {
    if (repairingDocuments) return;
    
    try {
      setRepairingDocuments(true);
      setProcessingAllStatus(`Finding documents that need repair...`);
      
      // First, just get the list of broken document IDs without trying to repair them
      const findResponse = await fetch(`/api/jfk/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          findBrokenOnly: true,
        }),
      });
      
      const findData = await findResponse.json();
      
      if (!findResponse.ok) {
        setProcessingAllStatus(`Error finding broken documents: ${findData.message || findResponse.statusText}`);
        setRepairingDocuments(false);
        return;
      }
      
      const brokenDocIds = findData.brokenDocIds || [];
      
      if (brokenDocIds.length === 0) {
        setProcessingAllStatus(`No broken documents found.`);
        setRepairingDocuments(false);
        return;
      }
      
      setProcessingAllStatus(`Found ${brokenDocIds.length} documents that need repair. Starting repair process...`);
      
      // Variables to track progress
      let completedRepairs = 0;
      let failedRepairs = 0;
      let activeRepairs = 0;
      const maxConcurrentRepairs = 5; // Limit concurrent repairs
      
      // Queue function to handle concurrency
      const repairQueue = async () => {
        // Process documents as long as there are IDs left
        while (brokenDocIds.length > 0 || activeRepairs > 0) {
          // Start new repairs if we're under the concurrency limit and have IDs to process
          while (activeRepairs < maxConcurrentRepairs && brokenDocIds.length > 0) {
            const docId = brokenDocIds.shift();
            if (docId) {
              activeRepairs++;
              setActiveProcessingCount(activeRepairs);
              
              // Start the repair with a slight delay to avoid overwhelming the server
              setTimeout(() => {
                repairSingleDocument(docId);
              }, 2000); // 2 second stagger
            }
          }
          
          // Wait before checking again
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // All documents processed
        setProcessingAllStatus(`Repair complete. ${completedRepairs} documents repaired, ${failedRepairs} failures.`);
        setActiveProcessingCount(0);
        setRepairingDocuments(false);
        
        // Refresh the page after processing to show updated data
        if (completedRepairs > 0) {
          setTimeout(() => {
            window.location.reload();
          }, 3000);
        }
      };
      
      // Function to repair a single document
      const repairSingleDocument = async (docId: string) => {
        try {
          setProcessingAllStatus(`Repairing ${completedRepairs + failedRepairs + 1}/${brokenDocIds.length + completedRepairs + failedRepairs + activeRepairs} documents. Completed: ${completedRepairs}, Failed: ${failedRepairs}, Active: ${activeRepairs}`);
          
          await repairDocument(docId);
          completedRepairs++;
        } catch (error) {
          failedRepairs++;
          console.error(`Failed to repair document ${docId}:`, error);
        } finally {
          activeRepairs--;
          setActiveProcessingCount(activeRepairs);
        }
      };
      
      // Start the repair queue
      repairQueue();
      
    } catch (error) {
      console.error('Error in repairAllBrokenDocuments:', error);
      setProcessingAllStatus(`Error repairing documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setActiveProcessingCount(0);
      setRepairingDocuments(false);
    }
  }, [repairingDocuments, repairDocument]);

  // Add a function to stop all processing
  const stopProcessing = useCallback(() => {
    // Set the stop flag to true
    shouldStopProcessingRef.current = true;
    
    // Close all active event source connections
    activeConnectionsRef.current.forEach((connection, docId) => {
      console.log(`Closing connection for ${docId} due to manual stop`);
      connection.close();
    });
    
    // Clear all active connections
    activeConnectionsRef.current.clear();
    
    // Abort all active XHR requests
    activeXhrRequestsRef.current.forEach(xhr => {
      if (xhr && xhr.readyState !== 4) { // 4 = DONE
        xhr.abort();
      }
    });
    
    // Empty the XHR refs
    activeXhrRequestsRef.current = [];
    
    // Clear all intervals
    intervalsRef.current.forEach(intervalId => {
      clearInterval(intervalId);
    });
    intervalsRef.current = [];
    
    // Update the UI
    setIsProcessingAll(false);
    setProcessingAllStatus('Processing stopped manually');
    setActiveProcessingCount(0);
    
    // Reset the stop flag for future processing
    setTimeout(() => {
      shouldStopProcessingRef.current = false;
    }, 1000);
  }, []);

  return {
    processingUpdates,
    isProcessingAll,
    processedCount,
    totalToProcess,
    processingAllStatus,
    activeProcessingCount,
    concurrencyLimit,
    setConcurrencyLimit,
    limitToImageAnalysis,
    setLimitToImageAnalysis,
    processDocument,
    processAllDocuments,
    repairDocument,
    repairAllBrokenDocuments,
    stopProcessing
  };
} 