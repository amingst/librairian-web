import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/db';

export async function GET(
  request: NextRequest
) {
  const searchParams = request.nextUrl.searchParams;
  const documentId = searchParams.get('documentId');
  
  const response: any = {
    timestamp: new Date().toISOString(),
    dbConnected: false,
    documentCount: 0,
    documentExists: false,
    documentDetails: null,
    sampleDocumentId: null
  };

  try {
    console.log(`Debug endpoint called with documentId: ${documentId || 'none'}`);
    
    // Check if database is connected
    try {
      await prisma.$queryRaw`SELECT 1`;
      response.dbConnected = true;
      console.log('Database connection successful');
    } catch (dbError) {
      console.error('Database connection error:', dbError);
      response.error = {
        message: 'Database connection failed',
        details: dbError instanceof Error ? dbError.message : 'Unknown database error'
      };
      return NextResponse.json(response, { status: 500 });
    }
    
    // Get total document count
    try {
      const documentCount = await prisma.document.count();
      response.documentCount = documentCount;
      console.log(`Total document count: ${documentCount}`);
    } catch (countError) {
      console.error('Error counting documents:', countError);
      response.error = {
        message: 'Failed to count documents',
        details: countError instanceof Error ? countError.message : 'Unknown error'
      };
      // Continue with the rest of the function despite this error
    }
    
    // Check if requested document exists
    if (documentId) {
      try {
        const document = await prisma.document.findUnique({
          where: { id: documentId },
          select: {
            id: true,
            title: true,
            documentType: true,
            pageCount: true,
            allNames: true,
            allPlaces: true,
            allObjects: true,
            createdAt: true
          }
        });
        
        if (document) {
          console.log(`Document ${documentId} found`);
          response.documentExists = true;
          response.documentDetails = document;
        } else {
          console.log(`Document ${documentId} not found`);
        }
      } catch (findError) {
        console.error(`Error finding document ${documentId}:`, findError);
        response.error = {
          message: `Failed to find document ${documentId}`,
          details: findError instanceof Error ? findError.message : 'Unknown error'
        };
        // Continue with the rest of the function despite this error
      }
    }
    
    // Get a sample document ID if no document found
    if (!response.documentExists && response.documentCount > 0) {
      try {
        const sampleDocument = await prisma.document.findFirst({
          select: {
            id: true,
            title: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        });
        
        if (sampleDocument) {
          console.log(`Sample document provided: ${sampleDocument.id}`);
          response.sampleDocumentId = sampleDocument.id;
          response.sampleDocumentTitle = sampleDocument.title;
        }
      } catch (sampleError) {
        console.error('Error finding sample document:', sampleError);
        // Not critical - don't return an error status
      }
    }
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in debug endpoint:', error);
    response.error = {
      message: error instanceof Error ? error.message : 'Unknown database error'
    };
    
    return NextResponse.json(response, { status: 500 });
  } finally {
    try {
      await prisma.$disconnect();
    } catch (disconnectError) {
      console.error('Error disconnecting from database:', disconnectError);
    }
  }
} 