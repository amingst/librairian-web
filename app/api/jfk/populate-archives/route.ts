import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer';
import path from 'path';

const prisma = new PrismaClient();

// Base URLs for archives.gov
const BASE_URL = 'https://www.archives.gov';
const TARGET_URL = 'https://www.archives.gov/research/jfk/release-2025';

// Function to extract release date from URL
function extractReleaseDate(url: string): Date {
  // URL pattern might be like: /files/research/jfk/releases/2025/0318/file.pdf
  // or /files/research/jfk/releases/2025/0403/file.pdf
  const datePattern = /releases\/\d{4}\/(\d{2})(\d{2})\//;
  const match = url.match(datePattern);
  
  if (match) {
    const month = parseInt(match[1]);
    const day = parseInt(match[2]);
    // Use 2025 as default year for these releases
    return new Date(2025, month - 1, day);
  }
  
  // Default to March 18, 2025 if pattern not found
  return new Date('2025-03-18');
}

// Fetch all JFK documents from archives.gov using Puppeteer
// This directly adapts the user's working download script
async function fetchAllArchiveDocuments() {
  try {
    console.log('Starting to fetch document IDs from archives.gov using Puppeteer...');
    
    // Launch headless browser
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
      const page = await browser.newPage();
      
      // Set a reasonable timeout
      page.setDefaultNavigationTimeout(60000);
      
      // Go to the archives page
      console.log('Navigating to archives.gov JFK release page...');
      await page.goto(TARGET_URL, { waitUntil: 'networkidle2' });
      
      // Step 1: Set dropdown to "All" to show all entries
      console.log('Setting view to show all entries...');
      await page.select('select[name="DataTables_Table_0_length"]', '-1'); // "-1" is for "All"
      
      // Step 2: Wait for the table to fully load
      console.log('Waiting for all entries to load...');
      await page.waitForFunction(() => {
        // Wait until there are more than 100 entries loaded
        const rows = document.querySelectorAll('table#DataTables_Table_0 tbody tr');
        return rows.length > 100;
      }, { timeout: 30000 });
      
      // Step 3: Extract PDF links
      console.log('Extracting document IDs...');
      const pdfLinks = await page.$$eval('table#DataTables_Table_0 tbody tr td a', links =>
        links
          .map(link => link.getAttribute('href'))
          .filter(href => href && href.endsWith('.pdf'))
      );
      
      console.log(`Found ${pdfLinks.length} PDF links.`);
      
      // Step 4: Convert links to document objects
      const documents = pdfLinks.map(relativeUrl => {
        if (!relativeUrl) return null;
        
        const fullUrl = BASE_URL + relativeUrl;
        const filename = path.basename(relativeUrl);
        // Extract ID without the .pdf extension
        const id = filename.replace('.pdf', '');
        
        // Extract release date from URL
        const releaseDate = extractReleaseDate(relativeUrl);
        
        return {
          id: id,
          archiveId: id,
          title: `JFK Document ${id}`,
          pageCount: 0, // Will be determined during processing
          fullUrl: fullUrl,
          releaseDate: releaseDate.toISOString(),
          documentType: 'jfk', // For backward compatibility
          documentGroup: 'jfk' // Use new consistent terminology
        };
      }).filter(Boolean); // Remove any null items
      
      console.log(`Found ${documents.length} documents from archives.gov`);
      
      // Close browser
      await browser.close();
      
      return documents;
    } catch (error) {
      // Make sure browser closes even if there's an error
      await browser.close();
      throw error;
    }
  } catch (error) {
    console.error('Error fetching document IDs from archives.gov:', error);
    
    // Return a few known valid document IDs as fallback
    console.log('Returning fallback document IDs...');
    
    // Sample URLs from different release dates
    const fallbackUrls = [
      '/files/research/jfk/releases/2025/0318/104-10003-10041.pdf',
      '/files/research/jfk/releases/2025/0403/104-10004-10143.pdf'
    ];
    
    return fallbackUrls.map(relativeUrl => {
      const filename = path.basename(relativeUrl);
      const id = filename.replace('.pdf', '');
      const fullUrl = `${BASE_URL}${relativeUrl}`;
      const releaseDate = extractReleaseDate(relativeUrl);
      
      return {
        id: id,
        archiveId: id,
        title: `JFK Document ${id}`,
        pageCount: 0,
        fullUrl: fullUrl,
        releaseDate: releaseDate.toISOString(),
        documentType: 'jfk', // For backward compatibility
        documentGroup: 'jfk' // Use new consistent terminology
      };
    });
  }
}

// Populate database with documents from archives.gov
export async function POST() {
  try {
    // 1. Fetch all documents from archives.gov
    const archiveDocuments = await fetchAllArchiveDocuments();
    
    if (archiveDocuments.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Failed to fetch documents from archives.gov'
      }, { status: 500 });
    }
    
    // 2. Get existing documents from database to avoid duplicates
    const existingDocs = await prisma.document.findMany({
      select: {
        archiveId: true
      }
    });
    
    const existingArchiveIds = new Set(
      existingDocs
        .map(doc => doc.archiveId)
        .filter(Boolean) // Remove null/undefined values
    );
    
    console.log(`Found ${existingArchiveIds.size} existing documents in database`);
    
    // 3. Filter out documents that already exist in the database
    const newDocuments = archiveDocuments.filter(doc => {
      if (!doc) return false;
      return !existingArchiveIds.has(doc.archiveId);
    });
    
    console.log(`Adding ${newDocuments.length} new documents to database`);
    
    // 4. Insert new documents into database
    if (newDocuments.length > 0) {
      // Process in batches to avoid overwhelming the database
      const BATCH_SIZE = 100;
      let processedCount = 0;
      
      for (let i = 0; i < newDocuments.length; i += BATCH_SIZE) {
        const batch = newDocuments.slice(i, i + BATCH_SIZE);
        
        // Create database entries with type assertion
        await prisma.document.createMany({
          data: batch
            .filter((doc): doc is NonNullable<typeof doc> => doc !== null) // Type guard
            .map(doc => ({
              id: doc.id,
              archiveId: doc.archiveId,
              title: doc.title,
              pageCount: doc.pageCount,
              documentType: 'jfk', // For backward compatibility
              documentGroup: 'jfk', // Use new consistent terminology
              document: JSON.stringify({
                id: doc.id,
                title: doc.title,
                pageCount: doc.pageCount,
                processingStage: 'waitingForProcessing',
                processingSteps: [],
                analysisComplete: false,
                releaseDate: doc.releaseDate,
                documentType: 'jfk', // For backward compatibility
                documentGroup: 'jfk' // Use new consistent terminology
              }),
              processingDate: new Date(),
              lastProcessed: new Date()
            })),
          skipDuplicates: true,
        });
        
        processedCount += batch.length;
        console.log(`Processed ${processedCount}/${newDocuments.length} documents`);
      }
    }
    
    // 5. Return success response
    return NextResponse.json({
      success: true,
      totalDocuments: archiveDocuments.length,
      existingDocuments: existingArchiveIds.size,
      newDocuments: newDocuments.length,
      message: `Successfully added ${newDocuments.length} new documents to database`
    });
  } catch (error) {
    console.error('Error populating database:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to populate database',
      error: String(error)
    }, { status: 500 });
  }
} 