import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import {
	newsArticleToDocument,
	structuredArticleToDocument,
	basicArticleToDocument,
} from '@shared/backend/src/utils/articleToDocument';

// Create Prisma client
let prisma: PrismaClient;

try {
	prisma = new PrismaClient();
	console.log('[ARTICLE TO DOCUMENT API] Prisma client initialized');
} catch (e) {
	console.error(
		'[ARTICLE TO DOCUMENT API] Error initializing Prisma client:',
		e
	);
	prisma = {} as PrismaClient;
}

export async function POST(request: Request) {
	try {
		// Check if we have a valid Prisma instance
		if (!prisma.document) {
			console.error(
				'[ARTICLE TO DOCUMENT API] Prisma client not properly initialized'
			);
			return NextResponse.json(
				{
					error: 'Database client initialization failed',
					status: 'error',
					databaseError: true,
				},
				{ status: 500 }
			);
		}

		const body = await request.json();
		const { articles, type = 'auto' } = body;

		if (!articles || !Array.isArray(articles)) {
			return NextResponse.json(
				{
					error: 'Invalid request: articles array is required',
					status: 'error',
				},
				{ status: 400 }
			);
		}

		const createdDocuments = [];
		const errors = [];

		for (const article of articles) {
			try {
				let documentData;

				// Auto-detect article type or use specified type
				if (type === 'auto') {
					if (
						'source' in article &&
						'link' in article &&
						'excerpt' in article
					) {
						// NewsArticlePreview
						documentData = newsArticleToDocument(article);
					} else if ('url' in article && 'content' in article) {
						// StructuredArticle
						documentData = structuredArticleToDocument(article);
					} else if (
						'link' in article &&
						'timestamp' in article &&
						'source' in article
					) {
						// Basic Article
						documentData = basicArticleToDocument(article);
					} else {
						errors.push({
							article: article.title || 'Unknown',
							error: 'Unable to determine article type',
						});
						continue;
					}
				} else {
					// Use specified conversion type
					switch (type) {
						case 'news-preview':
							documentData = newsArticleToDocument(article);
							break;
						case 'structured':
							documentData = structuredArticleToDocument(article);
							break;
						case 'basic':
							documentData = basicArticleToDocument(article);
							break;
						default:
							errors.push({
								article: article.title || 'Unknown',
								error: `Unknown conversion type: ${type}`,
							});
							continue;
					}
				}

				// Check if document already exists (by URL)
				const existingDocument = await prisma.document.findFirst({
					where: {
						documentUrl: documentData.documentUrl,
					},
				});

				if (existingDocument) {
					errors.push({
						article: article.title || 'Unknown',
						error: 'Document already exists with this URL',
						existingId: existingDocument.id,
					});
					continue;
				}

				// Create the document
				const documentInput = {
					...documentData,
					document: documentData.document as any, // Cast to satisfy Prisma JsonValue
				};

				const createdDocument = await prisma.document.create({
					data: documentInput,
				});

				createdDocuments.push({
					id: createdDocument.id,
					title: createdDocument.title,
					url: createdDocument.documentUrl,
					type: createdDocument.documentGroup,
				});
			} catch (error) {
				console.error(
					`Error processing article: ${article.title}`,
					error
				);
				errors.push({
					article: article.title || 'Unknown',
					error:
						error instanceof Error ? error.message : String(error),
				});
			}
		}

		return NextResponse.json({
			status: 'success',
			created: createdDocuments.length,
			errors: errors.length,
			documents: createdDocuments,
			errorDetails: errors,
			serverTime: new Date().toISOString(),
		});
	} catch (error) {
		console.error('[ARTICLE TO DOCUMENT API] Global error:', error);
		return NextResponse.json(
			{
				error: 'Failed to process articles',
				details: String(error),
				status: 'error',
				serverTime: new Date().toISOString(),
			},
			{ status: 500 }
		);
	}
}

export async function GET(request: Request) {
	try {
		const { searchParams } = new URL(request.url);
		const group = searchParams.get('group') || 'news';
		const limit = parseInt(searchParams.get('limit') || '20');
		const offset = parseInt(searchParams.get('offset') || '0');

		// Get news articles as documents
		const documents = await prisma.document.findMany({
			where: {
				documentGroup: group,
			},
			select: {
				id: true,
				title: true,
				documentUrl: true,
				summary: true,
				processingDate: true,
				documentGroup: true,
				processingStage: true,
			},
			orderBy: {
				processingDate: 'desc',
			},
			take: limit,
			skip: offset,
		});

		const total = await prisma.document.count({
			where: {
				documentGroup: group,
			},
		});

		return NextResponse.json({
			status: 'success',
			documents,
			total,
			limit,
			offset,
			serverTime: new Date().toISOString(),
		});
	} catch (error) {
		console.error(
			'[ARTICLE TO DOCUMENT API] Error fetching documents:',
			error
		);
		return NextResponse.json(
			{
				error: 'Failed to fetch documents',
				details: String(error),
				status: 'error',
			},
			{ status: 500 }
		);
	}
}
