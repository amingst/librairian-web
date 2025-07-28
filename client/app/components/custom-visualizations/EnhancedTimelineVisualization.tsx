"use client";

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

type TimelineEvent = {
  date: string;
  label: string;
};

interface EnhancedTimelineVisualizationProps {
  startDate: string | null;
  endDate: string | null;
  events?: TimelineEvent[];
}

const EnhancedTimelineVisualization = ({ 
  startDate, 
  endDate, 
  events = [] 
}: EnhancedTimelineVisualizationProps) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltipContent, setTooltipContent] = useState<{content: string, x: number, y: number} | null>(null);
  
  // Format date for display
  const formatShortDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
    } catch (e) {
      return dateStr;
    }
  };

  useEffect(() => {
    if (!startDate || !svgRef.current) return;
    
    // Clear any existing visualizations
    d3.select(svgRef.current).selectAll("*").remove();
    
    // Determine the dates to visualize
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date(startDate);
    
    // Add one day to the end date to make sure it's included
    end.setDate(end.getDate() + 1);
    
    // Calculate the width and padding
    const width = svgRef.current.clientWidth;
    const height = 100;
    const margin = { top: 40, right: 20, bottom: 30, left: 20 };
    const innerWidth = width - margin.left - margin.right;
    
    // Create scales
    const timeScale = d3.scaleTime()
      .domain([start, end])
      .range([0, innerWidth]);
    
    // Create a group for the timeline
    const svg = d3.select(svgRef.current);
    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);
    
    // Draw the timeline line
    g.append("line")
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", innerWidth)
      .attr("y2", 0)
      .attr("stroke", "#3b82f6")
      .attr("stroke-width", 3);
    
    // Draw the start date point
    g.append("circle")
      .attr("cx", 0)
      .attr("cy", 0)
      .attr("r", 6)
      .attr("fill", "#3b82f6");
    
    // Draw the start date label
    g.append("text")
      .attr("x", 0)
      .attr("y", -15)
      .attr("text-anchor", "start")
      .attr("font-size", "12px")
      .attr("font-weight", "bold")
      .text(formatShortDate(startDate));
    
    // Draw the end date point if different from start
    if (endDate && endDate !== startDate) {
      g.append("circle")
        .attr("cx", innerWidth)
        .attr("cy", 0)
        .attr("r", 6)
        .attr("fill", "#3b82f6");
      
      g.append("text")
        .attr("x", innerWidth)
        .attr("y", -15)
        .attr("text-anchor", "end")
        .attr("font-size", "12px")
        .attr("font-weight", "bold")
        .text(formatShortDate(endDate));
    }
    
    // Draw event points and labels
    events.forEach((event) => {
      const eventDate = new Date(event.date);
      const x = timeScale(eventDate);
      
      // Create event point
      const eventPoint = g.append("circle")
        .attr("cx", x)
        .attr("cy", 0)
        .attr("r", 6)
        .attr("fill", "#ef4444")
        .style("cursor", "pointer");
      
      // Add hover effect and tooltip
      eventPoint
        .on("mouseover", function(e) {
          d3.select(this).attr("r", 8);
          
          // Show tooltip
          const { clientX, clientY } = e;
          setTooltipContent({
            content: `${formatShortDate(event.date)}: ${event.label}`,
            x: clientX,
            y: clientY
          });
        })
        .on("mouseout", function() {
          d3.select(this).attr("r", 6);
          setTooltipContent(null);
        });
    });
    
  }, [startDate, endDate, events]);

  return (
    <div style={{ width: '100%', border: '2px solid #dbeafe', borderRadius: '0.5rem', padding: '1rem', backgroundColor: 'white' }}>
      <h3 style={{ fontWeight: 'bold', fontSize: '1.125rem', marginBottom: '1rem', color: '#1e40af' }}>Timeline</h3>
      
      {!startDate ? (
        <p style={{ textAlign: 'center', color: '#6b7280', fontSize: '0.75rem', fontStyle: 'italic' }}>No date information available</p>
      ) : (
        <>
          <div style={{ position: 'relative' }}>
            <svg 
              ref={svgRef} 
              width="100%" 
              height="100" 
              style={{ overflow: 'visible' }}
            />
            
            {/* Tooltip */}
            {tooltipContent && (
              <div 
                style={{
                  position: 'absolute',
                  backgroundColor: 'black',
                  color: 'white',
                  fontSize: '0.75rem',
                  padding: '0.5rem',
                  borderRadius: '0.25rem',
                  pointerEvents: 'none',
                  zIndex: 50,
                  left: `${tooltipContent.x}px`,
                  top: `${tooltipContent.y - 40}px`,
                  transform: 'translateX(-50%)'
                }}
              >
                {tooltipContent.content}
              </div>
            )}
          </div>
          
          {/* Event list */}
          <div style={{ marginTop: '1.5rem' }}>
            <h4 style={{ fontWeight: '500', fontSize: '0.875rem', marginBottom: '0.5rem', color: '#4b5563' }}>Events:</h4>
            <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '0.5rem' }}>
              {events.map((event, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', backgroundColor: '#fee2e2', padding: '0.25rem 0.5rem', borderRadius: '0.25rem' }}>
                  <span style={{ width: '0.75rem', height: '0.75rem', borderRadius: '9999px', backgroundColor: '#ef4444', marginRight: '0.5rem' }}></span>
                  <span style={{ fontSize: '0.75rem', fontWeight: '500' }}>{formatShortDate(event.date)}:</span>
                  <span style={{ fontSize: '0.75rem', marginLeft: '0.25rem' }}>{event.label}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default EnhancedTimelineVisualization; 