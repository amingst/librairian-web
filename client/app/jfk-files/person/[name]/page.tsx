"use client";

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import Link from 'next/link';
import { ArrowLeftIcon, DocumentIcon, ClockIcon, MapIcon, CalendarIcon, UserIcon } from '@heroicons/react/24/outline';
import { Loader2, Network, User, ArrowLeft, FileText, Clock, Search, X, MapPin } from 'lucide-react';
import { AddToDocumentDock } from '../../../../components/ui/AddToDocumentDock';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.oip.onl';

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
  wikipediaBio?: string; // Add field for Wikipedia bio
}

// Interface for search results
interface SearchResult {
  documents: Document[];
  total?: number;
}

// Function to escape HTML
function escapeHTML(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Function to render basic Markdown to HTML
function renderMarkdown(markdown: string) {
  if (!markdown) return '';
  
  // Escape HTML first to prevent injection
  let html = escapeHTML(markdown);
  
  // Convert code blocks - preserve whitespace and handle language
  html = html.replace(/```([\w-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    return `<pre class="bg-gray-100 dark:bg-gray-800 p-3 rounded-md my-3 overflow-x-auto"><code class="language-${lang || 'text'}">${code.trim()}</code></pre>`;
  });
  
  // Convert inline code
  html = html.replace(/`([^`]+)`/g, '<code class="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm">$1</code>');
  
  // Handle horizontal rules
  html = html.replace(/^\s*---+\s*$/gm, '<hr class="my-4 border-t border-gray-200 dark:border-gray-700" />');
  
  // Handle blockquotes
  html = html.replace(/^\s*>\s+(.*$)/gim, '<blockquote class="pl-4 italic border-l-4 border-gray-300 dark:border-gray-600 my-3 py-1">$1</blockquote>');
  
  // Handle headings (h1, h2, h3)
  html = html.replace(/^### (.*$)/gim, '<h3 class="text-lg font-medium mt-4 mb-2">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 class="text-xl font-medium mt-5 mb-2">$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-6 mb-3">$1</h1>');
  
  // Handle bold and italic
  html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');
  html = html.replace(/__(.*?)__/gim, '<strong>$1</strong>');
  html = html.replace(/_(.*?)_/gim, '<em>$1</em>');
  
  // Handle links - make sure they open in a new tab
  html = html.replace(/\[([^\[]+)\]\(([^\)]+)\)/gim, (match, text, url) => {
    // Check if the URL is relative or absolute
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return `<a href="${url}" class="text-blue-500 hover:underline" target="_blank" rel="noopener noreferrer">${text}</a>`;
    } else {
      return `<a href="${url}" class="text-blue-500 hover:underline">${text}</a>`;
    }
  });
  
  // Wrap lists properly
  let inList = false;
  let isOrderedList = false;
  const lines = html.split('\n');
  for (let i = 0; i < lines.length; i++) {
    // Check for list items
    const isUnorderedItem = lines[i].match(/^\s*[-*]\s+/);
    const isOrderedItem = lines[i].match(/^\s*\d+\.\s+/);
    
    if (isUnorderedItem || isOrderedItem) {
      // Determine if this is an ordered or unordered list
      const currentIsOrdered = !!isOrderedItem;
      
      // If not in a list yet, or switching list types, start a new list
      if (!inList || isOrderedList !== currentIsOrdered) {
        const listType = currentIsOrdered ? 'ol' : 'ul';
        const listClass = currentIsOrdered ? 'list-decimal' : 'list-disc';
        
        // Close previous list if we're switching list types
        if (inList) {
          lines[i-1] += isOrderedList ? '</ol>' : '</ul>';
        }
        
        // Start new list
        lines[i] = `<${listType} class="${listClass} ml-5 my-3">`;
        
        // Add the list item
        if (currentIsOrdered) {
          lines[i] += lines[i].replace(/^\s*\d+\.\s+(.*$)/, '<li>$1</li>');
        } else {
          lines[i] += lines[i].replace(/^\s*[-*]\s+(.*$)/, '<li>$1</li>');
        }
        
        inList = true;
        isOrderedList = currentIsOrdered;
      } else {
        // Continue the current list
        if (isOrderedList) {
          lines[i] = lines[i].replace(/^\s*\d+\.\s+(.*$)/, '<li>$1</li>');
        } else {
          lines[i] = lines[i].replace(/^\s*[-*]\s+(.*$)/, '<li>$1</li>');
        }
      }
    } else {
      // If we were in a list but this line is not a list item, close the list
      if (inList) {
        lines[i-1] += isOrderedList ? '</ol>' : '</ul>';
        inList = false;
      }
    }
  }
  
  // Close any open list at the end
  if (inList) {
    lines[lines.length-1] += isOrderedList ? '</ol>' : '</ul>';
  }
  html = lines.join('\n');
  
  // Handle paragraphs (skip for elements that are already formatted)
  html = html.replace(/^(?!<h|<ul|<ol|<li|<blockquote|<hr|<pre)(.*$)/gim, '<p class="mb-2">$1</p>');
  
  // Replace double line breaks with paragraph breaks
  html = html.replace(/\n\s*\n/g, '</p><p class="mb-2">');
  
  // Handle single line breaks
  html = html.replace(/\n/g, '<br />');
  
  return html;
}

export default function PersonProfilePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const personName = params.name as string;
  const decodedName = decodeURIComponent(personName);
  
  // Theme hooks
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // State variables for data and loading states
  const [entityProfile, setEntityProfile] = useState<EntityProfile | null>(null);
  const [relatedDocuments, setRelatedDocuments] = useState<Document[]>([]);
  const [isLoadingProfile, setIsLoadingProfile] = useState<boolean>(true);

  // Search related state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<Document[]>([]);
  const [showingSearchResults, setShowingSearchResults] = useState<boolean>(false);
    
  // State for entity profile visualizations
  const [timelineEvents, setTimelineEvents] = useState<{date: string, label: string}[]>([]);
  const [profilePlaces, setProfilePlaces] = useState<string[]>([]);
  const [relatedNames, setRelatedNames] = useState<string[]>([]);
  
  // State for selected date in timeline
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // State for profile image and map loading
  const [isProfileImageLoaded, setIsProfileImageLoaded] = useState<boolean>(false);
  const [profileImageError, setProfileImageError] = useState<boolean>(false);

  // Biography tab state
  const [activeTab, setActiveTab] = useState<'ai' | 'wikipedia' | 'grok'>('ai');
  const [isLoadingGrok, setIsLoadingGrok] = useState<boolean>(false);
  const [grokResponse, setGrokResponse] = useState<string>('');
  const [grokError, setGrokError] = useState<string | null>(null);

  // Add these state variables to the component
  const [webSearchImageUrl, setWebSearchImageUrl] = useState<string | null>(null);
  const [hasAttemptedImageSearch, setHasAttemptedImageSearch] = useState<boolean>(false);
  const [isSearchingForImage, setIsSearchingForImage] = useState<boolean>(false);

  // Handle search input change
  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  // Handle search form submission
  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!searchQuery.trim()) {
      // If search is cleared, revert to showing related documents
      setShowingSearchResults(false);
      return;
    }
    
    setIsSearching(true);
    try {
      // First, try fetching from internal /api/jfk/profile endpoint
      const profileResponse = await fetch(`/api/jfk/profile/${decodedName}`);
      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        setEntityProfile(profileData);
      } else {
        // If internal API fails, try external search API
        const searchUrl = `${API_BASE_URL}/api/jfk/search?text=${encodeURIComponent(searchQuery)}&person=${encodeURIComponent(decodedName)}&limit=50`;
        const searchResponse = await fetch(searchUrl);
        if (searchResponse.ok) {
          const data: SearchResult = await searchResponse.json();
          if (data && data.documents) {
            setSearchResults(data.documents);
            setShowingSearchResults(true);
          }
        }
      }

      // Fetch related documents using external search API
      const docsResponse = await fetch(`${API_BASE_URL}/api/jfk/search?person=${encodeURIComponent(decodedName)}&limit=50`);
      if (!docsResponse.ok) throw new Error('Failed to fetch related documents');
      const docsData = await docsResponse.json();
      
      if (docsData && docsData.documents) {
        setRelatedDocuments(docsData.documents);
        
        // Extract places, dates, and names from all documents for visualizations
        const allPlaces: string[] = [];
        const allDates: string[] = [];
        const allNames: string[] = [];
        
        // Process each document to collect metadata
        docsData.documents.forEach((doc: any) => {
          // Process places
          if (doc.places && Array.isArray(doc.places)) {
            doc.places.forEach((place: string) => {
              if (!allPlaces.includes(place)) {
                allPlaces.push(place);
              }
            });
          }
          
          // Process dates
          if (doc.dates && Array.isArray(doc.dates)) {
            doc.dates.forEach((date: string) => {
              if (!allDates.includes(date)) {
                allDates.push(date);
              }
            });
          }
          
          // Process names
          if (doc.names && Array.isArray(doc.names)) {
            doc.names.forEach((name: string) => {
              // Don't include the profile person in related names
              if (name !== decodedName && !allNames.includes(name)) {
                allNames.push(name);
              }
            });
          }
        });
        
        // Sort dates chronologically
        const sortedDates = [...allDates].sort((a, b) => {
          return new Date(a).getTime() - new Date(b).getTime();
        });
        
        // Create timeline events
        const timelineEvents = sortedDates.map(date => ({
          date,
          label: `Documents from ${new Date(date).toLocaleDateString()}`
        }));
        
        // Set state for visualizations
        setTimelineEvents(timelineEvents);
        setProfilePlaces(allPlaces);
        setRelatedNames(allNames);
      }
    } catch (error) {
      console.error('Error fetching entity profile:', error);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  // Fetch Grok data
  const fetchGrokData = async () => {
    if (grokResponse) return; // Don't fetch if we already have data
    
    setIsLoadingGrok(true);
    setGrokError(null);
    
    try {
      const response = await fetch('/api/grok', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `Please tell me about ${decodedName}. If there are multiple people under this name, choose the one who would most likely be relevant to the JFK assassination files.`
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch from Grok: ${response.status}`);
      }
      
      const data = await response.json();
      setGrokResponse(data.response || 'No information available from Grok.');
    } catch (error) {
      console.error('Error fetching from Grok:', error);
      setGrokError('Failed to fetch information from Grok. Please try again later.');
    } finally {
      setIsLoadingGrok(false);
    }
  };
  
  // Handle tab change
  const handleTabChange = (tab: 'ai' | 'wikipedia' | 'grok') => {
    setActiveTab(tab);
    if (tab === 'grok') {
      fetchGrokData();
    }
  };

  // Handle timeline date click
  const handleDateClick = (date: string) => {
    if (selectedDate === date) {
      // If clicking the same date, clear the selection
      setSelectedDate(null);
    } else {
      // Otherwise, set the new selected date
      setSelectedDate(date);
    }
  };
  
  // Check if a document matches the selected date
  const isDocumentHighlighted = (doc: Document): boolean => {
    if (!selectedDate || !doc.date) return false;
    
    // Compare the date strings - could be improved with proper date parsing if needed
    return doc.date.includes(selectedDate) || 
           (new Date(doc.date).toLocaleDateString() === new Date(selectedDate).toLocaleDateString());
  };

  // Determine which documents to display: search results or related documents
  const documentsToDisplay = showingSearchResults ? searchResults : relatedDocuments;

  // Function to search for images using our API
  const searchForImage = async () => {
    if (hasAttemptedImageSearch || !entityProfile) return;
    
    setIsSearchingForImage(true);
    setHasAttemptedImageSearch(true);
    
    try {
      const response = await fetch(`/api/image-search?query=${encodeURIComponent(entityProfile.name)}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.imageUrl) {
          setWebSearchImageUrl(data.imageUrl);
          // Reset profile image error state to display the new image
          setProfileImageError(false);
          setIsProfileImageLoaded(true);
        }
      }
    } catch (error) {
      console.error('Error searching for image:', error);
    } finally {
      setIsSearchingForImage(false);
    }
  };

  // Auto-trigger image search when profile loads without an image
  useEffect(() => {
    if (entityProfile && (profileImageError || !entityProfile.imageUrl) && !hasAttemptedImageSearch) {
      searchForImage();
    }
  }, [entityProfile, profileImageError, hasAttemptedImageSearch]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Page Header */}
      <div className="bg-gray-800 text-white p-4 shadow-md" style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link href="/jfk-files" className="flex items-center text-sm hover:text-blue-300">
              <ArrowLeft className="h-3 w-3 mr-1" style={{width: '10px', height: '10px'}} />
              <span>Back to Files</span>
            </Link>
            <h1 className="text-xl font-bold truncate max-w-md">{decodedName}</h1>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-xs text-gray-300 bg-gray-700 px-2 py-1 rounded">Person Profile</span>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700" style={{ flexShrink: 0 }}>
        <div style={{ padding: '0.75rem 1rem' }}>
          <form onSubmit={handleSearchSubmit} className="flex items-center">
            <div style={{ position: 'relative', flexGrow: 1 }}>
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchInputChange}
                placeholder={`Search documents related to ${decodedName}...`}
                className="w-full pl-12 pr-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400"
                style={{ width: '100%' }}
              />
              <div style={{ position: 'absolute', top: '50%', left: '0.75rem', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                <Search className="h-4 w-4 text-gray-500" />
              </div>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setShowingSearchResults(false);
                  }}
                  style={{ position: 'absolute', top: '50%', right: '0.75rem', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <button
              type="submit"
              className="ml-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md"
              disabled={isSearching}
            >
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Search"
              )}
            </button>
          </form>
        </div>
      </div>

      {isLoadingProfile ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '64px' }}>
          <Loader2 className="h-4 w-4 animate-spin text-blue-500" style={{width: '16px', height: '16px'}} />
        </div>
      ) : (
        <div style={{ flexGrow: 1, overflow: 'auto', padding: '1rem' }}>
          {/* Main Dashboard Container */}
          <div style={{ maxWidth: '1400px', margin: '0 auto', height: 'calc(100% - 1rem)' }}>
            {/* Dashboard Grid - Same structure as document page */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '1rem', width: '100%', height: '100%' }}>
              
              {/* Left Sidebar: Biography */}
              <div style={{ gridColumn: 'span 3 / span 3', display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
                {/* Bio Card */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden border border-gray-200 dark:border-gray-700" 
                    style={{ width: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div style={{ padding: '1rem', borderBottom: '1px solid rgba(229, 231, 235, 0.5)', flexShrink: 0 }}>
                    <h2 className="text-lg flex items-center font-medium">
                      <UserIcon className="h-3 w-3 mr-2 text-red-500" style={{width: '10px', height: '10px'}} />
                      Biography
                    </h2>
                  </div>
                  <div style={{ padding: '1rem', flexGrow: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    {entityProfile ? (
                      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                        <div style={{ marginBottom: '1rem', flexShrink: 0 }}>
                          <div className="bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden" 
                              style={{ width: '100%', maxHeight: '180px', position: 'relative' }}>
                            {!isProfileImageLoaded && !profileImageError && (
                              <div style={{ 
                                display: 'flex', 
                                justifyContent: 'center', 
                                alignItems: 'center', 
                                height: '180px',
                                backgroundColor: 'rgba(229, 231, 235, 0.5)'
                              }}>
                                <Loader2 className="h-5 w-5 animate-spin text-gray-400" style={{width: '20px', height: '20px'}} />
                              </div>
                            )}
                            {profileImageError ? (
                              <div style={{ 
                                display: 'flex', 
                                flexDirection: 'column',
                                justifyContent: 'center', 
                                alignItems: 'center', 
                                height: '180px',
                                backgroundColor: 'rgba(229, 231, 235, 0.5)'
                              }}>
                                {isSearchingForImage ? (
                                  <>
                                    <Loader2 className="h-8 w-8 text-gray-400 animate-spin mb-2" style={{width: '32px', height: '32px'}} />
                                    <span className="text-xs text-gray-500">Searching for image...</span>
                                  </>
                                ) : webSearchImageUrl ? (
                                  <img 
                                    src={webSearchImageUrl} 
                                    alt={entityProfile.name || "Profile"}
                                    style={{ 
                                      width: '100%', 
                                      height: '100%', 
                                      objectFit: 'contain', 
                                      maxHeight: '180px'
                                    }}
                                    onError={() => {
                                      setWebSearchImageUrl(null);
                                    }}
                                  />
                                ) : (
                                  <>
                                    <UserIcon className="h-8 w-8 text-gray-400 mb-2" style={{width: '32px', height: '32px'}} />
                                    <span className="text-xs text-gray-500">No image available</span>
                                    {!hasAttemptedImageSearch && (
                                      <button 
                                        onClick={searchForImage}
                                        className="mt-2 text-xs text-blue-500 hover:text-blue-700 font-medium"
                                      >
                                        Search for image
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            ) : (
                              <img 
                                src={entityProfile.imageUrl} 
                                alt={entityProfile.name || "Profile"}
                                style={{ 
                                  width: '100%', 
                                  height: '100%', 
                                  objectFit: 'contain', 
                                  maxHeight: '180px',
                                  display: isProfileImageLoaded ? 'block' : 'none'
                                }}
                                onLoad={() => setIsProfileImageLoaded(true)}
                                onError={() => {
                                  setProfileImageError(true);
                                  setIsProfileImageLoaded(false);
                                  // Automatically search for image when the original one fails
                                  searchForImage();
                                }}
                              />
                            )}
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                            {webSearchImageUrl 
                              ? "Source: Web search" 
                              : `Source: ${entityProfile.source === 'wikipedia' ? 'Wikipedia' : 'AI-generated'}`}
                          </p>
                        </div>
                        
                        {/* Biography Tabs */}
                        <div style={{ padding: '0 1rem', display: 'flex', flexDirection: 'column', flexGrow: 1, overflow: 'hidden' }}>
                          <div style={{ display: 'flex', borderBottom: '1px solid rgba(229, 231, 235, 0.5)', marginBottom: '0.75rem', flexShrink: 0 }}>
                            <button 
                              onClick={() => handleTabChange('ai')}
                              className={`px-3 py-2 text-sm font-medium ${activeTab === 'ai' ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
                            >
                              AI-generated
                            </button>
                            <button 
                              onClick={() => handleTabChange('wikipedia')}
                              className={`px-3 py-2 text-sm font-medium ${activeTab === 'wikipedia' ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
                            >
                              Wikipedia
                            </button>
                            <button 
                              onClick={() => handleTabChange('grok')}
                              className={`px-3 py-2 text-sm font-medium ${activeTab === 'grok' ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
                            >
                              Grok
                            </button>
                          </div>
                          
                          <h3 className="text-base font-semibold mb-2 flex-shrink-0">{entityProfile.name}</h3>
                          
                          <div className="text-sm text-gray-700 dark:text-gray-300 overflow-y-auto" style={{ flexGrow: 1 }}>
                            {activeTab === 'ai' && (
                              <p>{entityProfile.bio}</p>
                            )}
                            
                            {activeTab === 'wikipedia' && (
                              <div>
                                <p>{entityProfile.source === 'wikipedia' ? entityProfile.bio : 'No Wikipedia information available for this person.'}</p>
                              </div>
                            )}
                            
                            {activeTab === 'grok' && (
                              <div className="px-4 py-3">
                                {isLoadingGrok ? (
                                  <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem 0' }}>
                                    <Loader2 className="h-4 w-4 animate-spin text-blue-500" style={{width: '16px', height: '16px'}} />
                                  </div>
                                ) : grokError ? (
                                  <div className="p-4 border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 rounded-md">
                                    <p className="text-red-600 dark:text-red-400">{grokError}</p>
                                  </div>
                                ) : grokResponse ? (
                                  <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg p-5 shadow-sm">
                                    <div className="flex items-center mb-4 pb-3 border-b border-gray-100 dark:border-gray-700">
                                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center mr-3">
                                        <span className="text-white font-semibold">G</span>
                                      </div>
                                      <div>
                                        <h3 className="font-medium">Grok Response</h3>
                                        <p className="text-xs text-gray-500">AI-generated content about {entityProfile?.name}</p>
                                      </div>
                                    </div>
                                    <div 
                                      className="markdown-content prose dark:prose-invert max-w-none text-gray-800 dark:text-gray-200"
                                      dangerouslySetInnerHTML={{ __html: renderMarkdown(grokResponse) }} 
                                    />
                                  </div>
                                ) : (
                                  <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                                    <p>No information from Grok available yet.</p>
                                    <p className="text-sm mt-2">Click the button below to ask Grok about this person.</p>
                                    <button 
                                      onClick={() => fetchGrokData()} 
                                      className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md"
                                    >
                                      Ask Grok about {entityProfile?.name}
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem 0' }}>
                        <UserIcon className="h-8 w-8 text-gray-300" style={{width: '32px', height: '32px'}} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Main Content Area - 9/12 columns */}
              <div style={{ gridColumn: 'span 9 / span 9', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                
                {/* Top Section: Documents */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700" 
                    style={{ width: '100%' }}>
                  <div style={{ padding: '1rem', borderBottom: '1px solid rgba(229, 231, 235, 0.5)' }}>
                    <h2 className="text-lg flex items-center font-medium">
                      <DocumentIcon className="h-3 w-3 mr-2 text-blue-500" style={{width: '10px', height: '10px'}} />
                      {showingSearchResults ? "Search Results" : "Document Mentions"}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {showingSearchResults 
                        ? `Results for "${searchQuery}" related to ${decodedName}` 
                        : `Documents that mention ${decodedName}`}
                    </p>
                  </div>
                  <div style={{ padding: '1rem' }}>
                    {isSearching ? (
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '120px' }}>
                        <Loader2 className="h-4 w-4 animate-spin text-blue-500" style={{width: '16px', height: '16px'}} />
                      </div>
                    ) : documentsToDisplay.length > 0 ? (
                      <div style={{ maxHeight: '450px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                          {documentsToDisplay.map((doc) => (
                            <div 
                              key={doc.id} 
                              className={`hover:bg-gray-50 dark:hover:bg-gray-700 rounded border ${
                                isDocumentHighlighted(doc) 
                                  ? 'border-red-400 dark:border-red-500 bg-red-50 dark:bg-red-900/30' 
                                  : 'border-gray-200 dark:border-gray-700'
                              }`}
                              style={{ 
                                padding: '0.75rem', 
                                transition: 'all 0.3s ease', 
                                height: '100%',
                                boxShadow: isDocumentHighlighted(doc) 
                                  ? '0 0 0 3px rgba(239, 68, 68, 0.2), 0 4px 6px -1px rgba(0, 0, 0, 0.1)' 
                                  : 'none',
                                transform: isDocumentHighlighted(doc) ? 'translateY(-2px)' : 'translateY(0)'
                              }}
                            >
                              <div className="flex flex-col h-full">
                                <Link href={`/jfk-files/${doc.id}`} className="flex-grow">
                                  <p className={`font-medium text-sm line-clamp-2 mb-1 ${
                                    isDocumentHighlighted(doc) 
                                      ? 'text-red-600 dark:text-red-400' 
                                      : 'text-blue-600 dark:text-blue-400'
                                  }`}>
                                    {doc.title || `Document ${doc.id}`}
                                  </p>
                                  <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    {doc.date && (
                                      <span style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        marginRight: '0.75rem',
                                        padding: isDocumentHighlighted(doc) ? '0px 6px' : '0',
                                        backgroundColor: isDocumentHighlighted(doc) ? 'rgba(254, 226, 226, 0.7)' : 'transparent',
                                        borderRadius: '9999px',
                                        color: isDocumentHighlighted(doc) ? 'rgba(185, 28, 28, 1)' : 'inherit',
                                        fontWeight: isDocumentHighlighted(doc) ? '500' : 'normal'
                                      }}>
                                        <ClockIcon className="h-2 w-2 mr-1" style={{
                                          width: '8px', 
                                          height: '8px',
                                          color: isDocumentHighlighted(doc) ? 'rgba(220, 38, 38, 1)' : 'currentColor'
                                        }} />
                                        {doc.date}
                                      </span>
                                    )}
                                    {doc.agency && (
                                      <span className="truncate">{doc.agency}</span>
                                    )}
                                  </div>
                                </Link>
                                <div className="flex justify-end mt-2">
                                  <AddToDocumentDock 
                                    item={{
                                      id: doc.id,
                                      title: doc.title || `Document ${doc.id}`,
                                      url: `/jfk-files/${doc.id}`,
                                      type: 'document'
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-gray-600 dark:text-gray-400 text-sm text-center py-8">
                        {showingSearchResults
                          ? `No results found for "${searchQuery}" related to ${decodedName}.`
                          : `No documents found mentioning ${decodedName}.`}
                      </p>
                    )}
                  </div>
                </div>
                
                {/* Bottom Row with Visualizations */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', width: '100%' }}>
                  {/* Network Panel */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700" 
                      style={{ width: '100%' }}>
                    <div style={{ padding: '1rem', borderBottom: '1px solid rgba(229, 231, 235, 0.5)' }}>
                      <h2 className="text-lg flex items-center font-medium">
                        <Network className="h-3 w-3 mr-2 text-purple-500" style={{width: '10px', height: '10px'}} />
                        Network Connections
                      </h2>
                    </div>
                    <div style={{ padding: 0 }}>
                      {relatedNames.length > 0 ? (
                        <div className="bg-gray-50 dark:bg-gray-700 rounded" style={{ padding: '0.75rem', height: '256px', overflow: 'auto' }}>
                          <h4 className="text-sm font-medium mb-2">People connected to {decodedName}</h4>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                            {relatedNames.slice(0, 16).map((name, idx) => (
                              <Link key={`person-${idx}`} href={`/jfk-files/person/${encodeURIComponent(name)}`} className="text-xs hover:underline hover:text-blue-600">
                                <div style={{ display: 'flex', alignItems: 'center', padding: '0.5rem', backgroundColor: isDark ? 'rgba(31, 41, 55, 1)' : 'white', borderRadius: '0.25rem', border: '1px solid rgba(229, 231, 235, 0.5)' }}>
                                  <User className="h-3 w-3 mr-2 text-blue-500" style={{width: '12px', height: '12px'}} />
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                                </div>
                              </Link>
                            ))}
                          </div>
                          {relatedNames.length > 16 && (
                            <p className="text-xs text-gray-500 mt-2">
                              + {relatedNames.length - 16} more people
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="bg-gray-50 dark:bg-gray-700 rounded" style={{ padding: '0.75rem', height: '256px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <div className="text-sm text-gray-500 dark:text-gray-400 text-center">
                            <Network className="h-4 w-4 mx-auto mb-2 opacity-50" style={{width: '16px', height: '16px'}} />
                            <p>No connection data available</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Timeline Panel */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700" 
                      style={{ width: '100%' }}>
                    <div style={{ padding: '1rem', borderBottom: '1px solid rgba(229, 231, 235, 0.5)' }}>
                      <h2 className="text-lg flex items-center font-medium">
                        <CalendarIcon className="h-3 w-3 mr-2 text-green-500" style={{width: '10px', height: '10px'}} />
                        Timeline
                      </h2>
                    </div>
                    <div style={{ padding: 0 }}>
                      {timelineEvents.length > 0 ? (
                        <div className="bg-gray-50 dark:bg-gray-700 rounded" style={{ padding: '0.75rem', height: '256px' }}>
                          <div style={{ position: 'relative', height: '100%' }}>
                            {/* Timeline title with clear button */}
                            <div style={{ 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center', 
                              marginBottom: '8px' 
                            }}>
                              <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                                {selectedDate 
                                  ? `Showing documents from ${new Date(selectedDate).toLocaleDateString()}` 
                                  : 'Click a date to filter documents'}
                              </span>
                              {selectedDate && (
                                <button 
                                  className="text-xs text-blue-500 hover:text-blue-700 font-medium"
                                  onClick={() => setSelectedDate(null)}
                                >
                                  Clear Filter
                                </button>
                              )}
                            </div>
                            
                            {/* Timeline track line */}
                            <div style={{ 
                              position: 'absolute', 
                              left: 0, 
                              right: 0, 
                              height: '4px', 
                              backgroundColor: 'rgba(209, 213, 219, 1)', 
                              top: '60px',
                              zIndex: 1
                            }}></div>
                            
                            {/* Scrollable timeline container with visible scrollbar */}
                            <div className="timeline-container" style={{ 
                              position: 'relative',
                              height: 'calc(100% - 32px)',
                              marginTop: '16px',
                              overflowX: 'auto',
                              overflowY: 'hidden',
                              borderRadius: '6px',
                              border: '1px solid rgba(229, 231, 235, 0.5)',
                              background: isDark ? 'rgba(17, 24, 39, 0.3)' : 'rgba(249, 250, 251, 0.8)'
                            }}>
                              <div style={{ 
                                display: 'flex', 
                                alignItems: 'flex-start', 
                                paddingTop: '32px', 
                                paddingBottom: '16px', 
                                paddingLeft: '32px', 
                                paddingRight: '32px', 
                                minWidth: 'max-content',
                                width: timelineEvents.length * 80 + 'px'
                              }}>
                                {timelineEvents.map((event, idx) => (
                                  <div 
                                    key={idx} 
                                    style={{ 
                                      textAlign: 'center', 
                                      flexShrink: 0,
                                      flexGrow: 0,
                                      width: '64px',
                                      marginLeft: idx === 0 ? '0' : '16px',
                                      cursor: 'pointer',
                                      opacity: selectedDate && selectedDate !== event.date ? 0.5 : 1,
                                      transition: 'all 0.3s ease',
                                      position: 'relative',
                                      zIndex: 5
                                    }}
                                    onClick={() => handleDateClick(event.date)}
                                  >
                                    <div style={{ 
                                      width: '16px', 
                                      height: '16px', 
                                      borderRadius: '50%', 
                                      backgroundColor: selectedDate === event.date 
                                        ? 'rgba(220, 38, 38, 1)' 
                                        : 'rgba(37, 99, 235, 1)', 
                                      margin: '0 auto 6px',
                                      boxShadow: selectedDate === event.date 
                                        ? '0 0 0 4px rgba(220, 38, 38, 0.3), 0 0 0 8px rgba(220, 38, 38, 0.1)' 
                                        : 'none',
                                      transform: selectedDate === event.date ? 'scale(1.3)' : 'scale(1)',
                                      transition: 'all 0.3s ease'
                                    }}></div>
                                    <div style={{ 
                                      fontSize: '11px', 
                                      backgroundColor: selectedDate === event.date 
                                        ? 'rgba(254, 226, 226, 1)' 
                                        : 'rgba(219, 234, 254, 1)', 
                                      padding: '3px 8px', 
                                      borderRadius: '0.25rem', 
                                      fontWeight: 500, 
                                      color: selectedDate === event.date 
                                        ? 'rgba(153, 27, 27, 1)' 
                                        : 'rgba(30, 58, 138, 1)', 
                                      whiteSpace: 'nowrap',
                                      border: selectedDate === event.date 
                                        ? '1px solid rgba(248, 113, 113, 1)' 
                                        : '1px solid rgba(147, 197, 253, 1)',
                                      transform: selectedDate === event.date ? 'scale(1.05)' : 'scale(1)'
                                    }}>
                                      {new Date(event.date).toLocaleDateString()}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-gray-50 dark:bg-gray-700 rounded" style={{ padding: '0.75rem', height: '256px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <div className="text-sm text-gray-500 dark:text-gray-400 text-center">
                            <CalendarIcon className="h-4 w-4 mx-auto mb-2 opacity-50" style={{width: '16px', height: '16px'}} />
                            <p>No timeline data available</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Full-width Geographic Panel */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700" 
                    style={{ width: '100%' }}>
                  <div style={{ padding: '1rem', borderBottom: '1px solid rgba(229, 231, 235, 0.5)' }}>
                    <h2 className="text-lg flex items-center font-medium">
                      <MapIcon className="h-3 w-3 mr-2 text-amber-500" style={{width: '10px', height: '10px'}} />
                      Geographic References
                    </h2>
                  </div>
                  <div style={{ padding: 0 }}>
                    {profilePlaces.length > 0 ? (
                      <div className="bg-gray-50 dark:bg-gray-700 rounded" style={{ padding: '0.75rem' }}>
                        {/* Map visualization */}
                        <div style={{ position: 'relative', width: '100%', paddingBottom: '50%', border: '1px solid rgba(229, 231, 235, 0.5)', overflow: 'hidden', borderRadius: '0.5rem', marginBottom: '12px', backgroundColor: isDark ? '#1f2937' : '#f9fafb' }}>
                          {/* Simple Map Background - Solid color with grid lines instead of image */}
                          <div style={{ 
                            position: 'absolute', 
                            inset: 0, 
                            backgroundSize: '20px 20px',
                            backgroundImage: `linear-gradient(to right, ${isDark ? 'rgba(75, 85, 99, 0.1)' : 'rgba(209, 213, 219, 0.3)'} 1px, transparent 1px), 
                                            linear-gradient(to bottom, ${isDark ? 'rgba(75, 85, 99, 0.1)' : 'rgba(209, 213, 219, 0.3)'} 1px, transparent 1px)`,
                            boxShadow: 'inset 0 0 0 1px rgba(0, 0, 0, 0.05)'
                          }}>
                            {/* Continental outlines (simple approximation) */}
                            <svg viewBox="0 0 100 50" style={{ width: '100%', height: '100%', position: 'absolute', opacity: '0.15' }}>
                              {/* North America */}
                              <path d="M15,13 C19,13 22,16 24,20 C26,24 25,30 22,35 C17,38 15,40 15,43 L5,38 L5,23 Z" 
                                    fill={isDark ? "#60a5fa" : "#3b82f6"} />
                              
                              {/* South America */}
                              <path d="M22,35 C24,38 26,42 26,45 C24,47 21,47 18,45 L15,43 L15,38 Z" 
                                    fill={isDark ? "#60a5fa" : "#3b82f6"} />
                              
                              {/* Europe & Africa */}
                              <path d="M45,13 C48,13 50,15 50,20 C55,25 55,35 50,40 C45,45 40,45 35,40 L33,30 L40,20 Z" 
                                    fill={isDark ? "#60a5fa" : "#3b82f6"} />
                              
                              {/* Asia */}
                              <path d="M60,15 C65,13 70,13 75,15 C80,20 85,20 85,25 C85,30 80,35 75,40 C70,42 65,42 60,40 C55,35 52,30 50,20 C52,18 57,17 60,15 Z" 
                                    fill={isDark ? "#60a5fa" : "#3b82f6"} />
                              
                              {/* Australia */}
                              <path d="M80,40 C83,39 85,40 85,42 C85,44 83,45 80,45 C77,44 77,41 80,40 Z" 
                                    fill={isDark ? "#60a5fa" : "#3b82f6"} />
                            </svg>
                          </div>

                          {/* Place markers */}
                          {profilePlaces.slice(0, 10).map((place, index) => {
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
                              "USSR": {x: 65, y: 32},
                              "Havana": {x: 25, y: 45}
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
                                key={`place-${index}`}
                                style={{
                                  position: 'absolute',
                                  left: `${x}%`,
                                  top: `${y}%`,
                                  transform: 'translate(-50%, -50%)',
                                  zIndex: 20
                                }}
                              >
                                {/* Pin design */}
                                <div style={{ 
                                  width: '20px', 
                                  height: '20px', 
                                  borderRadius: '50%', 
                                  backgroundColor: 'rgba(220, 38, 38, 1)', 
                                  border: '2px solid white', 
                                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)', 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  justifyContent: 'center', 
                                  color: 'white', 
                                  fontSize: '8px', 
                                  fontWeight: 'bold',
                                  position: 'relative'
                                }}>
                                  {index + 1}
                                  {/* Pulse animation */}
                                  <div style={{
                                    position: 'absolute',
                                    width: '100%',
                                    height: '100%',
                                    borderRadius: '50%',
                                    border: '2px solid rgba(220, 38, 38, 0.5)',
                                    animation: 'pulse 2s infinite',
                                    animationDelay: `${index * 0.3}s`
                                  }} />
                                </div>
                                
                                {/* Label */}
                                <div style={{ 
                                  position: 'absolute', 
                                  top: '100%', 
                                  left: '50%', 
                                  transform: 'translateX(-50%)', 
                                  backgroundColor: 'rgba(0, 0, 0, 0.7)', 
                                  color: 'white', 
                                  fontSize: '8px', 
                                  borderRadius: '0.25rem', 
                                  padding: '2px 4px', 
                                  marginTop: '2px', 
                                  whiteSpace: 'nowrap',
                                  zIndex: 30
                                }}>
                                  {place}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        
                        {/* Place chips */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                          {profilePlaces.slice(0, 12).map((place, idx) => (
                            <div key={`place-tag-${idx}`} style={{ padding: '2px 6px', backgroundColor: 'rgba(251, 191, 36, 0.2)', color: 'rgba(146, 64, 14, 1)', borderRadius: '9999px', fontSize: '12px', display: 'flex', alignItems: 'center' }}>
                              <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: 'rgba(220, 38, 38, 1)', marginRight: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '6px', fontWeight: 'bold' }}>{idx+1}</span>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100px' }}>{place}</span>
                            </div>
                          ))}
                          
                          {profilePlaces.length > 12 && (
                            <div style={{ padding: '2px 6px', backgroundColor: 'rgba(243, 244, 246, 1)', color: 'rgba(31, 41, 55, 1)', borderRadius: '9999px', fontSize: '12px' }}>
                              +{profilePlaces.length - 12} more
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gray-50 dark:bg-gray-700 rounded" style={{ padding: '0.75rem', height: '224px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div className="text-sm text-gray-500 dark:text-gray-400 text-center">
                          <MapPin className="h-4 w-4 mx-auto mb-2 opacity-50" style={{width: '16px', height: '16px'}} />
                          <p>No geographic data available</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add CSS for the timeline scrolling */}
      <style jsx global>{`
        .timeline-container::-webkit-scrollbar {
          height: 8px;
        }
        .timeline-container::-webkit-scrollbar-track {
          background: ${isDark ? 'rgba(31, 41, 55, 0.2)' : 'rgba(243, 244, 246, 0.5)'};
          border-radius: 4px;
        }
        .timeline-container::-webkit-scrollbar-thumb {
          background: ${isDark ? 'rgba(75, 85, 99, 0.5)' : 'rgba(156, 163, 175, 0.5)'};
          border-radius: 4px;
        }
        .timeline-container::-webkit-scrollbar-thumb:hover {
          background: ${isDark ? 'rgba(75, 85, 99, 0.8)' : 'rgba(156, 163, 175, 0.8)'};
        }
        @keyframes pulse {
          0% {
            transform: scale(1);
            opacity: 1;
          }
          70% {
            transform: scale(1.5);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
} 