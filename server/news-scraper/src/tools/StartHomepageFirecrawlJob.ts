import FirecrawlApp from '@mendable/firecrawl-js';
import { MCPTool } from '@shared/backend';
import { inject, injectable } from 'inversify';
import { TYPES } from '../types/symbols.js';
import { PrismaClient } from '@prisma/client';
import config from '../config.js';
import z from 'zod';
import { MCPToolResponse } from '../types/response.js';

const FirecrawlNewsHomepageSchema = z.object({
	urls: z
		.array(z.string().url())
		.min(1)
		.describe('An array of news homepage URLs to scrape.'),
	limit: z
		.number()
		.min(1)
		.max(100)
		.default(20)
		.describe('Maximum number of articles to extract per site'),
});

@injectable()
export class StartHomepageFirecrawlJob extends MCPTool {
	private firecrawl: FirecrawlApp;

	constructor(@inject(TYPES.PrismaClient) private prisma: PrismaClient) {
		super();
		this.firecrawl = new FirecrawlApp({
			apiKey:
				config.firecrawlKey ??
				(() => {
					throw new Error('FIRECRAWL_API_KEY is not set');
				})(),
		});
	}

	get name(): string {
		return 'start_homepage_firecrawl_job';
	}

	get description(): string {
		return 'Starts a Firecrawl job to scrape news articles from the web';
	}

	get inputSchema(): z.ZodSchema {
		return FirecrawlNewsHomepageSchema;
	}

	get schema(): z.ZodType {
		return FirecrawlNewsHomepageSchema;
	}

	async execute(
		params: z.infer<typeof FirecrawlNewsHomepageSchema>
	): Promise<MCPToolResponse | undefined> {
		const { urls, limit } = params;
		return;
	}
}
