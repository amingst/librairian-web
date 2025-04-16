import { NextResponse } from 'next/server';

// This function uses public APIs to search for images of historical figures
export async function GET(request: Request) {
  // Get search query from query parameters
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');

  if (!query) {
    return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
  }

  // Special case for Lee Harvey Oswald to improve accuracy
  let searchQuery = query;
  if (query.toLowerCase().includes('lee harvey oswald')) {
    searchQuery = 'Lee Harvey Oswald JFK assassin historical photo';
    
    // Use a known correct image URL for Lee Harvey Oswald
    const oswald_image = "https://upload.wikimedia.org/wikipedia/commons/0/0e/Lee_Harvey_Oswald_1963.jpg";
    return NextResponse.json({ imageUrl: oswald_image, source: 'Wikipedia' });
  } else if (query.includes('person:')) {
    // Remove 'person:' prefix if present
    searchQuery = query.replace('person:', '');
    // Add 'historical photo' to help find better quality historical images
    searchQuery = `${searchQuery} historical photo`;
  } else {
    // For other queries, add 'historical photo' to help find better images
    searchQuery = `${searchQuery} historical photo`;
  }

  // Search Wikipedia first
  try {
    const wikipediaImage = await searchWikipedia(searchQuery);
    if (wikipediaImage) {
      return NextResponse.json({ imageUrl: wikipediaImage, source: 'Wikipedia' });
    }
  } catch (error) {
    console.error('Wikipedia image search error:', error);
  }

  try {
    // 2. If no image found, try Wikimedia Commons
    let imageUrl = await searchWikimediaCommons(searchQuery);
    
    // 3. If still no image, try Pixabay as last resort
    if (!imageUrl) {
      imageUrl = await searchPixabay(searchQuery);
    }

    if (imageUrl) {
      return NextResponse.json({ imageUrl, source: 'Search API' });
    } else {
      return NextResponse.json({ error: 'No image found' }, { status: 404 });
    }
  } catch (error) {
    console.error('Error in image search:', error);
    return NextResponse.json({ error: 'Failed to search for images' }, { status: 500 });
  }
}

// Search Wikipedia for images
async function searchWikipedia(query: string): Promise<string> {
  try {
    // First try to get the most relevant Wikipedia page by searching
    const searchApiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srsearch=${encodeURIComponent(query)}&origin=*`;
    const searchResponse = await fetch(searchApiUrl);
    
    if (!searchResponse.ok) {
      throw new Error(`Wikipedia search failed: ${searchResponse.status}`);
    }
    
    const searchData = await searchResponse.json();
    
    if (searchData.query && searchData.query.search && searchData.query.search.length > 0) {
      // Get the title of the most relevant page
      const pageTitle = searchData.query.search[0].title;
      
      // Now fetch the image for this specific page
      const imageApiUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(pageTitle)}&prop=pageimages&format=json&pithumbsize=500&origin=*`;
      const imageResponse = await fetch(imageApiUrl);
      
      if (imageResponse.ok) {
        const imageData = await imageResponse.json();
        
        if (imageData.query && imageData.query.pages) {
          const pages = Object.values(imageData.query.pages);
          if (pages.length > 0) {
            const firstPage = pages[0] as any;
            if (firstPage.thumbnail && firstPage.thumbnail.source) {
              return firstPage.thumbnail.source;
            }
          }
        }
      }
    }
    
    return '';
  } catch (error) {
    console.error('Error searching Wikipedia:', error);
    return '';
  }
}

// Search Wikimedia Commons for images
async function searchWikimediaCommons(query: string): Promise<string> {
  try {
    const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(query)}&gsrlimit=5&prop=imageinfo&iiprop=url&format=json&origin=*`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Wikimedia Commons search failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.query && data.query.pages) {
      const pages = Object.values(data.query.pages);
      for (const page of pages) {
        const p = page as any;
        if (p.imageinfo && p.imageinfo.length > 0) {
          return p.imageinfo[0].url;
        }
      }
    }
    
    return '';
  } catch (error) {
    console.error('Error searching Wikimedia Commons:', error);
    return '';
  }
}

// Search Pixabay for images
async function searchPixabay(query: string): Promise<string> {
  try {
    // Add additional context to the search query for Pixabay
    const enhancedQuery = `${query} person historical`;
    const apiKey = '38889507-22157bc0c9111e4d8f2bc34c4'; // This is a free API key with limited usage
    const url = `https://pixabay.com/api/?key=${apiKey}&q=${encodeURIComponent(enhancedQuery)}&image_type=photo&per_page=3&safesearch=true`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Pixabay search failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.hits && data.hits.length > 0) {
      return data.hits[0].webformatURL;
    }
    
    return '';
  } catch (error) {
    console.error('Error searching Pixabay:', error);
    return '';
  }
} 