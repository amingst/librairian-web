import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

// Global Prisma client singleton to prevent connection pool issues
const globalForPrisma = globalThis as unknown as {
	prisma: PrismaClient | undefined;
};

const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function GET(request: Request) {
	try {
		const url = new URL(request.url);
		const limit = parseInt(url.searchParams.get('limit') || '100');
		const offset = parseInt(url.searchParams.get('offset') || '0');
		const documentGroup = url.searchParams.get('group');

		console.log(
			`[NEWS DOCUMENTS API] Fetching news documents with limit: ${limit}, offset: ${offset}`
		);

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

		console.log(
			`[NEWS DOCUMENTS API] Found ${documents.length} news documents (${totalCount} total)`
		);

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
