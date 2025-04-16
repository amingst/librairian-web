// This script clears oldId and archiveId fields from all documents 
// to prevent duplicate documents from appearing in visualizations

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clearDuplicateIdFields() {
  console.log('Starting to clear oldId and archiveId fields from all documents...');
  
  try {
    // Get total count first
    const totalCount = await prisma.document.count();
    console.log(`Found ${totalCount} documents in the database`);
    
    // Update all documents to set oldId and archiveId to null
    const result = await prisma.document.updateMany({
      data: {
        oldId: null,
        archiveId: null
      }
    });
    
    console.log(`Successfully cleared oldId and archiveId fields from ${result.count} documents`);
    console.log('This should resolve the issue with duplicate documents appearing in visualizations');
    
    return result.count;
  } catch (error) {
    console.error('Error clearing document IDs:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the function if this script is executed directly
if (require.main === module) {
  clearDuplicateIdFields()
    .then(count => {
      console.log(`Operation completed successfully. Updated ${count} documents.`);
      process.exit(0);
    })
    .catch(error => {
      console.error('Script failed:', error);
      process.exit(1);
    });
} else {
  // If imported as a module, export the function
  module.exports = clearDuplicateIdFields;
} 