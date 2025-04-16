const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fetch = require('node-fetch');
const { normalizeAllDates } = require('../lib/dateUtils'); // Assume this exists

// Concurrency settings
const MAX_CONCURRENT = 3; // Process 3 documents at a time
const DELAY_BETWEEN_DOCS = 5000; // 5 seconds between starting repairs

// Global counters
let totalDocuments = 0;
let successCount = 0;
let failureCount = 0;
let activeCount = 0;
let pendingDocIds = [];

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.oip.onl';

async function findBrokenMultirifDocuments() {
  console.log("Finding all multirif documents that need repair...");
  
  try {
    // Find all documents with issues that have "_multirif" in their ID
    const documents = await prisma.document.findMany({
      select: {
        id: true,
        archiveId: true,
        document: true,
        pageCount: true,
        pages: { select: { id: true } }
      },
      where: {
        OR: [
          { id: { contains: '_multirif' } },
          { archiveId: { contains: '_multirif' } }
        ]
      }
    });
    
    console.log(`Found ${documents.length} multirif documents in database`);
    
    // Filter for broken documents
    const brokenDocs = documents.filter(doc => {
      try {
        // Case 1: Incorrectly formatted document data
        const hasIncorrectFormat = typeof doc.document === 'object' && 
                doc.document !== null && 
                JSON.stringify(doc.document).startsWith('{"archiveId":');
        
        // Case 2: Document with pageCount = 0
        const hasZeroPages = doc.pageCount === 0;
        
        // Case 3: Document with no pages relationship
        const hasNoPageRelations = !doc.pages || doc.pages.length === 0;
        
        // Case 4: Document that shows as processed but is missing data
        const isProcessedButMissingData = typeof doc.document === 'object' && 
              doc.document !== null &&
              doc.document.analysisComplete === true &&
              (!doc.pages || doc.pages.length === 0 || doc.pageCount === 0);
              
        // Return true if any of the conditions are met
        return hasIncorrectFormat || hasZeroPages || hasNoPageRelations || isProcessedButMissingData;
      } catch (e) {
        return false;
      }
    });
    
    console.log(`Found ${brokenDocs.length} broken multirif documents that need repair`);
    
    // Log breakdown of broken document types
    const incorrectFormatCount = brokenDocs.filter(doc => 
      typeof doc.document === 'object' && 
      doc.document !== null && 
      JSON.stringify(doc.document).startsWith('{"archiveId":')
    ).length;
    
    const zeroPageCount = brokenDocs.filter(doc => doc.pageCount === 0).length;
    
    const noPageRelationsCount = brokenDocs.filter(doc => 
      !doc.pages || doc.pages.length === 0
    ).length;
    
    const processedMissingDataCount = brokenDocs.filter(doc => 
      typeof doc.document === 'object' && 
      doc.document !== null &&
      doc.document.analysisComplete === true &&
      (!doc.pages || doc.pages.length === 0 || doc.pageCount === 0)
    ).length;
    
    console.log(`Broken document types breakdown: 
  - Incorrect format: ${incorrectFormatCount}
  - Zero page count: ${zeroPageCount}
  - Missing page relations: ${noPageRelationsCount}
  - Processed but missing data: ${processedMissingDataCount}
`);
    
    // Return the list of broken document IDs
    return brokenDocs.map(doc => doc.id);
  } catch (error) {
    console.error("Error finding broken documents:", error);
    return [];
  }
}

async function repairSingleDocument(docId) {
  if (!docId) {
    console.error("ERROR: Document ID is required!");
    return false;
  }
  
  activeCount++;
  console.log(`\n[${successCount + failureCount + 1}/${totalDocuments}] Repairing document ${docId}... (Active: ${activeCount})`);
  
  try {
    // Step 1: Check if document exists in database
    const doc = await prisma.document.findFirst({
      where: {
        OR: [
          { id: docId },
          { archiveId: docId },
          { oldId: docId }
        ]
      },
      select: {
        id: true,
        summary: true,
        pages: { select: { id: true } }
      }
    });
    
    if (doc) {
      console.log(`Found document ${doc.id} in database`);
      console.log(`Summary present: ${Boolean(doc.summary)}`);
      console.log(`Pages: ${doc.pages.length}`);
    } else {
      console.log(`Document ${docId} not found in database`);
    }
    
    // Step 2: Fetch document data from media API
    console.log("Fetching document data from media API...");
    
    // Set a timeout for the fetch operation
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000); // 90-second timeout for multirif docs
    
    try {
      const mediaApiUrl = `${API_BASE_URL}/api/jfk/media?id=${docId}&type=analysis&getLatestPageData=true`;
      const response = await fetch(mediaApiUrl, {
        signal: controller.signal
      });
      
      clearTimeout(timeout);
      
      if (!response.ok) {
        console.error(`Error fetching document data: ${response.status} ${response.statusText}`);
        failureCount++;
        return false;
      }
      
      const analysisData = await response.json();
      
      // Step 3: Check if we got data
      console.log(`Retrieved data from media API:`);
      console.log(`  Pages: ${analysisData.pages?.length || 0}`);
      console.log(`  Summary present: ${Boolean(analysisData.summary)}`);
      console.log(`  Handwritten notes: ${analysisData.handwrittenNotes?.length || 0}`);
      console.log(`  Stamps: ${analysisData.stamps?.length || 0}`);
      
      if (!analysisData.pages || analysisData.pages.length === 0) {
        console.error("ERROR: No page data found in API response!");
        failureCount++;
        return false;
      }
      
      // Process dates if present
      let dateInfo = {
        normalizedDates: [],
        normalizedDateObjects: [],
        earliestDate: null,
        latestDate: null
      };
      
      if (Array.isArray(analysisData.allDates)) {
        try {
          // Filter out any non-string values
          analysisData.allDates = analysisData.allDates.filter(date => typeof date === 'string' && date.trim().length > 0);
          console.log(`  Dates: ${analysisData.allDates.length} date strings`);
          
          // Process normalized dates directly in the script
          dateInfo = await processNormalizedDates(analysisData.allDates);
          console.log(`  Normalized dates: ${dateInfo.normalizedDates.length} processed`);
          console.log(`  Earliest date: ${dateInfo.earliestDate || 'none'}`);
          console.log(`  Latest date: ${dateInfo.latestDate || 'none'}`);
          
          // Store the JSON version in the document
          analysisData.normalizedDates = dateInfo.normalizedDates;
          analysisData.earliestDate = dateInfo.earliestDate;
          analysisData.latestDate = dateInfo.latestDate;
        } catch (dateError) {
          console.warn(`  Warning: Error processing dates:`, dateError);
          dateInfo = {
            normalizedDates: [],
            normalizedDateObjects: [],
            earliestDate: null,
            latestDate: null
          };
          analysisData.normalizedDates = [];
          analysisData.earliestDate = null;
          analysisData.latestDate = null;
        }
      } else {
        console.log(`  No dates found in document`);
        analysisData.allDates = [];
        analysisData.normalizedDates = [];
        analysisData.earliestDate = null;
        analysisData.latestDate = null;
      }
      
      // Step 4: Update database with the data
      console.log("Updating database...");
      
      // Prepare database update
      const dbUpdateData = {
        archiveId: docId,
        documentUrl: analysisData.documentUrl || null,
        processingDate: new Date(),
        // Set all the individual fields from the analysis data
        pageCount: analysisData.pageCount || analysisData.pages.length,
        title: analysisData.title || null,
        summary: analysisData.summary || null,
        fullText: analysisData.fullText || null,
        allNames: analysisData.allNames || [],
        allPlaces: analysisData.allPlaces || [],
        allDates: analysisData.allDates || [],
        allObjects: analysisData.allObjects || [],
        searchText: analysisData.summary || null,
        // Make sure to use proper date objects for these fields
        earliestDate: dateInfo.earliestDate ? new Date(dateInfo.earliestDate) : null,
        latestDate: dateInfo.latestDate ? new Date(dateInfo.latestDate) : null,
        // Use the Date objects array for Prisma
        normalizedDates: dateInfo.normalizedDateObjects || [],
        hasHandwrittenNotes: (analysisData.handwrittenNotes?.length || 0) > 0,
        hasStamps: (analysisData.stamps?.length || 0) > 0,
        hasFullText: Boolean(analysisData.fullText),
        processingStage: 'ready',
        lastProcessed: new Date(),
        document: {
          ...analysisData,
          processingStage: 'ready',
          lastProcessed: new Date().toISOString(),
          indexedInDb: true,
          folderCreated: true,
          pdfDownloaded: true,
          pngCreated: true,
          analysisComplete: true,
          summaryUpdated: true
        }
      };
      
      // Add pages relation
      const pages = analysisData.pages || [];
      if (pages.length > 0) {
        dbUpdateData.pages = {
          deleteMany: {}, // Clear existing pages first
          create: pages.map((page, index) => ({
            pageNumber: page.pageNumber || index + 1,
            imagePath: page.imagePath || `${docId}/page-${index + 1}.png`,
            summary: page.summary || null,
            fullText: page.fullText || null,
            hasImage: true,
            hasText: Boolean(page.fullText)
          }))
        };
      }
      
      // Add handwritten notes if available
      const handwrittenNotes = analysisData.handwrittenNotes || [];
      if (handwrittenNotes.length > 0) {
        dbUpdateData.handwrittenNotes = {
          deleteMany: {}, // Clear existing notes first
          create: handwrittenNotes.map(note => ({
            pageNumber: note.pageNumber || 1,
            content: note.content || '',
            location: note.location || ''
          }))
        };
      }
      
      // Add document stamps if available
      const stamps = analysisData.stamps || [];
      if (stamps.length > 0) {
        dbUpdateData.documentStamps = {
          deleteMany: {}, // Clear existing stamps first
          create: stamps.map(stamp => ({
            pageNumber: stamp.pageNumber || 1,
            type: stamp.type || 'unknown',
            text: stamp.text || '',
            date: stamp.date || ''
          }))
        };
      }
      
      // Update or create document
      try {
        if (doc) {
          await prisma.document.update({
            where: { id: doc.id },
            data: dbUpdateData
          });
          console.log(`Successfully updated document ${doc.id} with complete data`);
        } else {
          await prisma.document.create({
            data: {
              id: docId,
              ...dbUpdateData
            }
          });
          console.log(`Successfully created document ${docId} with complete data`);
        }
        
        // Step 5: Verify the update
        console.log("Verifying update...");
        const updatedDoc = await prisma.document.findFirst({
          where: {
            OR: [
              { id: docId },
              { archiveId: docId },
              { oldId: docId }
            ]
          },
          select: {
            id: true,
            summary: true,
            pages: { select: { id: true, pageNumber: true } },
            handwrittenNotes: { select: { id: true } },
            documentStamps: { select: { id: true } }
          }
        });
        
        if (updatedDoc) {
          console.log(`Updated document ${updatedDoc.id}:`);
          console.log(`  Summary present: ${Boolean(updatedDoc.summary)}`);
          console.log(`  Pages: ${updatedDoc.pages.length}`);
          console.log(`  Handwritten notes: ${updatedDoc.handwrittenNotes.length}`);
          console.log(`  Stamps: ${updatedDoc.documentStamps.length}`);
          console.log(`Document successfully repaired!`);
          successCount++;
          return true;
        } else {
          console.error("ERROR: Failed to retrieve updated document!");
          failureCount++;
          return false;
        }
      } catch (dbError) {
        console.error("Error updating database:", dbError);
        failureCount++;
        return false;
      }
    } catch (fetchError) {
      clearTimeout(timeout);
      console.error("Error fetching or processing document data:", fetchError);
      failureCount++;
      return false;
    }
  } catch (error) {
    console.error("Error repairing document:", error);
    failureCount++;
    return false;
  } finally {
    activeCount--;
    processNextDocument();
  }
}

/**
 * Process date strings to extract normalized dates, earliest date, and latest date
 */
async function processNormalizedDates(dateStrings) {
  if (!dateStrings || dateStrings.length === 0) {
    return { 
      normalizedDates: [],
      normalizedDateObjects: [],
      earliestDate: null,
      latestDate: null
    };
  }
  
  // Create a map to store normalized dates (to avoid duplicates)
  const dateMap = new Map();
  
  // Define month names for parsing
  const months = {
    'january': 0, 'jan': 0,
    'february': 1, 'feb': 1,
    'march': 2, 'mar': 2,
    'april': 3, 'apr': 3,
    'may': 4,
    'june': 5, 'jun': 5,
    'july': 6, 'jul': 6,
    'august': 7, 'aug': 7,
    'september': 8, 'sep': 8, 'sept': 8,
    'october': 9, 'oct': 9,
    'november': 10, 'nov': 10,
    'december': 11, 'dec': 11
  };
  
  // Process each date string
  for (const dateStr of dateStrings) {
    try {
      if (!dateStr) continue;
      
      let date = null;
      const normStr = dateStr.toLowerCase().trim();
      
      // Try various date formats
      
      // First try standard Date parsing (handles ISO dates, etc)
      date = new Date(dateStr);
      if (!isNaN(date.getTime()) && date.getFullYear() > 1900 && date.getFullYear() < 2100) {
        dateMap.set(dateStr, date);
        continue;
      }
      
      // Handle "DD Month YYYY" format (e.g., "21 May 1982")
      const dmyMatch = normStr.match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})/);
      if (dmyMatch) {
        const day = parseInt(dmyMatch[1]);
        const monthName = dmyMatch[2];
        const year = parseInt(dmyMatch[3]);
        
        if (months[monthName] !== undefined && year >= 1900 && year < 2100 && day >= 1 && day <= 31) {
          date = new Date(year, months[monthName], day);
          if (!isNaN(date.getTime())) {
            dateMap.set(dateStr, date);
            continue;
          }
        }
      }
      
      // Handle month YYYY format (e.g., "June 1963")
      const myMatch = normStr.match(/([a-z]+)\s+(\d{4})/);
      if (myMatch) {
        const monthName = myMatch[1];
        const year = parseInt(myMatch[2]);
        
        if (months[monthName] !== undefined && year >= 1900 && year < 2100) {
          date = new Date(year, months[monthName], 1);
          if (!isNaN(date.getTime())) {
            dateMap.set(dateStr, date);
            continue;
          }
        }
      }
      
      // Handle year ranges (e.g., "1959-61")
      const yearRangeMatch = normStr.match(/(\d{4})-(\d{2})/);
      if (yearRangeMatch) {
        const startYear = parseInt(yearRangeMatch[1]);
        const endYearSuffix = parseInt(yearRangeMatch[2]);
        const endYear = Math.floor(startYear / 100) * 100 + endYearSuffix;
        
        if (startYear >= 1900 && endYear < 2100 && startYear < endYear) {
          // Store both the start and end years
          const startDate = new Date(startYear, 0, 1);
          const endDate = new Date(endYear, 11, 31);
          
          if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
            dateMap.set(`${startYear}`, startDate);
            dateMap.set(`${endYear}`, endDate);
            continue;
          }
        }
      }
      
      // Handle just years (e.g., "1963")
      const yearMatch = normStr.match(/^(\d{4})$/);
      if (yearMatch) {
        const year = parseInt(yearMatch[1]);
        if (year >= 1900 && year < 2100) {
          date = new Date(year, 0, 1); // January 1st of that year
          if (!isNaN(date.getTime())) {
            dateMap.set(dateStr, date);
            continue;
          }
        }
      }
    } catch (parseError) {
      // Skip this date if there's an error parsing it
      continue;
    }
  }
  
  // Convert map to array of normalized date strings
  const dateEntries = Array.from(dateMap.entries());
  
  // Sort dates chronologically
  dateEntries.sort((a, b) => a[1].getTime() - b[1].getTime());
  
  // Create normalized date array with objects that have both original and normalized values
  const normalizedDates = dateEntries.map(([original, dateObj]) => ({
    originalText: original,
    normalized: dateObj.toISOString().split('T')[0]  // YYYY-MM-DD format
  }));
  
  // Create a separate array of Date objects for Prisma
  const normalizedDateObjects = dateEntries.map(([_, dateObj]) => dateObj);
  
  // Get earliest and latest dates if available
  // Use full ISO format for Prisma compatibility
  const earliestDate = dateEntries.length > 0 ? dateEntries[0][1].toISOString() : null;
  const latestDate = dateEntries.length > 0 ? dateEntries[dateEntries.length-1][1].toISOString() : null;
  
  return {
    normalizedDates,
    normalizedDateObjects, // For Prisma
    earliestDate,
    latestDate
  };
}

function processNextDocument() {
  // Process more documents if we have capacity and there are documents waiting
  if (activeCount < MAX_CONCURRENT && pendingDocIds.length > 0) {
    const docId = pendingDocIds.shift();
    
    // Add a slight delay between starting new documents
    setTimeout(() => {
      repairSingleDocument(docId);
    }, DELAY_BETWEEN_DOCS);
  }
  
  // Log progress
  const totalProcessed = successCount + failureCount;
  console.log(`\nProgress: ${totalProcessed}/${totalDocuments} (${Math.round((totalProcessed/totalDocuments)*100)}%)`);
  console.log(`Successful: ${successCount}, Failed: ${failureCount}, Active: ${activeCount}, Pending: ${pendingDocIds.length}`);
  
  // Check if we're done
  if (activeCount === 0 && pendingDocIds.length === 0) {
    console.log('\n==========================');
    console.log(`Repair complete! Successfully repaired ${successCount}/${totalDocuments} documents.`);
    console.log(`Failed: ${failureCount}`);
    console.log('==========================\n');
    
    // Exit after all documents have been processed
    setTimeout(() => {
      prisma.$disconnect();
      process.exit(0);
    }, 1000);
  }
}

// Main function to run the batch repair
async function repairAllMultirifDocuments() {
  try {
    console.log("Starting batch repair of multirif documents...");
    
    // Find all broken multirif documents
    const docIds = await findBrokenMultirifDocuments();
    totalDocuments = docIds.length;
    
    if (totalDocuments === 0) {
      console.log("No broken multirif documents found!");
      await prisma.$disconnect();
      return;
    }
    
    console.log(`Found ${totalDocuments} documents to repair. Starting with concurrency ${MAX_CONCURRENT}...`);
    
    // Store pending documents
    pendingDocIds = [...docIds];
    
    // Start initial batch of repairs
    const initialBatch = Math.min(MAX_CONCURRENT, pendingDocIds.length);
    for (let i = 0; i < initialBatch; i++) {
      const docId = pendingDocIds.shift();
      repairSingleDocument(docId);
      
      // Small delay between starting each document
      if (i < initialBatch - 1) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_DOCS));
      }
    }
    
  } catch (error) {
    console.error("Error in batch repair:", error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

// Run the batch repair
repairAllMultirifDocuments(); 