"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent } from '../../../components/ui/card';
import { Loader2 } from 'lucide-react';

export interface TimelineChartProps {
  documentId?: string;
  width?: number;
  height?: number;
  onBarClick?: (date: string, count: number) => void;
}

interface TimelineEvent {
  date: string;
  event: string;
  documents: string[];
}

interface DateCount {
  date: string;
  document_count: number;
}

export default function TimelineChart({ 
  documentId, 
  width = 960, 
  height = 600,
  onBarClick
}: TimelineChartProps) {
  const [timelineData, setTimelineData] = useState<TimelineEvent[] | DateCount[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [totalDocuments, setTotalDocuments] = useState<number>(0);

  useEffect(() => {
    const fetchTimelineData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // If we have a document ID, get timeline specific to that document
        if (documentId) {
          console.log(`Fetching timeline data for document ID: ${documentId}`);
          const response = await fetch(`/api/jfk/connections?type=timeline&documentId=${documentId}`);
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Failed to fetch timeline data: ${response.status} ${response.statusText}`);
          }
          
          const data = await response.json();
          console.log('Timeline data fetched successfully:', data.results.timeline.length, 'events found');
          setTimelineData(data.results.timeline);
        } 
        // Otherwise, get general date statistics across documents
        else {
          const response = await fetch(`/api/jfk/connections?type=dates`);
          
          if (!response.ok) {
            throw new Error(`Failed to fetch dates data: ${response.statusText}`);
          }
          
          const data = await response.json();
          
          // Calculate total documents in the dataset
          const totalCount = data.results.reduce((sum: number, item: DateCount) => sum + item.document_count, 0);
          setTotalDocuments(totalCount);
          
          // Sort data by date
          const sortedData = [...data.results].sort((a: DateCount, b: DateCount) => {
            return new Date(a.date).getTime() - new Date(b.date).getTime();
          });
          
          setTimelineData(sortedData);
        }
      } catch (err) {
        console.error("Error fetching timeline data:", err);
        setError(err instanceof Error ? err.message : "Unknown error occurred");
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchTimelineData();
  }, [documentId]);

  const handleDateClick = (date: string, count: number) => {
    if (onBarClick) {
      onBarClick(date, count);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-12 w-12 animate-spin text-blue-500 mr-3" />
        <span>Loading timeline data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="text-red-500">Error: {error}</div>
      </div>
    );
  }

  if (timelineData.length === 0) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="text-gray-500 max-w-md text-center">
          <p>No timeline data available{documentId ? ' for this document' : ''}</p>
          <p className="mt-2 text-sm">{
            documentId 
              ? "The document may not have any date references or related timeline events."
              : "Try a different search or visualization type."
          }</p>
        </div>
      </div>
    );
  }

  // Check if we're dealing with the document-specific timeline or general date counts
  const isDocumentTimeline = 'event' in timelineData[0];

  // If we have document-specific timeline data, show the event timeline
  if (isDocumentTimeline) {
    const events = timelineData as TimelineEvent[];
    
    return (
      <Card className="w-full h-full overflow-auto">
        <CardContent className="p-4">
          <div className="flex flex-col items-center">
            {/* Timeline vertical line */}
            <div className="w-1 bg-gray-200 rounded h-full absolute left-1/2 transform -translate-x-1/2"></div>
            
            {/* Timeline events */}
            <div className="relative w-full max-w-3xl">
              {events.map((event, index) => (
                <div 
                  key={`${event.date}-${index}`}
                  className={`mb-8 flex w-full ${
                    index % 2 === 0 ? 'justify-start' : 'justify-end'
                  }`}
                  onClick={() => handleDateClick(event.date, event.documents.length)}
                >
                  <div className="order-1 w-5/12">
                    <div className="flex flex-col p-4 my-4 bg-white rounded shadow-md border hover:bg-blue-50 cursor-pointer">
                      <h3 className="font-bold text-gray-800">{event.date}</h3>
                      <p className="text-sm mt-2">{event.event}</p>
                      {event.documents && event.documents.length > 0 && (
                        <div className="mt-2 pt-2 border-t text-xs text-gray-600">
                          Related documents: {event.documents.length}
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Timeline dot */}
                  <div className="z-20 flex items-center order-1 bg-gray-800 shadow-md w-4 h-4 rounded-full">
                    <div className="z-30 w-3 h-3 bg-blue-600 rounded-full"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  } 
  // Otherwise, show the date counts for general view
  else {
    const dateData = timelineData as DateCount[];
    const maxCount = Math.max(...dateData.map(d => d.document_count));
    
    return (
      <Card className="w-full h-full">
        <CardContent className="p-4">
          <div className="mb-4 flex justify-between items-center">
            <h3 className="text-lg font-medium">Documents by Date</h3>
            {totalDocuments > 0 && (
              <div className="text-sm text-gray-500">
                {totalDocuments} documents across {dateData.length} time periods
              </div>
            )}
          </div>
          <div className="overflow-auto h-[500px]">
            <div className="space-y-2 w-full">
              {dateData.map((dateItem, index) => (
                <div 
                  key={`date-${index}`}
                  className="flex items-center hover:bg-blue-50 cursor-pointer p-2 rounded"
                  onClick={() => handleDateClick(dateItem.date, dateItem.document_count)}
                >
                  <div className="w-32 text-sm font-medium">{new Date(dateItem.date).toLocaleDateString()}</div>
                  <div className="grow">
                    <div className="bg-gray-200 rounded-full h-5 w-full overflow-hidden">
                      <div 
                        className="bg-blue-500 h-5 rounded-full flex items-center justify-end pr-2" 
                        style={{ 
                          width: `${Math.max(5, (dateItem.document_count / maxCount) * 100)}%` 
                        }}>
                        {dateItem.document_count > maxCount / 4 && (
                          <span className="text-xs text-white font-medium">{dateItem.document_count}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {dateItem.document_count <= maxCount / 4 && (
                    <div className="w-12 text-right text-sm ml-2">{dateItem.document_count}</div>
                  )}
                </div>
              ))}
            </div>
            <div className="text-sm text-gray-500 mt-4 text-center">
              Click on a date to view related documents
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
} 