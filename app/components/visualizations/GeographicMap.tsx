"use client";

import { useState, useEffect } from 'react';

export interface GeographicMapProps {
  documentId?: string;
  width?: number;
  height?: number;
  onMarkerClick?: (place: string, count: number) => void;
}

interface PlaceData {
  place: string;
  coordinates?: [number, number];
  mentions?: number;
  document_count?: number;
}

export default function GeographicMap({ 
  documentId, 
  width = 960, 
  height = 600,
  onMarkerClick
}: GeographicMapProps) {
  const [placesData, setPlacesData] = useState<PlaceData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activePlace, setActivePlace] = useState<number | null>(null);

  useEffect(() => {
    const fetchGeoData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // If we have a specific document, get places for that document
        if (documentId) {
          console.log(`Fetching geographic data for document ID: ${documentId}`);
          const response = await fetch(`/api/jfk/connections?type=geo&documentId=${documentId}`);
          
          if (!response.ok) {
            throw new Error(`Failed to fetch geographic data: ${response.statusText}`);
          }
          
          const data = await response.json();
          console.log('Geographic data fetched successfully:', data.results.places.length, 'places found');
          setPlacesData(data.results.places);
        } 
        // Otherwise, get top places mentioned across documents
        else {
          console.log('Fetching aggregate geographic data');
          const response = await fetch('/api/jfk/connections?type=places');
          
          if (!response.ok) {
            throw new Error(`Failed to fetch places data: ${response.statusText}`);
          }
          
          const data = await response.json();
          
          // Format the data to match our expected structure
          const formattedData = data.results
            .slice(0, 20) // limit to top 20 places
            .map((place: any) => ({
              place: place.place,
              document_count: place.document_count
            }));
          
          console.log('Aggregate geographic data fetched successfully:', formattedData.length, 'places found');
          setPlacesData(formattedData);
        }
      } catch (err) {
        console.error("Error fetching geographic data:", err);
        setError(err instanceof Error ? err.message : "Unknown error occurred");
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchGeoData();
  }, [documentId]);

  const handlePlaceClick = (place: PlaceData, index: number) => {
    setActivePlace(index === activePlace ? null : index);
    if (onMarkerClick) {
      const count = place.mentions || place.document_count || 0;
      onMarkerClick(place.place, count);
    }
  };

  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100%', 
        width: '100%',
        padding: '2rem'
      }}>
        Loading geographic data...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100%', 
        width: '100%',
        padding: '2rem'
      }}>
        <div style={{ color: '#ef4444' }}>Error: {error}</div>
      </div>
    );
  }

  if (placesData.length === 0) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100%', 
        width: '100%',
        padding: '2rem'
      }}>
        <div style={{ color: '#6b7280', maxWidth: '28rem', textAlign: 'center' }}>
          <p>No geographic data available{documentId ? ' for this document' : ''}</p>
          <p style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>{
            documentId 
              ? "The document may not mention any places with known geographic coordinates."
              : "Try a different search or visualization type."
          }</p>
        </div>
      </div>
    );
  }

  // Map with inline styles - using approach from [id]/page.tsx
  return (
    <div style={{ 
      width: '100%', 
      height: '100%', 
      padding: '1rem',
      borderRadius: '0.5rem',
      backgroundColor: 'white',
      boxShadow: '0 1px 3px rgba(0,0,0,0.12)'
    }}>
      <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: '500' }}>Geographic Distribution</h3>
        <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
          Showing {placesData.length} most mentioned places{documentId ? ' in the document' : ''}
        </p>
      </div>
      
      {/* Map container with fixed dimensions */}
      <div style={{ 
        position: 'relative', 
        width: '100%', 
        aspectRatio: '2/1', 
        border: '2px solid #e5e7eb', 
        borderRadius: '0.5rem', 
        overflow: 'hidden',
        backgroundColor: '#f0f9ff', 
        marginBottom: '1rem'
      }}>
        {/* Map image - with multiple fallbacks */}
        <div style={{ 
          position: 'absolute',
          inset: 0,
          backgroundColor: '#e0f2fe', // Light blue background as base fallback
          zIndex: 1
        }}>
          {/* Primary map image - local file */}
          <img 
            src="/world-map-simple.png" 
            alt="World Map" 
            style={{ 
              position: 'absolute', 
              inset: 0, 
              width: '100%', 
              height: '100%', 
              objectFit: 'cover',
              display: 'block'
            }}
            onError={(e) => {
              console.log("Local map image failed to load, trying fallback");
              // If local image fails, try the Wikimedia URL
              (e.target as HTMLImageElement).src = "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/World_map_blank_without_borders.svg/1280px-World_map_blank_without_borders.svg.png";
            }}
          />
          
          {/* Add basic outline of continents as ultimate fallback */}
          <div style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.7), rgba(255,255,255,0.7))',
            backgroundSize: 'cover',
            zIndex: -1
          }}>
            {/* Simple continent outlines using divs */}
            <div style={{ position: 'absolute', left: '15%', top: '30%', width: '20%', height: '25%', backgroundColor: '#d1d5db', borderRadius: '50%', opacity: 0.5 }}></div>
            <div style={{ position: 'absolute', left: '45%', top: '25%', width: '25%', height: '25%', backgroundColor: '#d1d5db', borderRadius: '30%', opacity: 0.5 }}></div>
            <div style={{ position: 'absolute', left: '75%', top: '30%', width: '15%', height: '25%', backgroundColor: '#d1d5db', borderRadius: '30%', opacity: 0.5 }}></div>
            <div style={{ position: 'absolute', left: '20%', top: '60%', width: '10%', height: '15%', backgroundColor: '#d1d5db', borderRadius: '30%', opacity: 0.5 }}></div>
            <div style={{ position: 'absolute', left: '85%', top: '65%', width: '10%', height: '20%', backgroundColor: '#d1d5db', borderRadius: '40%', opacity: 0.5 }}></div>
          </div>
        </div>
        
        {/* Simplified Pin Markers - using fixed positions for key locations */}
        {placesData.map((place, index) => {
          // Base coordinates (longitude, latitude) for key locations
          const geoPositions: Record<string, [number, number]> = {
            // North America
            "Washington": [-77.0369, 38.9072],
            "Washington, D.C.": [-77.0369, 38.9072],
            "Dallas": [-96.7970, 32.7767],
            "New Orleans": [-90.0715, 29.9511],
            "Miami": [-80.1918, 25.7617],
            "Chicago": [-87.6298, 41.8781],
            "New York": [-74.0060, 40.7128],
            "Los Angeles": [-118.2437, 34.0522],
            "U.S.": [-98.5795, 39.8283],
            "United States": [-98.5795, 39.8283],
            
            // Caribbean/Central America
            "Cuba": [-77.7812, 21.5218],
            "Havana": [-82.3666, 23.1136],
            "Matanzas": [-81.5774, 23.0511],
            "Mexico": [-102.5528, 23.6345],
            "Mexico City": [-99.1332, 19.4326],
            "Costa Rica": [-84.0907, 9.9281],
            "Panama": [-80.7821, 8.5375],
            
            // South America
            "Brazil": [-51.9253, -14.2350],
            
            // Europe
            "London": [-0.1276, 51.5074],
            "UK": [-3.4359, 55.3781],
            "Paris": [2.3522, 48.8566],
            "France": [2.2137, 46.2276],
            "Berlin": [13.4050, 52.5200],
            "Madrid": [-3.7038, 40.4168],
            "Rome": [12.4964, 41.9028],
            "Czech": [15.4730, 49.8175],
            "Europe": [10.4515, 51.1657],
            "ODOYNE": [-3.6895, 55.9533],
            
            // Russia/Former USSR
            "Moscow": [37.6173, 55.7558],
            "Soviet": [39.0742, 56.1304],
            "USSR": [39.0742, 56.1304],
            
            // Asia
            "Tokyo": [139.6503, 35.6762],
            "Beijing": [116.4074, 39.9042],
            "Hong Kong": [114.1694, 22.3193],
            "Vietnam": [108.2772, 14.0583]
          };
          
          // Map projection parameters - adjusted for this specific map
          const mapProjection = (lon: number, lat: number) => {
            // Longitude range in the map is from -180 to 180, mapped to 0% to 100%
            // Latitude range is from -90 to 90, mapped to approximately 15% to 65%
            
            // Scale longitude from -180:180 to 0:100, with increased spread
            // Use 80% of the map width (10-90%) instead of full 100% to avoid edge crowding
            const x = ((lon + 180) / 360) * 80 + 10;
            
            // Scale latitude from 90:-90 to 15:75 (north to south) - increased vertical range
            // Inverted because y-axis is top-down in CSS
            const y = ((90 - lat) / 180) * 60 + 15;
            
            return { x, y };
          };
          
          // Default position for unknown places (spread across map rather than clustered)
          let x = 25 + (index * 8) % 70; // More horizontal spread
          let y = 30 + (index * 7) % 40; // More vertical spread
          
          // Try to find a match using full name first
          if (geoPositions[place.place]) {
            const [lon, lat] = geoPositions[place.place];
            const projected = mapProjection(lon, lat);
            x = projected.x;
            y = projected.y;
          } else {
            // Then try to match partial place names
            for (const [key, [lon, lat]] of Object.entries(geoPositions)) {
              if (place.place.toLowerCase().includes(key.toLowerCase()) || 
                  key.toLowerCase().includes(place.place.toLowerCase())) {
                const projected = mapProjection(lon, lat);
                x = projected.x;
                y = projected.y;
                break;
              }
            }
          }
          
          // Apply fine-tuning adjustments for this specific map
          // These are percentage adjustments to make the coordinates match this specific map
          x = x - 3; // Shift everything slightly more left
          if (x > 50) {
            // Eastern hemisphere adjustment
            x = x + 4;
          }
          
          // Additional spread adjustment
          if (y < 45) {
            // Move northern hemisphere locations up a bit more
            y = y - 2;
          } else {
            // Move southern hemisphere locations down a bit more
            y = y + 2;
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
                cursor: 'pointer'
              }}
              onClick={() => handlePlaceClick(place, index)}
            >
              {/* Extra large, obvious pin design */}
              <div style={{
                width: '2rem',
                height: '2rem',
                borderRadius: '9999px',
                backgroundColor: activePlace === index ? '#dc2626' : '#ef4444',
                border: '2px solid white',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
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
                {place.place} ({place.mentions || place.document_count || 0})
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Location list */}
      <div style={{ 
        display: 'flex', 
        flexWrap: 'wrap', 
        gap: '0.5rem', 
        marginTop: '1rem' 
      }}>
        {placesData.map((place, idx) => (
          <div 
            key={`place-tag-${idx}`} 
            style={{ 
              padding: '0.25rem 0.5rem', 
              backgroundColor: activePlace === idx ? '#fef2f2' : '#f9fafb',
              border: '1px solid #e5e7eb',
              color: activePlace === idx ? '#dc2626' : '#374151', 
              borderRadius: '9999px', 
              fontSize: '0.75rem', 
              fontWeight: 'bold', 
              display: 'flex', 
              alignItems: 'center',
              cursor: 'pointer'
            }}
            onClick={() => handlePlaceClick(place, idx)}
          >
            <span style={{ 
              width: '1rem', 
              height: '1rem', 
              borderRadius: '9999px', 
              backgroundColor: activePlace === idx ? '#dc2626' : '#ef4444', 
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
            {place.place}
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
} 