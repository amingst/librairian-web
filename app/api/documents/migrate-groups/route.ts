import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST() {
  try {
    console.log('Running document group migration...');
    
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
    
    // Set any remaining documents to 'jfk' as default
    const defaultResult = await prisma.document.updateMany({
      where: {
        documentGroup: null
      },
      data: {
        documentGroup: 'jfk'
      }
    });
    
    // Update document JSON as well
    // Get all documents without documentGroup in their JSON
    const documents = await prisma.document.findMany({
      select: {
        id: true,
        document: true,
        documentType: true,
        documentGroup: true
      }
    });
    
    let updatedJsonCount = 0;
    
    for (const doc of documents) {
      const documentObj = doc.document as any;
      
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
      
      updatedJsonCount++;
    }
    
    return NextResponse.json({
      success: true,
      message: `Migration complete: Updated ${jfkResult.count} JFK docs, ${rfkResult.count} RFK docs, ${rfkInIdResult.count} docs with 'rfk' in ID, ${defaultResult.count} default docs, and ${updatedJsonCount} document JSON records.`
    });
  } catch (error) {
    console.error('Error during migration:', error);
    return NextResponse.json({ 
      success: false, 
      message: `Migration failed: ${error instanceof Error ? error.message : String(error)}` 
    }, { status: 500 });
  }
} 