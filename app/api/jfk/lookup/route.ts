import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';
import crypto from 'crypto';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const documentId = searchParams.get('id');
  
  if (!documentId) {
    return NextResponse.json(
      { error: 'id parameter is required' },
      { status: 400 }
    );
  }
  
  try {
    // Test database connection
    try {
      console.log(`Testing database connection for document ID lookup: ${documentId}`);
      await prisma.$queryRaw`SELECT 1`;
      console.log('Database connection successful');
    } catch (dbError) {
      console.error('Database connection error:', dbError);
      return NextResponse.json(
        { 
          error: 'Database connection failed', 
          details: dbError instanceof Error ? dbError.message : 'Unknown database error'
        },
        { status: 500 }
      );
    }
    
    // Try to find the document directly by its ID first
    const document = await prisma.document.findUnique({
      where: { id: documentId }
    });
    
    // If found by direct match, return it
    if (document) {
      console.log(`Found document with direct ID match: ${documentId}`);
      
      // Get document stamps separately
      const documentStamps = await prisma.documentStamp.findMany({
        where: { documentId: document.id }
      });
      
      // Return the document with its stamps
      return NextResponse.json({
        ...document,
        documentStamps
      });
    }
    
    // If not found, compute the hash of the document URL and try to find it that way
    console.log(`Document not found with direct ID: ${documentId}, trying hashed lookup`);
    
    // Create the URL that would have been hashed
    const url = `https://www.archives.gov/files/research/jfk/releases/2025/0318/${documentId}.pdf`;
    
    // Calculate MD5 hash
    const md5Hash = crypto.createHash('md5').update(url).digest('hex');
    
    console.log(`Looking for document with ID = ${md5Hash} (raw hash)`);
    
    // First try the raw hash without any prefixes (just the hash value itself)
    const rawHashDocument = await prisma.document.findUnique({
      where: { id: md5Hash }
    });
    
    if (rawHashDocument) {
      console.log(`Found document with raw hash ID: ${md5Hash}`);
      
      // Get document stamps separately
      const documentStamps = await prisma.documentStamp.findMany({
        where: { documentId: rawHashDocument.id }
      });
      
      // Return the document with its stamps
      return NextResponse.json({
        ...rawHashDocument,
        documentStamps,
        originalId: documentId,
        isHashedId: true,
        sourceUrl: url
      });
    }
    
    // Try prefixed versions (id- and docId-)
    console.log(`Looking for document with id-${md5Hash} or docId-${md5Hash}`);
    
    const hashedDocuments = await prisma.$queryRaw`
      SELECT * FROM "Document"
      WHERE id LIKE ${'id-' + md5Hash + '%'}
      OR id LIKE ${'docId-' + md5Hash + '%'} 
      LIMIT 1
    `;
    
    if (Array.isArray(hashedDocuments) && hashedDocuments.length > 0) {
      const hashedDocument = hashedDocuments[0];
      console.log(`Found document by hash prefix: ${hashedDocument.id}`);
      
      // Get document stamps separately
      const documentStamps = await prisma.documentStamp.findMany({
        where: { documentId: hashedDocument.id }
      });
      
      // Return the document with its stamps
      return NextResponse.json({
        ...hashedDocument,
        documentStamps,
        originalId: documentId, // Include the original ID that was requested
        isHashedId: true, // Flag to indicate this was found via hash
        sourceUrl: url // Include the source URL
      });
    }
    
    // Calculate SHA-256 hash
    const sha256Hash = crypto.createHash('sha256').update(url).digest('hex');
    
    // Try raw SHA-256 hash
    console.log(`Looking for document with ID = ${sha256Hash} (raw SHA-256 hash)`);
    
    const rawSha256Document = await prisma.document.findUnique({
      where: { id: sha256Hash }
    });
    
    if (rawSha256Document) {
      console.log(`Found document with raw SHA-256 hash ID: ${sha256Hash}`);
      
      // Get document stamps separately
      const documentStamps = await prisma.documentStamp.findMany({
        where: { documentId: rawSha256Document.id }
      });
      
      // Return the document with its stamps
      return NextResponse.json({
        ...rawSha256Document,
        documentStamps,
        originalId: documentId,
        isHashedId: true,
        sourceUrl: url
      });
    }
    
    // Try prefixed SHA-256 hash
    console.log(`Looking for document with id-${sha256Hash} or docId-${sha256Hash}`);
    
    const sha256Documents = await prisma.$queryRaw`
      SELECT * FROM "Document"
      WHERE id LIKE ${'id-' + sha256Hash + '%'}
      OR id LIKE ${'docId-' + sha256Hash + '%'}
      LIMIT 1
    `;
    
    if (Array.isArray(sha256Documents) && sha256Documents.length > 0) {
      const hashedDocument = sha256Documents[0];
      console.log(`Found document by SHA-256 hash prefix: ${hashedDocument.id}`);
      
      // Get document stamps separately
      const documentStamps = await prisma.documentStamp.findMany({
        where: { documentId: hashedDocument.id }
      });
      
      // Return the document with its stamps
      return NextResponse.json({
        ...hashedDocument,
        documentStamps,
        originalId: documentId, // Include the original ID that was requested
        isHashedId: true, // Flag to indicate this was found via hash
        sourceUrl: url // Include the source URL
      });
    }
    
    // If still not found, try other hash algorithms or hash variants
    // For example, the URL might have been constructed differently
    const alternativeUrls = [
      `https://www.archives.gov/files/research/jfk/releases/${documentId}.pdf`,
      `https://www.archives.gov/files/research/jfk/${documentId}.pdf`,
      `https://archives.gov/files/research/jfk/releases/2025/0318/${documentId}.pdf`
    ];
    
    for (const altUrl of alternativeUrls) {
      const altMd5Hash = crypto.createHash('md5').update(altUrl).digest('hex');
      
      console.log(`Trying alternative URL: ${altUrl}`);
      
      // Try raw hash for alternative URL
      console.log(`Looking for document with ID = ${altMd5Hash} (raw hash of alternative URL)`);
      
      const altRawHashDocument = await prisma.document.findUnique({
        where: { id: altMd5Hash }
      });
      
      if (altRawHashDocument) {
        console.log(`Found document with raw hash of alternative URL: ${altMd5Hash}`);
        
        // Get document stamps separately
        const documentStamps = await prisma.documentStamp.findMany({
          where: { documentId: altRawHashDocument.id }
        });
        
        // Return the document with its stamps
        return NextResponse.json({
          ...altRawHashDocument,
          documentStamps,
          originalId: documentId,
          isHashedId: true,
          sourceUrl: altUrl
        });
      }
      
      // Try prefixed hash for alternative URL
      console.log(`Looking for document with id-${altMd5Hash} or docId-${altMd5Hash}`);
      
      const altHashedDocuments = await prisma.$queryRaw`
        SELECT * FROM "Document"
        WHERE id LIKE ${'id-' + altMd5Hash + '%'}
        OR id LIKE ${'docId-' + altMd5Hash + '%'} 
        LIMIT 1
      `;
      
      if (Array.isArray(altHashedDocuments) && altHashedDocuments.length > 0) {
        const hashedDocument = altHashedDocuments[0];
        console.log(`Found document by hash prefix of alternative URL: ${hashedDocument.id}`);
        
        // Get document stamps separately
        const documentStamps = await prisma.documentStamp.findMany({
          where: { documentId: hashedDocument.id }
        });
        
        // Return the document with its stamps
        return NextResponse.json({
          ...hashedDocument,
          documentStamps,
          originalId: documentId,
          isHashedId: true,
          sourceUrl: altUrl
        });
      }
    }
    
    // Try a broader search (search in all document IDs to find partial matches)
    console.log(`No exact matches found, trying broader search for partial match...`);
    
    const partialMatches = await prisma.$queryRaw`
      SELECT id FROM "Document" 
      WHERE id LIKE ${`%${md5Hash.substring(0, 8)}%`}
      LIMIT 5
    `;
    
    if (Array.isArray(partialMatches) && partialMatches.length > 0) {
      console.log(`Found some potential partial matches:`);
      partialMatches.forEach((match: any) => console.log(`- ${match.id}`));
    }
    
    console.log(`No document found with ID: ${documentId}, after trying multiple hash lookups`);
    return NextResponse.json(
      { 
        error: `No document found with ID ${documentId}`,
        searchedPatterns: [
          `Direct ID: ${documentId}`,
          `Raw MD5 hash: ${md5Hash}`,
          `id-${md5Hash}...`,
          `docId-${md5Hash}...`,
          `Raw SHA-256 hash: ${sha256Hash}`,
          `id-${sha256Hash}...`,
          `docId-${sha256Hash}...`,
          // Include alternative URL hashes for debugging
          ...alternativeUrls.map(url => `MD5(${url})`)
        ]
      },
      { status: 404 }
    );
  } catch (error) {
    console.error(`Error looking up document: ${error}`);
    return NextResponse.json(
      { 
        error: 'Failed to lookup document',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  } finally {
    try {
      await prisma.$disconnect();
      console.log('Database disconnected successfully');
    } catch (disconnectError) {
      console.error('Error disconnecting from database:', disconnectError);
    }
  }
} 