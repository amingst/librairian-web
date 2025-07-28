import { MCPTool } from '@shared/backend';
import { SearchResult, SearchMatch } from '@shared/types';
import { MCPToolResponse, SearchContentParams } from '../types/index.js';
import { z } from 'zod';
import * as cheerio from 'cheerio';
import { HTMLScraperBase } from '../lib/helpers/html.js';
import { injectable, inject } from 'inversify';
import { TYPES } from '../types/symbols.js';
import config from '../config.js';

type Config = typeof config;

@injectable()
export class WebpageSearchTool extends MCPTool {
	constructor(@inject(TYPES.Config) private config: Config) {
		super();
	}

	private readonly inputSchema = z.object({
		url: z.string().url().describe('The URL of the webpage to search'),
		query: z.string().describe('The text to search for'),
		case_sensitive: z
			.boolean()
			.default(false)
			.describe('Whether the search should be case sensitive'),
		context_chars: z
			.number()
			.default(100)
			.describe(
				'Number of characters to include around each match for context'
			),
		max_results: z
			.number()
			.default(10)
			.describe('Maximum number of search results to return'),
	});

	get name(): string {
		return 'search_content';
	}

	get description(): string {
		return 'Search for specific content within a webpage';
	}

	get schema(): Record<string, any> {
		return this.inputSchema.shape;
	}

	async execute(params: SearchContentParams): Promise<MCPToolResponse> {
		const { url, query, case_sensitive, context_chars } = params;
		try {
			const html = await HTMLScraperBase.fetchHTML(url);
			const $ = cheerio.load(html);

			const bodyText = $('body').text();
			const cleanedText = HTMLScraperBase.cleanText(bodyText);

			const searchText = case_sensitive
				? cleanedText
				: cleanedText.toLowerCase();
			const searchQuery = case_sensitive ? query : query.toLowerCase();

			const matches: SearchMatch[] = [];
			let index = 0;

			while ((index = searchText.indexOf(searchQuery, index)) !== -1) {
				const start = Math.max(0, index - (context_chars || 100));
				const end = Math.min(
					cleanedText.length,
					index + searchQuery.length + (context_chars || 100)
				);
				const context = cleanedText.substring(start, end);

				matches.push({
					index,
					context: `...${context}...`,
				});

				index += searchQuery.length;
			}

			const result: SearchResult = {
				url,
				query,
				matches_found: matches.length,
				matches: matches.slice(0, 10), // Limit to first 10 matches
				timestamp: new Date().toISOString(),
			};

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
						text: `Error searching content: ${
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
