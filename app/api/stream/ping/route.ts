import { NextRequest, NextResponse } from 'next/server';

// API URL for backend ping service
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.oip.onl';
// Use the exact endpoint for ping
const PING_ENDPOINT = `${API_URL}/api/ping`;

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/**
 * Ping endpoint to keep connections alive
 * This proxies to the backend ping service and returns a simple response
 */
export async function GET(req: NextRequest) {
  try {
    // Try to ping the backend service
    const response = await fetch(PING_ENDPOINT, {
      headers: {
        'Accept': 'application/json',
      },
      next: { revalidate: 0 }, // Don't cache this request
    });
    
    if (response.ok) {
      // If backend responds, return its response
      const data = await response.json();
      return NextResponse.json({
        status: 'active',
        timestamp: Date.now(),
        backend: data,
        message: 'Connection alive'
      });
    } else {
      // If backend fails, return our own response
      return NextResponse.json({
        status: 'active',
        timestamp: Date.now(),
        backend_status: 'unavailable',
        message: 'Connection alive (backend unavailable)'
      });
    }
  } catch (error: unknown) {
    // If there's a network error, still return a valid response
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error pinging backend:', errorMessage);
    return NextResponse.json({
      status: 'active',
      timestamp: Date.now(),
      backend_status: 'error',
      message: 'Connection alive (backend error)'
    });
  }
} 