'use server';

import { z } from 'zod';
import { NewsScraperMCPClient } from '@/lib/mcp-client';

// Input validation schema
const scrapeRequestSchema = z.object({
	url: z.string().url(),
	include_media: z.boolean().default(true),
	extract_tags: z.boolean().default(true),
	estimate_reading_time: z.boolean().default(true),
});

// Non-streaming server action for simple extraction
export async function scrapeArticleAction(params: {
	url: string;
	include_media?: boolean;
	extract_tags?: boolean;
	estimate_reading_time?: boolean;
}) {
	try {
		const validatedData = scrapeRequestSchema.parse(params);

		const mcpClient = new NewsScraperMCPClient();
		await mcpClient.connect();

		try {
			const result = await mcpClient.extractArticle(validatedData.url);
			return { success: true, data: result };
		} finally {
			await mcpClient.disconnect();
		}

	} catch (error) {
		console.error('Server action error:', error);
		return { 
			success: false, 
			error: error instanceof Error ? error.message : 'Unknown error' 
		};
	}
}

// Server action to validate input before streaming
export async function validateScrapeRequest(params: {
	url: string;
	include_media?: boolean;
	extract_tags?: boolean;
	estimate_reading_time?: boolean;
}) {
	try {
		const validatedData = scrapeRequestSchema.parse(params);
		return { success: true, data: validatedData };
	} catch (error) {
		return { 
			success: false, 
			error: error instanceof Error ? error.message : 'Invalid input' 
		};
	}
}
