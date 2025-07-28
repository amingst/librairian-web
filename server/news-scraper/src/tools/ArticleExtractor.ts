import z from 'zod';
import { HTMLScraperBase } from '../lib/helpers/html.js';
import { MCPTool } from '@shared/backend';
import {
	StructuredArticle,
	ArticleContent,
	MediaContent,
	ArticleMetadata,
} from '@shared/types';
import { MCPToolResponse, ExtractTextParams } from '../types/index.js';
import * as cheerio from 'cheerio';
import { injectable } from 'inversify';

@injectable()
export class ArticleExtractorTool extends MCPTool {
	private static readonly inputSchema = z.object({
		url: z
			.string()
			.url()
			.describe('The URL of the news article to extract'),
		include_media: z
			.boolean()
			.default(true)
			.describe('Whether to extract media content (images, videos)'),
		extract_tags: z
			.boolean()
			.default(true)
			.describe('Whether to extract article tags and categories'),
		estimate_reading_time: z
			.boolean()
			.default(true)
			.describe('Whether to calculate estimated reading time'),
	});

	get name(): string {
		return 'extract_text';
	}

	get description(): string {
		return 'Extract structured JSON data from a news article including content, metadata, and media';
	}

	get schema(): Record<string, any> {
		return ArticleExtractorTool.inputSchema.shape;
	}

	async execute(params: ExtractTextParams): Promise<MCPToolResponse> {
		const {
			url,
			include_media = true,
			extract_tags = true,
			estimate_reading_time = true,
		} = params;

		try {
			const html = await HTMLScraperBase.fetchHTML(url);
			const $ = cheerio.load(html);

			// Extract basic article information
			const title = this.extractTitle($);
			const subtitle = this.extractSubtitle($);
			const author = this.extractAuthor($);
			const publishDate = this.extractPublishDate($);
			const lastModified = this.extractLastModified($);

			// Extract content
			const content = this.extractContent($, estimate_reading_time);

			// Extract category and tags if requested
			let category: string | undefined;
			let tags: string[] | undefined;
			if (extract_tags) {
				category = this.extractCategory($);
				tags = this.extractTags($);
			}

			// Extract media if requested
			let media: MediaContent[] | undefined;
			if (include_media) {
				media = this.extractMedia($, url);
			}

			// Extract metadata
			const metadata = this.extractMetadata($, url);

			// Build structured article
			const structuredArticle: StructuredArticle = {
				url,
				title,
				subtitle,
				author,
				publishDate,
				lastModified,
				category,
				tags,
				summary: this.generateSummary(content.paragraphs),
				content,
				media,
				metadata,
				timestamp: new Date().toISOString(),
			};

			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify(structuredArticle, null, 2),
					},
				],
			};
		} catch (error) {
			return {
				content: [
					{
						type: 'text',
						text: `Error extracting structured article data: ${
							error instanceof Error
								? error.message
								: String(error)
						}`,
					},
				],
			};
		}
	}

	private extractTitle($: cheerio.CheerioAPI): string {
		// Try multiple selectors for title extraction
		const titleSelectors = [
			'h1[data-testid="headline"]', // AP News specific
			'h1.ArticleHeader-headline',
			'h1.entry-title',
			'h1.article-title',
			'h1.post-title',
			'h1[class*="headline"]',
			'h1[class*="title"]',
			'article h1',
			'h1',
			'title',
		];

		for (const selector of titleSelectors) {
			const element = $(selector).first();
			if (element.length && element.text().trim()) {
				return element.text().trim();
			}
		}

		return $('title').text().trim() || 'No title found';
	}

	private extractSubtitle($: cheerio.CheerioAPI): string | undefined {
		const subtitleSelectors = [
			'.ArticleHeader-subtitle',
			'.article-subtitle',
			'.entry-subtitle',
			'h2.subtitle',
			'p.subtitle',
			'[class*="subtitle"]',
			'[data-testid="subtitle"]',
		];

		for (const selector of subtitleSelectors) {
			const element = $(selector).first();
			if (element.length && element.text().trim()) {
				return element.text().trim();
			}
		}

		return undefined;
	}

	private extractAuthor($: cheerio.CheerioAPI): string | undefined {
		const authorSelectors = [
			'[data-testid="byline"]',
			'.byline .author',
			'.article-author',
			'.entry-author',
			'[rel="author"]',
			'[class*="author"]',
			'[class*="byline"]',
			'meta[name="author"]',
		];

		for (const selector of authorSelectors) {
			const element = $(selector).first();
			if (element.length) {
				const text = element.attr('content') || element.text().trim();
				if (text) {
					// Clean up author text (remove "By " prefix, etc.)
					return text.replace(/^(By|Author:)\s*/i, '').trim();
				}
			}
		}

		return undefined;
	}

	private extractPublishDate($: cheerio.CheerioAPI): string | undefined {
		const dateSelectors = [
			'[data-testid="timestamp"]',
			'time[datetime]',
			'.publish-date',
			'.entry-date',
			'.article-date',
			'meta[property="article:published_time"]',
			'meta[name="publishdate"]',
		];

		for (const selector of dateSelectors) {
			const element = $(selector).first();
			if (element.length) {
				const datetime =
					element.attr('datetime') ||
					element.attr('content') ||
					element.text().trim();
				if (datetime) {
					return datetime;
				}
			}
		}

		return undefined;
	}

	private extractLastModified($: cheerio.CheerioAPI): string | undefined {
		const modifiedSelectors = [
			'meta[property="article:modified_time"]',
			'meta[name="lastmod"]',
			'time[class*="modified"]',
			'.last-modified',
		];

		for (const selector of modifiedSelectors) {
			const element = $(selector).first();
			if (element.length) {
				const datetime =
					element.attr('content') ||
					element.attr('datetime') ||
					element.text().trim();
				if (datetime) {
					return datetime;
				}
			}
		}

		return undefined;
	}

	private extractContent(
		$: cheerio.CheerioAPI,
		estimateReadingTime: boolean
	): ArticleContent {
		// Try to find the main article content
		const contentSelectors = [
			'[data-testid="richTextStoryBody"]', // AP News specific
			'.ArticleBody',
			'.entry-content',
			'.article-content',
			'.article-text', // Daily Mail specific
			'[itemprop="articleBody"]', // Daily Mail specific
			'.post-content',
			'article .content',
			'[class*="article-body"]',
			'[class*="story-body"]',
			'main article',
		];

		let contentElement: cheerio.Cheerio<any> | null = null;

		for (const selector of contentSelectors) {
			const element = $(selector).first();
			if (element.length) {
				contentElement = element;
				break;
			}
		}

		// Fallback to article tag or body
		if (!contentElement || !contentElement.length) {
			contentElement = $('article').first();
			if (!contentElement.length) {
				contentElement = $('main').first();
			}
		}

		// Extract paragraphs
		const paragraphs: string[] = [];
		if (contentElement && contentElement.length) {
			contentElement.find('p').each((_, element) => {
				const text = $(element).text().trim();
				if (text && text.length > 20) {
					// Filter out very short paragraphs
					paragraphs.push(text);
				}
			});
		}

		// If no paragraphs found, try to extract from the whole content area
		if (
			paragraphs.length === 0 &&
			contentElement &&
			contentElement.length
		) {
			const fullText = contentElement.text().trim();
			if (fullText) {
				// Split by double newlines or periods followed by newlines
				const splitText = fullText
					.split(/\n\n|\.\s*\n/)
					.filter((p) => p.trim().length > 20);
				paragraphs.push(...splitText);
			}
		}

		const fullText = paragraphs.join('\n\n');
		const wordCount = this.countWords(fullText);
		const readingTime = estimateReadingTime
			? this.estimateReadingTime(wordCount)
			: 0;

		return {
			fullText,
			paragraphs,
			wordCount,
			readingTime,
		};
	}

	private extractCategory($: cheerio.CheerioAPI): string | undefined {
		const categorySelectors = [
			'[data-testid="breadcrumb"] a:last-child',
			'.category',
			'.article-category',
			'.entry-category',
			'nav[aria-label="breadcrumb"] a:last-child',
			'meta[property="article:section"]',
		];

		for (const selector of categorySelectors) {
			const element = $(selector).first();
			if (element.length) {
				const text = element.attr('content') || element.text().trim();
				if (text) {
					return text;
				}
			}
		}

		return undefined;
	}

	private extractTags($: cheerio.CheerioAPI): string[] {
		const tags: string[] = [];

		const tagSelectors = [
			'.tags a',
			'.article-tags a',
			'.entry-tags a',
			'[class*="tag"] a',
			'meta[property="article:tag"]',
		];

		for (const selector of tagSelectors) {
			$(selector).each((_, element) => {
				const text =
					$(element).attr('content') || $(element).text().trim();
				if (text && !tags.includes(text)) {
					tags.push(text);
				}
			});
		}

		// Also check keywords meta tag
		const keywords = $('meta[name="keywords"]').attr('content');
		if (keywords) {
			const keywordArray = keywords
				.split(',')
				.map((k) => k.trim())
				.filter((k) => k.length > 0);
			keywordArray.forEach((keyword) => {
				if (!tags.includes(keyword)) {
					tags.push(keyword);
				}
			});
		}

		return tags;
	}

	private extractMedia(
		$: cheerio.CheerioAPI,
		baseUrl: string
	): MediaContent[] {
		const media: MediaContent[] = [];

		// Extract images
		$('img').each((_, element) => {
			const src = $(element).attr('src');
			const caption =
				$(element).attr('title') ||
				$(element).closest('figure').find('figcaption').text().trim();
			const altText = $(element).attr('alt');
			const credit = $(element)
				.closest('figure')
				.find('.credit, .photo-credit')
				.text()
				.trim();

			if (src) {
				try {
					const absoluteUrl = new URL(src, baseUrl).href;
					media.push({
						type: 'image',
						url: absoluteUrl,
						caption: caption || undefined,
						altText: altText || undefined,
						credit: credit || undefined,
					});
				} catch (error) {
					// Skip invalid URLs
				}
			}
		});

		// Extract videos
		$('video').each((_, element) => {
			const src =
				$(element).attr('src') ||
				$(element).find('source').first().attr('src');
			if (src) {
				try {
					const absoluteUrl = new URL(src, baseUrl).href;
					media.push({
						type: 'video',
						url: absoluteUrl,
						caption: $(element).attr('title') || undefined,
					});
				} catch (error) {
					// Skip invalid URLs
				}
			}
		});

		return media;
	}

	private extractMetadata(
		$: cheerio.CheerioAPI,
		url: string
	): ArticleMetadata {
		const language =
			$('html').attr('lang') ||
			$('meta[http-equiv="content-language"]').attr('content') ||
			'en';

		const canonical = $('link[rel="canonical"]').attr('href') || url;
		const source = new URL(url).hostname;

		// Extract Open Graph data
		const ogData: Record<string, string> = {};
		$('meta[property^="og:"]').each((_, element) => {
			const property = $(element).attr('property');
			const content = $(element).attr('content');
			if (property && content) {
				const key = property.replace('og:', '');
				ogData[key] = content;
			}
		});

		// Extract Twitter Card data
		const twitterData: Record<string, string> = {};
		$('meta[name^="twitter:"]').each((_, element) => {
			const name = $(element).attr('name');
			const content = $(element).attr('content');
			if (name && content) {
				const key = name.replace('twitter:', '');
				twitterData[key] = content;
			}
		});

		return {
			language,
			source,
			sourceUrl: url,
			canonical,
			ogData: Object.keys(ogData).length > 0 ? ogData : undefined,
			twitterData:
				Object.keys(twitterData).length > 0 ? twitterData : undefined,
		};
	}

	private generateSummary(paragraphs: string[]): string | undefined {
		if (paragraphs.length === 0) return undefined;

		// Use the first paragraph as summary, but limit to a reasonable length
		const firstParagraph = paragraphs[0];
		if (firstParagraph.length <= 300) {
			return firstParagraph;
		}

		// If first paragraph is too long, truncate at sentence boundary
		const sentences = firstParagraph.split(/[.!?]+/);
		let summary = '';
		for (const sentence of sentences) {
			if (summary.length + sentence.length > 300) break;
			summary += sentence + '.';
		}

		return summary.trim() || firstParagraph.substring(0, 300) + '...';
	}

	private countWords(text: string): number {
		return text
			.trim()
			.split(/\s+/)
			.filter((word) => word.length > 0).length;
	}

	private estimateReadingTime(wordCount: number): number {
		// Average reading speed is about 200-250 words per minute
		const wordsPerMinute = 225;
		return Math.ceil(wordCount / wordsPerMinute);
	}
}
