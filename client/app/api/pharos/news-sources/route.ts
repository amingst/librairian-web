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
		const newsSources = await prisma.newsSource.findMany();
		if (newsSources.length === 0) {
			return NextResponse.json([], {
				status: 404,
				statusText: 'Not Found',
			});
		}
		return NextResponse.json(newsSources, {
			status: 200,
			statusText: 'OK',
		});
	} catch (error) {
		return NextResponse.json(
			{ error: 'Internal Server Error' },
			{ status: 500 }
		);
	}
}
