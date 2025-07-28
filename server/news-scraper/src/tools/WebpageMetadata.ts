import z from 'zod';
import { HTMLScraperBase } from '../lib/helpers/html.js';
import { MCPTool } from '@shared/backend';
import { PageMetadata, HeadingData } from '@shared/types';
import { MCPToolResponse, ExtractMetadataParams } from '../types/index.js';
import * as cheerio from 'cheerio';
import { injectable } from 'inversify';

@injectable()
export class WebpageMetadataTool extends MCPTool {
	private static readonly inputSchema = z.object({
		url: z.string().url().describe('The URL of the webpage to analyze'),
	});

	get name(): string {
		return 'extract_metadata';
	}

	get description(): string {
		return 'Extract metadata from a webpage (title, description, keywords, etc.)';
	}

	get schema(): Record<string, any> {
		return WebpageMetadataTool.inputSchema.shape;
	}

	async execute(params: ExtractMetadataParams): Promise<MCPToolResponse> {
		const { url } = params;
		try {
			const html = await HTMLScraperBase.fetchHTML(url);
			const $ = cheerio.load(html);

			const metadata: PageMetadata = {
				url,
				title: $('title').text().trim(),
				description:
					$('meta[name="description"]').attr('content') || '',
				keywords: $('meta[name="keywords"]').attr('content') || '',
				author: $('meta[name="author"]').attr('content') || '',
				canonical: $('link[rel="canonical"]').attr('href') || '',
				language:
					$('html').attr('lang') ||
					$('meta[http-equiv="content-language"]').attr('content') ||
					'',
				timestamp: new Date().toISOString(),
				headings: [], // Initialize empty, will populate below
			};

			// Open Graph metadata
			const ogTags: Record<string, string> = {};
			$('meta[property^="og:"]').each((_, element) => {
				const property = $(element).attr('property');
				const content = $(element).attr('content');
				if (property && content) {
					const key = property.replace('og:', '');
					ogTags[key] = content;
				}
			});
			if (Object.keys(ogTags).length > 0) {
				metadata.openGraph = ogTags;
			}

			// Twitter Card metadata
			const twitterTags: Record<string, string> = {};
			$('meta[name^="twitter:"]').each((_, element) => {
				const name = $(element).attr('name');
				const content = $(element).attr('content');
				if (name && content) {
					const key = name.replace('twitter:', '');
					twitterTags[key] = content;
				}
			});
			if (Object.keys(twitterTags).length > 0) {
				metadata.twitter = twitterTags;
			}

			// Extract headings structure
			const headings: HeadingData[] = [];
			$('h1, h2, h3, h4, h5, h6').each((_, element) => {
				const tagName = element.tagName.toLowerCase();
				const level = parseInt(tagName.charAt(1));
				const text = $(element).text().trim();
				if (text) {
					headings.push({ level, text });
				}
			});
			metadata.headings = headings;

			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify(metadata, null, 2),
					},
				],
			};
		} catch (error) {
			return {
				content: [
					{
						type: 'text',
						text: `Error extracting metadata: ${
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
