import { NextRequest, NextResponse } from "next/server";

// Function to fetch bio from Wikipedia
async function fetchBioFromWikipedia(name: string): Promise<{ bio: string; source: string } | null> {
  try {
    // Try to fetch from Wikipedia first
    const encodedName = encodeURIComponent(name);
    const wikipediaResponse = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodedName}`
    );
    
    if (wikipediaResponse.ok) {
      const data = await wikipediaResponse.json();
      
      // Check if we got a proper bio and not a disambiguation page
      if (data.extract && !data.extract.includes("may refer to")) {
        return {
          bio: data.extract,
          source: "wikipedia"
        };
      }
    }
    
    // Try with variations of the name
    const nameVariations = generateNameVariations(name);
    for (const variation of nameVariations) {
      if (variation === name) continue; // Skip if it's the same as the original name
      
      const encodedVariation = encodeURIComponent(variation);
      const variationResponse = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodedVariation}`
      );
      
      if (variationResponse.ok) {
        const data = await variationResponse.json();
        
        if (data.extract && !data.extract.includes("may refer to")) {
          return {
            bio: data.extract,
            source: "wikipedia"
          };
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error("Error fetching bio from Wikipedia:", error);
    return null;
  }
}

// Function to generate variations of a name for better search results
function generateNameVariations(name: string): string[] {
  const variations = [];
  
  // Remove "Jr." or "Sr." for potentially better matches
  if (name.includes(" Jr.")) {
    variations.push(name.replace(" Jr.", ""));
  }
  if (name.includes(" Sr.")) {
    variations.push(name.replace(" Sr.", ""));
  }
  
  // Try with middle initial only
  const nameParts = name.split(" ");
  if (nameParts.length > 2) {
    const firstLast = `${nameParts[0]} ${nameParts[nameParts.length - 1]}`;
    variations.push(firstLast);
  }
  
  // Add "Kennedy assassination" to potentially find more relevant articles
  variations.push(`${name} Kennedy assassination`);
  
  return variations;
}

// Function to search for an image of a person
async function searchPersonImage(name: string): Promise<string> {
  try {
    // First check if we have predefined images for well-known JFK figures
    const knownImages: Record<string, string> = {
      "Lee Harvey Oswald": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Lee_Harvey_Oswald_arrest_card_1963.jpg/220px-Lee_Harvey_Oswald_arrest_card_1963.jpg",
      "Jack Ruby": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Jack_Ruby_mugshot_1963.jpg/220px-Jack_Ruby_mugshot_1963.jpg",
      "John F. Kennedy": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/John_F._Kennedy%2C_White_House_color_photo_portrait.jpg/220px-John_F._Kennedy%2C_White_House_color_photo_portrait.jpg",
      "Jacqueline Kennedy": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/JBK.jpg/220px-JBK.jpg",
      "Robert F. Kennedy": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/RFK_WHPO_1964_crop.jpg/220px-RFK_WHPO_1964_crop.jpg",
      "J. Edgar Hoover": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f9/J._Edgar_Hoover%2C_1961.jpg/220px-J._Edgar_Hoover%2C_1961.jpg",
      "Marina Oswald": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f4/Warren-commission-testimony.png/220px-Warren-commission-testimony.png",
      "Earl Warren": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Earl_Warren.jpg/220px-Earl_Warren.jpg",
      "Lyndon B. Johnson": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/37_Lyndon_Johnson_3x4.jpg/220px-37_Lyndon_Johnson_3x4.jpg"
    };
    
    // Check for exact matches in our known images
    for (const [key, url] of Object.entries(knownImages)) {
      if (name.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(name.toLowerCase())) {
        return url;
      }
    }
    
    // Try to get image from Wikipedia
    const encodedName = encodeURIComponent(name);
    const wikipediaResponse = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodedName}`
    );
    
    if (wikipediaResponse.ok) {
      const data = await wikipediaResponse.json();
      if (data.thumbnail && data.thumbnail.source) {
        // Try to get a larger version of the image
        const largerImage = data.thumbnail.source.replace(/\/\d+px-/, '/300px-');
        return largerImage;
      }
    }
    
    // If no image found from Wikipedia, use a placeholder
    return `https://via.placeholder.com/150x150?text=${encodeURIComponent(name.replace(/\s/g, '+'))}`;
  } catch (error) {
    console.error("Error searching for person image:", error);
    return `https://via.placeholder.com/150x150?text=${encodeURIComponent(name.replace(/\s/g, '+'))}`;
  }
}

// Function to generate a bio if Wikipedia doesn't have one
async function generateBio(name: string): Promise<string> {
  // Default bio for common JFK-related figures
  const commonFigures: Record<string, string> = {
    "Lee Harvey Oswald": "Lee Harvey Oswald (October 18, 1939 – November 24, 1963) was an American Marxist and former U.S. Marine who assassinated United States President John F. Kennedy on November 22, 1963. Oswald was honorably discharged from the Marine Corps and defected to the Soviet Union in October 1959. He lived in the Soviet Union until June 1962, when he returned to the United States. Oswald was initially arrested for the murder of Dallas police officer J. D. Tippit, who was killed on a city street approximately 45 minutes after Kennedy was shot. Oswald was later charged with the murder of Kennedy as well, but denied shooting anybody, claiming he was a 'patsy'. Two days later, Oswald was fatally shot by local nightclub owner Jack Ruby on live television in the basement of Dallas Police Headquarters.",
    "Jack Ruby": "Jack Leon Ruby (born Jacob Leon Rubenstein; April 25, 1911 – January 3, 1967) was an American nightclub owner and alleged associate of the Chicago Outfit who fatally shot Lee Harvey Oswald on November 24, 1963, while Oswald was in police custody after being charged with assassinating United States President John F. Kennedy two days earlier. Ruby was charged with murder and was convicted, but the conviction was later appealed and Ruby was granted a new trial. As the date for his new trial was being set, Ruby became ill in prison and died of a pulmonary embolism from lung cancer on January 3, 1967.",
    "J. Edgar Hoover": "John Edgar Hoover (January 1, 1895 – May 2, 1972) was the first Director of the Federal Bureau of Investigation (FBI) of the United States. He was appointed as the director of the Bureau of Investigation – the FBI's predecessor – in 1924 and was instrumental in founding the FBI in 1935, where he remained director for another 37 years until his death in 1972 at the age of 77. Hoover has been credited with building the FBI into a larger crime-fighting agency than it was at its inception and with instituting a number of modernizations to police technology, such as a centralized fingerprint file and forensic laboratories. After Kennedy's assassination, Hoover directed the FBI's investigation.",
    "Earl Warren": "Earl Warren (March 19, 1891 – July 9, 1974) was an American politician and jurist who served as the 14th Chief Justice of the United States from 1953 to 1969. Warren chaired the President's Commission on the Assassination of President Kennedy (the Warren Commission), which concluded that Lee Harvey Oswald was the sole perpetrator of the assassination of President John F. Kennedy, without the assistance of others."
  };
  
  // Check if we have a default bio for this person
  const lowercaseName = name.toLowerCase();
  for (const [key, bio] of Object.entries(commonFigures)) {
    if (key.toLowerCase().includes(lowercaseName) || lowercaseName.includes(key.toLowerCase())) {
      return bio;
    }
  }
  
  // For other figures, generate a generic bio
  return `${name} was a figure mentioned in documents related to the JFK assassination and subsequent investigation. While specific biographical details may be limited in the available documents, their appearance in these files indicates some level of relevance to the events surrounding President Kennedy's assassination or the investigations that followed.`;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get("name");

    if (!name) {
      return NextResponse.json(
        { error: "Name parameter is required" },
        { status: 400 }
      );
    }

    // Fetch bio from Wikipedia first
    const wikipediaBio = await fetchBioFromWikipedia(name);
    
    // Get image for the person
    const imageUrl = await searchPersonImage(name);
    
    let bio: string;
    let source: string;
    
    if (wikipediaBio) {
      // Use Wikipedia bio if available
      bio = wikipediaBio.bio;
      source = wikipediaBio.source;
    } else {
      // Generate bio as fallback
      bio = await generateBio(name);
      source = "ai-generated";
    }

    // Return the profile data
    return NextResponse.json({
      name,
      bio,
      imageUrl,
      source
    });
  } catch (error) {
    console.error("Error in profile API:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile information" },
      { status: 500 }
    );
  }
} 