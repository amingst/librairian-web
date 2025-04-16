const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const path = require('path');
const url = require('url');

// Function to extract the filename from a URL
function getFilenameFromUrl(urlString) {
  try {
    // Sometimes the URL might be malformed, so we'll handle errors
    const parsedUrl = new URL(urlString);
    // Get just the pathname
    const pathname = parsedUrl.pathname;
    // Extract the filename (last part of the path)
    const filename = path.basename(pathname, '.pdf').replace(/\.pdf$/, '');
    return filename;
  } catch (error) {
    console.error(`Error parsing URL: ${urlString}`);
    console.error(error);
    // Return null or a placeholder if the URL cannot be parsed
    return null;
  }
}

async function listAllDocuments() {
  try {
    // Limit to 10 initially to verify the structure
    const documents = await prisma.document.findMany({
      take: 10,
      select: {
        id: true,
        title: true,
        documentUrl: true,
        oldId: true,
        archiveId: true,
        pages: { select: { id: true }, take: 1 },
        documentStamps: { select: { id: true }, take: 1 },
        handwrittenNotes: { select: { id: true }, take: 1 }
      }
    });

    console.log(`Found ${documents.length} documents.`);
    
    documents.forEach(doc => {
      const filenameId = doc.documentUrl ? getFilenameFromUrl(doc.documentUrl) : null;
      
      console.log({
        currentId: doc.id,
        oldId: doc.oldId,
        archiveId: doc.archiveId,
        title: doc.title,
        documentUrl: doc.documentUrl,
        extractedId: filenameId,
        hasPages: doc.pages.length > 0,
        hasStamps: doc.documentStamps.length > 0,
        hasNotes: doc.handwrittenNotes.length > 0
      });
    });
  } catch (error) {
    console.error('Error listing documents:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Simpler approach using direct SQL to update a single document
async function updateSingleDocument(id) {
  try {
    // First, get the document to see if we can extract an ID from it
    const doc = await prisma.document.findUnique({
      where: { id },
      select: {
        id: true,
        documentUrl: true,
        oldId: true,
        archiveId: true
      }
    });
    
    if (!doc) {
      console.error(`Document with ID ${id} not found.`);
      return false;
    }
    
    // Skip documents that already have an oldId (meaning they've been processed)
    if (doc.oldId) {
      console.log(`Skipping document with ID ${doc.id} - already processed (has oldId)`);
      return false;
    }
    
    if (!doc.documentUrl) {
      console.log(`Skipping document with ID ${doc.id} - no documentUrl found`);
      return false;
    }
    
    const filenameId = getFilenameFromUrl(doc.documentUrl);
    
    if (!filenameId) {
      console.log(`Skipping document with ID ${doc.id} - could not extract filename from URL: ${doc.documentUrl}`);
      return false;
    }
    
    // Check if target ID already exists to avoid conflicts
    const existingDoc = await prisma.document.findUnique({
      where: { id: filenameId }
    });
    
    if (existingDoc) {
      console.log(`Skipping document with ID ${doc.id} - target ID ${filenameId} already exists`);
      return false;
    }
    
    // Update the document with a direct SQL approach
    // First, add the oldId column for the current document
    await prisma.$executeRaw`
      UPDATE "Document"
      SET "oldId" = ${doc.id}
      WHERE "id" = ${doc.id}
    `;
    
    console.log(`Updated document ${doc.id} to set oldId`);
    
    // Update the archiveId field
    await prisma.$executeRaw`
      UPDATE "Document"
      SET "archiveId" = ${filenameId}
      WHERE "id" = ${doc.id}
    `;
    
    console.log(`Updated document ${doc.id} with archive ID ${filenameId}`);
    
    return true;
  } catch (error) {
    console.error(`Error updating document with ID ${id}:`, error);
    return false;
  }
}

// Update the count of total documents
async function countDocuments() {
  try {
    const count = await prisma.document.count();
    console.log(`Total documents in database: ${count}`);
  } catch (error) {
    console.error('Error counting documents:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Function to update all documents one by one
async function updateAllDocuments() {
  try {
    const documents = await prisma.document.findMany({
      select: {
        id: true,
        oldId: true
      }
    });

    console.log(`Found ${documents.length} documents to update.`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const doc of documents) {
      try {
        if (doc.oldId) {
          console.log(`Skipping document with ID ${doc.id} - already has oldId`);
          continue;
        }
        
        const success = await updateSingleDocument(doc.id);
        
        if (success) {
          successCount++;
          if (successCount % 10 === 0) {
            console.log(`Updated ${successCount} documents so far...`);
          }
        } else {
          errorCount++;
        }
      } catch (error) {
        console.error(`Error processing document with ID ${doc.id}:`, error);
        errorCount++;
      }
    }
    
    console.log(`Update complete. Successfully updated ${successCount} documents with ${errorCount} errors.`);
  } catch (error) {
    console.error('Error updating documents:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Final step to update the IDs of all documents to match their archiveId
async function finalizeDocumentIds() {
  try {
    console.log('Starting document ID update with foreign key constraints disabled');
    
    // Disable foreign key constraints temporarily
    await prisma.$executeRaw`SET session_replication_role = 'replica';`;
    console.log('Foreign key constraints disabled');
    
    // Get all documents that have both oldId and archiveId
    const documents = await prisma.document.findMany({
      where: {
        oldId: { not: null },
        archiveId: { not: null }
      },
      select: {
        id: true,
        oldId: true,
        archiveId: true,
        title: true
      }
    });

    console.log(`Found ${documents.length} documents with oldId and archiveId.`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const doc of documents) {
      try {
        // Skip documents where the ID already matches the archiveId
        if (doc.id === doc.archiveId) {
          console.log(`Document ID ${doc.id} already matches archiveId, skipping`);
          continue;
        }

        // Check if there's already a document with the target archiveId
        const existingDoc = await prisma.document.findUnique({
          where: { id: doc.archiveId }
        });
        
        if (existingDoc) {
          console.log(`Cannot update document ${doc.id} to ${doc.archiveId} - ID already exists`);
          errorCount++;
          continue;
        }
        
        console.log(`Updating document ${doc.id} to ${doc.archiveId} (${doc.title || 'No title'})`);
        
        // Get related records count for logging
        const pageCount = await prisma.page.count({
          where: { documentId: doc.id }
        });
        
        const noteCount = await prisma.handwrittenNote.count({
          where: { documentId: doc.id }
        });
        
        const stampCount = await prisma.documentStamp.count({
          where: { documentId: doc.id }
        });
        
        console.log(`Document ${doc.id} has related records: Pages=${pageCount}, Notes=${noteCount}, Stamps=${stampCount}`);
        
        // First update related records
        if (pageCount > 0) {
          console.log(`Updating ${pageCount} pages...`);
          await prisma.page.updateMany({
            where: { documentId: doc.id },
            data: { documentId: doc.archiveId }
          });
        }
        
        if (noteCount > 0) {
          console.log(`Updating ${noteCount} handwritten notes...`);
          await prisma.handwrittenNote.updateMany({
            where: { documentId: doc.id },
            data: { documentId: doc.archiveId }
          });
        }
        
        if (stampCount > 0) {
          console.log(`Updating ${stampCount} document stamps...`);
          await prisma.documentStamp.updateMany({
            where: { documentId: doc.id },
            data: { documentId: doc.archiveId }
          });
        }
        
        // Now update the document itself 
        console.log(`Updating document ID from ${doc.id} to ${doc.archiveId}`);
        await prisma.document.update({
          where: { id: doc.id },
          data: { id: doc.archiveId }
        });
        
        console.log(`Successfully updated document ID from ${doc.id} to ${doc.archiveId}`);
        successCount++;
        
        if (successCount % 5 === 0) {
          console.log(`Updated ${successCount} documents so far...`);
        }
      } catch (docError) {
        console.error(`Error processing document ${doc.id}:`, docError);
        errorCount++;
      }
    }
    
    console.log(`ID update complete. Successfully updated ${successCount} documents with ${errorCount} errors.`);
    
    // Re-enable foreign key constraints
    await prisma.$executeRaw`SET session_replication_role = 'origin';`;
    console.log('Foreign key constraints re-enabled');
    
  } catch (error) {
    console.error('Error finalizing document IDs:', error);
    // Make sure constraints are re-enabled even if there's an error
    try {
      await prisma.$executeRaw`SET session_replication_role = 'origin';`;
      console.log('Foreign key constraints re-enabled after error');
    } catch (fkError) {
      console.error('Error re-enabling foreign key constraints:', fkError);
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Uncomment the function you want to run
//listAllDocuments();
//countDocuments();
//updateAllDocuments();
finalizeDocumentIds(); 