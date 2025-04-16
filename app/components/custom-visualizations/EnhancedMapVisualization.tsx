"use client";

import { useState, useEffect } from 'react';
import { 
  ComposableMap, 
  Geographies, 
  Geography, 
  Marker
} from "react-simple-maps";

// Use a more reliable geoURL
const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// Define place coordinates type
type PlaceCoordinates = [number, number]; // [longitude, latitude]

interface EnhancedMapVisualizationProps {
  places: string[];
}

const EnhancedMapVisualization = ({ places = [] }: EnhancedMapVisualizationProps) => {
  const [tooltipContent, setTooltipContent] = useState<string | null>(null);
  const [activePlace, setActivePlace] = useState<number | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [fallbackVisible, setFallbackVisible] = useState(true);
  
  // Sample coordinates mapping for well-known locations
  const coordinatesMap: Record<string, PlaceCoordinates> = {
    "Washington": [-77.0369, 38.9072],   // Washington, DC
    "Moscow": [37.6173, 55.7558],        // Moscow, Russia
    "Dallas": [-96.7970, 32.7767],       // Dallas, TX
    "Cuba": [-77.7812, 21.5218],         // Cuba (center)
    "Mexico City": [-99.1332, 19.4326],  // Mexico City
    "New Orleans": [-90.0715, 29.9511],  // New Orleans, LA
    "Miami": [-80.1918, 25.7617],        // Miami, FL
    "Chicago": [-87.6298, 41.8781],      // Chicago, IL
    "New York": [-74.0060, 40.7128],     // New York, NY
    "Los Angeles": [-118.2437, 34.0522], // Los Angeles, CA
    "Berlin": [13.4050, 52.5200],        // Berlin, Germany
    "Paris": [2.3522, 48.8566],          // Paris, France
    "London": [-0.1276, 51.5074],        // London, UK
    "Tokyo": [139.6503, 35.6762],        // Tokyo, Japan
    "Beijing": [116.4074, 39.9042],      // Beijing, China
    "Hong Kong": [114.1694, 22.3193],    // Hong Kong
    "Vietnam": [108.2772, 14.0583],      // Vietnam (center)
    "ODOYNE": [-3.6895, 55.9533],        // Approximation for ODOYNE (UK)
    "UK": [-3.4359, 55.3781],            // UK (center)
    "Czech": [15.4730, 49.8175],         // Czech Republic (center)
    "Soviet": [39.0742, 56.1304],        // Former Soviet Union (approx center)
    "USSR": [55.7558, 37.6173],          // Former USSR (using Moscow)
    "Havana": [-82.3666, 23.1136],       // Havana, Cuba
    "Costa Rica": [-84.0907, 9.9281],    // Costa Rica (center)
    "Panama": [-80.7821, 8.5375],        // Panama (center)
    "Matanzas": [-81.5774, 23.0511]      // Matanzas, Cuba
  };
  
  // Helper function to get coordinates for a place, or provide a fallback
  const getCoordinates = (place: string): PlaceCoordinates => {
    // Check for case-insensitive match
    const caseInsensitiveMatch = Object.keys(coordinatesMap).find(
      key => key.toLowerCase() === place.toLowerCase()
    );
    
    if (caseInsensitiveMatch) {
      return coordinatesMap[caseInsensitiveMatch];
    }
    
    // Fallback to random coordinates (weighted toward North America for JFK documents)
    // Longitude range for North America biased
    const lng = Math.random() * 60 - 110; // -110 to -50 (mostly North America)
    // Latitude range
    const lat = Math.random() * 30 + 25; // 25 to 55 (mostly North America)
    
    return [lng, lat] as PlaceCoordinates;
  };
  
  // Use fallback if map fails to load
  useEffect(() => {
    // Set a timeout to check if map loads, if not, keep fallback visible
    const timer = setTimeout(() => {
      if (!mapLoaded) {
        console.log("Map failed to load in time, keeping fallback visible");
        setFallbackVisible(true);
      } else {
        setFallbackVisible(false);
      }
    }, 1500);
    
    return () => clearTimeout(timer);
  }, [mapLoaded]);

  // Immediately show fallback
  useEffect(() => {
    setFallbackVisible(true);
  }, []);

  return (
    <div style={{ width: '100%', border: '2px solid #dcfce7', borderRadius: '0.5rem', padding: '1rem', backgroundColor: 'white' }}>
      <h3 style={{ fontWeight: 'bold', fontSize: '1.125rem', marginBottom: '1rem', color: '#166534' }}>Geographic Map</h3>
      
      <div style={{ position: 'relative', aspectRatio: '2/1', border: '1px solid #ccc', borderRadius: '0.5rem', overflow: 'hidden', backgroundColor: '#f0f9ff' }}>
        {/* Always use the fallback since react-simple-maps seems to have issues */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <img 
              src="/world-map-simple.png" 
              alt="World Map" 
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              onLoad={() => {
                console.log("Fallback map image loaded");
                setFallbackVisible(true);
              }}
            />
            
            {/* Simplified Pin Markers using the fallback approach */}
            {places.filter(Boolean).slice(0, 10).map((place, index) => {
              // Fixed positions for common places
              const positions: Record<string, {x: number, y: number}> = {
                "Washington": {x: 25, y: 40},
                "Moscow": {x: 60, y: 35},
                "Dallas": {x: 22, y: 40},
                "Cuba": {x: 25, y: 45},
                "Mexico City": {x: 20, y: 48},
                "New Orleans": {x: 24, y: 43},
                "Miami": {x: 26, y: 43},
                "Chicago": {x: 24, y: 38},
                "New York": {x: 27, y: 38},
                "Los Angeles": {x: 15, y: 40},
                "Berlin": {x: 50, y: 35},
                "Paris": {x: 48, y: 37},
                "London": {x: 46, y: 35},
                "Tokyo": {x: 80, y: 40},
                "Beijing": {x: 75, y: 38},
                "Hong Kong": {x: 75, y: 45},
                "Vietnam": {x: 75, y: 48},
                "ODOYNE": {x: 47, y: 32},
                "UK": {x: 46, y: 35},
                "Czech": {x: 52, y: 36},
                "Soviet": {x: 60, y: 30},
                "USSR": {x: 65, y: 32},
                "Havana": {x: 25, y: 45},
                "Costa Rica": {x: 23, y: 48},
                "Panama": {x: 24, y: 49},
                "Matanzas": {x: 25, y: 46}
              };
              
              // Default position for unknown places
              let x = 20 + (index * 6) % 60; // Spread them out horizontally
              let y = 35 + (index * 3) % 20; // And vertically
              
              // Use known position if available
              for (const [key, pos] of Object.entries(positions)) {
                if (place.toLowerCase().includes(key.toLowerCase())) {
                  x = pos.x;
                  y = pos.y;
                  break;
                }
              }
              
              return (
                <div
                  key={`pin-${index}`}
                  style={{
                    position: 'absolute',
                    left: `${x}%`,
                    top: `${y}%`,
                    transform: 'translate(-50%, -50%)',
                    zIndex: 20,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center'
                  }}
                  onMouseEnter={() => setActivePlace(index)}
                  onMouseLeave={() => setActivePlace(null)}
                >
                  {/* Large, obvious pin design */}
                  <div style={{
                    width: '2rem', 
                    height: '2rem', 
                    borderRadius: '9999px', 
                    backgroundColor: activePlace === index ? '#dc2626' : '#ef4444',
                    border: '2px solid white', 
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    animation: activePlace === index ? 'pulse 1.5s infinite' : 'none'
                  }}>
                    {index + 1}
                  </div>
                  
                  {/* Always visible label */}
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    color: 'white',
                    fontSize: '0.75rem',
                    borderRadius: '0.25rem',
                    padding: '0.25rem 0.5rem',
                    marginTop: '0.25rem',
                    whiteSpace: 'nowrap',
                    visibility: activePlace === index ? 'visible' : 'hidden'
                  }}>
                    {place}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      
      {/* Location list */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '1rem' }}>
        {places.filter(Boolean).slice(0, 10).map((place, idx) => (
          <div 
            key={`place-tag-${idx}`} 
            style={{ 
              padding: '0.25rem 0.5rem', 
              backgroundColor: '#dcfce7', 
              color: '#166534', 
              borderRadius: '9999px', 
              fontSize: '0.75rem', 
              fontWeight: 'bold', 
              display: 'flex', 
              alignItems: 'center'
            }}
          >
            <span style={{ 
              width: '1rem', 
              height: '1rem', 
              borderRadius: '9999px', 
              backgroundColor: '#dc2626', 
              marginRight: '0.25rem', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              color: 'white', 
              fontSize: '0.5rem', 
              fontWeight: 'bold'
            }}>
              {idx+1}
            </span>
            {place}
          </div>
        ))}
      </div>
      
      <style jsx global>{`
        @keyframes pulse {
          0% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.1);
          }
          100% {
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
};

export default EnhancedMapVisualization; 