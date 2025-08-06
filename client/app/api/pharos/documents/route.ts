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
		const sourceFilter = url.searchParams.get('source');

		console.log(
			`[PHAROS ARTICLES API] Fetching posts with limit: ${limit}, offset: ${offset}, source: ${sourceFilter}`
		);

		// Build where clause
		const whereClause: any = {};
		if (sourceFilter) {
			whereClause.bylineWritersLocation = {
				contains: sourceFilter,
				mode: 'insensitive',
			};
		}

		// Fetch posts from database
		const posts = await prisma.post.findMany({
			where: whereClause,
			orderBy: {
				webUrl: 'desc',
			},
			take: limit,
			skip: offset,
		});

		// Get total count for pagination
		const totalCount = await prisma.post.count({
			where: whereClause,
		});

		console.log(
			`[PHAROS ARTICLES API] Found ${posts.length} posts (${totalCount} total)`
		);

		// Transform posts to match expected format for compatibility
		const documents = posts.map((post) => ({
			id: post.id,
			title: post.articleText?.split('\n')[0] || 'Untitled',
			url: post.webUrl,
			summary: post.articleText?.substring(0, 200) + '...' || '',
			fullText: post.articleText,
			publishedAt: null, // Post model doesn't have this field
			source: {
				name: post.bylineWritersLocation || 'Unknown',
				id: post.bylineWritersLocation || 'unknown',
			},
			media: post.featuredImage ? [{ url: post.featuredImage }] : [],
			// For backward compatibility with existing UI
			documentUrl: post.webUrl,
			processingDate: null,
			// Additional Post fields
			bylineWriter: post.bylineWriter,
			bylineWritersTitle: post.bylineWritersTitle,
			bylineWritersLocation: post.bylineWritersLocation,
			featuredImage: post.featuredImage,
			imageItems: post.imageItems,
			videoItems: post.videoItems,
			audioItems: post.audioItems,
		}));

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
		console.error('[PHAROS ARTICLES API] Error fetching posts:', error);
		return NextResponse.json(
			{
				error: 'Failed to fetch pharos posts',
				status: 'error',
				details: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 }
		);
	}
}
