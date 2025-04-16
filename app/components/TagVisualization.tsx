'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface TagSummary {
  tag: string;
  count: number;
}

interface TagVisualizationProps {
  tags: TagSummary[];
  totalCount: number;
  onTagClick: (tag: string) => void;
}

export default function TagVisualization({ tags, totalCount, onTagClick }: TagVisualizationProps) {
  const [visualizationType, setVisualizationType] = useState<'cloud' | 'bars'>('cloud');
  
  // Calculate the maximum count for scaling
  const maxCount = Math.max(...tags.map(tag => tag.count));
  
  // Calculate color based on frequency
  const getTagColor = (count: number) => {
    const intensity = Math.min(100, (count / maxCount) * 100);
    return `hsl(210, ${Math.round(intensity)}%, ${70 - Math.round(intensity * 0.2)}%)`;
  };
  
  // Calculate font size based on frequency for tag cloud
  const getTagSize = (count: number) => {
    const minSize = 0.9;
    const maxSize = 2.0;
    const scale = (count / maxCount) * (maxSize - minSize) + minSize;
    return `${scale}rem`;
  };
  
  // Calculate bar width for bar chart
  const getBarWidth = (count: number) => {
    return `${(count / maxCount) * 100}%`;
  };
  
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Common Tags ({totalCount} total)</h2>
        <div className="flex space-x-2">
          <button
            onClick={() => setVisualizationType('cloud')}
            className={`px-3 py-1 rounded ${visualizationType === 'cloud' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          >
            Cloud
          </button>
          <button
            onClick={() => setVisualizationType('bars')}
            className={`px-3 py-1 rounded ${visualizationType === 'bars' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          >
            Bars
          </button>
        </div>
      </div>
      
      {visualizationType === 'cloud' && (
        <div className="flex flex-wrap gap-3 p-2">
          {tags.map(tag => (
            <button
              key={tag.tag}
              onClick={() => onTagClick(tag.tag)}
              className="px-3 py-1 rounded-full transition-all hover:scale-105"
              style={{
                backgroundColor: getTagColor(tag.count),
                fontSize: getTagSize(tag.count),
              }}
            >
              {tag.tag} ({tag.count})
            </button>
          ))}
        </div>
      )}
      
      {visualizationType === 'bars' && (
        <div className="space-y-3">
          {tags.map(tag => (
            <div key={tag.tag} className="flex flex-col">
              <div className="flex justify-between items-center mb-1">
                <button 
                  onClick={() => onTagClick(tag.tag)}
                  className="text-blue-600 hover:underline"
                >
                  {tag.tag}
                </button>
                <span className="text-gray-500 text-sm">{tag.count}</span>
              </div>
              <div className="w-full bg-gray-200 rounded h-6">
                <div 
                  className="h-full rounded"
                  style={{ 
                    width: getBarWidth(tag.count),
                    backgroundColor: getTagColor(tag.count) 
                  }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 