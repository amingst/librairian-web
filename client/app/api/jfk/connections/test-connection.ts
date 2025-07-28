// This file is just for testing the database connection

import { PrismaClient } from '@prisma/client';

// Initialize Prisma client
const prisma = new PrismaClient();

// Function to test document lookup
async function testDocumentLookup(documentId: string) {
  try {
    console.log(`Looking up document with ID: ${documentId}`);
    
    const document = await prisma.document.findUnique({
      where: {
        id: documentId
      },
      select: {
        id: true,
        title: true,
        allNames: true,
        allPlaces: true,
        allObjects: true
      }
    });
    
    if (document) {
      console.log('Document found:', document);
      return true;
    } else {
      console.log('Document not found');
      return false;
    }
  } catch (error) {
    console.error('Error looking up document:', error);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

// Export the test function
export { testDocumentLookup }; 