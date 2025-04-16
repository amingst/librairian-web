"use client";

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useTheme } from 'next-themes';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeftIcon, DocumentIcon, ClockIcon, MapPinIcon, UserIcon, CubeIcon, ChartBarIcon, MapIcon, CalendarIcon } from '@heroicons/react/24/outline';
import { MagnifyingGlassIcon } from '@heroicons/react/24/solid';
import ForceGraphVisualization from '../../components/visualizations/ForceGraph';
import TimelineChart from '../../components/visualizations/TimelineChart';
import GeographicMap from '../../components/visualizations/GeographicMap';
import Chronosphere from '../../components/visualizations/Chronosphere';
import { Tab } from '@headlessui/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { Info, HelpCircle, X, Network, Calendar, MapPin, Loader2, User, ArrowLeft, FileText, Clock, Search, Globe, Play, Pause, Settings, ChevronUp, ChevronDown } from 'lucide-react';
import { AddToDocumentDock } from '../../../components/ui/AddToDocumentDock';
import * as d3 from 'd3';

// Interface for document data
interface Document {
  id: string;
  title: string;
  date?: string;
  agency?: string;
}

// Interface for entity profile data
interface EntityProfile {
  name: string;
  bio: string;
  imageUrl: string;
  source: string;
}

// Interface for search results
interface SearchResult {
  documents: Document[];
  total?: number;
}

// Add HistoryReplayerState interface
interface HistoryReplayerState {
  isPlaying: boolean;
  showSettings: boolean;
  interval: number; // milliseconds between updates
  increment: number; // days to advance per update
  incrementUnit: 'day' | 'week' | 'month' | 'year';
  direction: 'forward' | 'backward';
}

// Update Chronosphere props interface
interface ChronosphereProps {
  width?: number;
  height?: number;
  onNodeClick?: (node: any) => void;
  onDateSelect?: (date: string) => void;
  searchType?: string;
  searchValue?: string;
  startDate?: string;
  endDate?: string;
  onSearch?: () => void;
  onDateUpdate?: (newStartDate: string, newEndDate: string) => void;
}

// Document dimensions and scaling
const docWidth = 180;
const docHeight = 150;
const shrinkFactor = 0.15; // Even smaller default size
const expandedSize = 1.0; // Normal size when expanded

// Force simulation parameters
const forceStrength = -1000; // Stronger repulsion to spread documents more
const linkDistance = 250; // More space between linked nodes
const linkStrength = 0.3; // Keep connections moderately strong
const collideRadius = docWidth * shrinkFactor * 2; // Ensure documents don't overlap

// Word cloud parameters
const cloudRadius = 120; // Smaller radius for the word cloud
const maxFontSize = 16; // Smaller maximum font size
const minFontSize = 8; // Smaller minimum font size

export default function VisualizationsPage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  // Add state for search and filters
  const [searchType, setSearchType] = useState('all');
  const [searchValue, setSearchValue] = useState('');
  const [startDate, setStartDate] = useState('1963-11-01');
  const [endDate, setEndDate] = useState('1963-11-30');
  const [isSearching, setIsSearching] = useState(false);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  // Add state for window dimensions
  const [dimensions, setDimensions] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth - 40 : 960,
    height: typeof window !== 'undefined' ? window.innerHeight - 100 : 600, // Maximize height as much as possible
  });
  
  // Add history replayer state
  const [replayerState, setReplayerState] = useState<HistoryReplayerState>({
    isPlaying: false,
    showSettings: false,
    interval: 1000, // 1 second default
    increment: 1,
    incrementUnit: 'day',
    direction: 'forward'
  });
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Track window resize
  useEffect(() => {
    function handleResize() {
      setDimensions({
        width: window.innerWidth - 40, // Account for padding
        height: window.innerHeight - 100, // Maximize height as much as possible
      });
    }
    
    // Call once on initial load
    handleResize();
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle search
  const handleSearch = () => {
    setIsSearching(true);
    // Search will be handled by Chronosphere component internally
    // We just need to re-render it with the new parameters
    setVisualizationKey(prev => prev + 1);
  };

  // State to force re-render for Chronosphere when search is performed
  const [visualizationKey, setVisualizationKey] = useState(0);

  // Function to handle search button click
  const handleSearchClick = () => {
    setIsSearching(true);
    setVisualizationKey(prev => prev + 1);
  };

  // Handler for applying date range
  const handleDateApply = () => {
    setIsSearching(true);
    setVisualizationKey(prev => prev + 1);
  };

  // Handler for reset button
  const handleReset = () => {
    setSearchValue('');
    setSearchType('all');
    setStartDate('1963-11-01');
    setEndDate('1963-11-30');
    setIsSearching(true);
    setVisualizationKey(prev => prev + 1);
  };

  // Callback for when Chronosphere completes a search
  const handleSearchComplete = useCallback(() => {
    setIsSearching(false);
  }, []);

  // Calculate the time window in days
  const calculateWindowDays = useCallback(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  }, [startDate, endDate]);
  
  // Advance the dates by the configured amount
  const advanceDates = useCallback(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const windowDays = calculateWindowDays();
    
    let daysToAdvance = replayerState.increment;
    
    // Convert increment to days based on unit
    if (replayerState.incrementUnit === 'week') {
      daysToAdvance = replayerState.increment * 7;
    } else if (replayerState.incrementUnit === 'month') {
      daysToAdvance = replayerState.increment * 30;
    } else if (replayerState.incrementUnit === 'year') {
      daysToAdvance = replayerState.increment * 365;
    }
    
    // Apply direction
    if (replayerState.direction === 'backward') {
      daysToAdvance = -daysToAdvance;
    }
    
    // Calculate new dates
    const newStart = new Date(start);
    newStart.setDate(start.getDate() + daysToAdvance);
    
    const newEnd = new Date(end);
    newEnd.setDate(end.getDate() + daysToAdvance);
    
    // Format dates as YYYY-MM-DD
    const formatDate = (date: Date) => {
      return date.toISOString().split('T')[0];
    };
    
    // Update dates in state
    setStartDate(formatDate(newStart));
    setEndDate(formatDate(newEnd));
    
    // Update input fields
    updateDateInputs(formatDate(newStart), formatDate(newEnd));
    
    // Trigger the Apply Dates button click
    setTimeout(() => {
      // Find and click the Apply Dates button directly
      const applyButton = document.querySelector('button.apply-dates-button');
      if (applyButton) {
        (applyButton as HTMLButtonElement).click();
      }
    }, 10);
    
  }, [startDate, endDate, replayerState.increment, replayerState.incrementUnit, replayerState.direction, calculateWindowDays]);
  
  // Function to update date inputs
  const updateDateInputs = useCallback((newStart: string, newEnd: string) => {
    const startDateInput = document.querySelector('input[type="date"]:nth-of-type(1)') as HTMLInputElement;
    const endDateInput = document.querySelector('input[type="date"]:nth-of-type(2)') as HTMLInputElement;
    
    if (startDateInput) {
      startDateInput.value = newStart;
    }
    
    if (endDateInput) {
      endDateInput.value = newEnd;
    }
  }, []);
  
  // Toggle play/pause
  const togglePlay = useCallback(() => {
    setReplayerState(prev => {
      // If we're turning on playing, clear any existing interval first to prevent duplicates
      if (!prev.isPlaying && timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return { ...prev, isPlaying: !prev.isPlaying };
    });
  }, []);
  
  // Toggle settings panel
  const toggleSettings = useCallback(() => {
    setReplayerState(prev => ({ ...prev, showSettings: !prev.showSettings }));
  }, []);
  
  // Update a specific setting
  const updateSetting = useCallback((key: keyof HistoryReplayerState, value: any) => {
    setReplayerState(prev => ({ ...prev, [key]: value }));
    
    // If updating the interval while playing, restart the timer with the new interval
    if (key === 'interval' && replayerState.isPlaying) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      timerRef.current = setInterval(advanceDates, value);
    }
  }, [replayerState.isPlaying, advanceDates]);
  
  // Effect to handle the timer
  useEffect(() => {
    if (replayerState.isPlaying) {
      // Clear any existing interval to prevent duplicates
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      // Run immediately once, then set interval
      advanceDates();
      
      // Set a new interval
      timerRef.current = setInterval(advanceDates, replayerState.interval);
      
      console.log(`Started timer with interval ${replayerState.interval}ms`);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
      console.log('Stopped timer');
    }
    
    // Cleanup
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        console.log('Cleaned up timer');
      }
    };
  }, [replayerState.isPlaying, replayerState.interval, advanceDates]);

  // Function to update active filters when they change in Chronosphere
  const handleActiveFiltersUpdate = useCallback((filters: string[]) => {
    setActiveFilters(filters);
  }, []);

  // Handle date updates from both manual date inputs and the history replayer
  const handleDateUpdate = useCallback((newStartDate: string, newEndDate: string) => {
    // Update our local state
    setStartDate(newStartDate);
    setEndDate(newEndDate);
    
    // Update the UI date inputs to reflect the new dates
    const startDateInput = document.querySelector('input[type="date"][value*="-"]') as HTMLInputElement;
    const endDateInput = document.querySelectorAll('input[type="date"][value*="-"]')[1] as HTMLInputElement;
    
    if (startDateInput) {
      startDateInput.value = newStartDate;
    }
    
    if (endDateInput) {
      endDateInput.value = newEndDate;
    }
    
    // We don't need to trigger a visualizationKey update here
    // because the Chronosphere component will handle the update internally
  }, []);

  return (
    <div style={{
      width: '100%',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      padding: '0.5rem',
      backgroundColor: 'white',
      overflow: 'hidden'
    }}>
      <h1 style={{
        fontFamily: 'Arial, sans-serif',
        fontSize: '2rem',
        fontWeight: 500,
        letterSpacing: '0.2em',
        color: '#111827',
        marginBottom: '0.25rem'
      }}>
        LIBRΛIRIΛN
      </h1>
      
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        marginBottom: '0.25rem',
        padding: '0.25rem',
        borderBottom: '1px solid #e5e7eb'
      }}>
        <Link href="/jfk-files/visualizations" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          color: '#3b82f6',
          textDecoration: 'none',
          fontSize: '0.875rem'
        }}>
          <Globe size={16} />
          Chronosphere
        </Link>
        <Link href="/jfk-files/visualizations/network" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          color: '#6b7280',
          textDecoration: 'none',
          fontSize: '0.875rem'
        }}>
          <Network size={16} />
          Network Connections
        </Link>
        <Link href="/jfk-files/visualizations/timelinechart" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          color: '#6b7280',
          textDecoration: 'none',
          fontSize: '0.875rem'
        }}>
          <Clock size={16} />
          Timeline
        </Link>
        <Link href="/jfk-files/visualizations/geographicmap" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          color: '#6b7280',
          textDecoration: 'none',
          fontSize: '0.875rem'
        }}>
          <MapPin size={16} />
          Geographic Map
        </Link>
      </div>

      {/* Search and filter controls */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        marginBottom: '0.25rem',
        padding: '0.5rem', 
        backgroundColor: '#f9fafb',
        borderRadius: '0.5rem',
        alignItems: 'center'
      }}>
        {/* Entity type selector */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setSearchType('all')}
            style={{
              padding: '0.375rem 0.75rem',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              border: '1px solid #e5e7eb',
              backgroundColor: searchType === 'all' ? '#3b82f6' : '#ffffff',
              color: searchType === 'all' ? '#ffffff' : '#374151',
              cursor: 'pointer'
            }}
            role="tab"
            aria-selected={searchType === 'all'}
          >
            All
          </button>
          <button
            onClick={() => setSearchType('person')}
            style={{
              padding: '0.375rem 0.75rem',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              border: '1px solid #e5e7eb',
              backgroundColor: searchType === 'person' ? '#3b82f6' : '#ffffff',
              color: searchType === 'person' ? '#ffffff' : '#374151',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem'
            }}
            role="tab"
            aria-selected={searchType === 'person'}
          >
            <User size={14} />
            Person
          </button>
          <button
            onClick={() => setSearchType('place')}
            style={{
              padding: '0.375rem 0.75rem',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              border: '1px solid #e5e7eb',
              backgroundColor: searchType === 'place' ? '#3b82f6' : '#ffffff',
              color: searchType === 'place' ? '#ffffff' : '#374151',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem'
            }}
            role="tab"
            aria-selected={searchType === 'place'}
          >
            <MapPin size={14} />
            Place
          </button>
          <button
            onClick={() => setSearchType('text')}
            style={{
              padding: '0.375rem 0.75rem',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              border: '1px solid #e5e7eb',
              backgroundColor: searchType === 'text' ? '#3b82f6' : '#ffffff',
              color: searchType === 'text' ? '#ffffff' : '#374151',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem'
            }}
            role="tab"
            aria-selected={searchType === 'text'}
          >
            <FileText size={14} />
            Text
          </button>
        </div>

        {/* Search input */}
        <div style={{ 
          display: 'flex', 
          flex: 1,
          gap: '0.5rem',
          alignItems: 'center'
        }}>
          <div style={{ 
            flex: 1,
            position: 'relative'
          }}>
            <input
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder={`Search ${searchType}...`}
              className="search-input"
              style={{
                width: '100%',
                padding: '0.5rem 2.5rem 0.5rem 0.75rem',
                borderRadius: '0.375rem',
                border: '1px solid #e5e7eb',
                fontSize: '0.875rem'
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearchClick();
                }
              }}
            />
            <div
              style={{
                position: 'absolute',
                right: '0.5rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#6b7280'
              }}
            >
              {isSearching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            </div>
          </div>
          <button
            onClick={handleSearchClick}
            disabled={isSearching}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#3b82f6',
              color: 'white',
              borderRadius: '0.375rem',
              border: 'none',
              fontSize: '0.875rem',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              cursor: isSearching ? 'not-allowed' : 'pointer',
              opacity: isSearching ? 0.7 : 1
            }}
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </div>

        {/* Date range inputs */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <Calendar size={16} className="text-gray-500" />
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{
              padding: '0.375rem 0.5rem',
              borderRadius: '0.375rem',
              border: '1px solid #e5e7eb',
              fontSize: '0.875rem'
            }}
          />
          <span style={{ color: '#6b7280' }}>to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{
              padding: '0.375rem 0.5rem',
              borderRadius: '0.375rem',
              border: '1px solid #e5e7eb',
              fontSize: '0.875rem'
            }}
          />
          <button
            onClick={handleDateApply}
            disabled={isSearching}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#059669',
              color: 'white',
              borderRadius: '0.375rem',
              border: 'none',
              fontSize: '0.875rem',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              cursor: isSearching ? 'not-allowed' : 'pointer',
              opacity: isSearching ? 0.7 : 1
            }}
            className="apply-dates-button"
          >
            {isSearching ? 'Applying...' : 'Apply Dates'}
          </button>
          <button
            onClick={handleReset}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#f3f4f6',
              color: '#374151',
              borderRadius: '0.375rem',
              border: '1px solid #e5e7eb',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            Reset
          </button>
        </div>
      </div>
      
      {/* History Replayer */}
      <div style={{ 
        position: 'absolute', 
        top: '200px', 
        right: '360px', // Increase from 360px to 460px to move it more to the left
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        {/* Main controls */}
        <div style={{ 
          display: 'flex',
          gap: '8px',
          padding: '8px',
          backgroundColor: isDark ? 'rgba(30, 41, 59, 0.9)' : 'rgba(255, 255, 255, 0.9)',
          borderRadius: '6px',
          boxShadow: '0 2px 5px rgba(0, 0, 0, 0.1)'
        }}>
          <button
            onClick={togglePlay}
            style={{ 
              padding: '4px', 
              borderRadius: '4px', 
              cursor: 'pointer',
              backgroundColor: 'transparent',
              border: 'none',
              color: isDark ? '#e5e7eb' : '#1f2937',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title={replayerState.isPlaying ? "Pause" : "Play"}
          >
            {replayerState.isPlaying ? <Pause size={18} /> : <Play size={18} />}
          </button>
          
          <button
            onClick={toggleSettings}
            style={{ 
              padding: '4px', 
              borderRadius: '4px', 
              cursor: 'pointer',
              backgroundColor: 'transparent',
              border: 'none',
              color: isDark ? '#e5e7eb' : '#1f2937',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Settings"
          >
            <Settings size={18} />
          </button>
          
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            fontSize: '12px',
            color: isDark ? '#e5e7eb' : '#1f2937',
            marginLeft: '4px'
          }}>
            {replayerState.increment} {replayerState.incrementUnit}{replayerState.increment !== 1 ? 's' : ''} / {replayerState.interval / 1000}s
          </div>
        </div>
        
        {/* Settings panel */}
        {replayerState.showSettings && (
          <div style={{ 
            padding: '12px',
            backgroundColor: isDark ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            width: '240px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ 
                fontSize: '14px', 
                fontWeight: 'bold', 
                color: isDark ? '#e5e7eb' : '#1f2937' 
              }}>
                History Replay Settings
              </div>
              <button
                onClick={toggleSettings}
                style={{ 
                  padding: '4px', 
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: isDark ? '#e5e7eb' : '#1f2937',
                  cursor: 'pointer',
                  display: 'flex'
                }}
              >
                <X size={16} />
              </button>
            </div>
            
            {/* Increment value */}
            <div>
              <label style={{ 
                fontSize: '12px', 
                color: isDark ? '#d1d5db' : '#4b5563',
                display: 'block',
                marginBottom: '4px'
              }}>
                Increment Value
              </label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  onClick={() => updateSetting('increment', Math.max(1, replayerState.increment - 1))}
                  style={{ 
                    padding: '4px', 
                    backgroundColor: isDark ? '#4b5563' : '#e5e7eb',
                    border: 'none',
                    borderRadius: '4px',
                    color: isDark ? '#e5e7eb' : '#1f2937',
                    cursor: 'pointer',
                    display: 'flex'
                  }}
                >
                  <ChevronDown size={16} />
                </button>
                
                <input
                  type="number"
                  min="1"
                  value={replayerState.increment}
                  onChange={(e) => updateSetting('increment', Math.max(1, parseInt(e.target.value) || 1))}
                  style={{ 
                    width: '60px',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    border: isDark ? '1px solid #4b5563' : '1px solid #d1d5db',
                    backgroundColor: isDark ? '#1f2937' : '#ffffff',
                    color: isDark ? '#e5e7eb' : '#1f2937',
                    fontSize: '14px',
                    textAlign: 'center'
                  }}
                />
                
                <button
                  onClick={() => updateSetting('increment', replayerState.increment + 1)}
                  style={{ 
                    padding: '4px', 
                    backgroundColor: isDark ? '#4b5563' : '#e5e7eb',
                    border: 'none',
                    borderRadius: '4px',
                    color: isDark ? '#e5e7eb' : '#1f2937',
                    cursor: 'pointer',
                    display: 'flex'
                  }}
                >
                  <ChevronUp size={16} />
                </button>
              </div>
            </div>
            
            {/* Increment unit */}
            <div>
              <label style={{ 
                fontSize: '12px', 
                color: isDark ? '#d1d5db' : '#4b5563',
                display: 'block',
                marginBottom: '4px'
              }}>
                Increment Unit
              </label>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(4, 1fr)', 
                gap: '4px' 
              }}>
                {(['day', 'week', 'month', 'year'] as const).map(unit => (
                  <button
                    key={unit}
                    onClick={() => updateSetting('incrementUnit', unit)}
                    style={{ 
                      padding: '4px 0', 
                      backgroundColor: replayerState.incrementUnit === unit 
                        ? (isDark ? '#3b82f6' : '#60a5fa') 
                        : (isDark ? '#374151' : '#f3f4f6'),
                      border: 'none',
                      borderRadius: '4px',
                      color: replayerState.incrementUnit === unit 
                        ? '#ffffff' 
                        : (isDark ? '#e5e7eb' : '#1f2937'),
                      cursor: 'pointer',
                      fontSize: '12px',
                      textTransform: 'capitalize'
                    }}
                  >
                    {unit}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Update interval */}
            <div>
              <label style={{ 
                fontSize: '12px', 
                color: isDark ? '#d1d5db' : '#4b5563',
                display: 'block',
                marginBottom: '4px'
              }}>
                Update Speed (seconds)
              </label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  onClick={() => updateSetting('interval', Math.max(500, replayerState.interval - 500))}
                  style={{ 
                    padding: '4px', 
                    backgroundColor: isDark ? '#4b5563' : '#e5e7eb',
                    border: 'none',
                    borderRadius: '4px',
                    color: isDark ? '#e5e7eb' : '#1f2937',
                    cursor: 'pointer',
                    display: 'flex'
                  }}
                >
                  <ChevronDown size={16} />
                </button>
                
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={replayerState.interval / 1000}
                  onChange={(e) => updateSetting('interval', Math.max(500, parseFloat(e.target.value) * 1000 || 1000))}
                  style={{ 
                    width: '60px',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    border: isDark ? '1px solid #4b5563' : '1px solid #d1d5db',
                    backgroundColor: isDark ? '#1f2937' : '#ffffff',
                    color: isDark ? '#e5e7eb' : '#1f2937',
                    fontSize: '14px',
                    textAlign: 'center'
                  }}
                />
                
                <button
                  onClick={() => updateSetting('interval', replayerState.interval + 500)}
                  style={{ 
                    padding: '4px', 
                    backgroundColor: isDark ? '#4b5563' : '#e5e7eb',
                    border: 'none',
                    borderRadius: '4px',
                    color: isDark ? '#e5e7eb' : '#1f2937',
                    cursor: 'pointer',
                    display: 'flex'
                  }}
                >
                  <ChevronUp size={16} />
                </button>
              </div>
            </div>
            
            {/* Direction */}
            <div>
              <label style={{ 
                fontSize: '12px', 
                color: isDark ? '#d1d5db' : '#4b5563',
                display: 'block',
                marginBottom: '4px'
              }}>
                Direction
              </label>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(2, 1fr)', 
                gap: '8px' 
              }}>
                {(['forward', 'backward'] as const).map(dir => (
                  <button
                    key={dir}
                    onClick={() => updateSetting('direction', dir)}
                    style={{ 
                      padding: '6px 0', 
                      backgroundColor: replayerState.direction === dir 
                        ? (isDark ? '#3b82f6' : '#60a5fa') 
                        : (isDark ? '#374151' : '#f3f4f6'),
                      border: 'none',
                      borderRadius: '4px',
                      color: replayerState.direction === dir 
                        ? '#ffffff' 
                        : (isDark ? '#e5e7eb' : '#1f2937'),
                      cursor: 'pointer',
                      fontSize: '12px',
                      textTransform: 'capitalize'
                    }}
                  >
                    {dir}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Visualization container */}
      <div style={{ 
        flex: 1,
        position: 'relative',
        width: '100%', 
        height: 'calc(100vh - 130px)', // Fixed calculation for height
        backgroundColor: '#ffffff', 
        borderRadius: '0.5rem', 
        border: '1px solid #e5e7eb', 
        overflow: 'hidden'
      }}>
        {isSearching && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.7)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 10
          }}>
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              gap: '0.5rem' 
            }}>
              <div style={{ 
                width: '2rem', 
                height: '2rem', 
                borderRadius: '50%', 
                borderWidth: '2px',
                borderStyle: 'solid',
                borderColor: '#e5e7eb #e5e7eb #3b82f6 #e5e7eb',
                animation: 'spin 1s linear infinite'
              }}></div>
              <span style={{ 
                color: '#374151', 
                fontSize: '0.875rem' 
              }}>Searching...</span>
            </div>
          </div>
        )}
        <Chronosphere 
          key={visualizationKey}
          width={window.innerWidth - 40}
          height={window.innerHeight - 130} // Match the container height
          searchType={searchType}
          searchValue={searchValue}
          startDate={startDate}
          endDate={endDate}
          onSearch={handleSearchComplete}
          onDateUpdate={handleDateUpdate}
        />
      </div>
    </div>
  );
} 