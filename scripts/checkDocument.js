const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Get document ID from command line if provided, otherwise use default
  const docId = process.argv[2] || '104-10170-10051';
  
  try {
    // Find document with all related data
    console.log(`Checking document with ID: ${docId}`);
    const doc = await prisma.document.findFirst({
      where: {
        OR: [
          { id: docId },
        ]
      },
      include: {
        pages: {
          orderBy: { pageNumber: 'asc' }
        },
        handwrittenNotes: true,
        documentStamps: true
      }
    });
    
    if (!doc) {
      console.error(`Document with ID ${docId} not found`);
      return;
    }
    
    // Basic document info
    console.log('\n=== DOCUMENT INFO ===');
    console.log(`ID: ${doc.id}`);
    console.log(`Title: ${doc.title || 'None'}`);
    console.log(`URL: ${doc.documentUrl || 'None'}`);
    console.log(`Processing Stage: ${doc.processingStage || 'Unknown'}`);
    console.log(`Summary: ${doc.summary ? doc.summary.substring(0, 200) + '...' : 'None'}`);
    
    // Page information
    console.log('\n=== PAGES ===');
    console.log(`Total pages: ${doc.pages.length}`);
    doc.pages.forEach((page, index) => {
      if (index < 3) { // Show first 3 pages only to avoid overwhelming output
        console.log(`\nPage ${page.pageNumber}:`);
        console.log(`  Image path: ${page.imagePath}`);
        console.log(`  Has text: ${page.hasText}`);
        console.log(`  Summary: ${page.summary ? page.summary.substring(0, 100) + '...' : 'None'}`);
      }
    });
    
    if (doc.pages.length > 3) {
      console.log(`\n... and ${doc.pages.length - 3} more pages`);
    }
    
    // Handwritten notes
    console.log('\n=== HANDWRITTEN NOTES ===');
    console.log(`Total notes: ${doc.handwrittenNotes.length}`);
    doc.handwrittenNotes.forEach((note, index) => {
      if (index < 3) { // Show first 3 notes only
        console.log(`\nNote ${index + 1} (Page ${note.pageNumber}):`);
        console.log(`  Content: ${note.content.substring(0, 100)}${note.content.length > 100 ? '...' : ''}`);
        console.log(`  Location: ${note.location || 'Not specified'}`);
      }
    });
    
    if (doc.handwrittenNotes.length > 3) {
      console.log(`\n... and ${doc.handwrittenNotes.length - 3} more notes`);
    }
    
    // Document stamps
    console.log('\n=== DOCUMENT STAMPS ===');
    console.log(`Total stamps: ${doc.documentStamps.length}`);
    doc.documentStamps.forEach((stamp, index) => {
      if (index < 3) { // Show first 3 stamps only
        console.log(`\nStamp ${index + 1} (Page ${stamp.pageNumber}):`);
        console.log(`  Type: ${stamp.type || 'Unknown'}`);
        console.log(`  Text: ${stamp.text}`);
        console.log(`  Date: ${stamp.date || 'None'}`);
      }
    });
    
    if (doc.documentStamps.length > 3) {
      console.log(`\n... and ${doc.documentStamps.length - 3} more stamps`);
    }
    
    // Raw document JSON fields
    console.log('\n=== RAW JSON DOCUMENT FIELD ===');
    const docData = doc.document;
    console.log('Keys in the document field:');
    console.log(Object.keys(docData).join(', '));
    
    console.log('\nCheck if document has important fields:');
    console.log(`Has summary: ${Boolean(docData.summary)}`);
    console.log(`Has pages array: ${Array.isArray(docData.pages)}`);
    console.log(`Pages in JSON: ${Array.isArray(docData.pages) ? docData.pages.length : 0}`);
    console.log(`Has fullText: ${Boolean(docData.fullText)}`);
    console.log(`Has allNames: ${Array.isArray(docData.allNames)}, Count: ${Array.isArray(docData.allNames) ? docData.allNames.length : 0}`);
    console.log(`Has handwrittenNotes: ${Array.isArray(docData.handwrittenNotes)}, Count: ${Array.isArray(docData.handwrittenNotes) ? docData.handwrittenNotes.length : 0}`);
    console.log(`Has stamps: ${Array.isArray(docData.stamps)}, Count: ${Array.isArray(docData.stamps) ? docData.stamps.length : 0}`);
    
  } catch (error) {
    console.error("Error checking document:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the main function
main().catch(err => {
  console.error("Error in main function:", err);
  process.exit(1);
});

// Add usage instructions
console.log('Usage: node checkDocument.js [documentId]');
console.log('Example: node checkDocument.js 104-10170-10051'); 