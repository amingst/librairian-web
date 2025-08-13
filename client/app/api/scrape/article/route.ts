import { NextRequest } from 'next/server';
import { z } from 'zod';

const NEWS_SCRAPER_URL = process.env.NEWS_SCRAPER_URL || 'http://localhost:3001';

// Input validation schema
const scrapeRequestSchema = z.object({
	url: z.string().url(),
	include_media: z.boolean().default(true),
	extract_tags: z.boolean().default(true),
	estimate_reading_time: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const validatedData = scrapeRequestSchema.parse(body);

		// Call the MCP server's streaming endpoint directly
		const response = await fetch(`${NEWS_SCRAPER_URL}/api/stream/scrape-article`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(validatedData),
		});

		if (!response.ok) {
			throw new Error(`MCP server responded with ${response.status}: ${response.statusText}`);
		}

		// Return the real streaming response with actual progress updates
		return new Response(response.body, {
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				'Connection': 'keep-alive',
				'Access-Control-Allow-Origin': '*',
				'Access-Control-Allow-Methods': 'POST',
				'Access-Control-Allow-Headers': 'Content-Type',
			},
		});

	} catch (error) {
		console.error('Request validation error:', error);
		
		return new Response(
			JSON.stringify({ 
				error: 'Invalid request',
				details: error instanceof Error ? error.message : 'Unknown error'
			}),
			{ 
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
}
