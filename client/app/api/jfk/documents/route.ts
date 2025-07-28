import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';
import { PrismaClient } from '@prisma/client';

const prismaClient = new PrismaClient();

export async function GET(request: NextRequest) {
	const searchParams = await request.nextUrl.searchParams;
	const page = parseInt(searchParams.get('page') || '1');
	const limit = parseInt(searchParams.get('limit') || '10');
	const idMapRequested = searchParams.get('idMap') === 'true';

	try {
		// Test database connection first
		try {
			await prisma.$queryRaw`SELECT 1`;
			console.log('Database connection successful');
		} catch (dbError) {
			console.error('Database connection error:', dbError);
			return NextResponse.json(
				{
					error: 'Database connection failed',
					details:
						dbError instanceof Error
							? dbError.message
							: 'Unknown database error',
				},
				{ status: 500 }
			);
		}

		if (idMapRequested) {
			console.log('Fetching document ID mapping');
			try {
				// Return a list of documents with both frontend and backend IDs
				const documents = await prisma.document.findMany({
					select: {
						id: true, // This is the backend ID
						documentUrl: true, // This contains the frontend ID
					},
					orderBy: {
						createdAt: 'desc',
					},
				});

				console.log(
					`Found ${documents.length} documents for ID mapping`
				);

				// Extract frontend IDs from documentUrl if possible and create a mapping
				const idMap: { [key: string]: string } = {};

				documents.forEach(
					(doc: { id: string; documentUrl: string | null }) => {
						if (doc.documentUrl) {
							// Try to extract the frontend ID from the URL
							// Typically it's the last part of the path
							const urlParts = doc.documentUrl.split('/');
							const frontendId = urlParts[urlParts.length - 1];

							if (frontendId && frontendId.length > 0) {
								idMap[frontendId] = doc.id;
							}
						}
					}
				);

				const mapCount = Object.keys(idMap).length;
				console.log(`Created mapping with ${mapCount} entries`);

				// If no mappings were created but we have documents, something is wrong with the URL extraction
				if (mapCount === 0 && documents.length > 0) {
					console.warn(
						'No ID mappings were extracted despite having documents. Sample URLs:',
						documents.slice(0, 3).map((d) => d.documentUrl)
					);

					// Create a simple 1:1 mapping as fallback
					documents.forEach((doc: { id: string }) => {
						idMap[doc.id] = doc.id; // Use backend ID as the key too
					});

					console.log(
						`Created fallback 1:1 mapping with ${
							Object.keys(idMap).length
						} entries`
					);
				}

				return NextResponse.json({
					idMap,
					count: Object.keys(idMap).length,
				});
			} catch (mapError) {
				console.error('Error creating ID map:', mapError);
				return NextResponse.json(
					{
						error: 'Failed to create ID map',
						details:
							mapError instanceof Error
								? mapError.message
								: 'Unknown error',
					},
					{ status: 500 }
				);
			}
		}

		// Regular document listing logic
		const skip = (page - 1) * limit;

		try {
			const [documents, totalCount] = await Promise.all([
				prisma.document.findMany({
					select: {
						id: true,
						title: true,
						summary: true,
						pageCount: true,
						createdAt: true,
						earliestDate: true,
					},
					orderBy: {
						createdAt: 'desc',
					},
					skip,
					take: limit,
				}),
				prisma.document.count(),
			]);

			console.log(
				`Fetched ${documents.length} documents (page ${page}, limit ${limit})`
			);

			return NextResponse.json({
				documents,
				pagination: {
					page,
					limit,
					totalCount,
					totalPages: Math.ceil(totalCount / limit),
				},
			});
		} catch (listError) {
			console.error('Error listing documents:', listError);
			return NextResponse.json(
				{
					error: 'Failed to list documents',
					details:
						listError instanceof Error
							? listError.message
							: 'Unknown error',
				},
				{ status: 500 }
			);
		}
	} catch (error) {
		console.error('Unexpected error in documents API:', error);
		return NextResponse.json(
			{
				error: 'Failed to process request',
				details:
					error instanceof Error ? error.message : 'Unknown error',
			},
			{ status: 500 }
		);
	} finally {
		try {
			await prisma.$disconnect();
			console.log('Database disconnected successfully');
		} catch (disconnectError) {
			console.error(
				'Error disconnecting from database:',
				disconnectError
			);
		}
	}
}

// export async function getAllDocuments(request: Request) {
// 	try {
// 		// Get all documents with basic fields (limit to most recent 50)
// 		const documents = await prismaClient.document.findMany({
// 			select: {
// 				id: true,
// 				archiveId: true,
// 				title: true,
// 				pageCount: true,
// 			},
// 			take: 50,
// 			orderBy: {
// 				processingDate: 'desc',
// 			},
// 		});

// 		return NextResponse.json({
// 			documents,
// 			count: documents.length,
// 		});
// 	} catch (error) {
// 		console.error('Error fetching documents:', error);
// 		return NextResponse.json(
// 			{ error: 'Failed to fetch documents' },
// 			{ status: 500 }
// 		);
// 	}
// }
