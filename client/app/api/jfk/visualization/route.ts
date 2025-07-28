import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface EntityMention {
  name: string;
  type: 'person' | 'place' | 'object';
  frequency: number;
}

// Main API handler
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  
  // Parse query parameters
  const query = searchParams.get('q') || '';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '20', 10);
  const hasHandwrittenNotes = searchParams.get('hasHandwrittenNotes') === 'true';
  const hasStamps = searchParams.get('hasStamps') === 'true';
  const dateFrom = searchParams.get('dateFrom') ? new Date(searchParams.get('dateFrom')!) : null;
  const dateTo = searchParams.get('dateTo') ? new Date(searchParams.get('dateTo')!) : null;
  const personName = searchParams.get('person') || '';
  const placeName = searchParams.get('place') || '';
  const objectName = searchParams.get('object') || '';
  try {
    // Build query conditions
    const whereConditions: any = {
      ...(query ? {
        searchText: {
          search: query.split(' ').join(' & ')
        }
      } : {}),
      ...(hasHandwrittenNotes ? { hasHandwrittenNotes: true } : {}),
      ...(hasStamps ? { hasStamps: true } : {}),
      ...(dateFrom || dateTo ? {
        AND: [
          ...(dateFrom ? [{ earliestDate: { gte: dateFrom } }] : []),
          ...(dateTo ? [{ latestDate: { lte: dateTo } }] : [])
        ]
      } : {}),
      ...(personName ? { allNames: { has: personName } } : {}),
      ...(placeName ? { allPlaces: { has: placeName } } : {}),
      ...(objectName ? { allObjects: { has: objectName } } : {})
    };
    
    // Execute the database query
    const documents = await prisma.document.findMany({
      where: whereConditions,
      select: {
        id: true,
        title: true,
        summary: true,
        documentUrl: true,
        archiveId: true,
        earliestDate: true,
        latestDate: true,
        allNames: true,
        allPlaces: true,
        allObjects: true,
        document: true,
        pageCount: true,
        hasHandwrittenNotes: true,
        hasStamps: true,
        pages: {
          select: {
            id: true,
            pageNumber: true,
            summary: true,
            imagePath: true
          }
        }
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: {
        // Order by relevance if search query provided, otherwise by date
        ...(query ? { searchText: { sort: 'desc', nulls: 'last' } } : 
                   { earliestDate: { sort: 'desc', nulls: 'last' } })
      }
    });
    
    // Get total count for pagination
    const totalCount = await prisma.document.count({
      where: whereConditions
    });
    
    // Transform documents to format expected by Chronosphere
    const formattedDocuments = documents.map(doc => {
      // Extract people and places with frequencies
      const people: EntityMention[] = [];
      const places: EntityMention[] = [];
      const objects: EntityMention[] = [];
      // We can't process entities from pages as they don't exist in our schema
      // Instead, just use allNames and allPlaces
      if (Array.isArray(doc.allNames)) {
        doc.allNames.forEach((name) => {
          people.push({
            name,
            type: 'person',
            frequency: 1
          });
        });
      }
      
      if (Array.isArray(doc.allPlaces)) {
        doc.allPlaces.forEach((place) => {
          places.push({
            name: place,
            type: 'place',
            frequency: 1
          });
        });
      }

      if (Array.isArray(doc.allObjects)) {
        doc.allObjects.forEach((object) => {
          objects.push({
            name: object,
            type: 'object',
            frequency: 1
          });
        });
      }
      
      // Extract date
      let date: string = '';
      if (doc.earliestDate) {
        date = doc.earliestDate.toISOString().split('T')[0];
      }
      
      // Extract agency from document JSON if available
      let agency: string = '';
      if (doc.document && typeof doc.document === 'object') {
        const docData = doc.document as any;
        if (docData.agency) {
          agency = docData.agency;
        } else if (docData.metadata && docData.metadata.agency) {
          agency = docData.metadata.agency;
        }
      }
      
      // Extract keywords from document content or summary after first adding the objects to the beginning of the keywords array
      // let keywords: string[] = [];
      // let keywords: string[] = objects.map(object => object.name);
      let keywords: string[] = ['hello'];

      // if (doc.summary) {
      //   // Simple keyword extraction without using Set
      //   const wordMap: Record<string, boolean> = {};
      //   doc.summary.split(/\s+/)
      //     .filter(word => word.length > 5)
      //     .map(word => word.toLowerCase())
      //     .filter(word => !['document', 'includes', 'information', 'regarding'].includes(word))
      //     .forEach(word => {
      //       wordMap[word] = true;
      //     });
        
      //   keywords = Object.keys(wordMap).slice(0, 10);
      // }

      

      
      // Create the content URL for accessing the document
      const contentUrl = `/jfk-files/${doc.id}`;
      
      return {
        id: doc.id,
        title: doc.title || `Document ${doc.id}`,
        date,
        agency,
        summary: doc.summary || '',
        people,
        places,
        objects,
        keywords,
        contentUrl,
        nodeType: 'document',
        pageCount: doc.pageCount || 0
      };
    });
    
    return NextResponse.json({
      documents: formattedDocuments,
      count: totalCount,
      status: 'success',
      isSampleData: false,
      message: 'Using real JFK document data from database',
      serverTime: new Date().toISOString(),
      pagination: {
        total: totalCount,
        page,
        limit,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error("Error fetching visualization data:", error);
    return NextResponse.json(
      { 
        error: "Failed to fetch visualization data",
        details: String(error),
        status: 'error'
      },
      { status: 500 }
    );
  }
} 