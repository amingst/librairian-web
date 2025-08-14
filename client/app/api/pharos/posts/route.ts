import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
// Global Prisma client singleton to prevent connection pool issues
const globalForPrisma = globalThis as unknown as {
	prisma: PrismaClient | undefined;
};
const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function GET(request: NextRequest) {
	try {
		// Get limit from query params, default to 50
		const searchParams = request.nextUrl.searchParams;
		const limit = parseInt(searchParams.get('limit') || '50', 10);

		// Get posts from database
		const posts = await prisma.post.findMany({
			take: limit,
			orderBy: {
				id: 'desc', // Using ID as a proxy for most recent since no timestamp
			},
			include: {
				source: true, // Include source information
			},
		});

		console.log(posts[0]);

		return NextResponse.json({
			success: true,
			posts,
			count: posts.length,
		});
	} catch (error) {
		console.error('Error fetching posts:', error);
		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
			},
			{ status: 500 }
		);
	}
}
