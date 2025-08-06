import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
		});

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
