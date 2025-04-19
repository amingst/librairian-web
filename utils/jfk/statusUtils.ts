// Utility functions for handling JFK document statuses
// These functions were extracted from app/jfk-files/page.tsx

import { JFKDocument, DocumentStatus } from './types';

// Get the latest stage of a document processing
export const getLatestStage = (stages: string[] | undefined, doc: JFKDocument): string => {
  if (!stages || stages.length === 0) return 'None';
  
  // If there's an active processing status, show that
  if (doc.processingStatus === 'processing') {
    return 'Processing';
  }
  
  if (doc.processingStatus === 'failed') {
    return 'Failed';
  }
  
  // For completed documents, show the final state
  if (doc.status === 'ready') {
    return 'Ready';
  }
  
  // For waiting documents that are not processing, show the waiting state
  return 'Needs Analysis';
};

// Get the step status for a document
export const getStepStatus = (
  documentUpdates: Record<string, any>,
  documentId: string, 
  step: string
): 'completed' | 'pending' | 'processing' | 'failed' => {
  const update = documentUpdates[documentId];
  
  if (!update || !update.steps) {
    return 'pending';
  }
  
  if (update.status === 'failed' || (update.steps && update.steps.includes(`${step}:failed`))) {
    return 'failed';
  }
  
  if (update.steps.includes(step) && !update.steps.includes(`${step}:completed`)) {
    return 'processing';
  }
  
  if (update.steps.includes(`${step}:completed`)) {
    return 'completed';
  }
  
  return 'pending';
};

// Check if a document specifically needs repair
export const checkIfDocumentNeedsRepair = async (documentId: string): Promise<boolean> => {
  try {
    // First get basic document status
    const docStatus = await checkDocumentStatus(documentId);
    
    // If document doesn't exist, it can't be repaired
    if (!docStatus.exists || !docStatus.dbId) {
      return false;
    }
    
    // Get document info to check its content
    const docResponse = await fetch(`/api/jfk/document-info?id=${docStatus.dbId}`);
    if (!docResponse.ok) {
      return false;
    }
    
    const docData = await docResponse.json();
    
    // Check for various repair conditions:
    
    // 1. Incorrectly formatted document (has archiveId as content)
    const hasIncorrectFormat = docData.document && 
      typeof docData.document === 'object' && 
      JSON.stringify(docData.document).startsWith('{"archiveId":');
    
    // 2. Zero page count
    const hasZeroPageCount = docData.pageCount === 0;
    
    // 3. Missing pages relationship
    const hasMissingPages = !docData.pages || docData.pages.length === 0;
    
    // 4. Processed but missing data
    const isProcessedButMissingData = docData.document && 
      typeof docData.document === 'object' && 
      (docData.document as any).analysisComplete === true &&
      (hasMissingPages || hasZeroPageCount);
      
    // Return true if any condition is met
    return hasIncorrectFormat || hasZeroPageCount || hasMissingPages || isProcessedButMissingData;
  } catch (error) {
    console.error(`Error checking if document ${documentId} needs repair:`, error);
    return false;
  }
};

// Check document status to determine needed steps
export const checkDocumentStatus = async (documentId: string, documentType?: string): Promise<DocumentStatus> => {
  try {
    // Determine document type from ID if not provided
    const isRfkDocument = documentType === 'rfk' || documentId.toLowerCase().includes('rfk');
    const effectiveDocType = isRfkDocument ? 'rfk' : 'jfk';
    
    // Add the document type to the query params
    const response = await fetch(`/api/jfk/document-status?documentId=${documentId}&documentType=${effectiveDocType}`);
    const data = await response.json();
    
    if (response.ok) {
      return data;
    } else {
      console.error("Document status check failed:", data.error || response.statusText);
      throw new Error(data.error || response.statusText);
    }
  } catch (error) {
    console.error("Error checking document status:", error);
    // Return a default structure with all properties set to false
    return {
      exists: false,
      hasFolder: false,
      hasPdf: false,
      hasPngs: false,
      hasAnalysis: false,
      hasArweave: false,
      hasLatestSummary: false,
      isIndexed: false,
      completedSteps: []
    };
  }
}; 