'use server';
import { PrismaClient } from '@prisma/client';
// Global Prisma client singleton to prevent connection pool issues
const globalForPrisma = globalThis as unknown as {
	prisma: PrismaClient | undefined;
};
const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function getNewsSources() {
	const sources = await prisma.newsSource.findMany();
	return sources;
}

export async function getNewsSourceDetails(id: string) {
	const source = await prisma.newsSource.findUnique({
		where: { id },
	});
	return source;
}
