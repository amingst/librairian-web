import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

// Create Prisma client
let prisma: PrismaClient;

try {
	prisma = new PrismaClient();
	console.log('[NEWS DOCUMENTS API] Prisma client initialized');
} catch (e) {
	console.error('[NEWS DOCUMENTS API] Error initializing Prisma client:', e);
	prisma = {} as PrismaClient;
}

export async function GET(request: Request) {
	try {
		// Check if we have a valid Prisma instance
		if (!prisma.document) {
			console.error('[NEWS DOCUMENTS API] Prisma client not properly initialized');
			return NextResponse.json(
				{
					error: 'Database client initialization failed',
					status: 'error',
					databaseError: true,
				},
				{ status: 500 }
			);
		}

		const url = new URL(request.url);
		const limit = parseInt(url.searchParams.get('limit') || '100');
		const offset = parseInt(url.searchParams.get('offset') || '0');
		const documentGroup = url.searchParams.get('group');

		console.log(`[NEWS DOCUMENTS API] Fetching news documents with limit: ${limit}, offset: ${offset}`);

		// Build where clause
		const whereClause: any = {
			documentGroup: documentGroup || 'news', // Default to 'news' group
		};

		// Fetch news documents from database
		const documents = await prisma.document.findMany({
			where: whereClause,
			orderBy: {
				processingDate: 'desc',
			},
			take: limit,
			skip: offset,
		});

		// Get total count for pagination
		const totalCount = await prisma.document.count({
			where: whereClause,
		});

		console.log(`[NEWS DOCUMENTS API] Found ${documents.length} news documents (${totalCount} total)`);

		return NextResponse.json({
			status: 'success',
			documents,
			pagination: {
				limit,
				offset,
				total: totalCount,
				hasMore: offset + documents.length < totalCount,
			},
		});

	} catch (error) {
		console.error('[NEWS DOCUMENTS API] Error fetching documents:', error);
		return NextResponse.json(
			{
				error: 'Failed to fetch news documents',
				status: 'error',
				details: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 }
		);
	}
}
