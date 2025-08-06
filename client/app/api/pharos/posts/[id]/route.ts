import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(
	req: NextRequest,
	{ params }: { params: { id: string } }
) {
	const { id } = await params;
	const post = await prisma.post.findUnique({
		where: { id: id },
	});

	if (!post) {
		return NextResponse.json({ error: 'Post not found' }, { status: 404 });
	}

	return NextResponse.json(post);
}

export async function PUT(
	req: NextRequest,
	{ params }: { params: { id: string } }
) {
	const body = await req.json();

	const post = await prisma.post.update({
		where: { id: params.id },
		data: body,
	});

	return NextResponse.json(post);
}

export async function DELETE(
	req: NextRequest,
	{ params }: { params: { id: string } }
) {
	await prisma.post.delete({
		where: { id: params.id },
	});

	return NextResponse.json({ message: 'Post deleted' });
}
