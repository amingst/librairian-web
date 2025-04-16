const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteMultirifDocuments() {
  try {
    console.log("Finding all multirif documents to delete...");
    
    // Find all documents with multirif in their ID
    const documents = await prisma.document.findMany({
      select: {
        id: true,
        archiveId: true,
      },
      where: {
        OR: [
          { id: { contains: '_multirif' } },
          { archiveId: { contains: '_multirif' } }
        ]
      }
    });
    
    console.log(`Found ${documents.length} multirif documents in database`);
    
    if (documents.length === 0) {
      console.log("No multirif documents found!");
      return;
    }
    
    console.log("Documents to be deleted:");
    documents.forEach((doc, index) => {
      console.log(`${index + 1}. ${doc.id}`);
    });
    
    console.log("\nDeleting documents...");
    
    let successCount = 0;
    let failureCount = 0;
    
    // Delete each document and its relationships
    for (const doc of documents) {
      try {
        // First delete related records in other tables
        console.log(`Deleting relationships for document ${doc.id}...`);
        
        // Delete document pages
        await prisma.page.deleteMany({
          where: { documentId: doc.id }
        });
        
        // Delete handwritten notes
        await prisma.handwrittenNote.deleteMany({
          where: { documentId: doc.id }
        });
        
        // Delete document stamps
        await prisma.documentStamp.deleteMany({
          where: { documentId: doc.id }
        });
        
        // Now delete the document itself
        console.log(`Deleting document ${doc.id}...`);
        await prisma.document.delete({
          where: { id: doc.id }
        });
        
        console.log(`Successfully deleted document ${doc.id}`);
        successCount++;
      } catch (error) {
        console.error(`Failed to delete document ${doc.id}:`, error);
        failureCount++;
      }
    }
    
    console.log("\n==========================");
    console.log(`Deletion complete! Successfully deleted ${successCount}/${documents.length} documents.`);
    console.log(`Failed: ${failureCount}`);
    console.log("==========================\n");
  } catch (error) {
    console.error("Error in deleteMultirifDocuments:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the deletion
deleteMultirifDocuments(); 