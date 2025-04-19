// Type definitions for JFK document data
// These types were extracted from app/jfk-files/page.tsx

export interface JFKDocument {
  id: string;
  status: string; 
  processingStatus?: string | null; // Added for the new status system
  processingStage?: string | null; // Added for displaying the current processing stage
  stages: string[];
  lastUpdated: string;
  url?: string;
  dbId?: string; // Database ID for this document
  title?: string;
  pageCount?: number;
  processingProgress?: number;
  analysisComplete?: boolean;
  allNames?: string[];
  allPlaces?: string[];
  allDates?: string[];
  allObjects?: string[];
}

export interface ProcessingUpdate {
  status: string;
  message: string;
  page?: number;
  totalPages?: number;
  imageCount?: number;
  type?: string; // 'processing', 'download', 'conversion', 'analysis', 'publishing', 'complete'
  progress?: number;
  steps?: string[]; // Include the processing steps
}

export interface DocumentStatus {
  exists: boolean;
  hasFolder: boolean;
  hasPdf: boolean;
  hasPngs: boolean;
  hasAnalysis: boolean;
  hasArweave: boolean;
  hasLatestSummary: boolean;
  isIndexed: boolean;
  dbId?: string;
  completedSteps?: string[];
} 