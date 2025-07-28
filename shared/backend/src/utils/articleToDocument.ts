import { Document } from '@prisma/client';
import { NewsArticlePreview, StructuredArticle } from '@shared/types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Convert a NewsArticlePreview to a Prisma Document structure
 */
export function newsArticleToDocument(
	article: NewsArticlePreview
): Omit<Document, 'createdAt' | 'updatedAt'> {
	const documentId = uuidv4();

	return {
		id: documentId,
		oldId: article.id || null,
		document: article as any, // Store the original article as JSON for compatibility

		// Document metadata
		documentUrl: article.link,
		processingDate: article.timestamp
			? new Date(article.timestamp)
			: new Date(),
		pageCount: null,
		title: article.title,
		summary: article.excerpt || null,
		fullText: null, // Will be populated when full text is extracted
		documentType: 'news-article', // Legacy field
		documentGroup: 'news', // New consistent terminology

		// Arrays for data storage
		allNames: [], // Will be populated during NLP processing
		allPlaces: [],
		allDates: article.timestamp ? [article.timestamp] : [],
		allObjects: [],
		stamps: [],

		// Search field - concatenated text for full-text search
		searchText: `${article.title} ${article.excerpt || ''} ${
			article.source?.site || ''
		}`,

		// Normalized dates
		normalizedDates: article.timestamp ? [new Date(article.timestamp)] : [],
		earliestDate: article.timestamp ? new Date(article.timestamp) : null,
		latestDate: article.timestamp ? new Date(article.timestamp) : null,

		// Boolean flags
		hasHandwrittenNotes: false,
		hasStamps: false,
		hasFullText: false,

		// Processing status
		processingStage: 'pending',
		processingSteps: ['scraping'],
		lastProcessed: new Date(),
		processingError: null,
		archiveId: article.source?.domain || null,
	};
}

/**
 * Convert a StructuredArticle to a Prisma Document structure
 */
export function structuredArticleToDocument(
	article: StructuredArticle
): Omit<Document, 'createdAt' | 'updatedAt'> {
	const documentId = uuidv4();

	return {
		id: documentId,
		oldId: null,
		document: article as any,

		// Document metadata
		documentUrl: article.url,
		processingDate: article.publishDate
			? new Date(article.publishDate)
			: new Date(),
		pageCount: null,
		title: article.title,
		summary: article.summary || null,
		fullText: article.content?.fullText || null,
		documentType: 'news-article',
		documentGroup: 'news',

		// Arrays for data storage
		allNames: [], // Extract from content during processing
		allPlaces: [],
		allDates: [
			...(article.publishDate ? [article.publishDate] : []),
			...(article.lastModified ? [article.lastModified] : []),
			article.timestamp,
		].filter(Boolean),
		allObjects: [],
		stamps: [],

		// Search text
		searchText: `${article.title} ${article.subtitle || ''} ${
			article.summary || ''
		} ${article.content?.fullText || ''} ${article.author || ''} ${
			article.tags?.join(' ') || ''
		}`,

		// Normalized dates
		normalizedDates: [
			...(article.publishDate ? [new Date(article.publishDate)] : []),
			...(article.lastModified ? [new Date(article.lastModified)] : []),
			new Date(article.timestamp),
		].filter((date) => !isNaN(date.getTime())),
		earliestDate: article.publishDate
			? new Date(article.publishDate)
			: new Date(article.timestamp),
		latestDate: article.lastModified
			? new Date(article.lastModified)
			: new Date(article.timestamp),

		// Boolean flags
		hasHandwrittenNotes: false,
		hasStamps: false,
		hasFullText: Boolean(article.content?.fullText),

		// Processing status
		processingStage: 'completed',
		processingSteps: ['scraping', 'extraction', 'analysis'],
		lastProcessed: new Date(),
		processingError: null,
		archiveId: article.metadata?.sourceUrl || null,
	};
}

/**
 * Convert the basic Article interface to Document
 */
export function basicArticleToDocument(article: {
	title: string;
	link: string;
	source: {
		site: string;
		domain: string;
		method: string;
	};
	timestamp: string;
}): Omit<Document, 'createdAt' | 'updatedAt'> {
	const documentId = uuidv4();

	return {
		id: documentId,
		oldId: null,
		document: article as any,

		// Document metadata
		documentUrl: article.link,
		processingDate: new Date(article.timestamp),
		pageCount: null,
		title: article.title,
		summary: null,
		fullText: null,
		documentType: 'news-article',
		documentGroup: 'news',

		// Arrays for data storage
		allNames: [],
		allPlaces: [],
		allDates: [article.timestamp],
		allObjects: [],
		stamps: [],

		// Search text
		searchText: `${article.title} ${article.source.site}`,

		// Normalized dates
		normalizedDates: [new Date(article.timestamp)],
		earliestDate: new Date(article.timestamp),
		latestDate: new Date(article.timestamp),

		// Boolean flags
		hasHandwrittenNotes: false,
		hasStamps: false,
		hasFullText: false,

		// Processing status
		processingStage: 'pending',
		processingSteps: ['scraping'],
		lastProcessed: new Date(),
		processingError: null,
		archiveId: article.source.domain,
	};
}

/**
 * Extract Document fields from various article types
 */
export function extractDocumentFields(article: any): {
	title: string;
	url: string;
	summary?: string;
	content?: string;
	publishDate?: Date;
	source?: string;
} {
	// Handle NewsArticlePreview
	if ('link' in article && 'source' in article) {
		const result: any = {
			title: article.title,
			url: article.link,
			summary: article.excerpt,
			source: article.source?.site || article.source?.domain,
		};
		if (article.timestamp) {
			result.publishDate = new Date(article.timestamp);
		}
		return result;
	}

	// Handle StructuredArticle
	if ('url' in article && 'content' in article) {
		const result: any = {
			title: article.title,
			url: article.url,
			summary: article.summary,
			content: article.content?.fullText,
			source: article.metadata?.source,
		};
		if (article.publishDate) {
			result.publishDate = new Date(article.publishDate);
		}
		return result;
	}

	// Handle basic Article
	if ('link' in article && 'timestamp' in article) {
		return {
			title: article.title,
			url: article.link,
			publishDate: new Date(article.timestamp),
			source: article.source?.site,
		};
	}

	throw new Error('Unknown article type for conversion');
}
