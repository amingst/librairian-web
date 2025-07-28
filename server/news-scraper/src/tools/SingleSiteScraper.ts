import z from 'zod';
import { HTMLScraperBase } from '../lib/helpers/html.js';
import { MCPTool } from '@shared/backend';
import { ScrapedContent, LinkData, ImageData } from '@shared/types';
import { ScrapeWebpageParams } from '../types/index.js';
import * as cheerio from 'cheerio';
import { injectable } from 'inversify';

@injectable()
export class SingleSiteScraperTool extends MCPTool {
	private static readonly inputSchema = z.object({
		url: z.string().url().describe('The URL of the webpage to scrape'),
		selector: z
			.string()
			.optional()
			.describe('Optional CSS selector to target specific elements'),
		extract_text: z
			.boolean()
			.default(true)
			.describe('Whether to extract text content (default: true)'),
		extract_links: z
			.boolean()
			.default(false)
			.describe('Whether to extract all links'),
		extract_images: z
			.boolean()
			.default(false)
			.describe('Whether to extract image URLs'),
		max_content_length: z
			.number()
			.optional()
			.describe('Maximum length of extracted text (default: no limit)'),
	});

	get name(): string {
		return 'scrape_webpage';
	}

	get description(): string {
		return 'Scrape and extract content from a webpage';
	}

	get schema(): Record<string, any> {
		return SingleSiteScraperTool.inputSchema.shape;
	}

	async execute(params: ScrapeWebpageParams): Promise<any> {
		const {
			url,
			selector,
			extract_text,
			extract_links,
			extract_images,
			max_content_length,
		} = params;

		try {
			const html = await HTMLScraperBase.fetchHTML(url);
			const $ = cheerio.load(html);

			const result: ScrapedContent = {
				url,
				title: $('title').text().trim(),
				content: '', // Initialize content property
			};

			// Apply selector if provided
			const target = selector ? $(selector) : $('body');

			if (extract_text) {
				let text = target.text();
				text = HTMLScraperBase.cleanText(text);

				if (max_content_length && text.length > max_content_length) {
					text = text.substring(0, max_content_length) + '...';
				}

				result.content = text;
			}

			if (extract_links) {
				const links: LinkData[] = [];
				target.find('a[href]').each((_, element) => {
					const href = $(element).attr('href');
					const text = $(element).text().trim();
					if (href && text) {
						// Convert relative URLs to absolute
						const absoluteUrl = new URL(href, url).href;
						links.push({ url: absoluteUrl, text });
					}
				});
				result.links = links;
			}

			if (extract_images) {
				const images: ImageData[] = [];
				target.find('img[src]').each((_, element) => {
					const src = $(element).attr('src');
					const alt = $(element).attr('alt') || '';
					if (src) {
						// Convert relative URLs to absolute
						const absoluteUrl = new URL(src, url).href;
						images.push({ src: absoluteUrl, alt });
					}
				});
				result.images = images;
			}

			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify(result, null, 2),
					},
				],
			};
		} catch (error) {
			return {
				content: [
					{
						type: 'text',
						text: `Error scraping webpage: ${
							error instanceof Error
								? error.message
								: String(error)
						}`,
					},
				],
			};
		}
	}
}
