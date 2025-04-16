const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fetch = require('node-fetch');

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.oip.onl';

// The list of document IDs that returned 404 errors from the media server
const DOCUMENT_IDS = [
  '124-10190-10075',
  '124-10276-10400 (c06716411)',
  '124-10273-10289_redacted',
  '124-10185-10099 (c06716626)',
  '124-10274-10011 (c06716583)',
  '194-10002-10203_redacted',
  '104-10326-10014 (c06931192)',
  '104-10105-10290 (C06932214)'
];

async function deleteNonExistentDocument(docId) {
  console.log(`\nDeleting non-existent document ${docId}...`);
  
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
        archiveId: true,
        oldId: true,
        summary: true,
        pages: { select: { id: true } },
        handwrittenNotes: { select: { id: true } },
        documentStamps: { select: { id: true } }
      }
    });
    
    if (!doc) {
      console.log(`Document ${docId} not found in database. Skipping.`);
      return false;
    }
    
    console.log(`Found document ${doc.id} in database:`);
    console.log(`  Archive ID: ${doc.archiveId || 'none'}`);
    console.log(`  Old ID: ${doc.oldId || 'none'}`);
    console.log(`  Summary: ${doc.summary ? 'present' : 'none'}`);
    console.log(`  Pages: ${doc.pages.length}`);
    console.log(`  Handwritten notes: ${doc.handwrittenNotes.length}`);
    console.log(`  Stamps: ${doc.documentStamps.length}`);
    
    // Double-check with the media API to confirm it's truly non-existent
    console.log("Double-checking with media API...");
    
    // Set a timeout for the fetch operation
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30-second timeout
    
    try {
      const mediaApiUrl = `${API_BASE_URL}/api/jfk/media?id=${docId}&type=analysis`;
      const response = await fetch(mediaApiUrl, {
        signal: controller.signal
      });
      
      clearTimeout(timeout);
      
      if (response.ok) {
        console.log("WARNING: Document exists in the media server! Not deleting.");
        return false;
      }
      
      if (response.status !== 404) {
        console.log(`Unexpected status from media API: ${response.status} ${response.statusText}`);
        return false;
      }
      
      console.log("Confirmed document does not exist in media server. Proceeding with deletion.");
      
      // Delete all related records first
      let deletedRelations = 0;
      
      // Delete page records
      if (doc.pages.length > 0) {
        await prisma.page.deleteMany({
          where: { documentId: doc.id }
        });
        console.log(`Deleted ${doc.pages.length} page records`);
        deletedRelations += doc.pages.length;
      }
      
      // Delete handwritten notes
      if (doc.handwrittenNotes.length > 0) {
        await prisma.handwrittenNote.deleteMany({
          where: { documentId: doc.id }
        });
        console.log(`Deleted ${doc.handwrittenNotes.length} handwritten note records`);
        deletedRelations += doc.handwrittenNotes.length;
      }
      
      // Delete stamps
      if (doc.documentStamps.length > 0) {
        await prisma.documentStamp.deleteMany({
          where: { documentId: doc.id }
        });
        console.log(`Deleted ${doc.documentStamps.length} stamp records`);
        deletedRelations += doc.documentStamps.length;
      }
      
      // Now delete the document itself
      await prisma.document.delete({
        where: { id: doc.id }
      });
      
      console.log(`Successfully deleted document ${doc.id} and ${deletedRelations} related records`);
      return true;
    } catch (fetchError) {
      clearTimeout(timeout);
      console.error("Error checking document with media API:", fetchError);
      return false;
    }
  } catch (error) {
    console.error("Error deleting document:", error);
    return false;
  }
}

async function deleteAllNonExistentDocuments() {
  try {
    console.log("Starting deletion of non-existent documents...");
    console.log(`Found ${DOCUMENT_IDS.length} documents to check and potentially delete.`);
    
    let successCount = 0;
    let failureCount = 0;
    
    // Process each document sequentially
    for (const docId of DOCUMENT_IDS) {
      const success = await deleteNonExistentDocument(docId);
      if (success) {
        successCount++;
      } else {
        failureCount++;
      }
    }
    
    console.log('\n==========================');
    console.log(`Deletion complete! Successfully deleted ${successCount}/${DOCUMENT_IDS.length} non-existent documents.`);
    console.log(`Failed: ${failureCount}`);
    console.log('==========================\n');
    
    await prisma.$disconnect();
  } catch (error) {
    console.error("Error in batch deletion:", error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

// Run the batch deletion
deleteAllNonExistentDocuments(); 