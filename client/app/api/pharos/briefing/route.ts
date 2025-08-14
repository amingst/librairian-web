import { NextRequest, NextResponse } from 'next/server';

// Simple JSON-RPC helper to call MCP server
async function callMcpTool(tool: string, args: any) {
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

		// Build arguments for tool (pass options directly – tool schema handles defaults)
		const args = {
			ids,
			briefingType: options?.briefingType || 'summary',
			targetAudience: options?.targetAudience || 'general',
			includeSourceAttribution:
				options?.includeSourceAttribution !== false,
			maxSections: options?.maxSections || 8,
			prioritizeTopics: options?.prioritizeTopics,
		};

		const result = await callMcpTool('create_news_briefing', args);

		// Tool returns plain object (already parsed)
		return NextResponse.json({ success: true, data: result });
	} catch (error) {
		console.error('Error generating briefing:', error);
		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
			},
			{ status: 500 }
		);
	}
}
