import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import cheerio from 'cheerio';
// import AWS from 'aws-sdk';
import { getArchivesGovUrl } from '../../../../utils/jfk/docUtils';
const prisma = new PrismaClient();
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.oip.onl';

// Updated mock storage for document statuses with new state system
const documentStatus: Record<
	string,
	{
		status: 'waitingForAnalysis' | 'ready';
		analysisComplete: boolean;
		timestamp: string;
	}
> = {};

// Helper function to repair incorrect document data
async function repairIncorrectDocument(documentId: string): Promise<boolean> {
	try {
		// First, find the document in the database
		const existingDoc = await prisma.document.findFirst({
			where: {
				OR: [
					{ id: documentId },
					{ archiveId: documentId },
					{ oldId: documentId },
				],
			},
			include: {
				pages: { select: { id: true } },
			},
		});

		if (!existingDoc) {
			console.error(`Document ${documentId} not found in database`);
			return false;
		}

		// Check if this is an incorrectly migrated document or needs repair
		const docContent = existingDoc.document;

		// Case 1: Incorrectly migrated document
		const hasIncorrectFormat =
			typeof docContent === 'object' &&
			docContent !== null &&
			JSON.stringify(docContent).startsWith('{"archiveId":');

		// Case 2: Missing pages relationship
		const hasNoPages = !existingDoc.pages || existingDoc.pages.length === 0;

		// Case 3: Zero page count but marked as complete
		const hasZeroPageCount =
			existingDoc.pageCount === 0 &&
			typeof docContent === 'object' &&
			docContent !== null &&
			(docContent as any).analysisComplete === true;

		// Only continue if the document needs repair
		const needsRepair =
			hasIncorrectFormat || hasNoPages || hasZeroPageCount;

		if (!needsRepair) {
			console.log(`Document ${documentId} does not need repair`);
			return false;
		}

		// Fetch the correct data from the media API
		console.log(`Fetching correct data for ${documentId} from media API`);
		const mediaResponse = await fetch(
			`${API_BASE_URL}/api/jfk/media?id=${documentId}&type=analysis&getLatestPageData=true`
		);

		if (!mediaResponse.ok) {
			console.error(
				`Failed to fetch data for ${documentId}: ${mediaResponse.status} ${mediaResponse.statusText}`
			);
			return false;
		}

		const analysisData = await mediaResponse.json();

		// Check if the data is complete
		const hasAnalysisData =
			analysisData && analysisData.pages && analysisData.pages.length > 0;

		if (!hasAnalysisData) {
			console.error(`Retrieved incomplete data for ${documentId}`);
			return false;
		}

		console.log(
			`Retrieved complete data for ${documentId} with ${analysisData.pages.length} pages`
		);

		// Process dates if present
		try {
			if (Array.isArray(analysisData.allDates)) {
				// Filter out invalid date strings
				analysisData.allDates = analysisData.allDates.filter(
					(date: unknown) =>
						typeof date === 'string' && date.trim().length > 0
				);

				// Pre-normalize dates
				const dateInfo = normalizeDates(analysisData.allDates || []);
				console.log(
					`Processed ${dateInfo.normalizedDates.length} dates successfully`
				);

				// Add normalized dates to analysis data
				analysisData.normalizedDates = dateInfo.normalizedDates;
				analysisData.earliestDate = dateInfo.earliestDate;
				analysisData.latestDate = dateInfo.latestDate;
			} else {
				// If allDates is not an array, initialize it
				analysisData.allDates = [];
				analysisData.normalizedDates = [];
				analysisData.earliestDate = null;
				analysisData.latestDate = null;
				console.log(`No dates to normalize (allDates is not an array)`);
			}
		} catch (dateError) {
			// Don't let date normalization issues prevent document update
			console.error(
				`Error normalizing dates for ${documentId}:`,
				dateError
			);
			analysisData.normalizedDates = [];
			analysisData.earliestDate = null;
			analysisData.latestDate = null;
		}

		// Instead of custom update logic, use the same updateDocumentInDatabase function
		// that's used by the individual document repair process
		const success = await updateDocumentInDatabase(
			documentId,
			analysisData,
			true
		);

		if (success) {
			console.log(
				`Successfully repaired document ${documentId} using standardized update process`
			);
			return true;
		} else {
			console.error(
				`Failed to update document ${documentId} using standardized update process`
			);
			return false;
		}
	} catch (error) {
		console.error(`Error repairing document ${documentId}:`, error);
		return false;
	}
}

// Add this function near the updateDocumentInDatabase function to handle external process completion
async function handleExternalProcessCompletion(
	documentId: string,
	completedSteps: string[] = []
) {
	try {
		// Check if analysis is complete (this is when we need to update the document)
		const analysisComplete = completedSteps.includes('analyzeImages');

		// Only proceed with full update if analysis has been completed
		if (analysisComplete) {
			console.log(
				`Handling completion for document ${documentId} - analysis complete. Updating database...`
			);

			// We need to fetch the full document data with page information
			const analysisData = await fetchDocumentAnalysis(documentId);

			if (
				analysisData &&
				analysisData.pages &&
				analysisData.pages.length > 0
			) {
				// Update the database with the complete data
				const success = await updateDocumentInDatabase(
					documentId,
					analysisData,
					true
				);

				if (success) {
					console.log(
						`Successfully updated document ${documentId} with complete data after external processing`
					);
					return true;
				} else {
					console.error(
						`Failed to update document ${documentId} with complete data`
					);
				}
			} else {
				console.error(
					`Could not get complete analysis data for document ${documentId}`
				);
			}
		} else {
			console.log(
				`Document ${documentId} is not ready for complete data update yet.`
			);
		}

		return false;
	} catch (error) {
		console.error(
			`Error handling external processing completion for ${documentId}:`,
			error
		);
		return false;
	}
}

// New endpoint to fix incorrectly migrated documents
export async function PATCH(request: Request) {
	try {
		const body = await request.json();
		const {
			documentId,
			repairAllBroken,
			forceDataUpdate,
			retryCount = 1,
		} = body;

		// If forceDataUpdate is true, fetch latest data and update the document
		if (documentId && forceDataUpdate === true) {
			let lastError = null;
			let attempt = 0;
			let maxRetries = Number(retryCount) || 1;

			// Implement retry logic
			while (attempt < maxRetries) {
				attempt++;
				console.log(
					`Attempt ${attempt}/${maxRetries} to update document ${documentId}`
				);

				try {
					console.log(
						`Forcing data update for document ${documentId}`
					);

					// Use getLatestPageData=true explicitly for the most complete data
					const mediaApiUrl = `${API_BASE_URL}/api/jfk/media?id=${documentId.replace(
						/^\/+/,
						''
					)}&type=analysis&getLatestPageData=true`;
					console.log(
						`Fetching complete analysis data from: ${mediaApiUrl}`
					);

					// Set a longer timeout for the fetch
					const controller = new AbortController();
					const timeout = setTimeout(() => controller.abort(), 30000); // 30-second timeout

					try {
						const mediaResponse = await fetch(mediaApiUrl, {
							signal: controller.signal,
						});
						clearTimeout(timeout);

						if (!mediaResponse.ok) {
							console.error(
								`Failed to fetch data from media API: ${mediaResponse.status} ${mediaResponse.statusText}`
							);
							lastError = `Failed to fetch data from media API: ${mediaResponse.status} ${mediaResponse.statusText}`;
							continue; // Try again
						}

						const analysisData = await mediaResponse.json();

						// Check if the data is complete
						const hasCompleteData =
							analysisData &&
							analysisData.pages &&
							analysisData.pages.length > 0;

						if (!hasCompleteData) {
							console.warn(
								`Incomplete data received for ${documentId}. Missing required fields:`,
								{
									hasPages: Boolean(
										analysisData.pages &&
											analysisData.pages.length > 0
									),
									hasSummary: Boolean(analysisData.summary),
									pageCount: analysisData.pages?.length || 0,
								}
							);

							// If data is completely empty, retry
							if (
								!analysisData ||
								!analysisData.pages ||
								analysisData.pages.length === 0
							) {
								lastError = `Retrieved empty data for document ${documentId}`;
								continue; // Try again
							}
						}

						console.log(
							`Retrieved analysis data with ${
								analysisData.pages?.length || 0
							} pages and summary ${
								analysisData.summary ? 'present' : 'missing'
							}`
						);

						if (analysisData) {
							// Handle date normalization errors separately to prevent them from breaking the whole update
							try {
								// Pre-process dates to prevent errors
								if (Array.isArray(analysisData.allDates)) {
									// Filter out invalid date strings
									analysisData.allDates =
										analysisData.allDates.filter(
											(date: unknown) =>
												typeof date === 'string' &&
												date.trim().length > 0
										);

									// Pre-normalize dates
									const dateInfo = normalizeDates(
										analysisData.allDates || []
									);
									console.log(
										`Pre-processed ${dateInfo.normalizedDates.length} dates successfully`
									);

									// Add normalized dates to analysis data
									analysisData.normalizedDates =
										dateInfo.normalizedDates;
									analysisData.earliestDate =
										dateInfo.earliestDate;
									analysisData.latestDate =
										dateInfo.latestDate;
								} else {
									// If allDates is not an array, initialize it
									analysisData.allDates = [];
									analysisData.normalizedDates = [];
									analysisData.earliestDate = null;
									analysisData.latestDate = null;
									console.log(
										`No dates to normalize (allDates is not an array)`
									);
								}
							} catch (dateError) {
								// Don't let date normalization issues prevent document update
								console.error(
									`Error normalizing dates for ${documentId}:`,
									dateError
								);
								analysisData.normalizedDates = [];
								analysisData.earliestDate = null;
								analysisData.latestDate = null;
							}

							try {
								// Update the document with the processed data
								console.log(
									`Updating document ${documentId} in database...`
								);
								const success = await updateDocumentInDatabase(
									documentId,
									analysisData,
									true
								);

								console.log(
									`Document update result: ${
										success ? 'success' : 'failed'
									}`
								);

								if (success) {
									// If successful, return immediately
									return NextResponse.json({
										documentId,
										status: 'success',
										message:
											'Document updated with latest data',
										dataDetails: {
											pageCount:
												analysisData.pages?.length || 0,
											hasSummary: Boolean(
												analysisData.summary
											),
											hasHandwrittenNotes:
												(analysisData.handwrittenNotes
													?.length || 0) > 0,
											hasStamps:
												(analysisData.stamps?.length ||
													0) > 0,
										},
										attempts: attempt,
									});
								} else {
									// Database update failed, try again
									lastError =
										'Failed to update document in database';
									continue;
								}
							} catch (dbError) {
								console.error(
									`Database error updating document ${documentId}:`,
									dbError
								);
								lastError = `Database error: ${String(
									dbError
								)}`;
								continue; // Try again
							}
						} else {
							lastError =
								'Failed to fetch analysis data (empty response)';
							continue; // Try again
						}
					} catch (fetchError) {
						clearTimeout(timeout);
						console.error(
							`Error fetching data for ${documentId}:`,
							fetchError
						);
						lastError = `Fetch error: ${String(fetchError)}`;
						continue; // Try again
					}
				} catch (attemptError) {
					console.error(
						`Error during attempt ${attempt} for ${documentId}:`,
						attemptError
					);
					lastError = String(attemptError);
					continue; // Try again
				}
			}

			// If we've tried all attempts and still failed, return the last error
			return NextResponse.json(
				{
					documentId,
					status: 'failed',
					message: `Failed after ${attempt} attempts. Last error: ${lastError}`,
					attempts: attempt,
				},
				{ status: 500 }
			);
		}

		// If repairAllBroken is true, find and repair all broken documents
		if (repairAllBroken === true) {
			try {
				// Find all documents with issues
				console.log('Finding all documents that need data repair...');

				const documents = await prisma.document.findMany({
					select: {
						id: true,
						archiveId: true,
						document: true,
						pageCount: true,
						pages: { select: { id: true } },
					},
				});

				// Filter for all types of broken documents:
				// 1. Incorrectly migrated documents (has archiveId as document content)
				// 2. Documents with pageCount = 0
				// 3. Documents with no pages relationship
				// 4. Documents with analysis marked as complete but missing data
				const brokenDocs = documents.filter((doc: any) => {
					try {
						// Case 1: Incorrectly formatted document data
						const hasIncorrectFormat =
							typeof doc.document === 'object' &&
							doc.document !== null &&
							JSON.stringify(doc.document).startsWith(
								'{"archiveId":'
							);

						// Case 2: Document with pageCount = 0
						const hasZeroPages = doc.pageCount === 0;

						// Case 3: Document with no pages relationship
						const hasNoPageRelations =
							!doc.pages || doc.pages.length === 0;

						// Case 4: Document that shows as processed but is missing data
						const isProcessedButMissingData =
							typeof doc.document === 'object' &&
							doc.document !== null &&
							(doc.document as any).analysisComplete === true &&
							(!doc.pages ||
								doc.pages.length === 0 ||
								doc.pageCount === 0);

						// Return true if any of the conditions are met
						return (
							hasIncorrectFormat ||
							hasZeroPages ||
							hasNoPageRelations ||
							isProcessedButMissingData
						);
					} catch (e) {
						return false;
					}
				});

				console.log(
					`Found ${brokenDocs.length} documents that need repair`
				);

				// Log some stats about the types of broken documents
				const incorrectFormatCount = brokenDocs.filter(
					(doc: any) =>
						typeof doc.document === 'object' &&
						doc.document !== null &&
						JSON.stringify(doc.document).startsWith('{"archiveId":')
				).length;

				const zeroPageCount = brokenDocs.filter(
					(doc: any) => doc.pageCount === 0
				).length;

				const noPageRelationsCount = brokenDocs.filter(
					(doc: any) => !doc.pages || doc.pages.length === 0
				).length;

				const processedMissingDataCount = brokenDocs.filter(
					(doc: any) =>
						typeof doc.document === 'object' &&
						doc.document !== null &&
						(doc.document as any).analysisComplete === true &&
						(!doc.pages ||
							doc.pages.length === 0 ||
							doc.pageCount === 0)
				).length;

				console.log(`Broken document types breakdown: 
          - Incorrect format: ${incorrectFormatCount}
          - Zero page count: ${zeroPageCount}
          - Missing page relations: ${noPageRelationsCount}
          - Processed but missing data: ${processedMissingDataCount}
        `);

				// Keep track of success/failure
				const results = {
					success: 0,
					failed: 0,
					documents: [] as Array<{
						id: string;
						status: 'success' | 'failed';
						message?: string;
					}>,
				};

				// Process each document (sequentially to avoid overwhelming the media server)
				for (const doc of brokenDocs) {
					try {
						// Get the document ID to use for the media server
						const mediaId = doc.archiveId || doc.id;
						console.log(
							`Attempting to repair document ${mediaId}...`
						);

						// For documents that are missing content data (rather than format issues),
						// use the forceDocumentUpdate function instead of repairIncorrectDocument
						let repaired = false;

						// First try with regular repair
						repaired = await repairIncorrectDocument(mediaId);

						// If that didn't work, try with force update
						if (!repaired) {
							console.log(
								`Standard repair didn't work for ${mediaId}, trying force update...`
							);
							repaired = await forceDocumentUpdate(mediaId);
						}

						if (repaired) {
							results.success++;
							results.documents.push({
								id: doc.id,
								status: 'success',
							});
						} else {
							results.failed++;
							results.documents.push({
								id: doc.id,
								status: 'failed',
								message: 'Repair failed',
							});
						}
					} catch (docError) {
						console.error(
							`Error repairing document ${doc.id}:`,
							docError
						);
						results.failed++;
						results.documents.push({
							id: doc.id,
							status: 'failed',
							message: String(docError),
						});
					}
				}

				return NextResponse.json({
					status: 'completed',
					message: `Repaired ${results.success} documents, ${results.failed} failed`,
					repaired: results.success,
					failed: results.failed,
					documents: results.documents,
				});
			} catch (error) {
				console.error('Error finding broken documents:', error);
				return NextResponse.json(
					{
						error: 'Failed to repair documents',
						details: String(error),
					},
					{ status: 500 }
				);
			}
		}

		// Otherwise repair a specific document
		if (!documentId) {
			return NextResponse.json(
				{ error: 'Document ID is required' },
				{ status: 400 }
			);
		}

		const repaired = await repairIncorrectDocument(documentId);

		if (repaired) {
			return NextResponse.json({
				documentId,
				status: 'success',
				message: 'Document repaired successfully',
			});
		} else {
			return NextResponse.json(
				{
					documentId,
					status: 'failed',
					message: 'Failed to repair document or repair not needed',
				},
				{ status: 400 }
			);
		}
	} catch (error) {
		console.error('Error in repair endpoint:', error);
		return NextResponse.json(
			{ error: 'Internal server error' },
			{ status: 500 }
		);
	}
}

// Update the PUT webhook handler to use our new handleExternalProcessCompletion function
export async function PUT(request: Request) {
	try {
		const body = await request.json();
		const { documentId, status, completedSteps = [] } = body;

		if (!documentId) {
			return NextResponse.json(
				{ error: 'Document ID is required' },
				{ status: 400 }
			);
		}

		console.log(
			`[Webhook] Received for document ${documentId} with status ${
				status || 'not provided'
			}`
		);
		console.log(
			`[Webhook] Completed steps: ${completedSteps.join(', ') || 'none'}`
		);

		// Check if document exists
		const existingDoc = await prisma.document.findFirst({
			where: {
				OR: [
					{ id: documentId },
					{ archiveId: documentId },
					{ oldId: documentId },
				],
			},
		});

		if (!existingDoc) {
			console.error(
				`[Webhook] Document ${documentId} not found in database`
			);
			return NextResponse.json(
				{
					documentId,
					status: 'error',
					message: 'Document not found in database',
				},
				{ status: 404 }
			);
		}

		console.log(`[Webhook] Found document in database: ${existingDoc.id}`);

		// Check if analysis was part of the completed steps
		const hasAnalysisCompleted = completedSteps.includes('analyzeImages');
		console.log(`[Webhook] Analysis completed: ${hasAnalysisCompleted}`);

		if (hasAnalysisCompleted) {
			console.log(
				`[Webhook] Analysis is complete for ${documentId}, fetching data and updating database...`
			);

			// Explicitly fetch the document with getLatestPageData=true parameter for complete data
			const mediaApiUrl = `${API_BASE_URL}/api/jfk/media?id=${documentId.replace(
				/^\/+/,
				''
			)}&type=analysis&getLatestPageData=true`;
			console.log(
				`[Webhook] Fetching complete analysis data from: ${mediaApiUrl}`
			);

			try {
				const mediaResponse = await fetch(mediaApiUrl);

				if (!mediaResponse.ok) {
					console.error(
						`[Webhook] Failed to fetch analysis data from media API: ${mediaResponse.status} ${mediaResponse.statusText}`
					);
					return NextResponse.json(
						{
							documentId,
							status: 'error',
							message:
								'Failed to fetch analysis data from media API',
						},
						{ status: 500 }
					);
				}

				const analysisData = await mediaResponse.json();

				// Check if we got complete data
				const hasCompleteData =
					analysisData &&
					analysisData.pages &&
					analysisData.pages.length > 0 &&
					analysisData.summary;

				console.log(
					`[Webhook] Retrieved analysis data with ${
						analysisData.pages?.length || 0
					} pages, summary ${
						analysisData.summary ? 'present' : 'missing'
					}`
				);

				if (!hasCompleteData) {
					console.warn(
						`[Webhook] Analysis data incomplete for ${documentId}`
					);
				}

				// Update the database with whatever data we have
				console.log(
					`[Webhook] Updating document ${documentId} in database with analysis data...`
				);
				const success = await updateDocumentInDatabase(
					documentId,
					analysisData,
					true
				);

				if (success) {
					console.log(
						`[Webhook] Successfully updated document ${documentId} with complete data`
					);
					return NextResponse.json({
						documentId,
						status: 'success',
						message: 'Document updated with complete analysis data',
						dataDetails: {
							pageCount: analysisData.pages?.length || 0,
							hasSummary: Boolean(analysisData.summary),
							hasHandwrittenNotes:
								(analysisData.handwrittenNotes?.length || 0) >
								0,
							hasStamps: (analysisData.stamps?.length || 0) > 0,
						},
					});
				} else {
					console.error(
						`[Webhook] Failed to update document ${documentId} with analysis data`
					);
					return NextResponse.json(
						{
							documentId,
							status: 'error',
							message:
								'Failed to update document with analysis data',
						},
						{ status: 500 }
					);
				}
			} catch (apiError) {
				console.error(
					`[Webhook] Error fetching or processing analysis data:`,
					apiError
				);
				return NextResponse.json(
					{
						documentId,
						status: 'error',
						message: `Error fetching or processing analysis data: ${String(
							apiError
						)}`,
					},
					{ status: 500 }
				);
			}
		}

		// If analysis wasn't completed or we want to update status anyway
		console.log(
			`[Webhook] Updating document ${documentId} with status: ${
				status || 'unchanged'
			}`
		);

		try {
			// Just update processing status
			await prisma.document.update({
				where: { id: existingDoc.id },
				data: {
					processingDate: new Date(),
					document: {
						...(typeof existingDoc.document === 'object'
							? existingDoc.document
							: {}),
						processingStage: status || 'waitingForAnalysis',
						lastProcessed: new Date().toISOString(),
						completedSteps,
					},
				},
			});

			console.log(
				`[Webhook] Successfully updated document ${documentId} status`
			);

			return NextResponse.json({
				documentId,
				status: 'updated',
				message: 'Document status updated',
			});
		} catch (dbError) {
			console.error(
				`[Webhook] Error updating document ${documentId} status:`,
				dbError
			);
			return NextResponse.json(
				{
					documentId,
					status: 'error',
					message: 'Failed to update document status',
				},
				{ status: 500 }
			);
		}
	} catch (error) {
		console.error('[Webhook] Error handling webhook:', error);
		return NextResponse.json(
			{ error: 'Internal server error' },
			{ status: 500 }
		);
	}
}

export async function POST(request: Request) {
	try {
		const body = await request.json();
		const {
			documentId,
			documentUrl,
			archiveId,
			steps = [],
			findBrokenOnly = false,
			documentType = 'jfk', // Default to 'jfk' if not specified
			documentGroup = 'jfk', // Default to 'jfk' if not specified
			processType = '', // Add processType parameter
			forceDataUpdate = false, // Add forceDataUpdate parameter
		} = body;

		// Special case for direct finalization of a document (final step)
		if (processType === 'finalizeDocument' || forceDataUpdate === true) {
			const targetDocId = documentId.replace(/^\/+/, '');
			console.log(`[FINALIZE] Force finalizing document ${targetDocId}`);

			try {
				// Determine document type with fallbacks
				let effectiveDocType = 'jfk';
				if (
					documentType === 'rfk' ||
					documentGroup === 'rfk' ||
					targetDocId.toLowerCase().includes('rfk')
				) {
					effectiveDocType = 'rfk';
				}

				// Fetch complete analysis data
				const analysisData = await fetchDocumentAnalysis(
					targetDocId,
					effectiveDocType
				);

				if (!analysisData) {
					return NextResponse.json(
						{
							status: 'error',
							message:
								'Failed to fetch analysis data for document',
							documentId: targetDocId,
						},
						{ status: 500 }
					);
				}

				// Make sure allNames, allPlaces, allDates, and allObjects are initialized
				if (!analysisData.allNames) analysisData.allNames = [];
				if (!analysisData.allPlaces) analysisData.allPlaces = [];
				if (!analysisData.allDates) analysisData.allDates = [];
				if (!analysisData.allObjects) analysisData.allObjects = [];

				// LOG THE DATA BEFORE SAVING
				console.log(
					'[DB Update] Final dbUpdateData before saving:',
					JSON.stringify(
						{
							targetDocId,
							namesCount: analysisData.allNames.length,
							placesCount: analysisData.allPlaces.length,
							datesCount: analysisData.allDates.length,
							objectsCount: analysisData.allObjects.length,
							pageCount: analysisData.pages?.length || 0,
						},
						null,
						2
					)
				);

				// Perform database update with isComplete=true
				const success = await updateDocumentInDatabase(
					targetDocId,
					analysisData,
					true
				);

				if (success) {
					return NextResponse.json({
						status: 'success',
						message: 'Document finalized with full data update',
						documentId: targetDocId,
					});
				} else {
					return NextResponse.json(
						{
							status: 'error',
							message: 'Failed to update document in database',
							documentId: targetDocId,
						},
						{ status: 500 }
					);
				}
			} catch (error) {
				console.error(
					`[FINALIZE] Error finalizing document ${targetDocId}:`,
					error
				);
				return NextResponse.json(
					{
						status: 'error',
						message: `Error finalizing document: ${String(error)}`,
						documentId: targetDocId,
					},
					{ status: 500 }
				);
			}
		}

		// If findBrokenOnly is true, just find and return broken document IDs
		if (findBrokenOnly === true) {
			try {
				// Find all documents with issues
				console.log('Finding all documents that need data repair...');

				const documents = await prisma.document.findMany({
					select: {
						id: true,
						archiveId: true,
						document: true,
						pageCount: true,
						pages: { select: { id: true } },
					},
				});

				// Filter for all types of broken documents:
				// 1. Incorrectly migrated documents (has archiveId as document content)
				// 2. Documents with pageCount = 0
				// 3. Documents with no pages relationship
				// 4. Documents with analysis marked as complete but missing data
				const brokenDocs = documents.filter((doc: any) => {
					try {
						// Case 1: Incorrectly formatted document data
						const hasIncorrectFormat =
							typeof doc.document === 'object' &&
							doc.document !== null &&
							JSON.stringify(doc.document).startsWith(
								'{"archiveId":'
							);

						// Case 2: Document with pageCount = 0
						const hasZeroPages = doc.pageCount === 0;

						// Case 3: Document with no pages relationship
						const hasNoPageRelations =
							!doc.pages || doc.pages.length === 0;

						// Case 4: Document that shows as processed but is missing data
						const isProcessedButMissingData =
							typeof doc.document === 'object' &&
							doc.document !== null &&
							(doc.document as any).analysisComplete === true &&
							(!doc.pages ||
								doc.pages.length === 0 ||
								doc.pageCount === 0);

						// Return true if any of the conditions are met
						return (
							hasIncorrectFormat ||
							hasZeroPages ||
							hasNoPageRelations ||
							isProcessedButMissingData
						);
					} catch (e) {
						return false;
					}
				});

				console.log(
					`Found ${brokenDocs.length} documents that need repair`
				);

				// Log some stats about the types of broken documents
				const incorrectFormatCount = brokenDocs.filter(
					(doc: any) =>
						typeof doc.document === 'object' &&
						doc.document !== null &&
						JSON.stringify(doc.document).startsWith('{"archiveId":')
				).length;

				const zeroPageCount = brokenDocs.filter(
					(doc: any) => doc.pageCount === 0
				).length;

				const noPageRelationsCount = brokenDocs.filter(
					(doc: any) => !doc.pages || doc.pages.length === 0
				).length;

				const processedMissingDataCount = brokenDocs.filter(
					(doc: any) =>
						typeof doc.document === 'object' &&
						doc.document !== null &&
						(doc.document as any).analysisComplete === true &&
						(!doc.pages ||
							doc.pages.length === 0 ||
							doc.pageCount === 0)
				).length;

				console.log(`Broken document types breakdown: 
          - Incorrect format: ${incorrectFormatCount}
          - Zero page count: ${zeroPageCount}
          - Missing page relations: ${noPageRelationsCount}
          - Processed but missing data: ${processedMissingDataCount}
        `);

				// Just return the list of document IDs that need repair
				const brokenDocIds = brokenDocs.map((doc: any) => doc.id);

				return NextResponse.json({
					status: 'success',
					message: `Found ${brokenDocIds.length} documents that need repair.`,
					brokenDocIds: brokenDocIds,
				});
			} catch (error) {
				console.error('Error finding broken documents:', error);
				return NextResponse.json(
					{
						error: 'Failed to identify broken documents',
						details: String(error),
					},
					{ status: 500 }
				);
			}
		}

		// Use documentId or archiveId as-is, since real JFK document IDs don't have leading slashes
		const documentArchiveId =
			archiveId || request.headers.get('X-Archive-ID') || documentId;

		if (!documentArchiveId) {
			return NextResponse.json(
				{ error: 'Document ID is required' },
				{ status: 400 }
			);
		}

		// Clean up the document ID to ensure it's in the correct format (no leading slashes)
		const cleanDocId = documentId
			? documentId.replace(/^\/+/, '')
			: request.headers.get('X-Document-ID') || 'unknown';

		// Check if the document exists and get its type (JFK or RFK)
		const docRecord = await prisma.document.findFirst({
			where: {
				OR: [{ id: cleanDocId }, { archiveId: cleanDocId }],
			},
			select: {
				documentType: true,
				documentGroup: true,
			},
		});

		// Determine document type with fallbacks
		// 1. Use type/group from request body if provided
		// 2. Use document group from database if available
		// 3. Use document type from database if available
		// 4. Infer from document ID if it contains 'rfk'
		// 5. Default to 'jfk'
		let effectiveDocType = 'jfk';

		// Check if explicitly provided in request
		if (documentType === 'rfk' || documentGroup === 'rfk') {
			effectiveDocType = 'rfk';
		}
		// Check database record
		else if (docRecord) {
			if (docRecord.documentGroup === 'rfk') {
				effectiveDocType = 'rfk';
			} else if (docRecord.documentType === 'rfk') {
				effectiveDocType = 'rfk';
			}
		}
		// Infer from document ID
		else if (cleanDocId.toLowerCase().includes('rfk')) {
			effectiveDocType = 'rfk';
		}

		// If documentUrl is not provided, construct it using our utility function
		// This will handle different release dates correctly and document types
		const fullDocumentUrl =
			documentUrl ||
			getArchivesGovUrl(cleanDocId, undefined, effectiveDocType);

		console.log(
			`Processing document: ${cleanDocId} with URL: ${fullDocumentUrl} (Type: ${effectiveDocType})`
		);
		console.log(
			`Requested steps: ${steps.length > 0 ? steps.join(', ') : 'all'}`
		);

		try {
			// Start by setting status to waitingForAnalysis (replacing 'processing')
			documentStatus[documentArchiveId] = {
				status: 'waitingForAnalysis',
				analysisComplete: false,
				timestamp: new Date().toISOString(),
			};

			// CRITICAL FIX: Check if the document already exists on disk but not in our database
			// This ensures we correctly handle documents that were processed externally but not saved to our DB
			try {
				// First check if document exists in DB already
				const existingDoc = await prisma.document.findFirst({
					where: {
						OR: [
							{ id: documentArchiveId },
							{ archiveId: documentArchiveId },
							{ oldId: documentArchiveId },
						],
					},
					select: {
						id: true,
						archiveId: true,
						oldId: true,
						document: true,
						processingDate: true,
						documentUrl: true,
						summary: true,
						allNames: true,
						allPlaces: true,
						allDates: true,
						allObjects: true,
						pages: { select: { id: true } },
					},
				});

				// Log for debugging
				console.log(
					`${
						existingDoc
							? 'Found existing document'
							: 'No existing document found'
					} for ${documentArchiveId}`
				);
				console.log(
					'existingDocument',
					existingDoc ? existingDoc.id : 'null'
				);

				// Check if document exists on disk but not in our database
				const mediaResponse = await fetch(
					`${API_BASE_URL}/api/jfk/media/status?id=${documentArchiveId}&collection=${effectiveDocType}`,
					{
						method: 'HEAD',
					}
				);

				let documentExistsOnDisk = false;
				let diskAnalysisComplete = false;

				if (mediaResponse.ok) {
					const statusHeader =
						mediaResponse.headers.get('X-Document-Status');
					if (statusHeader) {
						try {
							const mediaStatus = JSON.parse(statusHeader);
							documentExistsOnDisk = mediaStatus.exists === true;
							diskAnalysisComplete =
								mediaStatus.hasAnalysis === true;
						} catch (e) {
							console.error('Error parsing media status:', e);
						}
					}
				}

				// If document exists on disk but not in our database, we should fetch the analysis data and save it
				if (documentExistsOnDisk && !existingDoc) {
					console.log(
						`Document ${documentArchiveId} exists on disk but not in database, proceeding to publish it`
					);

					// Fetch complete analysis data with getLatestPageData=true
					const analysisData = await fetchDocumentAnalysis(
						documentArchiveId,
						effectiveDocType
					);

					// If we have analysis data, update or create in database with complete data
					if (analysisData) {
						console.log(analysisData); // Log the data for debugging
						await updateDocumentInDatabase(
							documentArchiveId,
							analysisData,
							diskAnalysisComplete
						);

						// If analysis is complete and we were only asked to index, we can return early
						if (
							diskAnalysisComplete &&
							steps.length === 1 &&
							steps[0] === 'indexDatabase'
						) {
							return NextResponse.json({
								documentId: documentArchiveId,
								documentUrl: fullDocumentUrl,
								status: 'ready',
								message:
									'Document successfully indexed with data from disk',
								steps: ['indexDatabase'],
								analysisComplete: true,
							});
						}
					}
				}

				if (existingDoc) {
					// Update existing document
					await prisma.document.update({
						where: { id: existingDoc.id },
						data: {
							processingDate: new Date(),
							documentUrl: fullDocumentUrl,
							// Store processing stage information in the document JSON
							document: {
								...(typeof existingDoc.document === 'object'
									? existingDoc.document
									: {}),
								processingStage: 'waitingForAnalysis', // Updated status
								processingSteps:
									steps.length > 0 ? steps : ['download'], // Starting with specified steps or default to download
								lastProcessed: new Date().toISOString(),
								requestedSteps: steps,
								// Reset analysis flag when reprocessing
								analysisComplete: false,
							},
						},
					});
				} else {
					// Create a new document record
					await prisma.document.create({
						data: {
							id: documentArchiveId, // Use it as the primary key if no existing document
							processingDate: new Date(),
							documentUrl: fullDocumentUrl,
							archiveId: documentArchiveId,
							// Add empty placeholder fields for content
							summary: null,
							fullText: null,
							allNames: [],
							allPlaces: [],
							allDates: [],
							allObjects: [],
							pageCount: 0, // Will be updated when processing completes
							// Store processing information in the document JSON
							document: {
								processingStage: 'waitingForAnalysis', // Updated status
								processingSteps:
									steps.length > 0 ? steps : ['download'],
								lastProcessed: new Date().toISOString(),
								requestedSteps: steps,
								archiveId: documentArchiveId,
								analysisComplete: false,
							},
						},
					});
				}
			} catch (dbError) {
				console.error('Error updating database:', dbError);
				// Continue processing even if DB update fails
			}

			// If indexDatabase is the only step requested, we can handle that here without calling external API
			if (steps.length === 1 && steps[0] === 'indexDatabase') {
				try {
					// Fetch the latest complete document analysis data with getLatestPageData=true
					const analysisData = await fetchDocumentAnalysis(
						documentArchiveId,
						effectiveDocType
					);

					if (!analysisData) {
						console.error(
							`No analysis data found for document ${documentArchiveId}`
						);
						return NextResponse.json(
							{
								documentId: documentArchiveId,
								documentUrl: fullDocumentUrl,
								status: 'waitingForAnalysis',
								message:
									'Failed to retrieve document analysis data',
								error: 'Analysis data not found',
								analysisComplete: false,
							},
							{ status: 404 }
						);
					}

					// Check if document has analysis completed
					const analysisComplete = Boolean(
						analysisData.pages && analysisData.pages.length > 0
					);

					// Update the database with the complete document data
					const updateSuccess = await updateDocumentInDatabase(
						documentArchiveId,
						analysisData,
						analysisComplete
					);

					return NextResponse.json({
						documentId: documentArchiveId,
						documentUrl: fullDocumentUrl,
						status: analysisComplete
							? 'ready'
							: 'waitingForAnalysis',
						message: updateSuccess
							? 'Document indexed in database with complete data'
							: 'Partial document data saved to database',
						steps: ['indexDatabase'],
						analysisComplete,
						dataDetails: {
							pageCount: analysisData.pages?.length || 0,
							hasSummary: Boolean(analysisData.summary),
							hasHandwrittenNotes:
								(analysisData.handwrittenNotes?.length || 0) >
								0,
							hasStamps: (analysisData.stamps?.length || 0) > 0,
						},
					});
				} catch (indexError) {
					console.error('Error indexing document:', indexError);
					return NextResponse.json(
						{
							documentId: documentArchiveId,
							documentUrl: fullDocumentUrl,
							status: 'waitingForAnalysis',
							message: 'Failed to index document in database',
							error: String(indexError),
							analysisComplete: false,
						},
						{ status: 500 }
					);
				}
			}

			// For all other steps, try to call the external API
			try {
				const response = await fetch(
					`${API_BASE_URL}/api/jfk/process`,
					{
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'X-Archive-ID': documentArchiveId,
						},
						body: JSON.stringify({
							documentUrl: fullDocumentUrl,
							archiveId: documentArchiveId,
							steps,
						}),
					}
				);

				// If the API is available, we'll handle streaming responses in the status endpoint
			} catch (error) {
				console.log('External API not available, using mock data');
				// We'll use mock data from the status endpoint
			}

			return NextResponse.json({
				documentId: documentArchiveId,
				documentUrl: fullDocumentUrl,
				status: 'waitingForAnalysis', // Use new status system
				message: 'Document processing started',
				steps:
					steps.length > 0
						? steps
						: [
								'download',
								'conversion',
								'analysis',
								'publishing',
								'indexing',
						  ],
				analysisComplete: false,
			});
		} catch (error) {
			console.error(
				`Error processing document ${documentArchiveId}:`,
				error
			);

			documentStatus[documentArchiveId] = {
				status: 'waitingForAnalysis', // Use new status system (no more 'failed')
				analysisComplete: false,
				timestamp: new Date().toISOString(),
			};

			// Update the database with error status
			try {
				await prisma.document.updateMany({
					where: {
						OR: [
							{ id: documentArchiveId },
							{ archiveId: documentArchiveId },
							{ oldId: documentArchiveId },
						],
					},
					data: {
						processingDate: new Date(),
						// Store error information in document JSON field
						document: {
							processingStage: 'waitingForAnalysis', // Use new status system
							lastProcessed: new Date().toISOString(),
							processingError: String(error),
							analysisComplete: false,
						},
					},
				});
			} catch (dbError) {
				console.error('Error updating database for failure:', dbError);
			}

			return NextResponse.json({
				documentId: documentArchiveId,
				documentUrl: fullDocumentUrl,
				status: 'waitingForAnalysis', // Use new status system
				message: 'Failed to process document',
				error: String(error),
				analysisComplete: false,
			});
		}
	} catch (error) {
		console.error('Error in process endpoint:', error);
		return NextResponse.json(
			{ error: 'Internal server error' },
			{ status: 500 }
		);
	}
}

// GET endpoint to check document status
export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const documentId = searchParams.get('documentId') || searchParams.get('id');
	const forceDataCheck = searchParams.get('forceDataCheck') === 'true';

	if (!documentId) {
		return NextResponse.json(
			{
				error: 'Document ID is required',
			},
			{ status: 400 }
		);
	}

	// Determine document type (collection) - default to 'jfk'
	let effectiveDocType = 'jfk';

	// Check if it's an RFK document from the ID
	if (documentId.toLowerCase().includes('rfk')) {
		effectiveDocType = 'rfk';
	}

	try {
		// Try to get status from database first
		let dbDocument = await prisma.document.findFirst({
			where: {
				OR: [
					{ id: documentId },
					{ archiveId: documentId },
					{ oldId: documentId },
				],
			},
			select: {
				id: true,
				archiveId: true,
				oldId: true,
				document: true,
				processingDate: true,
				documentUrl: true,
				summary: true,
				allNames: true,
				allPlaces: true,
				allDates: true,
				allObjects: true,
				pages: { select: { id: true } },
			},
		});

		if (dbDocument && dbDocument.document) {
			// Extract processing info from the document JSON field
			let docJson = dbDocument.document as any;

			// Check if analysis is complete
			let analysisComplete = docJson.analysisComplete === true;

			// Determine which steps have been completed
			const completedSteps = [];
			if (docJson.folderCreated) completedSteps.push('createFolder');
			if (docJson.pdfDownloaded) completedSteps.push('downloadPdf');
			if (docJson.pngCreated) completedSteps.push('createPngs');
			if (docJson.analysisComplete) completedSteps.push('analyzeImages');
			if (docJson.arweavePublished) completedSteps.push('publishArweave');
			if (docJson.summaryUpdated) completedSteps.push('updateSummary');
			if (docJson.indexedInDb) completedSteps.push('indexDatabase');

			// If the external system status shows "published" but we don't have the data, get it now
			const externalSystemStatus = docJson.processingStage;
			const isExternallyComplete =
				externalSystemStatus === 'ready' ||
				docJson.analysisComplete === true ||
				(completedSteps.includes('analyzeImages') &&
					completedSteps.includes('indexDatabase'));

			// If document is marked as analysis complete or is waiting for final steps, check if we need to update DB
			// Ensure we update if key metadata arrays are missing, even if analysis is marked complete
			const needsDataUpdate =
				(analysisComplete || isExternallyComplete || forceDataCheck) &&
				(!dbDocument.summary ||
					!dbDocument.allNames ||
					dbDocument.allNames.length === 0 ||
					!dbDocument.allPlaces ||
					dbDocument.allPlaces.length === 0 || // Check places
					!dbDocument.allDates ||
					dbDocument.allDates.length === 0 || // Check dates
					!dbDocument.allObjects || // Check objects (allow empty array)
					!dbDocument.pages ||
					dbDocument.pages.length === 0 ||
					!docJson.pages ||
					docJson.pages.length === 0 ||
					forceDataCheck);

			if (needsDataUpdate) {
				try {
					// Get the latest analysis data and update the document with all fields
					console.log(
						`[Status] Document ${documentId} needs data update (isExternallyComplete=${isExternallyComplete}, analysisComplete=${analysisComplete}). Fetching from media server...`
					);

					// First try with getLatestPageData for most complete information
					const analysisData = await fetchDocumentAnalysis(
						documentId,
						effectiveDocType
					);

					if (
						analysisData &&
						analysisData.pages &&
						analysisData.pages.length > 0
					) {
						console.log(
							`[Status] Got complete data with ${analysisData.pages.length} pages for ${documentId}`
						);

						// Force analysis complete if document shows as ready
						const updateResult = await updateDocumentInDatabase(
							documentId,
							analysisData,
							true
						);

						if (updateResult) {
							console.log(
								`[Status] Successfully updated document ${documentId} with complete data`
							);

							// Refresh document data after update
							const updatedDoc = await prisma.document.findUnique(
								{
									where: { id: dbDocument.id },
									select: {
										id: true,
										archiveId: true,
										oldId: true,
										document: true,
										processingDate: true,
										documentUrl: true,
										summary: true,
										allNames: true,
										allPlaces: true,
										allDates: true,
										allObjects: true,
										pages: { select: { id: true } },
									},
								}
							);

							if (updatedDoc) {
								// Use the refreshed data
								dbDocument = updatedDoc;
								docJson = updatedDoc.document as any;
								// Update analysis complete flag
								analysisComplete =
									docJson.analysisComplete === true;

								console.log(
									`[Status] Updated document now has: summary=${Boolean(
										updatedDoc.summary
									)}, pages=${updatedDoc.pages?.length || 0}`
								);
							}
						} else {
							console.error(
								`[Status] Failed to update document with complete data`
							);
						}
					} else {
						console.error(
							`[Status] Failed to get complete data for ${documentId} - analysis data not available`
						);
					}
				} catch (updateError) {
					console.error(
						`[Status] Error updating document ${documentId} with missing fields:`,
						updateError
					);
				}
			}

			return NextResponse.json({
				documentId,
				dbId: dbDocument.id,
				archiveId: dbDocument.archiveId || documentId,
				oldId: dbDocument.oldId,
				status: analysisComplete ? 'ready' : 'waitingForAnalysis', // Updated status system
				steps: docJson.processingSteps || [],
				completedSteps,
				timestamp:
					docJson.lastProcessed ||
					dbDocument.processingDate?.toISOString() ||
					null,
				error: docJson.processingError || null,
				documentUrl: dbDocument.documentUrl,
				analysisComplete,
				hasSummary: Boolean(dbDocument.summary),
				hasPages: (dbDocument.pages?.length || 0) > 0,
			});
		}

		// If document is not in database, try to fetch status directly from media server
		try {
			console.log(
				`[Status] Document ${documentId} not found in database, checking media server...`
			);

			// Check if document exists in media server
			const mediaResponse = await fetch(
				`${API_BASE_URL}/api/jfk/media/status?id=${documentId}&collection=${effectiveDocType}`,
				{
					method: 'HEAD',
				}
			);

			if (mediaResponse.ok) {
				// See if document is complete on media server
				let isComplete = false;
				let mediaCompleted = false;

				try {
					const statusHeader =
						mediaResponse.headers.get('X-Document-Status');
					if (statusHeader) {
						const statusInfo = JSON.parse(statusHeader);
						isComplete = statusInfo.hasAnalysis === true;
						mediaCompleted = statusInfo.hasAnalysis === true;
					}
				} catch (e) {
					console.error(
						`[Status] Error parsing media server status:`,
						e
					);
				}

				// If document is complete on media server but not in our DB, fetch and store it
				if (mediaCompleted) {
					console.log(
						`[Status] Document ${documentId} is complete on media server but not in our database. Fetching...`
					);

					try {
						// Fetch complete data
						const analysisData = await fetchDocumentAnalysis(
							documentId,
							effectiveDocType
						);

						if (
							analysisData &&
							analysisData.pages &&
							analysisData.pages.length > 0
						) {
							console.log(
								`[Status] Retrieved complete data from media server for ${documentId}. Saving to database...`
							);

							// Save to database
							const success = await updateDocumentInDatabase(
								documentId,
								analysisData,
								true
							);

							if (success) {
								console.log(
									`[Status] Successfully saved document ${documentId} to database`
								);

								// Fetch the newly created document
								const newDoc = await prisma.document.findFirst({
									where: {
										OR: [
											{ id: documentId },
											{ archiveId: documentId },
											{ oldId: documentId },
										],
									},
									select: {
										id: true,
										archiveId: true,
										oldId: true,
										document: true,
										processingDate: true,
										documentUrl: true,
										summary: true,
										allNames: true,
										allPlaces: true,
										allDates: true,
										allObjects: true,
									},
								});

								if (newDoc) {
									return NextResponse.json({
										documentId,
										dbId: newDoc.id,
										status: 'ready',
										analysisComplete: true,
										message:
											'Document retrieved from media server and saved to database',
										timestamp: new Date().toISOString(),
										hasSummary: Boolean(newDoc.summary),
										hasPages: true,
									});
								}
							}
						}
					} catch (fetchError) {
						console.error(
							`[Status] Error fetching document from media server:`,
							fetchError
						);
					}
				}
			}
		} catch (mediaError) {
			console.error(`[Status] Error checking media server:`, mediaError);
		}
	} catch (dbError) {
		console.error('[Status] Error querying database:', dbError);
	}

	// Fall back to in-memory status if DB query fails
	return NextResponse.json({
		documentId,
		...(documentStatus[documentId] || {
			status: 'waitingForAnalysis', // No more 'pending' - use new status system
			analysisComplete: false,
			timestamp: null,
		}),
	});
}

// Status check endpoint for media files
export async function HEAD(request: Request) {
	const { searchParams } = new URL(request.url);
	const documentId = searchParams.get('documentId') || searchParams.get('id');

	// Determine document type (collection) - default to 'jfk'
	let effectiveDocType = 'jfk';

	// Check if it's an RFK document from the ID
	if (documentId && documentId.toLowerCase().includes('rfk')) {
		effectiveDocType = 'rfk';
	}

	if (!documentId) {
		return new Response(null, {
			status: 400,
			headers: {
				'X-Error': 'Document ID is required',
			},
		});
	}

	try {
		// Check media server for document status
		const mediaResponse = await fetch(
			`${API_BASE_URL}/api/jfk/media/status?id=${documentId}&collection=${effectiveDocType}`,
			{
				method: 'HEAD',
			}
		);

		// Forward status headers from media server
		const headers = new Headers();

		// Set default status info with explicit typing to include all possible properties
		const statusInfo: {
			exists: boolean;
			hasFolder: boolean;
			hasPdf: boolean;
			hasPngs: boolean;
			hasAnalysis: boolean;
			hasArweave: boolean;
			hasLatestSummary: boolean;
			isIndexed?: boolean;
			dbId?: string;
			analysisComplete?: boolean;
			[key: string]: any; // Allow additional properties
		} = {
			exists: false,
			hasFolder: false,
			hasPdf: false,
			hasPngs: false,
			hasAnalysis: false,
			hasArweave: false,
			hasLatestSummary: false,
			analysisComplete: false,
		};

		if (mediaResponse.ok) {
			// Get headers from media server response
			mediaResponse.headers.forEach((value, key) => {
				headers.set(key, value);

				// Extract status information
				if (key === 'X-Document-Status' && value) {
					try {
						const parsed = JSON.parse(value);
						Object.assign(statusInfo, parsed);
					} catch (e) {
						console.error(
							'Error parsing X-Document-Status header:',
							e
						);
					}
				}
			});
		}

		// Check database for additional status info
		const dbDocument = await prisma.document.findFirst({
			where: {
				OR: [
					{ id: documentId },
					{ archiveId: documentId },
					{ oldId: documentId },
				],
			},
			select: {
				id: true,
				document: true,
				processingDate: true,
			},
		});

		if (dbDocument && dbDocument.document) {
			const docJson = dbDocument.document as any;

			// Update status info from DB
			if (docJson.folderCreated) statusInfo.hasFolder = true;
			if (docJson.pdfDownloaded) statusInfo.hasPdf = true;
			if (docJson.pngCreated) statusInfo.hasPngs = true;
			if (docJson.analysisComplete) {
				statusInfo.hasAnalysis = true;
				statusInfo.analysisComplete = true;
			}
			if (docJson.arweavePublished) statusInfo.hasArweave = true;
			if (docJson.summaryUpdated) statusInfo.hasLatestSummary = true;

			// Add DB-specific status info
			statusInfo.isIndexed = true;
			statusInfo.dbId = dbDocument.id;
		}

		// Add status using new system: based on analysis completion
		statusInfo.status = statusInfo.analysisComplete
			? 'ready'
			: 'waitingForAnalysis';

		// Set full status info in header
		headers.set('X-Document-Status', JSON.stringify(statusInfo));

		return new Response(null, {
			status: mediaResponse.ok ? 200 : 404,
			headers,
		});
	} catch (error) {
		console.error(`Error checking media status for ${documentId}:`, error);
		return new Response(null, {
			status: 500,
			headers: {
				'X-Error': String(error),
				'X-Document-Status': JSON.stringify({
					status: 'waitingForAnalysis',
					analysisComplete: false,
					exists: false,
				}),
			},
		});
	}
}

// Fix the type issue in normalizeDates function
function normalizeDates(dateStrings: string[] = []): {
	normalizedDates: any[];
	normalizedDateObjects: Date[];
	earliestDate: string | null;
	latestDate: string | null;
} {
	if (!dateStrings || dateStrings.length === 0) {
		return {
			normalizedDates: [],
			normalizedDateObjects: [],
			earliestDate: null,
			latestDate: null,
		};
	}

	try {
		console.log(
			`[Date Normalization] Processing ${dateStrings.length} date strings`
		);

		// Create a map to store normalized dates (to avoid duplicates)
		const dateMap = new Map<string, Date>();

		// Define month names for parsing
		const months: Record<string, number> = {
			january: 0,
			jan: 0,
			february: 1,
			feb: 1,
			march: 2,
			mar: 2,
			april: 3,
			apr: 3,
			may: 4,
			june: 5,
			jun: 5,
			july: 6,
			jul: 6,
			august: 7,
			aug: 7,
			september: 8,
			sep: 8,
			sept: 8,
			october: 9,
			oct: 9,
			november: 10,
			nov: 10,
			december: 11,
			dec: 11,
		};

		// Process each date string
		for (const dateStr of dateStrings) {
			try {
				if (!dateStr) continue;

				let date: Date | null = null;
				const normStr = dateStr.toLowerCase().trim();

				// Try various date formats

				// First try standard Date parsing (handles ISO dates, etc)
				date = new Date(dateStr);
				if (
					!isNaN(date.getTime()) &&
					date.getFullYear() > 1900 &&
					date.getFullYear() < 2100
				) {
					dateMap.set(dateStr, date);
					continue;
				}

				// Handle "DD Month YYYY" format (e.g., "21 May 1982")
				const dmyMatch = normStr.match(
					/(\d{1,2})\s+([a-z]+)\s+(\d{4})/
				);
				if (dmyMatch) {
					const day = parseInt(dmyMatch[1]);
					const monthName = dmyMatch[2];
					const year = parseInt(dmyMatch[3]);

					if (
						months[monthName] !== undefined &&
						year >= 1900 &&
						year < 2100 &&
						day >= 1 &&
						day <= 31
					) {
						date = new Date(year, months[monthName], day);
						if (!isNaN(date.getTime())) {
							dateMap.set(dateStr, date);
							continue;
						}
					}
				}

				// Handle month YYYY format (e.g., "June 1963")
				const myMatch = normStr.match(/([a-z]+)\s+(\d{4})/);
				if (myMatch) {
					const monthName = myMatch[1];
					const year = parseInt(myMatch[2]);

					if (
						months[monthName] !== undefined &&
						year >= 1900 &&
						year < 2100
					) {
						date = new Date(year, months[monthName], 1);
						if (!isNaN(date.getTime())) {
							dateMap.set(dateStr, date);
							continue;
						}
					}
				}

				// Handle year ranges (e.g., "1959-61")
				const yearRangeMatch = normStr.match(/(\d{4})-(\d{2})/);
				if (yearRangeMatch) {
					const startYear = parseInt(yearRangeMatch[1]);
					const endYearSuffix = parseInt(yearRangeMatch[2]);
					const endYear =
						Math.floor(startYear / 100) * 100 + endYearSuffix;

					if (
						startYear >= 1900 &&
						endYear < 2100 &&
						startYear < endYear
					) {
						// Store both the start and end years
						const startDate = new Date(startYear, 0, 1);
						const endDate = new Date(endYear, 11, 31);

						if (
							!isNaN(startDate.getTime()) &&
							!isNaN(endDate.getTime())
						) {
							dateMap.set(`${startYear}`, startDate);
							dateMap.set(`${endYear}`, endDate);
							continue;
						}
					}
				}

				// Handle just years (e.g., "1963")
				const yearMatch = normStr.match(/^(\d{4})$/);
				if (yearMatch) {
					const year = parseInt(yearMatch[1]);
					if (year >= 1900 && year < 2100) {
						date = new Date(year, 0, 1); // January 1st of that year
						if (!isNaN(date.getTime())) {
							dateMap.set(dateStr, date);
							continue;
						}
					}
				}
			} catch (error) {
				console.warn(
					`[Date Normalization] Could not parse date: ${dateStr}`,
					error
				);
			}
		}

		// Convert map to array of normalized date strings
		const dateEntries = Array.from(dateMap.entries());

		// Sort dates chronologically
		dateEntries.sort((a, b) => a[1].getTime() - b[1].getTime());

		// Create normalized date array with objects that have both original and normalized values
		const normalizedDates = dateEntries.map(([original, dateObj]) => ({
			originalText: original,
			normalized: dateObj.toISOString().split('T')[0], // YYYY-MM-DD format
		}));

		// Create an array of Date objects for Prisma
		const normalizedDateObjects = dateEntries.map(
			([_, dateObj]) => dateObj
		);

		// Get earliest and latest dates if available
		const earliestDate =
			dateEntries.length > 0 ? dateEntries[0][1].toISOString() : null;
		const latestDate =
			dateEntries.length > 0
				? dateEntries[dateEntries.length - 1][1].toISOString()
				: null;

		console.log(
			`[Date Normalization] Found ${normalizedDates.length} valid dates. Earliest: ${earliestDate}, Latest: ${latestDate}`
		);

		return {
			normalizedDates,
			normalizedDateObjects,
			earliestDate,
			latestDate,
		};
	} catch (error) {
		console.error('[Date Normalization] Error normalizing dates:', error);
		return {
			normalizedDates: [],
			normalizedDateObjects: [],
			earliestDate: null,
			latestDate: null,
		};
	}
}

async function fetchDocumentAnalysis(
	documentId: string,
	documentType: string = 'jfk'
) {
	try {
		// Ensure documentId format is consistent (no double slashes)
		const cleanId = documentId.replace(/^\/+/, '');
		// Use the correct URL format with getLatestPageData=true to ensure we get all fields
		const mediaApiUrl = `${API_BASE_URL}/api/jfk/media?id=${cleanId}&type=analysis&getLatestPageData=true&collection=${documentType}`;
		console.log(`Fetching document analysis from ${mediaApiUrl}`);

		const response = await fetch(mediaApiUrl, {
			method: 'GET',
			headers: {
				Accept: 'application/json',
			},
		});

		if (response.ok) {
			return await response.json();
		} else {
			console.error(
				`Failed to fetch analysis: ${response.status} ${response.statusText}`
			);
			return null;
		}
	} catch (error) {
		console.error('Error fetching document analysis:', error);
		return null;
	}
}

// Enhance the updateDocumentInDatabase function with better error handling
async function updateDocumentInDatabase(
	documentId: string,
	analysisData: any,
	isComplete: boolean = false
) {
	console.log(
		`[updateDocumentInDatabase] Updating document ${documentId} with ${
			isComplete ? 'complete' : 'partial'
		} data`
	);
	try {
		if (!analysisData) {
			console.error(
				'[DB Update] No analysis data provided for database update'
			);
			return false;
		}

		// Clean the document ID to ensure it's consistent
		const cleanId = documentId.replace(/^\/+/, '');

		console.log(
			`[DB Update] Updating document ${cleanId} with ${
				isComplete ? 'complete' : 'partial'
			} data`
		);

		try {
			// Find existing document
			const existingDoc = await prisma.document.findFirst({
				where: {
					OR: [
						{ id: cleanId },
						{ archiveId: cleanId },
						{ oldId: cleanId },
					],
				},
			});

			if (existingDoc) {
				console.log(
					`[DB Update] Found existing document: ${existingDoc.id}`
				);
			} else {
				console.log(
					`[DB Update] No existing document found, will create new one with ID: ${cleanId}`
				);
			}

			// Extract page, handwritten notes, and stamps data if available
			const pages = analysisData.pages || [];
			const handwrittenNotes = analysisData.handwrittenNotes || [];
			const stamps = analysisData.stamps || [];

			console.log(
				`[DB Update] Analysis data contains: ${pages.length} pages, ${handwrittenNotes.length} notes, ${stamps.length} stamps`
			);

			// Log key fields for debugging
			console.log(
				`[DB Update] Summary present: ${Boolean(analysisData.summary)}`
			);
			console.log(
				`[DB Update] Full text present: ${Boolean(
					analysisData.fullText
				)}`
			);
			console.log(
				`[DB Update] Names array: ${
					(analysisData.allNames || []).length
				} items`
			);
			console.log(
				`[DB Update] Dates array: ${
					(analysisData.allDates || []).length
				} items`
			);

			// Process dates with error handling
			let dateInfo: {
				normalizedDates: any[];
				normalizedDateObjects: Date[];
				earliestDate: string | null;
				latestDate: string | null;
			} = {
				normalizedDates: [],
				normalizedDateObjects: [],
				earliestDate: null,
				latestDate: null,
			};

			try {
				if (Array.isArray(analysisData.allDates)) {
					dateInfo = normalizeDates(analysisData.allDates || []);
					console.log(
						`[DB Update] Normalized ${dateInfo.normalizedDates.length} dates`
					);
				} else {
					console.log(
						`[DB Update] Skipping date normalization - allDates is not an array`
					);
				}
			} catch (dateError) {
				console.error(
					`[DB Update] Error normalizing dates:`,
					dateError
				);
			}

			// Prepare database update with all relevant fields
			const dbUpdateData: any = {
				archiveId: cleanId,
				documentUrl: analysisData.documentUrl || null,
				processingDate: new Date(),
				// Set all the individual fields from the analysis data
				pageCount: analysisData.pageCount || pages.length,
				title: analysisData.title || null, // Add title field
				summary: analysisData.summary || null,
				fullText: analysisData.fullText || null,
				allNames: analysisData.allNames || [],
				allPlaces: analysisData.allPlaces || [],
				allDates: analysisData.allDates || [],
				allObjects: analysisData.allObjects || [],
				searchText: analysisData.summary || null,
				// Normalize dates - use our processed date information or existing values
				// Convert to proper Date objects for Prisma compatibility
				earliestDate: dateInfo.earliestDate
					? new Date(dateInfo.earliestDate)
					: analysisData.earliestDate
					? new Date(analysisData.earliestDate)
					: null,
				latestDate: dateInfo.latestDate
					? new Date(dateInfo.latestDate)
					: analysisData.latestDate
					? new Date(analysisData.latestDate)
					: null,
				// Use the Date objects array for Prisma
				normalizedDates: dateInfo.normalizedDateObjects || [],
				// Set flags based on data presence
				hasHandwrittenNotes: handwrittenNotes.length > 0,
				hasStamps: stamps.length > 0,
				hasFullText: Boolean(analysisData.fullText),
				// Set processing metadata
				processingStage: isComplete ? 'ready' : 'waitingForAnalysis',
				lastProcessed: new Date(),
				// Store the complete document data
				document: {
					...analysisData,
					processingStage: isComplete
						? 'ready'
						: 'waitingForAnalysis',
					lastProcessed: new Date().toISOString(),
					indexedInDb: true,
					folderCreated: true,
					pdfDownloaded: true,
					pngCreated: true,
					analysisComplete: isComplete,
					summaryUpdated: true,
					// Also add the normalized date information to the JSON document field
					earliestDate:
						dateInfo.earliestDate ||
						analysisData.earliestDate ||
						null,
					latestDate:
						dateInfo.latestDate || analysisData.latestDate || null,
					normalizedDates:
						dateInfo.normalizedDates ||
						analysisData.normalizedDates ||
						[],
				},
			};

			// Create pages, handwritten notes, and stamps relationships if available
			if (pages.length > 0) {
				dbUpdateData.pages = {
					deleteMany: {}, // Clear existing pages first
					create: pages.map((page: any, index: number) => ({
						pageNumber: page.pageNumber || index + 1,
						imagePath:
							page.imagePath ||
							`${cleanId}/page-${index + 1}.png`,
						summary: page.summary || null,
						fullText: page.fullText || null,
						hasImage: true,
						hasText: Boolean(page.fullText),
					})),
				};
			}

			// Add handwritten notes if available
			if (handwrittenNotes.length > 0) {
				dbUpdateData.handwrittenNotes = {
					deleteMany: {}, // Clear existing notes first
					create: handwrittenNotes.map((note: any) => ({
						pageNumber: note.pageNumber || 1,
						content: note.content || '',
						location: note.location || '',
					})),
				};
			}

			// Add document stamps if available
			if (stamps.length > 0) {
				dbUpdateData.documentStamps = {
					deleteMany: {}, // Clear existing stamps first
					create: stamps.map((stamp: any) => ({
						pageNumber: stamp.pageNumber || 1,
						type: stamp.type || 'unknown',
						text: stamp.text || '',
						date: stamp.date || '',
					})),
				};
			}

			try {
				// --> ADD LOGGING HERE <--
				console.log(
					'[DB Update] Final dbUpdateData before saving:',
					JSON.stringify(dbUpdateData, null, 2)
				);

				if (existingDoc) {
					// Update existing document
					await prisma.document.update({
						where: { id: existingDoc.id },
						data: dbUpdateData,
					});
					console.log(
						`[DB Update] Successfully updated existing document ${cleanId} with complete data`
					);
				} else {
					// Create new document
					await prisma.document.create({
						data: {
							id: cleanId,
							...dbUpdateData,
						},
					});
					console.log(
						`[DB Update] Successfully created new document ${cleanId} with complete data`
					);
				}

				return true;
			} catch (dbError) {
				console.error(
					`[DB Update] Database operation failed:`,
					dbError
				);
				return false;
			}
		} catch (findError) {
			console.error(
				`[DB Update] Error finding document in database:`,
				findError
			);
			return false;
		}
	} catch (error) {
		console.error(
			`[DB Update] Error updating document ${documentId} in database:`,
			error
		);
		return false;
	}
}

// Add a direct update function we can call for testing
async function forceDocumentUpdate(documentId: string): Promise<boolean> {
	try {
		console.log(
			`[forceDocumentUpdate] Forcing update for document ${documentId}`
		);

		// Determine document type from ID
		const isRfkDocument = documentId.toLowerCase().includes('rfk');
		const docType = isRfkDocument ? 'rfk' : 'jfk';

		// First try with getLatestPageData for most complete information
		const analysisData = await fetchDocumentAnalysis(documentId, docType);

		if (
			analysisData &&
			analysisData.pages &&
			analysisData.pages.length > 0
		) {
			// Update the database
			const success = await updateDocumentInDatabase(
				documentId,
				analysisData,
				true
			);

			if (success) {
				console.log(
					`[forceDocumentUpdate] Successfully updated document ${documentId}`
				);
				return true;
			} else {
				console.error(
					`[forceDocumentUpdate] Failed to update document ${documentId}`
				);
				return false;
			}
		} else {
			console.error(
				`[forceDocumentUpdate] Failed to get complete data for ${documentId} - analysis data not available`
			);
			return false;
		}
	} catch (error) {
		console.error(
			`[forceDocumentUpdate] Error updating document ${documentId}:`,
			error
		);
		return false;
	}
}
