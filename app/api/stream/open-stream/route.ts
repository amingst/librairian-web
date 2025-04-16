import { NextRequest } from 'next/server';

// API URL for backend services
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.oip.onl';
// Use the exact endpoint URL provided by the user
const STREAM_ENDPOINT = `${API_URL}/api/open-stream`;

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// Maximum time to wait for connection (5 minutes to accommodate longer processing time)
const CONNECTION_TIMEOUT = 300000;

/**
 * Proxy endpoint for SSE (Server-Sent Events) connections
 * This proxies requests to the backend and maintains an open connection
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const streamId = searchParams.get('id');
  
  if (!streamId) {
    return new Response(JSON.stringify({ error: 'No stream ID provided' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
  
  console.log(`Proxying stream connection for ID: ${streamId}`);
  
  // Create a readable stream that will be sent to the client
  const stream = new ReadableStream({
    async start(controller) {
      // Track if the controller is closed to prevent errors
      let isControllerClosed = false;
      
      // Safe method to enqueue data that checks if controller is still active
      const safeEnqueue = (chunk: Uint8Array) => {
        if (!isControllerClosed) {
          try {
            controller.enqueue(chunk);
          } catch (error: unknown) {
            const enqueueError = error as Error;
            console.warn('Error enqueueing data (controller may be closed):', enqueueError.message);
            isControllerClosed = true;
          }
        }
      };
      
      // Safe method to close the controller
      const safeClose = () => {
        if (!isControllerClosed) {
          try {
            controller.close();
            isControllerClosed = true;
          } catch (error: unknown) {
            const closeError = error as Error;
            console.warn('Error closing controller:', closeError.message);
          }
        }
      };
      
      // Function to attempt connection with retries
      const connectWithRetries = async (retryCount = 0, maxRetries = 3) => {
        try {
          // Connect to the backend SSE endpoint
          const backendUrl = `${STREAM_ENDPOINT}?id=${streamId}`;
          
          // Create AbortController with a timeout
          const abortController = new AbortController();
          const { signal } = abortController;
          
          // Set a timeout to abort the fetch if it takes too long
          const timeoutId = setTimeout(() => {
            abortController.abort('Connection timeout');
          }, CONNECTION_TIMEOUT);
          
          try {
            safeEnqueue(
              new TextEncoder().encode(`event: connecting\ndata: ${JSON.stringify({ 
                message: 'Connecting to backend stream',
                attempt: retryCount + 1,
                timestamp: Date.now()
              })}\n\n`)
            );
            
            const response = await fetch(backendUrl, { 
              signal,
              headers: {
                'Accept': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
              }
            });
            
            // Clear the timeout since we got a response
            clearTimeout(timeoutId);
            
            if (!response.ok) {
              const errorText = await response.text();
              console.error(`Backend stream error: ${response.status} - ${errorText}`);
              
              safeEnqueue(
                new TextEncoder().encode(`event: error\ndata: ${JSON.stringify({ 
                  error: `Backend connection failed with status ${response.status}`,
                  details: errorText 
                })}\n\n`)
              );
              
              // Try to reconnect if we haven't reached max retries
              if (retryCount < maxRetries) {
                const nextRetryDelay = Math.min(1000 * Math.pow(2, retryCount), 10000);
                
                safeEnqueue(
                  new TextEncoder().encode(`event: retrying\ndata: ${JSON.stringify({ 
                    message: `Retrying connection in ${nextRetryDelay / 1000} seconds`,
                    attempt: retryCount + 1,
                    maxRetries,
                    timestamp: Date.now()
                  })}\n\n`)
                );
                
                setTimeout(() => connectWithRetries(retryCount + 1, maxRetries), nextRetryDelay);
                return;
              }
              
              safeClose();
              return;
            }
            
            if (!response.body) {
              console.error('No response body from backend stream');
              
              safeEnqueue(
                new TextEncoder().encode(`event: error\ndata: ${JSON.stringify({ 
                  error: 'Backend response has no body' 
                })}\n\n`)
              );
              
              // Try to reconnect if we haven't reached max retries
              if (retryCount < maxRetries) {
                const nextRetryDelay = Math.min(1000 * Math.pow(2, retryCount), 10000);
                setTimeout(() => connectWithRetries(retryCount + 1, maxRetries), nextRetryDelay);
                return;
              }
              
              safeClose();
              return;
            }
            
            // Send initial connected event
            safeEnqueue(
              new TextEncoder().encode(`event: connected\ndata: ${JSON.stringify({ 
                message: 'Stream connected to backend',
                timestamp: Date.now()
              })}\n\n`)
            );
            
            const reader = response.body.getReader();
            
            // Process the stream from the backend and forward to the client
            try {
              let buffer = '';
              
              while (!isControllerClosed) {
                const { done, value } = await reader.read();
                
                if (done) {
                  console.log('Backend stream closed normally');
                  
                  safeEnqueue(
                    new TextEncoder().encode(`event: complete\ndata: ${JSON.stringify({ 
                      message: 'Backend stream ended',
                      timestamp: Date.now()
                    })}\n\n`)
                  );
                  
                  break;
                }
                
                // Decode the chunk and append to buffer
                const chunk = new TextDecoder().decode(value);
                buffer += chunk;
                
                // Process complete events in the buffer
                let eventEnd = buffer.indexOf('\n\n');
                while (eventEnd !== -1) {
                  const event = buffer.substring(0, eventEnd + 2);
                  buffer = buffer.substring(eventEnd + 2);
                  
                  // Forward the event to the client
                  safeEnqueue(new TextEncoder().encode(event));
                  
                  // Look for next event
                  eventEnd = buffer.indexOf('\n\n');
                }
              }
            } catch (error: unknown) {
              // Check if controller is already closed before sending error
              if (!isControllerClosed) {
                const readError = error as Error;
                console.error('Error reading from backend stream:', readError);
                
                safeEnqueue(
                  new TextEncoder().encode(`event: error\ndata: ${JSON.stringify({ 
                    error: 'Error reading from backend stream',
                    message: readError.message || 'Stream read error' 
                  })}\n\n`)
                );
                
                // Try to reconnect if we haven't reached max retries
                if (retryCount < maxRetries) {
                  const nextRetryDelay = Math.min(1000 * Math.pow(2, retryCount), 10000);
                  
                  safeEnqueue(
                    new TextEncoder().encode(`event: retrying\ndata: ${JSON.stringify({ 
                      message: `Connection interrupted. Retrying in ${nextRetryDelay / 1000} seconds`,
                      attempt: retryCount + 1,
                      maxRetries,
                      timestamp: Date.now()
                    })}\n\n`)
                  );
                  
                  setTimeout(() => connectWithRetries(retryCount + 1, maxRetries), nextRetryDelay);
                  return;
                }
              }
            } finally {
              try {
                reader.releaseLock();
              } catch (releaseError) {
                console.warn('Error releasing reader lock:', releaseError);
              }
            }
          } catch (error: unknown) {
            // Clear the timeout if fetch fails
            clearTimeout(timeoutId);
            
            const fetchError = error as Error;
            console.error('Error connecting to backend stream:', fetchError);
            
            // Only send error if controller is still active
            if (!isControllerClosed) {
              safeEnqueue(
                new TextEncoder().encode(`event: error\ndata: ${JSON.stringify({ 
                  error: 'Failed to connect to backend stream',
                  message: fetchError.message || 'Connection error'
                })}\n\n`)
              );
              
              // Try to reconnect if we haven't reached max retries
              if (retryCount < maxRetries) {
                const nextRetryDelay = Math.min(1000 * Math.pow(2, retryCount), 10000);
                
                safeEnqueue(
                  new TextEncoder().encode(`event: retrying\ndata: ${JSON.stringify({ 
                    message: `Connection failed. Retrying in ${nextRetryDelay / 1000} seconds`,
                    attempt: retryCount + 1,
                    maxRetries,
                    timestamp: Date.now()
                  })}\n\n`)
                );
                
                setTimeout(() => connectWithRetries(retryCount + 1, maxRetries), nextRetryDelay);
                return;
              }
            }
          }
        } catch (error: unknown) {
          const genericError = error as Error;
          console.error('Unexpected error in stream proxy:', genericError);
          
          if (!isControllerClosed) {
            safeEnqueue(
              new TextEncoder().encode(`event: error\ndata: ${JSON.stringify({ 
                error: 'Unexpected error in stream proxy',
                message: genericError.message || 'Unknown error'
              })}\n\n`)
            );
          }
        } finally {
          // Ensure controller is closed when we're done with all retries
          safeClose();
        }
      };
      
      // Start the connection process
      await connectWithRetries();
    }
  });
  
  // Return the stream response
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
} 