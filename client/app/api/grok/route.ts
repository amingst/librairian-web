import { NextRequest, NextResponse } from 'next/server';

// Grok API endpoint - correct endpoint from documentation
const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';

export async function POST(request: NextRequest) {
  try {
    // Get the Grok API key from environment variables
    const apiKey = process.env.GROK_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Grok API key is not configured.' },
        { status: 500 }
      );
    }

    // Parse the request body
    const body = await request.json();
    const { query } = body;

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      );
    }

    console.log('Sending query to Grok:', query);

    // Call the Grok API with the format from documentation
    const response = await fetch(GROK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'grok-2-latest', // Using the latest Grok model as shown in documentation
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant providing information about historical figures, particularly those related to the Kennedy assassination and the events surrounding it.'
          },
          {
            role: 'user',
            content: query
          }
        ]
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Grok API error:', errorText);
      return NextResponse.json(
        { error: `Grok API returned an error: ${response.status} ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Format the response based on Grok API structure
    const responseText = data.choices?.[0]?.message?.content || 'No response available from Grok.';
    
    // Return the formatted response
    return NextResponse.json({
      response: responseText,
    });
  } catch (error) {
    console.error('Error in Grok API route:', error);
    return NextResponse.json(
      { error: 'Failed to query the Grok API' },
      { status: 500 }
    );
  }
} 