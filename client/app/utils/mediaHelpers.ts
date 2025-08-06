/**
 * Utilities for handling media in the OIP web application
 */

// Replace the API domain in URLs
export function fixApiUrl(url: string | undefined): string {
  if (!url) return '';
  return url.replace('https://api.oip.onl/', 'https://api.oip.onl/');
}

// Fetch text content from a URL
export async function fetchTextContent(url: string): Promise<string> {
  try {
    const response = await fetch(fixApiUrl(url));
    if (!response.ok) {
      throw new Error(`Failed to fetch text: ${response.status} ${response.statusText}`);
    }
    return await response.text();
  } catch (error) {
    console.error('Error fetching text content:', error);
    throw error;
  }
}

// Format date from timestamp
export function formatDate(timestamp: number): string {
  if (!timestamp) return '';
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// Get content type for media files
export function getContentTypeFromUrl(url: string): string {
  if (!url) return '';
  if (url.endsWith('.mp3')) return 'audio/mpeg';
  if (url.endsWith('.wav')) return 'audio/wav';
  if (url.endsWith('.jpg') || url.endsWith('.jpeg')) return 'image/jpeg';
  if (url.endsWith('.png')) return 'image/png';
  if (url.endsWith('.txt')) return 'text/plain';
  // Default fallback
  return 'application/octet-stream';
} 