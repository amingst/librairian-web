import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id } = await params; // Await params per Next.js requirement
	const post = await prisma.post.findUnique({
		where: { id },
	});

	if (!post) {
		return NextResponse.json({ error: 'Post not found' }, { status: 404 });
	}

	return NextResponse.json(post);
}

export async function PUT(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id } = await params; // Await params
	const body = await req.json();

	const post = await prisma.post.update({
		where: { id },
		data: body,
	});

	return NextResponse.json(post);
}

export async function DELETE(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id } = await params; // Await params
	await prisma.post.delete({
		where: { id },
	});

	return NextResponse.json({ message: 'Post deleted' });
}
