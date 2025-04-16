import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  // Get query parameters
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q') || '';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '10', 10);
  const hasHandwrittenNotes = searchParams.get('hasHandwrittenNotes') === 'true';
  const hasStamps = searchParams.get('hasStamps') === 'true';
  const dateFrom = searchParams.get('dateFrom') ? new Date(searchParams.get('dateFrom')!) : null;
  const dateTo = searchParams.get('dateTo') ? new Date(searchParams.get('dateTo')!) : null;

  try {
    // Build the filter conditions
    const whereConditions = {
      ...(query ? {
        // Use PostgreSQL full-text search when a query is provided
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
      } : {})
    };
    
    // Execute the search query
    const results = await prisma.document.findMany({
      where: whereConditions,
      select: {
        id: true,
        title: true,
        summary: true,
        documentUrl: true,
        earliestDate: true,
        latestDate: true,
        hasHandwrittenNotes: true,
        hasStamps: true,
        hasFullText: true,
        pageCount: true
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: {
        // Order by relevance if search query provided, otherwise by date
        ...(query ? { searchText: { sort: 'desc', nulls: 'last' } } : 
                   { earliestDate: { sort: 'desc', nulls: 'last' } })
      }
    });
    
    // Get the total count for pagination
    const totalCount = await prisma.document.count({
      where: whereConditions
    });
    
    return NextResponse.json({
      results,
      pagination: {
        total: totalCount,
        page,
        limit,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'Failed to execute search' },
      { status: 500 }
    );
  }
} 