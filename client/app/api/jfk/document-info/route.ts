import { NextResponse } from "next/server";
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { error: "Document ID is required" },
      { status: 400 }
    );
  }

  try {
    // Find document by ID
    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        pages: {
          select: {
            id: true,
            pageNumber: true,
            summary: true,
            imagePath: true
          }
        },
        handwrittenNotes: true,
        documentStamps: true
      }
    });

    // If document not found by exact ID, try finding by archiveId or oldId
    if (!document) {
      const alternativeDocument = await prisma.document.findFirst({
        where: {
          OR: [
            { archiveId: id },
            { oldId: id }
          ]
        },
        include: {
          pages: {
            select: {
              id: true,
              pageNumber: true,
              summary: true,
              imagePath: true
            }
          },
          handwrittenNotes: true,
          documentStamps: true
        }
      });

      if (!alternativeDocument) {
        return NextResponse.json(
          { error: "Document not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(alternativeDocument);
    }

    return NextResponse.json(document);
  } catch (error) {
    console.error("Error fetching document:", error);
    return NextResponse.json(
      { error: "Failed to fetch document" },
      { status: 500 }
    );
  }
} 