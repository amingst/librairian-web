import { createBriefing, NewsBriefing } from '@/app/actions/pharos/briefings';
import { NextRequest, NextResponse } from 'next/server';
import { v4 } from 'uuid';

// Simple JSON-RPC helper to call MCP server
async function callMcpTool(
	tool: string,
	args: any
): Promise<Omit<NewsBriefing, 'id' | 'url' | 'createdAt'>> {
	const rpcRequest = {
		jsonrpc: '2.0',
		id: Date.now(),
		method: 'tools/call',
		params: { name: tool, arguments: args },
	};

	const resp = await fetch('http://localhost:3001/mcp', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(rpcRequest),
	});

	if (!resp.ok) {
		throw new Error(`MCP server HTTP error ${resp.status}`);
	}

	const json = await resp.json();
	if (json.error) {
		throw new Error(json.error.message || 'MCP tool error');
	}
	return json.result;
}

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const { ids, options } = body;

		if (!ids || !Array.isArray(ids) || ids.length === 0) {
			return NextResponse.json(
				{ success: false, error: 'ids array required' },
				{ status: 400 }
			);
		}

		const args = {
			ids,
			briefingType: options?.briefingType || 'summary',
			targetAudience: options?.targetAudience || 'general',
			includeSourceAttribution:
				options?.includeSourceAttribution !== false,
			includeAllSections: options?.includeAllSections ?? true,
			maxSections: options?.maxSections || 8,
			prioritizeTopics: options?.prioritizeTopics,
		};

		const result = await callMcpTool(
			'create_news_briefing_from_summaries',
			args
		);

		const id = v4();
		const briefing: NewsBriefing = {
			...result,
			id,
			url: `/pharos/briefings/view/${id}`,
			createdAt: new Date().toISOString(),
		};

		// Store the complete briefing data in the cookie
		await createBriefing(briefing);

		return NextResponse.json({ success: true, data: briefing });
	} catch (error) {
		console.error('Error generating briefing from summaries:', error);
		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
			},
			{ status: 500 }
		);
	}
}
