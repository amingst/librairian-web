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
  coordinates: [number, number]; // [longitude, latitude]
  mentions: number;
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
          const response = await fetch(`/api/jfk/connections?type=geo&documentId=${documentId}`);
          
          if (!response.ok) {
            throw new Error(`Failed to fetch geographic data: ${response.statusText}`);
          }
          
          const data = await response.json();
          setPlacesData(data.results.places);
        } 
        // Otherwise, get top places mentioned across documents
        else {
          const response = await fetch(`/api/jfk/connections?type=places`);
          
          if (!response.ok) {
            throw new Error(`Failed to fetch places data: ${response.statusText}`);
          }
          
          const data = await response.json();
          
          // Format the data to match our expected structure
          const formattedData = data.results
            .slice(0, 20) // limit to top 20 places
            .map((place: any) => ({
              place: place.place,
              coordinates: [0, 0], // Coordinates won't be used with fixed positions
              mentions: place.document_count
            }));
          
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
      onMarkerClick(place.place, place.mentions);
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
        {/* Map image */}
        <img 
          src="https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/World_map_blank_without_borders.svg/1280px-World_map_blank_without_borders.svg.png" 
          alt="World Map" 
          style={{ 
            position: 'absolute', 
            inset: 0, 
            width: '100%', 
            height: '100%', 
            objectFit: 'cover' 
          }}
        />
        
        {/* Simplified Pin Markers - using fixed positions for key locations */}
        {placesData.map((place, index) => {
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
            "Matanzas": {x: 25, y: 46},
            "Washington, D.C.": {x: 25, y: 40},
            "France": {x: 48, y: 37},
            "Europe": {x: 50, y: 35},
            "U.S.": {x: 24, y: 38},
            "United States": {x: 24, y: 38},
            "Mexico": {x: 20, y: 45},
            "Madrid": {x: 45, y: 40},
            "Rome": {x: 50, y: 42},
            "Miami, Florida": {x: 26, y: 43}
          };
          
          // Default position for unknown places
          let x = 20 + (index * 6) % 60; // Spread them out horizontally
          let y = 35 + (index * 3) % 20; // And vertically
          
          // Use known position if available
          for (const [key, pos] of Object.entries(positions)) {
            if (place.place.toLowerCase().includes(key.toLowerCase())) {
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
                {place.place} ({place.mentions})
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