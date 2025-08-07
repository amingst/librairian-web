import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function getPosts(limit: number = 50) {
	try {
		const posts = await prisma.post.findMany({
			take: limit,
			orderBy: {
				id: 'desc', // Using ID as a proxy for most recent since no timestamp
			},
		});

		return {
			success: true,
			posts,
			count: posts.length,
		};
	} catch (error) {
		console.error('Error fetching posts:', error);
		return {
			success: false,
			posts: [],
			count: 0,
			error: error instanceof Error ? error.message : 'Unknown error',
		};
	}
}
