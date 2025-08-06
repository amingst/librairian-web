import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';
import { JFKDocument } from '@/utils/jfk/types';

// Force disable caching for this API route
export const fetchCache = 'force-no-store';
export const dynamic = 'force-dynamic';

// Define interfaces for our data types
interface GraphNode {
	id: string;
	type: string;
	group: string;
	data: {
		title?: string;
		name?: string;
		place?: string;
		object?: string;
		[key: string]: any;
	};
}

interface GraphLink {
	source: string;
	target: string;
	type: string;
}

interface RelatedDocument {
	id: string;
	title: string | null;
	allNames: string[] | null;
	allPlaces: string[] | null;
	allObjects: string[] | null;
}

async function getDebugInfo(documentId: string) {
	try {
		// Add your debug logic here
		const debugData = {
			documentId,
			timestamp: new Date().toISOString(),
			// Add other debug information you need
		};

		return debugData;
	} catch (error) {
		return {
			error: 'Failed to get debug info',
			details: error instanceof Error ? error.message : 'Unknown error',
		};
	}
}

export async function GET(request: NextRequest) {
	const searchParams = request.nextUrl.searchParams;
	const type = searchParams.get('type') || 'network';
	const documentId = searchParams.get('documentId');
	const layers = parseInt(searchParams.get('layers') || '2', 10);

	// Limit layers between 1 and 5
	const connectionLayers = Math.min(Math.max(layers, 1), 5);

	if (!documentId && type === 'network') {
		return NextResponse.json(
			{ error: 'Document ID is required' },
			{ status: 400 }
		);
	}

	try {
		// Check if document exists first when documentId is provided
		if (documentId) {
			const document = await prisma.document.findUnique({
				where: { id: documentId },
				select: { id: true, title: true },
			});

			if (!document) {
				return NextResponse.json(
					{ error: `Document with ID ${documentId} not found` },
					{ status: 404 }
				);
			}
		}

		// Handle different types of data requests
		switch (type) {
			case 'network':
				if (!documentId) {
					return NextResponse.json(
						{
							error: 'Document ID is required for network visualization',
						},
						{ status: 400 }
					);
				}
				const document = await prisma.document.findUnique({
					where: { id: documentId },
					select: { title: true },
				});
				return await getNetworkData(
					documentId,
					document?.title || documentId,
					connectionLayers
				);

			case 'timeline':
				if (documentId) {
					return await getTimelineData(documentId);
				} else {
					// If no document ID is provided, return date statistics for all documents
					return await getDateStatistics();
				}

			case 'geo':
				if (documentId) {
					return await getGeoData(documentId);
				} else {
					// If no document ID is provided, return place statistics for all documents
					return await getPlaceDocuments(null);
				}

			case 'dates':
				return await getDateStatistics();

			case 'places':
				const placeName = searchParams.get('name');
				return await getPlaceDocuments(placeName);

			case 'people':
				const personName = searchParams.get('name');
				return await getPersonDocuments(personName);

			case 'objects':
				const objectName = searchParams.get('name');
				return await getObjectDocuments(objectName);

			case 'debug':
				// For debugging connection to the database
				const debugInfo = await getDebugInfo(documentId || '');
				return NextResponse.json(debugInfo);

			default:
				return NextResponse.json(
					{ error: `Unknown visualization type: ${type}` },
					{ status: 400 }
				);
		}
	} catch (error) {
		console.error('Error in connections API:', error);
		return NextResponse.json(
			{
				error: 'Failed to fetch connection data',
				details: error instanceof Error ? error.message : undefined,
			},
			{ status: 500 }
		);
	} finally {
		await prisma.$disconnect();
	}
}

async function getNetworkData(
	documentId: string,
	documentTitle: string,
	layers: number
) {
	console.log(
		`Getting network data for document ID: ${documentId} with ${layers} connection layers`
	);

	// Get all entities for this document
	const entityData = await prisma.document.findUnique({
		where: { id: documentId },
		select: {
			allNames: true,
			allPlaces: true,
			allObjects: true,
		},
	});

	if (!entityData) {
		console.log(`No entity data found for document ${documentId}`);
		return NextResponse.json({ results: { nodes: [], links: [] } });
	}

	// Extract unique entities
	const persons = entityData.allNames || [];
	const places = entityData.allPlaces || [];
	const objects = entityData.allObjects || [];

	console.log(
		`Found ${persons.length} persons, ${places.length} places, and ${objects.length} objects`
	);

	// Create nodes and links arrays
	const nodes: GraphNode[] = [
		// Source document node
		{
			id: documentId,
			type: 'document',
			group: 'source',
			data: { title: documentTitle || documentId },
		},
	];

	const links: GraphLink[] = [];

	// Track all entities for later use
	const allEntityIds: { [key: string]: string } = {};

	// Add person nodes and links
	persons.forEach((person: string) => {
		const personId = `person-${person.toLowerCase().replace(/\s+/g, '-')}`;
		allEntityIds[person] = personId;
		nodes.push({
			id: personId,
			type: 'person',
			group: 'entity',
			data: { name: person },
		});
		links.push({
			source: documentId,
			target: personId,
			type: 'mentions_person',
		});
	});

	// Add place nodes and links
	places.forEach((place: string) => {
		const placeId = `place-${place.toLowerCase().replace(/\s+/g, '-')}`;
		allEntityIds[place] = placeId;
		nodes.push({
			id: placeId,
			type: 'place',
			group: 'entity',
			data: { place: place },
		});
		links.push({
			source: documentId,
			target: placeId,
			type: 'mentions_place',
		});
	});

	// Add object nodes and links
	objects.forEach((object: string) => {
		const objectId = `object-${object.toLowerCase().replace(/\s+/g, '-')}`;
		allEntityIds[object] = objectId;
		nodes.push({
			id: objectId,
			type: 'object',
			group: 'entity',
			data: { object: object },
		});
		links.push({
			source: documentId,
			target: objectId,
			type: 'mentions_object',
		});
	});

	// If we only want 1 layer (just the entities directly connected to the source document), return now
	if (layers <= 1) {
		console.log(
			'Returning only first layer connections (entities directly connected to source document)'
		);
		return NextResponse.json({
			results: {
				nodes,
				links,
			},
		});
	}

	// Create a set of all entities (persons, places, objects)
	const allEntities = [...persons, ...places, ...objects];

	// Track the added document IDs to avoid duplicates
	const addedDocumentIds = new Set([documentId]);

	// Track entity relationships (which entities appear together)
	const entityRelationships: { [key: string]: Set<string> } = {};

	// Initialize relationship tracking for each entity
	allEntities.forEach((entity) => {
		entityRelationships[entity] = new Set();
	});

	// Get related documents (documents that mention the same entities)
	// Only if we have some entities to match on
	if (allEntities.length > 0) {
		console.log(
			`Searching for related documents with the same entities...`
		);

		// First, get directly related documents (share at least one entity with source document)
		const relatedDocuments = await prisma.document.findMany({
			where: {
				id: { not: documentId },
				OR: [
					...(persons.length > 0
						? [{ allNames: { hasSome: persons } }]
						: []),
					...(places.length > 0
						? [{ allPlaces: { hasSome: places } }]
						: []),
					...(objects.length > 0
						? [{ allObjects: { hasSome: objects } }]
						: []),
				],
			},
			select: {
				id: true,
				title: true,
				allNames: true,
				allPlaces: true,
				allObjects: true,
				oldId: true,
				archiveId: true,
			},
			take: 30,
		});

		console.log(`Found ${relatedDocuments.length} related documents`);

		// Log document IDs to help troubleshoot
		console.log(
			'Related document IDs:',
			relatedDocuments.map((doc) => doc.id)
		);

		// Check for any documents that still have oldId or archiveId values (should be none)
		const docsWithOldId = relatedDocuments.filter(
			(doc) => doc.oldId !== null
		);
		const docsWithArchiveId = relatedDocuments.filter(
			(doc) => doc.archiveId !== null
		);

		if (docsWithOldId.length > 0) {
			console.warn(
				`WARNING: Found ${docsWithOldId.length} documents with non-null oldId values`
			);
			console.warn(
				'This should not happen if the fields were cleared properly'
			);
		}

		if (docsWithArchiveId.length > 0) {
			console.warn(
				`WARNING: Found ${docsWithArchiveId.length} documents with non-null archiveId values`
			);
			console.warn(
				'This should not happen if the fields were cleared properly'
			);
		}

		// NEW: Count documents that appear to be duplicates based on title and entity counts
		const titleMap = new Map();
		relatedDocuments.forEach((doc) => {
			const titleKey = doc.title || doc.id;
			if (!titleMap.has(titleKey)) {
				titleMap.set(titleKey, []);
			}
			titleMap.get(titleKey).push(doc.id);
		});

		// Log any titles that appear multiple times
		let duplicateTitlesFound = false;
		titleMap.forEach((docIds, title) => {
			if (docIds.length > 1) {
				duplicateTitlesFound = true;
				console.warn(
					`Found ${docIds.length} documents with the same title: "${title}"`
				);
				console.warn('Document IDs:', docIds);
			}
		});

		if (!duplicateTitlesFound) {
			console.log('No documents with duplicate titles found');
		}

		// Deduplicate related documents to avoid showing the same document with different IDs
		// We prioritize keeping documents with dash-format IDs (newer format)
		const uniqueDocMap = new Map();
		const duplicateTracker = new Set();

		// First pass - identify duplicates based on oldId/archiveId relationships
		relatedDocuments.forEach((doc) => {
			// Skip the source document
			if (doc.id === documentId) return;

			// Create a unique content signature (can be enhanced based on your data)
			// If two documents have identical titles and the same number of entities, they're likely dupes
			const hasDashes = doc.id.includes('-');
			let titleSignature = `${doc.title}`;
			let entityCount =
				(doc.allNames?.length || 0) +
				(doc.allPlaces?.length || 0) +
				(doc.allObjects?.length || 0);

			// Check for direct ID relationships
			// 1. If this doc's oldId matches another doc's id or vice versa
			// 2. If this doc's archiveId matches another doc's id or vice versa
			// 3. If this doc's id matches another doc's archiveId
			for (const otherDoc of relatedDocuments) {
				if (doc.id === otherDoc.id) continue; // Skip self-comparison

				// Check if there's a relationship between these docs
				const isRelated =
					(doc.oldId && doc.oldId === otherDoc.id) ||
					(otherDoc.oldId && otherDoc.oldId === doc.id) ||
					(doc.archiveId && doc.archiveId === otherDoc.id) ||
					(otherDoc.archiveId && otherDoc.archiveId === doc.id);

				if (isRelated) {
					// Mark as duplicate - we'll decide which to keep based on ID format
					const otherHasDashes = otherDoc.id.includes('-');

					if (hasDashes && !otherHasDashes) {
						// This one has dashes and other doesn't - mark other as duplicate
						duplicateTracker.add(otherDoc.id);
					} else if (!hasDashes && otherHasDashes) {
						// Other has dashes and this one doesn't - mark this as duplicate
						duplicateTracker.add(doc.id);
					} else {
						// Both or neither have dashes - keep the alphabetically first one
						const toRemove =
							doc.id < otherDoc.id ? otherDoc.id : doc.id;
						duplicateTracker.add(toRemove);
					}

					// Once we find a relationship, we can stop checking
					break;
				}
			}

			// Also check for identical content when no direct ID relationship is found
			const contentKey = `${titleSignature}-${entityCount}`;
			if (!uniqueDocMap.has(contentKey)) {
				uniqueDocMap.set(contentKey, []);
			}
			uniqueDocMap.get(contentKey).push(doc);
		});

		// Second pass - resolve duplicates with the same content signature
		uniqueDocMap.forEach((docs) => {
			if (docs.length > 1) {
				// Multiple docs with the same content signature - keep the one with dash format ID
				const dashDoc = docs.find(({ d }: { d: JFKDocument }) =>
					d.id.includes('-')
				);
				const docToKeep = dashDoc || docs[0]; // Keep dash format if found, otherwise first one

				docs.forEach(({ d }: { d: JFKDocument }) => {
					if (d.id !== docToKeep.id) {
						duplicateTracker.add(d.id);
					}
				});
			}
		});

		// Filter out duplicates
		const dedupedRelatedDocs = relatedDocuments.filter(
			(doc) => !duplicateTracker.has(doc.id)
		);
		console.log(
			`Removed ${
				relatedDocuments.length - dedupedRelatedDocs.length
			} duplicate documents`
		);

		// Process each deduplicated related document
		dedupedRelatedDocs.forEach((relDoc) => {
			const relatedPersons = relDoc.allNames || [];
			const relatedPlaces = relDoc.allPlaces || [];
			const relatedObjects = relDoc.allObjects || [];

			// Add related document node if not already added
			if (!addedDocumentIds.has(relDoc.id)) {
				nodes.push({
					id: relDoc.id,
					type: 'document',
					group: 'related',
					data: { title: relDoc.title || relDoc.id },
				});
				addedDocumentIds.add(relDoc.id);
			}

			// Track entities that appear together in this document
			const docEntities = [
				...relatedPersons,
				...relatedPlaces,
				...relatedObjects,
			];

			// Add intra-document entity relationships
			// This builds the relationship map of which entities appear together
			docEntities.forEach((entity1) => {
				if (allEntities.includes(entity1)) {
					docEntities.forEach((entity2) => {
						if (
							entity1 !== entity2 &&
							allEntities.includes(entity2)
						) {
							if (!entityRelationships[entity1]) {
								entityRelationships[entity1] = new Set();
							}
							entityRelationships[entity1].add(entity2);

							if (!entityRelationships[entity2]) {
								entityRelationships[entity2] = new Set();
							}
							entityRelationships[entity2].add(entity1);
						}
					});
				}
			});

			// Add links to shared entities from the related document
			persons.forEach((person: string) => {
				if (relatedPersons.includes(person)) {
					const personId = `person-${person
						.toLowerCase()
						.replace(/\s+/g, '-')}`;
					links.push({
						source: relDoc.id,
						target: personId,
						type: 'mentions_person',
					});
				}
			});

			places.forEach((place: string) => {
				if (relatedPlaces.includes(place)) {
					const placeId = `place-${place
						.toLowerCase()
						.replace(/\s+/g, '-')}`;
					links.push({
						source: relDoc.id,
						target: placeId,
						type: 'mentions_place',
					});
				}
			});

			objects.forEach((object: string) => {
				if (relatedObjects.includes(object)) {
					const objectId = `object-${object
						.toLowerCase()
						.replace(/\s+/g, '-')}`;
					links.push({
						source: relDoc.id,
						target: objectId,
						type: 'mentions_object',
					});
				}
			});

			// Only add secondary entities if we're showing 3 or more layers
			if (layers >= 3) {
				// Add additional entities from the related document (second-degree connections)
				// Only add entities that aren't already in our main document
				relatedPersons.forEach((person) => {
					if (!persons.includes(person)) {
						const personId = `person-${person
							.toLowerCase()
							.replace(/\s+/g, '-')}`;
						// Check if this node already exists
						if (!nodes.some((node) => node.id === personId)) {
							nodes.push({
								id: personId,
								type: 'person',
								group: 'secondary',
								data: { name: person },
							});
						}
						links.push({
							source: relDoc.id,
							target: personId,
							type: 'mentions_person',
						});
					}
				});

				relatedPlaces.forEach((place) => {
					if (!places.includes(place)) {
						const placeId = `place-${place
							.toLowerCase()
							.replace(/\s+/g, '-')}`;
						// Check if this node already exists
						if (!nodes.some((node) => node.id === placeId)) {
							nodes.push({
								id: placeId,
								type: 'place',
								group: 'secondary',
								data: { place: place },
							});
						}
						links.push({
							source: relDoc.id,
							target: placeId,
							type: 'mentions_place',
						});
					}
				});

				relatedObjects.forEach((object) => {
					if (!objects.includes(object)) {
						const objectId = `object-${object
							.toLowerCase()
							.replace(/\s+/g, '-')}`;
						// Check if this node already exists
						if (!nodes.some((node) => node.id === objectId)) {
							nodes.push({
								id: objectId,
								type: 'object',
								group: 'secondary',
								data: { object: object },
							});
						}
						links.push({
							source: relDoc.id,
							target: objectId,
							type: 'mentions_object',
						});
					}
				});
			}
		});

		// Now, add entity-to-entity connections (showing which entities appear together)
		// This will help visualize the overlapping relationships
		const addedEntityLinks = new Set(); // To avoid duplicate links

		Object.entries(entityRelationships).forEach(
			([entity1, relatedEntitiesSet]) => {
				if (allEntityIds[entity1]) {
					relatedEntitiesSet.forEach((entity2) => {
						if (allEntityIds[entity2]) {
							// Skip adding connections between two person entities
							// This prevents the over-constraining of the visualization
							const entity1Id = allEntityIds[entity1];
							const entity2Id = allEntityIds[entity2];
							const isPerson1 = entity1Id.startsWith('person-');
							const isPerson2 = entity2Id.startsWith('person-');

							// Skip if both are person entities
							if (isPerson1 && isPerson2) {
								return;
							}

							// Create a unique key for this entity pair (alphabetically sorted to avoid duplicates)
							const linkKey = [entity1Id, entity2Id]
								.sort()
								.join('-');

							if (!addedEntityLinks.has(linkKey)) {
								links.push({
									source: entity1Id,
									target: entity2Id,
									type: 'related_entity',
								});
								addedEntityLinks.add(linkKey);
							}
						}
					});
				}
			}
		);

		// Only add tertiary connections (layer 4) if requested
		if (layers >= 4) {
			// Get secondary entities (entities that were introduced from related documents)
			const secondaryEntities = nodes
				.filter((node) => node.group === 'secondary')
				.map((node) => {
					if (node.type === 'person') return node.data.name;
					if (node.type === 'place') return node.data.place;
					if (node.type === 'object') return node.data.object;
					return null;
				})
				.filter(Boolean);

			// Only proceed if we have some secondary entities
			if (secondaryEntities.length > 0) {
				// Get tertiary documents (documents that relate to our secondary entities)
				const tertiaryDocuments = await prisma.document.findMany({
					where: {
						id: { notIn: Array.from(addedDocumentIds) },
						OR: [
							{
								allNames: {
									hasSome: secondaryEntities.filter(
										(e) => typeof e === 'string'
									) as string[],
								},
							},
							{
								allPlaces: {
									hasSome: secondaryEntities.filter(
										(e) => typeof e === 'string'
									) as string[],
								},
							},
							{
								allObjects: {
									hasSome: secondaryEntities.filter(
										(e) => typeof e === 'string'
									) as string[],
								},
							},
						],
					},
					select: {
						id: true,
						title: true,
						allNames: true,
						allPlaces: true,
						allObjects: true,
						oldId: true, // For deduplication
						archiveId: true, // For deduplication
					},
					take: 15, // Limit to avoid overwhelming the visualization
				});

				console.log(
					`Found ${tertiaryDocuments.length} tertiary documents for layer 4`
				);

				// Deduplicate tertiary documents using the same approach as for related documents
				const tertiaryDuplicateTracker = new Set();

				// Check for duplicates against both already added documents and within the tertiary set
				tertiaryDocuments.forEach((tertDoc) => {
					// Check if this document is a duplicate of any already added document (exact ID match)
					if (addedDocumentIds.has(tertDoc.id)) {
						tertiaryDuplicateTracker.add(tertDoc.id);
					}

					// Check for related ID matches
					for (const addedId of addedDocumentIds) {
						if (
							(tertDoc.oldId && tertDoc.oldId === addedId) ||
							(tertDoc.archiveId && tertDoc.archiveId === addedId)
						) {
							tertiaryDuplicateTracker.add(tertDoc.id);
							break;
						}
					}

					// Check for duplicates within tertiary documents
					if (!tertiaryDuplicateTracker.has(tertDoc.id)) {
						for (const otherDoc of tertiaryDocuments) {
							if (tertDoc.id === otherDoc.id) continue; // Skip self

							if (
								(tertDoc.oldId &&
									tertDoc.oldId === otherDoc.id) ||
								(otherDoc.oldId &&
									otherDoc.oldId === tertDoc.id) ||
								(tertDoc.archiveId &&
									tertDoc.archiveId === otherDoc.id) ||
								(otherDoc.archiveId &&
									otherDoc.archiveId === tertDoc.id)
							) {
								// Similar to main documents, prefer dash format IDs
								const tertHasDashes = tertDoc.id.includes('-');
								const otherHasDashes =
									otherDoc.id.includes('-');

								if (tertHasDashes && !otherHasDashes) {
									tertiaryDuplicateTracker.add(otherDoc.id);
								} else if (!tertHasDashes && otherHasDashes) {
									tertiaryDuplicateTracker.add(tertDoc.id);
								} else {
									const toRemove =
										tertDoc.id < otherDoc.id
											? otherDoc.id
											: tertDoc.id;
									tertiaryDuplicateTracker.add(toRemove);
								}
								break;
							}
						}
					}
				});

				// Filter out duplicates from tertiary documents
				const dedupedTertiaryDocs = tertiaryDocuments.filter(
					(doc) => !tertiaryDuplicateTracker.has(doc.id)
				);
				console.log(
					`Removed ${
						tertiaryDocuments.length - dedupedTertiaryDocs.length
					} duplicate tertiary documents`
				);

				// Add tertiary documents and their connections to secondary entities
				dedupedTertiaryDocs.forEach((tertDoc) => {
					if (!addedDocumentIds.has(tertDoc.id)) {
						nodes.push({
							id: tertDoc.id,
							type: 'document',
							group: 'secondary', // Mark as secondary document
							data: { title: tertDoc.title || tertDoc.id },
						});
						addedDocumentIds.add(tertDoc.id);

						// Connect to relevant entities we already have in our graph
						const tertDocPersons = tertDoc.allNames || [];
						const tertDocPlaces = tertDoc.allPlaces || [];
						const tertDocObjects = tertDoc.allObjects || [];

						// Only connect to secondary entities we already have in our graph
						nodes.forEach((node) => {
							if (node.group === 'secondary') {
								// Only connect to secondary entities
								if (
									node.type === 'person' &&
									node.data.name &&
									tertDocPersons.includes(node.data.name)
								) {
									links.push({
										source: tertDoc.id,
										target: node.id,
										type: 'mentions_person',
									});
								} else if (
									node.type === 'place' &&
									node.data.place &&
									tertDocPlaces.includes(node.data.place)
								) {
									links.push({
										source: tertDoc.id,
										target: node.id,
										type: 'mentions_place',
									});
								} else if (
									node.type === 'object' &&
									node.data.object &&
									tertDocObjects.includes(node.data.object)
								) {
									links.push({
										source: tertDoc.id,
										target: node.id,
										type: 'mentions_object',
									});
								}
							}
						});

						// For layer 5, add new entities from tertiary documents
						if (layers >= 5 && nodes.length < 200) {
							// Limit to prevent overwhelming visualization
							// Add new people from tertiary documents (limited to 2 per document)
							tertDocPersons.slice(0, 2).forEach((person) => {
								if (
									!nodes.some(
										(n) =>
											n.type === 'person' &&
											n.data.name === person
									)
								) {
									const personId = `person-${person
										.toLowerCase()
										.replace(/\s+/g, '-')}`;
									nodes.push({
										id: personId,
										type: 'person',
										group: 'secondary', // Still mark as secondary
										data: { name: person },
									});

									links.push({
										source: tertDoc.id,
										target: personId,
										type: 'mentions_person',
									});
								}
							});

							// Add new places from tertiary documents (limited to 2 per document)
							tertDocPlaces.slice(0, 2).forEach((place) => {
								if (
									!nodes.some(
										(n) =>
											n.type === 'place' &&
											n.data.place === place
									)
								) {
									const placeId = `place-${place
										.toLowerCase()
										.replace(/\s+/g, '-')}`;
									nodes.push({
										id: placeId,
										type: 'place',
										group: 'secondary', // Still mark as secondary
										data: { place: place },
									});

									links.push({
										source: tertDoc.id,
										target: placeId,
										type: 'mentions_place',
									});
								}
							});
						}
					}
				});
			}
		}
	}

	console.log(
		`Returning network with ${nodes.length} nodes and ${links.length} links`
	);
	return NextResponse.json({
		results: {
			nodes,
			links,
		},
	});
}

async function getTimelineData(documentId: string) {
	// For a specific document, get its date and related documents with dates
	const document = await prisma.document.findUnique({
		where: { id: documentId },
		select: {
			id: true,
			title: true,
			earliestDate: true,
			latestDate: true,
			allNames: true, // to find related documents
		},
	});

	if (!document || !document.earliestDate) {
		// If document doesn't have dates, return empty timeline
		return NextResponse.json({
			results: {
				timeline: [],
			},
		});
	}

	// Create an event for the source document
	const timelineEvents = [];

	if (document.earliestDate) {
		timelineEvents.push({
			date: document.earliestDate.toISOString().split('T')[0],
			event: document.title || `Document ${documentId}`,
			documents: [documentId],
		});
	}

	// Get related documents based on shared names
	if (document.allNames && document.allNames.length > 0) {
		// Get up to 3 names to search for related documents
		const searchNames = document.allNames.slice(0, 3);

		const relatedDocs = await prisma.document.findMany({
			where: {
				id: { not: documentId },
				earliestDate: { not: null },
				allNames: { hasSome: searchNames },
			},
			select: {
				id: true,
				title: true,
				earliestDate: true,
			},
			orderBy: {
				earliestDate: 'asc',
			},
			take: 10,
		});

		// Add related documents to timeline
		for (const relDoc of relatedDocs) {
			if (relDoc.earliestDate) {
				timelineEvents.push({
					date: relDoc.earliestDate.toISOString().split('T')[0],
					event: relDoc.title || `Document ${relDoc.id}`,
					documents: [relDoc.id],
				});
			}
		}
	}

	// Sort timeline by date
	timelineEvents.sort((a, b) => {
		return new Date(a.date).getTime() - new Date(b.date).getTime();
	});

	return NextResponse.json({
		results: {
			timeline: timelineEvents,
		},
	});
}

async function getGeoData(documentId: string) {
	// Get geographic data for places mentioned in the document
	try {
		const document = await prisma.document.findUnique({
			where: { id: documentId },
			select: {
				allPlaces: true,
				title: true,
			},
		});

		if (
			!document ||
			!document.allPlaces ||
			document.allPlaces.length === 0
		) {
			return NextResponse.json({
				results: {
					places: [],
				},
			});
		}

		// In a real-world application, you would have a places database with coordinates
		// Here we'll assign fake coordinates for demonstration
		const places = document.allPlaces;

		// Create a map to count duplicate place mentions
		const placeCounts: { [place: string]: number } = {};
		places.forEach((place: string) => {
			placeCounts[place] = (placeCounts[place] || 0) + 1;
		});

		// Generate fake coordinates based on place name string for demonstration
		// This ensures the same place name always gets the same coordinates
		const geoData = Object.keys(placeCounts).map((place) => {
			// Simple hash function to generate consistent coordinates from place name
			const hash = place
				.split('')
				.reduce((acc, char) => acc + char.charCodeAt(0), 0);

			// Generate lat/long between -80 and 80 for latitude, -170 and 170 for longitude
			const lat = (hash % 160) - 80 + (hash % 10) / 10;
			const lng = ((hash * 2) % 340) - 170 + (hash % 10) / 10;

			return {
				place,
				coordinates: [lng, lat] as [number, number], // [longitude, latitude]
				mentions: placeCounts[place],
			};
		});

		return NextResponse.json({
			results: {
				documentTitle: document.title || documentId,
				places: geoData,
			},
		});
	} catch (error) {
		console.error('Error getting geo data:', error);
		return NextResponse.json({
			results: {
				places: [],
			},
		});
	}
}

// New function to get date statistics across all documents
async function getDateStatistics() {
	// Get document counts by date
	const dateStats = await prisma.$queryRaw<
		Array<{ date: Date; document_count: bigint }>
	>`
	SELECT 
	  DATE_TRUNC('month', "earliestDate")::date as date,
	  COUNT(*) as document_count
	FROM "Document" 
	WHERE "earliestDate" IS NOT NULL
	GROUP BY DATE_TRUNC('month', "earliestDate")
	ORDER BY date ASC
	LIMIT 20
  `;

	// Convert BigInt to regular numbers before sending in the response
	const serializedStats = dateStats.map((stat) => ({
		date: stat.date,
		document_count: Number(stat.document_count),
	}));

	return NextResponse.json({
		results: serializedStats,
	});
}

// New function to get documents by place
async function getPlaceDocuments(placeName: string | null) {
	if (!placeName) {
		// If no place name provided, return top places with document counts
		const placeStats = await prisma.$queryRaw<
			Array<{ place: string; document_count: bigint }>
		>`
	  WITH place_data AS (
		SELECT 
		  UNNEST("allPlaces") as place,
		  id
		FROM "Document"
		WHERE "allPlaces" IS NOT NULL
	  )
	  SELECT 
		place,
		COUNT(DISTINCT id) as document_count
	  FROM place_data
	  GROUP BY place
	  ORDER BY document_count DESC
	  LIMIT 20
	`;

		// Convert BigInt to regular numbers before sending in the response
		const serializedStats = placeStats.map((stat) => ({
			place: stat.place,
			document_count: Number(stat.document_count),
		}));

		return NextResponse.json({
			results: serializedStats,
		});
	}

	// Get documents mentioning this place
	const documents = await prisma.document.findMany({
		where: {
			allPlaces: { has: placeName },
		},
		select: {
			id: true,
			title: true,
			summary: true,
			earliestDate: true,
			allNames: true,
			pageCount: true,
		},
		orderBy: {
			earliestDate: 'asc',
		},
		take: 20,
	});

	return NextResponse.json({
		results: documents,
	});
}

// New function to get documents by person
async function getPersonDocuments(personName: string | null) {
	if (!personName) {
		// If no person name provided, return top people with document counts
		const personStats = await prisma.$queryRaw<
			Array<{ person: string; document_count: bigint }>
		>`
	  WITH person_data AS (
		SELECT 
		  UNNEST("allNames") as person,
		  id
		FROM "Document"
		WHERE "allNames" IS NOT NULL
	  )
	  SELECT 
		person,
		COUNT(DISTINCT id) as document_count
	  FROM person_data
	  GROUP BY person
	  ORDER BY document_count DESC
	  LIMIT 20
	`;

		// Convert BigInt to regular numbers before sending in the response
		const serializedStats = personStats.map((stat) => ({
			person: stat.person,
			document_count: Number(stat.document_count),
		}));

		return NextResponse.json({
			results: serializedStats,
		});
	}

	// Get documents mentioning this person
	const documents = await prisma.document.findMany({
		where: {
			allNames: { has: personName },
		},
		select: {
			id: true,
			title: true,
			summary: true,
			earliestDate: true,
			allPlaces: true,
			pageCount: true,
		},
		orderBy: {
			earliestDate: 'asc',
		},
		take: 20,
	});

	return NextResponse.json({
		results: documents,
	});
}

// New function to get documents by object
async function getObjectDocuments(objectName: string | null) {
	if (!objectName) {
		// If no object name provided, return top objects with document counts
		const objectStats = await prisma.$queryRaw<
			Array<{ object: string; document_count: bigint }>
		>`
	  WITH object_data AS (
		SELECT 
		  UNNEST("allObjects") as object,
		  id
		FROM "Document"
		WHERE "allObjects" IS NOT NULL
	  )
	  SELECT 
		object,
		COUNT(DISTINCT id) as document_count
	  FROM object_data
	  GROUP BY object
	  ORDER BY document_count DESC
	  LIMIT 20
	`;

		// Convert BigInt to regular numbers before sending in the response
		const serializedStats = objectStats.map((stat) => ({
			object: stat.object,
			document_count: Number(stat.document_count),
		}));

		return NextResponse.json({
			results: serializedStats,
		});
	}

	// Get documents mentioning this object
	const documents = await prisma.document.findMany({
		where: {
			allObjects: { has: objectName },
		},
		select: {
			id: true,
			title: true,
			summary: true,
			earliestDate: true,
			allNames: true,
			pageCount: true,
		},
		orderBy: {
			earliestDate: 'asc',
		},
		take: 20,
	});

	return NextResponse.json({
		results: documents,
	});
}
