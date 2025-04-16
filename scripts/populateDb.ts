const { PrismaClient } = require('@prisma/client');
const nodeFetch = require('node-fetch');
const { normalizeAllDates: normalizeDatesUtil } = require('../lib/dateUtils');
const fs = require('fs');
const path = require('path');

// Initialize Prisma client
const prisma = new PrismaClient();

// Add command line argument support
const args = process.argv.slice(2);
const testMode = args.includes('--test');
const limit = testMode ? 10 : Infinity;

const pageSize = 100;
let page = 1;
let hasMore = true;

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.oip.onl';

async function fetchDocuments(page: number): Promise<any> {
  try {
    const response = await nodeFetch(`${API_BASE_URL}/api/jfk/list?page=${page}&limit=${pageSize}&excludeNoAnalysis=true`);
    if (!response.ok) {
      throw new Error(`API response error: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching document IDs:', error);
    return { documents: [], hasMore: false };
  }
}

async function fetchDocumentDetails(id: string): Promise<any> {
  try {
    const response = await nodeFetch(`${API_BASE_URL}/api/jfk/media?id=${id}&type=analysis`);
    if (!response.ok) {
      throw new Error(`API response error: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Error fetching analysis for document ${id}:`, error);
    return null;
  }
}

async function populateDatabase() {
  let page = 1;
  let hasMorePages = true;
  const processedCount = { success: 0, error: 0, skipped: 0 };

  console.log(`Starting database population${testMode ? ' in TEST MODE (limit: 10 documents)' : ''}...`);

  // Continue until we hit an empty page or reach our limit
  while (hasMorePages && processedCount.success < limit) {
    try {
      // Fetch a batch of document IDs
      const { documents, hasMore } = await fetchDocuments(page);
      hasMorePages = hasMore;
      
      // Check if we got any documents back
      if (!documents || !Array.isArray(documents) || documents.length === 0) {
        console.log(`No more documents found on page ${page}. Ending population.`);
        break;
      }
      
      console.log(`Processing page ${page} with ${documents.length} documents`);
      let pageSkipped = 0;
      
      // Process each document
      for (const doc of documents) {
        // Exit early if we've reached the test limit
        if (processedCount.success >= limit) {
          console.log(`Test limit reached (${limit} documents). Stopping.`);
          return;
        }
        
        try {
          if (!doc || !doc.id) {
            console.error('Invalid document object:', doc);
            processedCount.error++;
            continue;
          }

          // Skip if document already exists
          const existingDoc = await prisma.document.findUnique({
            where: { id: doc.id }
          });
          
          if (existingDoc) {
            console.log(`Document ${doc.id} already exists, skipping`);
            processedCount.skipped++;
            pageSkipped++;
            continue;
          }

          // Fetch the document analysis
          const analysis = await fetchDocumentDetails(doc.id);
          
          if (!analysis) {
            console.log(`No analysis data for document ${doc.id}`);
            processedCount.error++;
            continue;
          }

          // Extract arrays for indexing
          const allNames = extractArray(analysis.allNames || []);
          const allPlaces = extractArray(analysis.allPlaces || []);
          const allDates = extractArray(analysis.allDates || []);
          const allObjects = extractArray(analysis.allObjects || []);
          const stampTexts = analysis.stamps?.map((s: any) => s.text).filter(Boolean) || [];
          
          // Process and normalize dates
          const { normalizedDates, earliestDate, latestDate } = normalizeDatesUtil(allDates);
          
          // Check for presence of handwritten notes, stamps, and full text
          const hasHandwrittenNotes = Array.isArray(analysis.handwrittenNotes) && analysis.handwrittenNotes.length > 0;
          const hasStamps = Array.isArray(analysis.stamps) && analysis.stamps.length > 0;
          const hasFullText = Boolean(analysis.fullText && analysis.fullText.trim().length > 0);
          
          // Process the document with a transaction to ensure all related data is created together
          await prisma.$transaction(async (tx: any) => {
            // Create the main document record
            const searchText = generateSearchText({
              title: analysis.title,
              summary: analysis.summary,
              fullText: analysis.fullText,
              allNames,
              allPlaces,
              allDates,
              allObjects,
              stamps: stampTexts
            });
            
            const document = await tx.document.create({
              data: {
                id: doc.id,
                document: analysis,
                documentUrl: analysis.documentUrl || null,
                processingDate: analysis.processingDate ? new Date(analysis.processingDate) : null,
                pageCount: analysis.pageCount || analysis.pages?.length || null,
                title: analysis.title || null,
                summary: analysis.summary || null,
                fullText: analysis.fullText || null,
                documentType: analysis.documentType || null,
                allNames,
                allPlaces,
                allDates,
                allObjects,
                stamps: stampTexts,
                normalizedDates,
                earliestDate,
                latestDate,
                hasHandwrittenNotes,
                hasStamps,
                hasFullText,
                searchText
              }
            });
            
            // Create page records
            if (Array.isArray(analysis.pages)) {
              for (const page of analysis.pages) {
                await tx.page.create({
                  data: {
                    documentId: doc.id,
                    pageNumber: page.pageNumber,
                    imagePath: page.imagePath,
                    summary: page.summary || null,
                    fullText: page.fullText || null
                  }
                });
              }
            }
            
            // Create handwritten notes records
            if (Array.isArray(analysis.handwrittenNotes)) {
              for (const note of analysis.handwrittenNotes) {
                await tx.handwrittenNote.create({
                  data: {
                    documentId: doc.id,
                    pageNumber: note.pageNumber,
                    content: note.content,
                    location: note.location || null
                  }
                });
              }
            }
            
            // Create stamp records
            if (Array.isArray(analysis.stamps)) {
              for (const stamp of analysis.stamps) {
                await tx.documentStamp.create({
                  data: {
                    documentId: doc.id,
                    pageNumber: stamp.pageNumber,
                    type: stamp.type || null,
                    date: stamp.date || null,
                    text: stamp.text
                  }
                });
              }
            }
          });
          
          console.log(`Successfully processed document ${doc.id}`);
          processedCount.success++;
          
        } catch (error) {
          console.error(`Error processing document ${doc.id}:`, error);
          processedCount.error++;
        }
      }
      
      // Move to the next page
      page++;
      console.log(`Page completed: Processed ${processedCount.success} total documents successfully, ${processedCount.skipped} skipped, ${processedCount.error} errors.`);
      
      // If all documents on this page were skipped and we haven't reached the limit,
      // continue to next page even if hasMore might be false
      if (pageSkipped === documents.length && processedCount.success < limit) {
        console.log(`All documents on page ${page-1} already existed, moving to next page...`);
        hasMorePages = true;
      }
      
    } catch (error) {
      console.error('Error processing page:', error);
      break;
    }
  }
  
  console.log(`Database population completed. Total documents processed: ${processedCount.success}, skipped: ${processedCount.skipped}, errors: ${processedCount.error}`);
}

// Helper function to extract array elements
function extractArray(arr: any[]): string[] {
  if (!Array.isArray(arr)) return [];
  // Flatten nested arrays, convert to strings, and limit size
  return arr.flat()
    .filter(item => item !== null && item !== undefined)
    .map(item => typeof item === 'string' ? item : String(item))
    // Limit total combined length of strings
    .reduce((acc: string[], item: string) => {
      // Only add item if we haven't reached the size limit
      const currentSize = acc.join(' ').length;
      if (currentSize < 2000) {
        acc.push(item);
      }
      return acc;
    }, [] as string[]);
}

// Add this function to create the searchText field
function generateSearchText(doc: any): string {
  const textParts = [
    doc.title || '',
    doc.summary || '',
    (doc.allNames || []).join(' '),
    (doc.allPlaces || []).join(' '),
    (doc.allDates || []).join(' '),
    (doc.allObjects || []).join(' '),
    (doc.stamps || []).join(' ')
  ];
  
  // Include fullText only if it exists and isn't too long
  if (doc.fullText && typeof doc.fullText === 'string') {
    textParts.push(doc.fullText.slice(0, 10000)); // Limit to first 10K chars
  }
  
  return textParts.filter(Boolean).join(' ');
}

// Run the population script
populateDatabase()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  }); 