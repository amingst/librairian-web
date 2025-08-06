import { NewsScraperMCPClient } from './mcp-client';
import { Document } from '@prisma/client';
import {
	newsArticleToDocument,
	basicArticleToDocument,
} from '@shared/backend/src/utils/articleToDocument';

export class DocumentNewsScraperClient extends NewsScraperMCPClient {
	/**
	 * Scrape news homepages and return as Documents
	 */
	async scrapeNewsHomepagesAsDocuments(params: {
		sources: any[];
		limit?: number;
		includeMedia?: boolean;
		includeSections?: boolean;
		includeMetrics?: boolean;
		sortBy?: 'position' | 'date' | 'priority';
	}): Promise<
		Record<string, Array<Omit<Document, 'createdAt' | 'updatedAt'>>>
	> {
		// Get articles from parent MCP client
		const articlesData = await this.scrapeNewsHomepages(params);

		const documentsData: Record<
			string,
			Array<Omit<Document, 'createdAt' | 'updatedAt'>>
		> = {};

		// Convert articles to documents for each source
		for (const [sourceName, articles] of Object.entries(articlesData)) {
			documentsData[sourceName] = articles.map((article) => {
				// NewsArticlePreview -> Document
				return newsArticleToDocument(article);
			});
		}

		return documentsData;
	}

	/**
	 * Extract article text and return as Document
	 */
	async extractArticleAsDocument(
		url: string
	): Promise<Omit<Document, 'createdAt' | 'updatedAt'> | null> {
		try {
			const extractedArticle = await this.extractArticle(url);

			if (!extractedArticle) {
				return null;
			}

			// Convert StructuredArticle to Document
			return {
				id: crypto.randomUUID(),
				oldId: null,
				document: extractedArticle as any,

				// Document metadata
				documentUrl: extractedArticle.url,
				processingDate: extractedArticle.publishDate
					? new Date(extractedArticle.publishDate)
					: new Date(),
				pageCount: null,
				title: extractedArticle.title,
				summary: extractedArticle.summary || null,
				fullText: extractedArticle.content?.fullText || null,
				documentType: 'news-article',
				documentGroup: 'news',

				// Arrays for data storage
				allNames: [], // TODO: Extract from content
				allPlaces: [],
				allDates: [
					...(extractedArticle.publishDate
						? [extractedArticle.publishDate]
						: []),
					...(extractedArticle.lastModified
						? [extractedArticle.lastModified]
						: []),
					extractedArticle.timestamp,
				].filter(Boolean),
				allObjects: [],
				stamps: [],

				// Search text
				searchText: `${extractedArticle.title} ${
					extractedArticle.subtitle || ''
				} ${extractedArticle.summary || ''} ${
					extractedArticle.content?.fullText || ''
				} ${extractedArticle.author || ''} ${
					extractedArticle.tags?.join(' ') || ''
				}`,

				// Normalized dates
				normalizedDates: [
					...(extractedArticle.publishDate
						? [new Date(extractedArticle.publishDate)]
						: []),
					...(extractedArticle.lastModified
						? [new Date(extractedArticle.lastModified)]
						: []),
					new Date(extractedArticle.timestamp),
				].filter((date) => !isNaN(date.getTime())),
				earliestDate: extractedArticle.publishDate
					? new Date(extractedArticle.publishDate)
					: new Date(extractedArticle.timestamp),
				latestDate: extractedArticle.lastModified
					? new Date(extractedArticle.lastModified)
					: new Date(extractedArticle.timestamp),

				// Boolean flags
				hasHandwrittenNotes: false,
				hasStamps: false,
				hasFullText: Boolean(extractedArticle.content?.fullText),

				// Processing status
				processingStage: 'completed',
				processingSteps: ['scraping', 'extraction', 'analysis'],
				lastProcessed: new Date(),
				processingError: null,
				archiveId: extractedArticle.metadata?.sourceUrl || null,
			};
		} catch (error) {
			console.error('Error extracting article as document:', error);
			return null;
		}
	}

	/**
	 * Save articles directly to database as Documents
	 */
	async saveArticlesAsDocuments(
		articles: any[],
		apiUrl: string = '/api/articles/to-documents'
	): Promise<{
		created: number;
		errors: number;
		documents: Array<{
			id: string;
			title: string;
			url: string;
			type: string;
		}>;
		errorDetails: any[];
	}> {
		try {
			const response = await fetch(apiUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					articles,
					type: 'auto',
				}),
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const result = await response.json();
			return result;
		} catch (error) {
			console.error('Error saving articles as documents:', error);
			throw error;
		}
	}

	/**
	 * Get news articles as Documents from database
	 */
	async getNewsDocuments(options?: {
		group?: string;
		limit?: number;
		offset?: number;
	}): Promise<{
		documents: Array<{
			id: string;
			title: string;
			documentUrl: string;
			summary: string;
			processingDate: Date;
			documentGroup: string;
			processingStage: string;
		}>;
		total: number;
	}> {
		const params = new URLSearchParams({
			group: options?.group || 'news',
			limit: String(options?.limit || 20),
			offset: String(options?.offset || 0),
		});

		const response = await fetch(`/api/articles/to-documents?${params}`);

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const result = await response.json();
		return result;
	}
}
