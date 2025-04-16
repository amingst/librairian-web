// Utility functions for JFK documents
// These functions were extracted from app/jfk-files/page.tsx

// Get the URL for viewing a document in the app
export const getDocumentAppUrl = (documentId: string): string => {
  return `jfk-files/${documentId}`;
};

// Get the URL for the document's JSON data
export const getDocumentJsonUrl = (frontendId: string, documentIdMap: Record<string, string>): string | null => {
  const backendId = documentIdMap[frontendId];
  if (!backendId) return null;
  // Use the correct server URL, removing any leading slash from the ID
  const cleanId = backendId.replace(/^\/+/, '');
  return `https://api.oip.onl/api/jfk/media?id=${cleanId}&type=analysis`;
};

// Get the URL for a specific page image of a document
export const getDocumentPageUrl = (frontendId: string, pageNum: number, documentIdMap: Record<string, string>): string | null => {
  const backendId = documentIdMap[frontendId];
  if (!backendId) return null;
  // Use the correct server URL, removing any leading slash from the ID
  const cleanId = backendId.replace(/^\/+/, '');
  return `https://api.oip.onl/api/jfk/media?id=${cleanId}&type=image&filename=page-${pageNum}.png`;
};

// Get the URL for downloading the document's PDF
export const getDocumentPdfUrl = (frontendId: string, documentIdMap: Record<string, string>): string | null => {
  const backendId = documentIdMap[frontendId];
  if (!backendId) return null;
  // Use the correct server URL, removing any leading slash from the ID
  const cleanId = backendId.replace(/^\/+/, '');
  return `https://api.oip.onl/api/jfk/media?id=${cleanId}&type=pdf`;
};

// Get the archives.gov source URL for a document
export const getArchivesGovUrl = (documentId: string): string => {
  return `https://www.archives.gov/files/research/jfk/releases/2025/0318/${documentId}.pdf`;
};

// Format a date string for display
export const formatDate = (dateString: string): string => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  } catch (e) {
    return dateString;
  }
};

// Calculate the progress percentage for a given status type
export const getProgressPercentage = (statusType: string, documents: any[]): number => {
  let count;
  
  if (statusType === 'ready' || statusType === 'waitingForAnalysis') {
    // For final states, use status
    count = documents.filter(d => d.status === statusType).length;
  } else {
    // For processing states, use processingStatus
    count = documents.filter(d => d.processingStatus === statusType).length;
  }
  
  return (count / (documents.length || 1)) * 100;
};

export const getAnalysisUrl = (id: string): string => {
  const cleanId = id.startsWith('/') ? id.substring(1) : id;
  return `${process.env.NEXT_PUBLIC_API_URL}/api/jfk/media?id=${cleanId}&type=analysis`;
};

export const getImageUrl = (id: string, pageNum: number): string => {
  const cleanId = id.startsWith('/') ? id.substring(1) : id;
  return `${process.env.NEXT_PUBLIC_API_URL}/api/jfk/media?id=${cleanId}&type=image&filename=page-${pageNum}.png`;
};

export const getPdfUrl = (id: string): string => {
  const cleanId = id.startsWith('/') ? id.substring(1) : id;
  return `${process.env.NEXT_PUBLIC_API_URL}/api/jfk/media?id=${cleanId}&type=pdf`;
}; 