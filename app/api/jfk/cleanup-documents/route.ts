import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Cleanup endpoint to delete documents with incorrect IDs (.pdf extension)
 * This is a one-time cleanup function to remove documents created with the wrong ID format
 */
export async function DELETE(request: Request) {
  try {
    console.log('Starting cleanup of documents with incorrect IDs');
    
    // Get all documents where ID or archiveId contains ".pdf"
    const docsWithPdfExtension = await prisma.document.findMany({
      where: {
        OR: [
          { 
            id: { 
              contains: '.pdf' 
            } 
          },
          { 
            archiveId: { 
              contains: '.pdf' 
            } 
          }
        ]
      },
      select: {
        id: true,
        archiveId: true,
        title: true
      }
    });
    
    console.log(`Found ${docsWithPdfExtension.length} documents with .pdf extension`);
    
    if (docsWithPdfExtension.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No documents with .pdf extension found',
        docsDeleted: 0
      });
    }
    
    // Delete all documents with .pdf extension
    const result = await prisma.document.deleteMany({
      where: {
        OR: [
          { 
            id: { 
              contains: '.pdf' 
            } 
          },
          { 
            archiveId: { 
              contains: '.pdf' 
            } 
          }
        ]
      }
    });
    
    console.log(`Deleted ${result.count} documents with .pdf extension`);
    
    // Return success response with deleted document details
    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${result.count} documents with .pdf extension`,
      docsDeleted: result.count,
      deletedDocs: docsWithPdfExtension
    });
    
  } catch (error) {
    console.error('Error cleaning up documents:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to clean up documents',
      error: String(error)
    }, { status: 500 });
  }
} 