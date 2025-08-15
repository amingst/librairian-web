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
    const { query, briefingId } = await req.json();
    
    if (!query || !briefingId) {
      return NextResponse.json(
        { error: 'Missing query or briefingId' },
        { status: 400 }
      );
    }

    // Get response from MCP briefing RAG tool
    const response = await callMcpTool('briefing_rag', {
      briefingId,
      query,
    });

    return NextResponse.json({ response });
  } catch (error) {
    console.error('RAG query error:', error);
    return NextResponse.json(
      { error: 'Failed to process RAG query' },
      { status: 500 }
    );
  }
}
