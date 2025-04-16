const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findRemainingBrokenDocuments() {
  try {
    console.log("Finding all documents that need repair...");
    
    // Find all documents
    const documents = await prisma.document.findMany({
      select: {
        id: true,
        archiveId: true,
        document: true,
        pageCount: true,
        pages: { select: { id: true } }
      }
    });
    
    console.log(`Found ${documents.length} total documents in database`);
    
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
    
    console.log(`Found ${brokenDocs.length} broken documents that still need repair`);
    
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
    
    // Output the list of broken document IDs
    console.log("Broken document IDs:");
    brokenDocs.forEach((doc, index) => {
      console.log(`${index + 1}. ${doc.id}`);
    });
    
  } catch (error) {
    console.error("Error finding broken documents:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the search
findRemainingBrokenDocuments(); 