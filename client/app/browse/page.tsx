'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { fixApiUrl, fetchTextContent, formatDate } from '../utils/mediaHelpers';
import TagVisualization from '../components/TagVisualization';

// Add tag summary interface
interface TagSummary {
  tag: string;
  count: number;
}

interface RecordData {
  basic: {
    name: string;
    description: string;
    date: number;
    dateReadable: string;
    tagItems: string[];
    language: string;
    nsfw: boolean;
  };
  post: {
    bylineWriter?: string;
    webUrl?: string;
    featuredImage?: {
      oip: any;
      data: {
        basic: any;
        image: any;
      };
    };
    articleText?: {
      oip: any;
      data: {
        text: {
          webUrl: string;
          contentType: string;
        };
      };
    };
    summaryTTS?: {
      oip: any;
      data: {
        audio: {
          webUrl: string;
          contentType: string;
        };
      };
    };
  };
}

interface Record {
  data: RecordData;
  oip: {
    didTx: string;
    inArweaveBlock: number;
    recordType: string;
    indexedAt: string;
    recordStatus: string;
    creator: {
      creatorHandle: string;
      didAddress: string;
    };
  };
}

interface ApiResponse {
  message: string;
  totalRecords: number;
  pageSize: number;
  currentPage: number;
  totalPages: number;
  records: Record[];
  // Add new properties for tag summary
  tagSummary?: TagSummary[];
  tagCount?: number;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.oip.onl';

export default function BrowsePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [records, setRecords] = useState<Record[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalRecords: 0
  });
  // Add state for tag summary
  const [tagSummary, setTagSummary] = useState<TagSummary[]>([]);
  const [tagCount, setTagCount] = useState(0);
  const [showConnections, setShowConnections] = useState(false);

  const page = parseInt(searchParams.get('page') || '1', 10);
  const searchTerm = searchParams.get('search') || '';
  const didTx = searchParams.get('didTx') || '';

  useEffect(() => {
    fetchRecords(page, searchTerm, didTx);
  }, [page, searchTerm, didTx]);

  const fetchRecords = useCallback(async (currentPage: number, search: string = '', didTx: string = '') => {
    setLoading(true);
    try {
      // Build the API URL with tag summary parameters
      let apiUrl = `${API_BASE_URL}/api/records?recordType=post&sortBy=date&page=${currentPage}&limit=10&resolveDepth=2`;
      
      // Add tag summary parameters
      apiUrl += '&summarizeTags=true&tagCount=10&tagPage=1';
      
      // Add search term if provided
      if (search) {
        apiUrl += `&search=${encodeURIComponent(search)}`;
      }
      
      // Add didTx if provided (for single article view)
      if (didTx) {
        apiUrl += `&didTx=${encodeURIComponent(didTx)}`;
      }
      
      const response = await fetch(apiUrl, { cache: 'no-store' });
      
      if (!response.ok) {
        throw new Error('Failed to fetch records');
      }
      
      const data: ApiResponse = await response.json();
      setRecords(data.records);
      setPagination({
        currentPage: data.currentPage,
        totalPages: data.totalPages,
        totalRecords: data.totalRecords
      });
      
      // Set tag summary data if available
      if (data.tagSummary) {
        setTagSummary(data.tagSummary);
        setTagCount(data.tagCount || 0);
      }
    } catch (err) {
      console.error('Error fetching records:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch records');
    } finally {
      setLoading(false);
    }
  }, []);

  const navigatePage = (newPage: number) => {
    if (newPage < 1 || newPage > pagination.totalPages) return;
    
    // Preserve search parameter if it exists
    let newPath = `/browse?page=${newPage}`;
    if (searchTerm) {
      newPath += `&search=${encodeURIComponent(searchTerm)}`;
    }
    if (didTx) {
      newPath += `&didTx=${encodeURIComponent(didTx)}`;
    }
    
    router.push(newPath);
  };

  const handleTagClick = (tag: string) => {
    // Create a new search with the selected tag
    router.push(`/browse?page=1&search=${encodeURIComponent(tag)}`);
  };

  // Function to toggle connections view
  const toggleConnections = () => {
    setShowConnections(!showConnections);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">
          {searchTerm ? `Browse: "${searchTerm}"` : 'Browse Articles'}
        </h1>
        <button 
          onClick={toggleConnections}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          {showConnections ? 'Hide Connections' : 'Find Connections'}
        </button>
      </div>
      
      {/* Use the TagVisualization component */}
      {showConnections && tagSummary.length > 0 && (
        <div className="mb-8">
          <TagVisualization 
            tags={tagSummary} 
            totalCount={tagCount} 
            onTagClick={handleTagClick} 
          />
        </div>
      )}
      
      {loading && <div className="text-center py-10">Loading articles...</div>}
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6">
          {error}
        </div>
      )}
      
      {!loading && !error && (
        <>
          <div className="space-y-10">
            {records.map((record) => (
              <ArticleCard key={record.oip.didTx} record={record} />
            ))}
          </div>
          
          {/* Pagination */}
          <div className="mt-10 flex justify-center items-center space-x-4">
            <button 
              onClick={() => navigatePage(pagination.currentPage - 1)}
              disabled={pagination.currentPage === 1}
              className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
            >
              Previous
            </button>
            <span>
              Page {pagination.currentPage} of {pagination.totalPages}
            </span>
            <button 
              onClick={() => navigatePage(pagination.currentPage + 1)}
              disabled={pagination.currentPage === pagination.totalPages}
              className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ArticleCard({ record }: { record: Record }) {
  const [articleText, setArticleText] = useState<string | null>(null);
  const [loadingText, setLoadingText] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const router = useRouter();
  
  const { basic, post } = record.data;
  // Check if image data exists and has webUrl
  const featuredImageUrl = post?.featuredImage?.data?.image?.webUrl;
  const articleTextUrl = post?.articleText?.data?.text?.webUrl;
  const summaryTtsUrl = post?.summaryTTS?.data?.audio?.webUrl;
  
  const loadArticleText = async () => {
    if (!articleTextUrl || loadingText || articleText) return;
    
    setLoadingText(true);
    try {
      const text = await fetchTextContent(articleTextUrl);
      setArticleText(text);
    } catch (err) {
      console.error('Error loading article text:', err);
      // Show a user-friendly error message
      setArticleText("Unable to load article text. The content may be unavailable.");
    } finally {
      setLoadingText(false);
    }
  };

  const handleTagClick = (tag: string) => {
    router.push(`/browse?page=1&search=${encodeURIComponent(tag)}`);
  };

  const viewFullArticle = () => {
    router.push(`/browse?didTx=${encodeURIComponent(record.oip.didTx)}`);
  };

  // Handle image loading errors
  const handleImageError = () => {
    setImageError(true);
  };

  // Handle audio loading errors
  const handleAudioError = () => {
    setAudioError(true);
  };

  return (
    <div className="border rounded-lg overflow-hidden shadow-lg bg-white">
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-3">
          <a 
            href="#" 
            onClick={(e) => { e.preventDefault(); viewFullArticle(); }}
            className="hover:text-blue-600"
          >
            {basic?.name || "Untitled Article"}
          </a>
        </h2>
        
        {post?.bylineWriter && (
          <p className="text-gray-600 mb-2">By {post.bylineWriter}</p>
        )}
        
        <p className="text-gray-600 mb-4">{basic?.dateReadable || (basic?.date ? formatDate(basic.date) : "Unknown date")}</p>
        
        {/* Featured Image with error handling */}
        {featuredImageUrl && !imageError && (
          <div className="my-4">
            <img 
              src={fixApiUrl(featuredImageUrl)} 
              alt={basic?.name || "Article image"}
              className="w-full h-auto object-cover rounded max-h-96"
              onError={handleImageError}
            />
          </div>
        )}
        
        {/* Description */}
        {basic?.description && (
          <div className="my-4">
            <p className="text-gray-800">{basic.description}</p>
          </div>
        )}
        
        {/* Tags - clickable */}
        {basic?.tagItems && basic.tagItems.length > 0 && (
          <div className="my-4 flex flex-wrap gap-2">
            {basic.tagItems.map((tag, index) => (
              <button 
                key={index} 
                onClick={() => handleTagClick(tag)}
                className="bg-gray-200 px-2 py-1 text-sm rounded hover:bg-gray-300"
              >
                {tag}
              </button>
            ))}
          </div>
        )}
        
        {/* Article Text Button */}
        {articleTextUrl && (
          <div className="my-4">
            <button 
              onClick={loadArticleText}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              disabled={loadingText}
            >
              {loadingText ? 'Loading...' : articleText ? 'Hide Full Article' : 'Read Full Article'}
            </button>
            
            {articleText && (
              <div className="mt-4 bg-gray-50 p-4 rounded whitespace-pre-wrap">
                {articleText}
              </div>
            )}
          </div>
        )}
        
        {/* Audio Player with error handling */}
        {summaryTtsUrl && !audioError && (
          <div className="my-4">
            <h3 className="text-lg font-semibold mb-2">Audio Summary</h3>
            <audio 
              controls 
              className="w-full"
              onError={handleAudioError}
            >
              <source src={fixApiUrl(summaryTtsUrl)} type="audio/mpeg" />
              Your browser does not support the audio element.
            </audio>
          </div>
        )}
        
        {/* Original Source Link */}
        {post?.webUrl && (
          <div className="mt-4">
            <a 
              href={post.webUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              View Original Source
            </a>
          </div>
        )}
      </div>
    </div>
  );
} 