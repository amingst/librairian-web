import { NextRequest, NextResponse } from 'next/server';

/**
 * A proxy API route to bypass CORS issues when accessing media files
 * This routes requests from the browser through our Next.js server to the target server
 */
export async function GET(request: NextRequest) {
  try {
    // Get the URL to proxy from query parameters
    const searchParams = request.nextUrl.searchParams;
    const url = searchParams.get('url');
    
    if (!url) {
      return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
    }
    
    console.log(`Proxying request to: ${url}`);
    
    // Forward the request to the target URL
    const response = await fetch(url);
    
    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch from target URL: ${response.status} ${response.statusText}` }, 
        { status: response.status }
      );
    }
    
    // Get the content type to properly handle binary data
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    
    // Get the response data based on content type
    let data;
    if (contentType.includes('application/json')) {
      data = await response.json();
      return NextResponse.json(data);
    } else {
      // For images and other binary content
      data = await response.arrayBuffer();
      
      // Create a new response with the same headers
      const newResponse = new NextResponse(data, {
        status: response.status,
        statusText: response.statusText,
        headers: {
          'Content-Type': contentType,
          'Content-Length': response.headers.get('content-length') || '',
          'Cache-Control': 'public, max-age=3600'  // Cache for 1 hour
        }
      });
      
      return newResponse;
    }
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to proxy request' }, 
      { status: 500 }
    );
  }
} 