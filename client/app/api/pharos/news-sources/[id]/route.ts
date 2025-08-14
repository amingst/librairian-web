import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
// Global Prisma client singleton to prevent connection pool issues
const globalForPrisma = globalThis as unknown as {
	prisma: PrismaClient | undefined;
};
const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function GET(
	request: NextRequest,
	props: { params: Promise<{ id: string }> }
) {
	const { id } = await props.params;
	if (!id) {
		return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
	}

	try {
		const newsSource = await prisma.newsSource.findUnique({
			where: { id },
		});
		if (!newsSource) {
			return NextResponse.json({ error: 'Not Found' }, { status: 404 });
		}
		return NextResponse.json(newsSource, { status: 200 });
	} catch (error) {
		return NextResponse.json(
			{ error: 'Internal Server Error' },
			{ status: 500 }
		);
	}
}
