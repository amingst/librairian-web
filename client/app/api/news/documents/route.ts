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
		const sourceId = url.searchParams.get('sourceId');

		console.log(
			`[NEWS ARTICLES API] Fetching news articles with limit: ${limit}, offset: ${offset}, sourceId: ${sourceId}`
		);

		// Build where clause
		const whereClause: any = {};
		if (sourceId) {
			whereClause.sourceId = sourceId;
		}

		// Fetch news articles from database
		const articles = await prisma.newsArticle.findMany({
			where: whereClause,
			include: {
				source: true,
				media: true,
			},
			orderBy: {
				publishedAt: 'desc',
			},
			take: limit,
			skip: offset,
		});

		// Get total count for pagination
		const totalCount = await prisma.newsArticle.count({
			where: whereClause,
		});

		console.log(
			`[NEWS ARTICLES API] Found ${articles.length} news articles (${totalCount} total)`
		);

		// Transform articles to match expected format for compatibility
		const documents = articles.map((article) => ({
			id: article.id,
			title: article.title,
			url: article.url,
			summary: article.summary,
			fullText: article.fullText,
			publishedAt: article.publishedAt,
			source: article.source,
			media: article.media,
			// For backward compatibility with existing UI
			documentUrl: article.url,
			processingDate: article.publishedAt,
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
		console.error('[NEWS ARTICLES API] Error fetching articles:', error);
		return NextResponse.json(
			{
				error: 'Failed to fetch news articles',
				status: 'error',
				details: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 }
		);
	}
}
