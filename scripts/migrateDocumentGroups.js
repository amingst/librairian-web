const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrateDocumentGroups() {
  console.log('Migrating document groups for existing documents...');
  
  // Count documents
  const totalCount = await prisma.document.count();
  console.log(`Found ${totalCount} documents to check`);
  
  // Update JFK documents
  const jfkResult = await prisma.document.updateMany({
    where: {
      documentType: 'jfk',
      documentGroup: null
    },
    data: {
      documentGroup: 'jfk'
    }
  });
  console.log(`Updated ${jfkResult.count} JFK documents`);
  
  // Update RFK documents
  const rfkResult = await prisma.document.updateMany({
    where: {
      documentType: 'rfk',
      documentGroup: null
    },
    data: {
      documentGroup: 'rfk'
    }
  });
  console.log(`Updated ${rfkResult.count} RFK documents`);
  
  // Update any documents with 'rfk' in ID but no documentType set
  const rfkInIdResult = await prisma.document.updateMany({
    where: {
      id: {
        contains: 'rfk',
        mode: 'insensitive'
      },
      documentType: null,
      documentGroup: null
    },
    data: {
      documentType: 'rfk',
      documentGroup: 'rfk'
    }
  });
  console.log(`Updated ${rfkInIdResult.count} documents with 'rfk' in ID`);
  
  // Set any remaining documents to 'jfk' as default
  const defaultResult = await prisma.document.updateMany({
    where: {
      documentGroup: null
    },
    data: {
      documentGroup: 'jfk'
    }
  });
  console.log(`Set default group 'jfk' for ${defaultResult.count} documents`);
  
  // Update document JSON as well
  console.log('Updating document JSON records...');
  
  // Get all documents without documentGroup in their JSON
  const documents = await prisma.document.findMany({
    select: {
      id: true,
      document: true,
      documentType: true,
      documentGroup: true
    }
  });
  
  let updatedCount = 0;
  
  for (const doc of documents) {
    const documentObj = doc.document;
    
    // Skip if already has documentGroup
    if (documentObj.documentGroup) continue;
    
    // Determine the correct group
    let group = doc.documentGroup || doc.documentType || 'jfk';
    if (!doc.documentGroup && !doc.documentType && doc.id.toLowerCase().includes('rfk')) {
      group = 'rfk';
    }
    
    // Update the document JSON
    documentObj.documentGroup = group;
    
    // Update in database
    await prisma.document.update({
      where: { id: doc.id },
      data: { document: documentObj }
    });
    
    updatedCount++;
    if (updatedCount % 100 === 0) {
      console.log(`Updated ${updatedCount}/${documents.length} document JSON records`);
    }
  }
  
  console.log(`Updated documentGroup in JSON for ${updatedCount} documents`);
  console.log('Migration complete!');
}

migrateDocumentGroups()
  .catch(e => {
    console.error('Error during migration:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 