import { NextRequest, NextResponse } from 'next/server';
import { AIModel, ModelResponse } from '@shared/types';

const TEXT_ANALYSIS_SERVER_URL = process.env.TEXT_ANALYSIS_SERVER_URL || 'http://localhost:3002';

export async function GET(req: NextRequest): Promise<NextResponse<ModelResponse | { error: string }>> {
	try {
		// Extract query parameters
		const url = new URL(req.url);
		const provider = url.searchParams.get('provider');
		const costTier = url.searchParams.get('costTier');

		// Build query string for text-analysis server
		const queryParams = new URLSearchParams();
		if (provider) queryParams.append('provider', provider);
		if (costTier) queryParams.append('costTier', costTier);

		const queryString = queryParams.toString();
		const fetchUrl = `${TEXT_ANALYSIS_SERVER_URL}/api/models${queryString ? `?${queryString}` : ''}`;

		// Fetch from text-analysis server
		const response = await fetch(fetchUrl, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
			},
		});

		if (!response.ok) {
			throw new Error(`Text-analysis server responded with ${response.status}: ${response.statusText}`);
		}

		const data = await response.json();

		// Transform the response to match our ModelResponse interface
		const modelResponse: ModelResponse = {
			models: data.models || [],
			total: data.total || 0,
		};

		return NextResponse.json(modelResponse);
	} catch (error) {
		console.error('Error fetching models from text-analysis server:', error);
		
		// Return error response
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		return NextResponse.json(
			{ 
				error: 'Failed to fetch models from text-analysis server',
				details: errorMessage 
			},
			{ status: 500 }
		);
	}
}
