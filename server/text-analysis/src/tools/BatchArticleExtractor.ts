import { z } from 'zod';
import { MCPTool } from '@shared/backend';
import { HTMLScraperBase } from '../lib/helpers/html.js';
import type { NewsArticlePreview } from '@shared/types';
import * as cheerio from 'cheerio';
import axios from 'axios';

// Input schema for batch article extraction
const BatchExtractSchema = z.object({
	articles: z.array(
		z.object({
			title: z.string(),
			link: z.string(),
			source: z.object({
				site: z.string(),
				domain: z.string(),
			}),
		})
	),
	options: z
		.object({
			maxArticles: z.number().optional().default(20),
			includeFullText: z.boolean().optional().default(true),
			timeout: z.number().optional().default(10000),
		})
		.optional()
		.default({}),
});

interface ExtractedArticle {
	url: string;
	title: string;
	fullText: string;
	content: string[];
	wordCount: number;
	source: {
		site: string;
		domain: string;
	};
	extractedAt: string;
}

export class BatchArticleExtractorTool extends MCPTool {
	get name(): string {
		return 'extract_article_content_batch';
	}

	get description(): string {
		return 'Extract full text content from multiple news articles for analysis';
	}

	get inputSchema(): z.ZodSchema {
		return BatchExtractSchema;
	}

	get schema(): z.ZodSchema {
		return BatchExtractSchema;
	}

	async execute(
		params: z.infer<typeof BatchExtractSchema>
	): Promise<ExtractedArticle[]> {
		const { articles, options } = params;

		if (articles.length === 0) {
			return [];
		}

		// Limit the number of articles to prevent overwhelming the system
		const articlesToProcess = articles.slice(0, options.maxArticles);

		console.log(
			`🔍 Extracting content from ${articlesToProcess.length} articles...`
		);

		const results: ExtractedArticle[] = [];

		// Process articles in parallel with limited concurrency
		const batchSize = 5; // Process 5 articles at a time
		for (let i = 0; i < articlesToProcess.length; i += batchSize) {
			const batch = articlesToProcess.slice(i, i + batchSize);
			const batchPromises = batch.map((article) =>
				this.extractSingleArticle(article, options).catch((error) => {
					console.error(
						`Failed to extract ${article.link}:`,
						error.message
					);
					return null;
				})
			);

			const batchResults = await Promise.all(batchPromises);
			results.push(
				...(batchResults.filter(
					(result) => result !== null
				) as ExtractedArticle[])
			);

			// Small delay between batches to be respectful
			if (i + batchSize < articlesToProcess.length) {
				await new Promise((resolve) => setTimeout(resolve, 1000));
			}
		}

		console.log(
			`✅ Successfully extracted ${results.length}/${articlesToProcess.length} articles`
		);
		return results;
	}

	private async extractSingleArticle(
		article: any,
		options: any
	): Promise<ExtractedArticle | null> {
		try {
			const html = await this.fetchHTML(article.link, options.timeout);
			const $ = cheerio.load(html);

			// Remove unwanted elements
			$(
				'script, style, nav, header, footer, aside, .advertisement, .ad, .social-share'
			).remove();

			// Try to find the main article content using common selectors
			const contentSelectors = [
				'article',
				'[role="main"]',
				'.article-content',
				'.post-content',
				'.entry-content',
				'.content',
				'.story-body',
				'.article-body',
				'main',
			];

			let $content = $('');
			for (const selector of contentSelectors) {
				$content = $(selector);
				if ($content.length > 0) break;
			}

			// If no specific content area found, use body but be more selective
			if ($content.length === 0) {
				$content = $('body');
			}

			// Extract paragraphs
			const paragraphs: string[] = [];
			$content.find('p').each((_, elem) => {
				const text = $(elem).text().trim();
				if (text.length > 50) {
					// Only include substantial paragraphs
					paragraphs.push(text);
				}
			});

			// If no paragraphs found, try to get any text content
			if (paragraphs.length === 0) {
				const allText = $content.text().trim();
				if (allText.length > 100) {
					// Split into sentences and use as paragraphs
					const sentences = allText
						.split(/[.!?]+/)
						.filter((s) => s.trim().length > 30);
					paragraphs.push(...sentences.map((s) => s.trim()));
				}
			}

			const fullText = paragraphs.join(' ');
			const wordCount = fullText.split(/\s+/).length;

			// Only return if we got meaningful content
			if (wordCount < 50) {
				console.warn(
					`⚠️ Insufficient content extracted from ${article.link} (${wordCount} words)`
				);
				return null;
			}

			return {
				url: article.link,
				title: article.title,
				fullText,
				content: paragraphs,
				wordCount,
				source: article.source,
				extractedAt: new Date().toISOString(),
			};
		} catch (error) {
			console.error(`Failed to extract article ${article.link}:`, error);
			return null;
		}
	}

	private async fetchHTML(
		url: string,
		timeout: number = 10000
	): Promise<string> {
		try {
			const response = await axios.get(url, {
				headers: {
					'User-Agent':
						'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
					Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
					'Accept-Language': 'en-US,en;q=0.5',
					'Accept-Encoding': 'gzip, deflate',
					Connection: 'keep-alive',
				},
				timeout,
				maxRedirects: 5,
			});
			return response.data;
		} catch (error) {
			throw new Error(
				`Failed to fetch HTML from ${url}: ${
					error instanceof Error ? error.message : String(error)
				}`
			);
		}
	}
}
