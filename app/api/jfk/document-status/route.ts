import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

// Create Prisma client with connection handling
let prisma: PrismaClient;

try {
  prisma = new PrismaClient();
  console.log('[DOCUMENT STATUS API] Prisma client initialized');
} catch (e) {
  console.error('[DOCUMENT STATUS API] Error initializing Prisma client:', e);
  prisma = {} as PrismaClient; // Placeholder to prevent runtime errors
}

export async function GET(request: Request) {
  try {
    // Check if we have a valid Prisma instance
    if (!prisma.document) {
      console.error('[DOCUMENT STATUS API] Prisma client not properly initialized');
      return NextResponse.json({ 
        error: "Database client initialization failed",
        status: 'error',
        databaseError: true
      }, { status: 500 });
    }
    
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const size = parseInt(searchParams.get('size') || '50');
    const documentId = searchParams.get('documentId');
    
    // Check authorization header (required in production only)
    const authHeader = request.headers.get('authorization');
    const isProduction = process.env.NODE_ENV === 'production';
    
    // In production, require authentication
    if (isProduction && !authHeader) {
      console.log('[DOCUMENT STATUS API] Auth required but missing in production mode');
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    } else if (!isProduction) {
      console.log('[DOCUMENT STATUS API] Development mode, bypassing auth check');
    }
    
    // Check database connection
    try {
      await prisma.$queryRaw`SELECT 1`;
      console.log('[DOCUMENT STATUS API] Database connection verified');
    } catch (dbError) {
      console.error('[DOCUMENT STATUS API] Database connection failed:', dbError);
      return NextResponse.json({
        error: "Failed to connect to database",
        details: String(dbError),
        status: 'error',
        databaseConnectionError: true
      }, { status: 500 });
    }

    // If a specific document ID is requested, return just that document
    if (documentId) {
      const document = await prisma.document.findFirst({
        where: {
          OR: [
            { id: documentId },
            { archiveId: documentId },
            { oldId: documentId }
          ]
        },
        include: {
          pages: {
            select: { id: true }
          }
        }
      });

      if (!document) {
        return NextResponse.json({
          error: "Document not found",
          status: 'error'
        }, { status: 404 });
      }

      return NextResponse.json({
        document,
        status: 'success'
      });
    }

    // Calculate pagination
    const skip = (page - 1) * size;
    
    // Get total count first
    const totalCount = await prisma.document.count();
    const totalPages = Math.ceil(totalCount / size);

    // Get paginated documents with their relationships
    const documents = await prisma.document.findMany({
      skip,
      take: size,
      orderBy: {
        id: 'asc'
      },
      include: {
        pages: {
          select: { id: true }
        }
      }
    });

    // Transform documents to include required fields
    const transformedDocuments = documents.map(doc => {
      const docJson = doc.document as any;
      return {
        id: doc.id,
        status: docJson?.analysisComplete ? 'ready' : 'waitingForAnalysis',
        stages: docJson?.completedSteps || [],
        lastUpdated: doc.updatedAt.toISOString(),
        pageCount: doc.pageCount || doc.pages?.length || 0,
        allNames: doc.allNames || [],
        allPlaces: doc.allPlaces || [],
        allDates: doc.allDates || [],
        allObjects: doc.allObjects || [],
        processingStatus: docJson?.processingStage || null
      };
    });

    return NextResponse.json({
      documents: transformedDocuments,
      totalCount,
      totalPages,
      currentPage: page,
      pageSize: size,
      status: 'success',
      serverTime: new Date().toISOString(),
      environment: process.env.NODE_ENV
    });

  } catch (error) {
    console.error("[DOCUMENT STATUS API] Global error:", error);
    return NextResponse.json(
      { 
        error: "Failed to fetch documents",
        details: String(error),
        status: 'error',
        serverTime: new Date().toISOString(),
        environment: process.env.NODE_ENV
      },
      { status: 500 }
    );
  }
} 