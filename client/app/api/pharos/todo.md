# Async Scraping Job System Implementation

## 🎯 **Goal**

Replace the current blocking scraping requests (20-50 seconds) with an asynchronous job queue system that provides real-time progress updates and doesn't block the user interface.

## 🚨 **TODO: Priority Implementation**

-   [ ] Implement job queue API endpoints
-   [ ] Add job polling mechanism to NewsScraperExample
-   [ ] Create job status UI components
-   [ ] Test with multiple concurrent jobs
-   [ ] Add Redis/database persistence for production
-   [ ] Implement WebSocket alternative for real-time updates

---

## 📁 **File Structure to Create**

```
client/
├── app/api/news/
│   ├── scrape-job/
│   │   ├── route.ts          # Start scraping job
│   │   └── [jobId]/
│   │       └── route.ts      # Get job status
│   └── documents/
│       └── route.ts          # Existing endpoint
├── components/news/
│   ├── NewsScraperExample.tsx # Update with job polling
│   └── JobStatusDisplay.tsx   # New component
└── hooks/
    └── useScrapingJobs.ts     # Custom hook for job management
```

---

## 🔧 **Implementation Details**

### 1. **Backend: Job Queue API**

#### **Start Job Endpoint**

```typescript
// filepath: c:\Users\Andrew\Documents\GitHub\amingst\librairian-web\client\app\api\news\scrape-job\route.ts
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

// Simple in-memory job store (use Redis/database in production)
const jobs = new Map<
	string,
	{
		id: string;
		status: 'pending' | 'running' | 'completed' | 'failed';
		progress: number;
		result?: any;
		error?: string;
		createdAt: Date;
		sources: string[];
	}
>();

export async function POST(request: NextRequest) {
	try {
		const { sources, options } = await request.json();

		const jobId = uuidv4();

		// Create job entry
		jobs.set(jobId, {
			id: jobId,
			status: 'pending',
			progress: 0,
			createdAt: new Date(),
			sources,
		});

		// Start the scraping job asynchronously (don't await)
		startScrapingJob(jobId, sources, options);

		return NextResponse.json({
			success: true,
			jobId,
			status: 'pending',
			message: 'Scraping job started successfully',
		});
	} catch (error) {
		console.error('Failed to start scraping job:', error);
		return NextResponse.json(
			{ success: false, error: 'Failed to start scraping job' },
			{ status: 500 }
		);
	}
}

async function startScrapingJob(
	jobId: string,
	sources: string[],
	options: any
) {
	const job = jobs.get(jobId);
	if (!job) return;

	try {
		// Update job status
		job.status = 'running';
		job.progress = 10;

		// Your existing scraping logic here
		// TODO: Integrate with existing MCP client from NewsScraperExample
		const results = [];

		for (let i = 0; i < sources.length; i++) {
			const source = sources[i];

			// Update progress
			job.progress = 10 + (i / sources.length) * 80;

			// Scrape this source (integrate your existing MCP logic)
			const sourceResult = await scrapeSourceWithMCP(source, options);
			results.push(sourceResult);
		}

		// Auto-save to database (integrate with existing logic)
		await saveArticlesToDatabase(results);

		// Mark as completed
		job.status = 'completed';
		job.progress = 100;
		job.result = results;
	} catch (error) {
		job.status = 'failed';
		job.error = error instanceof Error ? error.message : 'Unknown error';
	}
}

// TODO: Extract this from NewsScraperExample component
async function scrapeSourceWithMCP(source: string, options: any) {
	// Your existing MCP scraping logic here
	// This should be extracted from the current handleScrapeSelected function
}

// TODO: Extract this from NewsScraperExample component
async function saveArticlesToDatabase(articles: any[]) {
	// Your existing article saving logic here
	// This should be extracted from the current auto-save functionality
}
```

#### **Job Status Endpoint**

```typescript
// filepath: c:\Users\Andrew\Documents\GitHub\amingst\librairian-web\client\app\api\news\scrape-job\[jobId]\route.ts
import { NextRequest, NextResponse } from 'next/server';

// Import the same jobs Map from the main route
// TODO: Move to Redis or database for production persistence

export async function GET(
	request: NextRequest,
	{ params }: { params: { jobId: string } }
) {
	const jobId = params.jobId;
	const job = jobs.get(jobId); // TODO: Get from Redis/database

	if (!job) {
		return NextResponse.json(
			{ success: false, error: 'Job not found' },
			{ status: 404 }
		);
	}

	return NextResponse.json({
		success: true,
		job: {
			id: job.id,
			status: job.status,
			progress: job.progress,
			result: job.result,
			error: job.error,
			createdAt: job.createdAt,
			sources: job.sources,
		},
	});
}

export async function DELETE(
	request: NextRequest,
	{ params }: { params: { jobId: string } }
) {
	const jobId = params.jobId;
	const deleted = jobs.delete(jobId); // TODO: Delete from Redis/database

	if (!deleted) {
		return NextResponse.json(
			{ success: false, error: 'Job not found' },
			{ status: 404 }
		);
	}

	return NextResponse.json({
		success: true,
		message: 'Job deleted successfully',
	});
}
```

### 2. **Frontend: Custom Hook for Job Management**

```typescript
// filepath: c:\Users\Andrew\Documents\GitHub\amingst\librairian-web\client\hooks\useScrapingJobs.ts
import { useState, useEffect, useCallback } from 'react';

interface ScrapingJob {
	id: string;
	status: 'pending' | 'running' | 'completed' | 'failed';
	progress: number;
	result?: any;
	error?: string;
	createdAt: Date;
	sources: string[];
}

export const useScrapingJobs = () => {
	const [activeJobs, setActiveJobs] = useState<Map<string, ScrapingJob>>(
		new Map()
	);
	const [pollingIntervals, setPollingIntervals] = useState<
		Map<string, NodeJS.Timeout>
	>(new Map());

	const startJob = async (sources: string[], options: any) => {
		try {
			const response = await fetch('/api/news/scrape-job', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ sources, options }),
			});

			const result = await response.json();

			if (result.success) {
				// Add job to active jobs
				const newJob: ScrapingJob = {
					id: result.jobId,
					status: 'pending',
					progress: 0,
					sources,
					createdAt: new Date(),
				};

				setActiveJobs(
					(prev) => new Map(prev.set(result.jobId, newJob))
				);
				startPolling(result.jobId);

				return { success: true, jobId: result.jobId };
			} else {
				return { success: false, error: result.error };
			}
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
			};
		}
	};

	const startPolling = useCallback(
		(jobId: string) => {
			const pollJob = async () => {
				try {
					const response = await fetch(
						`/api/news/scrape-job/${jobId}`
					);
					const result = await response.json();

					if (result.success) {
						const job = result.job;

						setActiveJobs((prev) => new Map(prev.set(jobId, job)));

						// If job is complete or failed, stop polling
						if (
							job.status === 'completed' ||
							job.status === 'failed'
						) {
							const interval = pollingIntervals.get(jobId);
							if (interval) {
								clearInterval(interval);
								setPollingIntervals((prev) => {
									const newMap = new Map(prev);
									newMap.delete(jobId);
									return newMap;
								});
							}
						}
					}
				} catch (error) {
					console.error('Failed to poll job status:', error);
				}
			};

			// Poll every 2 seconds
			const interval = setInterval(pollJob, 2000);
			setPollingIntervals((prev) => new Map(prev.set(jobId, interval)));

			// Initial poll
			pollJob();
		},
		[pollingIntervals]
	);

	const removeJob = useCallback(
		(jobId: string) => {
			// Stop polling
			const interval = pollingIntervals.get(jobId);
			if (interval) {
				clearInterval(interval);
				setPollingIntervals((prev) => {
					const newMap = new Map(prev);
					newMap.delete(jobId);
					return newMap;
				});
			}

			// Remove from active jobs
			setActiveJobs((prev) => {
				const newMap = new Map(prev);
				newMap.delete(jobId);
				return newMap;
			});

			// Optionally delete job on server
			fetch(`/api/news/scrape-job/${jobId}`, { method: 'DELETE' }).catch(
				console.error
			);
		},
		[pollingIntervals]
	);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			pollingIntervals.forEach((interval) => clearInterval(interval));
		};
	}, [pollingIntervals]);

	return {
		activeJobs: Array.from(activeJobs.values()),
		startJob,
		removeJob,
	};
};
```

### 3. **Frontend: Job Status Display Component**

```tsx
// filepath: c:\Users\Andrew\Documents\GitHub\amingst\librairian-web\client\components\news\JobStatusDisplay.tsx
import React from 'react';
import { CheckIcon, XIcon, ClockIcon, PlayIcon } from 'lucide-react';

interface Job {
	id: string;
	status: 'pending' | 'running' | 'completed' | 'failed';
	progress: number;
	sources: string[];
	error?: string;
	createdAt: Date;
}

interface JobStatusDisplayProps {
	jobs: Job[];
	onRemoveJob: (jobId: string) => void;
}

export const JobStatusDisplay: React.FC<JobStatusDisplayProps> = ({
	jobs,
	onRemoveJob,
}) => {
	if (jobs.length === 0) return null;

	const getStatusIcon = (status: string) => {
		switch (status) {
			case 'pending':
				return <ClockIcon className='w-4 h-4 text-yellow-500' />;
			case 'running':
				return <PlayIcon className='w-4 h-4 text-blue-500' />;
			case 'completed':
				return <CheckIcon className='w-4 h-4 text-green-500' />;
			case 'failed':
				return <XIcon className='w-4 h-4 text-red-500' />;
			default:
				return null;
		}
	};

	const getStatusColor = (status: string) => {
		switch (status) {
			case 'pending':
				return 'border-yellow-200 bg-yellow-50';
			case 'running':
				return 'border-blue-200 bg-blue-50';
			case 'completed':
				return 'border-green-200 bg-green-50';
			case 'failed':
				return 'border-red-200 bg-red-50';
			default:
				return 'border-gray-200 bg-gray-50';
		}
	};

	return (
		<div className='mb-6 space-y-3'>
			<h3 className='text-lg font-semibold text-gray-900'>
				Active Scraping Jobs ({jobs.length})
			</h3>

			{jobs.map((job) => (
				<div
					key={job.id}
					className={`p-4 border rounded-lg transition-all duration-200 ${getStatusColor(
						job.status
					)}`}
				>
					<div className='flex justify-between items-start mb-3'>
						<div className='flex items-center gap-2'>
							{getStatusIcon(job.status)}
							<span className='font-medium text-gray-900'>
								Job {job.id.slice(0, 8)}...
							</span>
							<span className='text-sm text-gray-600 capitalize'>
								{job.status}
							</span>
						</div>

						<button
							onClick={() => onRemoveJob(job.id)}
							className='text-gray-400 hover:text-gray-600 transition-colors'
							title='Remove job'
						>
							<XIcon className='w-4 h-4' />
						</button>
					</div>

					{/* Progress bar */}
					<div className='mb-3'>
						<div className='flex justify-between text-sm text-gray-600 mb-1'>
							<span>Progress</span>
							<span>{job.progress}%</span>
						</div>
						<div className='w-full bg-gray-200 rounded-full h-2'>
							<div
								className={`h-2 rounded-full transition-all duration-300 ${
									job.status === 'failed'
										? 'bg-red-500'
										: job.status === 'completed'
										? 'bg-green-500'
										: 'bg-blue-500'
								}`}
								style={{ width: `${job.progress}%` }}
							/>
						</div>
					</div>

					{/* Sources */}
					<div className='text-sm text-gray-600 mb-2'>
						<span className='font-medium'>Sources:</span>{' '}
						{job.sources.join(', ')}
					</div>

					{/* Error message */}
					{job.error && (
						<div className='text-sm text-red-600 bg-red-100 p-2 rounded'>
							<span className='font-medium'>Error:</span>{' '}
							{job.error}
						</div>
					)}

					{/* Timestamp */}
					<div className='text-xs text-gray-500'>
						Started: {job.createdAt.toLocaleTimeString()}
					</div>
				</div>
			))}
		</div>
	);
};
```

### 4. **Frontend: Update NewsScraperExample**

```tsx
// filepath: c:\Users\Andrew\Documents\GitHub\amingst\librairian-web\client\components\news\NewsScraperExample.tsx
// Add these imports
import { useScrapingJobs } from '../../hooks/useScrapingJobs';
import { JobStatusDisplay } from './JobStatusDisplay';

// Inside your NewsScraperExample component:
export default function NewsScraperExample() {
	// Add the scraping jobs hook
	const { activeJobs, startJob, removeJob } = useScrapingJobs();

	// Replace your existing handleScrapeSelected function
	const handleScrapeSelected = async () => {
		if (selection.selectedSources.length === 0) {
			alert('Please select at least one news source');
			return;
		}

		const result = await startJob(selection.selectedSources.slice(0, 2), {
			limit: 5,
			includeMedia: true,
			includeSections: true,
		});

		if (result.success) {
			alert(`Scraping job started! Job ID: ${result.jobId}`);
		} else {
			alert(`Failed to start scraping job: ${result.error}`);
		}
	};

	// Add job completion handler
	useEffect(() => {
		const completedJobs = activeJobs.filter(
			(job) => job.status === 'completed'
		);

		completedJobs.forEach((job) => {
			if (job.result) {
				// Update articles state with completed job results
				setArticles(job.result);

				// Refresh documents from database to show new articles
				handleLoadFromDatabase();

				// Show success notification
				console.log(`Scraping job ${job.id} completed successfully!`);
			}

			// Auto-remove completed jobs after 30 seconds
			setTimeout(() => removeJob(job.id), 30000);
		});
	}, [activeJobs, removeJob]);

	// Add to your JSX return:
	return (
		<div className='max-w-6xl mx-auto p-6'>
			{/* Your existing header content */}

			{/* Add job status display */}
			<JobStatusDisplay jobs={activeJobs} onRemoveJob={removeJob} />

			{/* Your existing content */}
		</div>
	);
}
```

---

## 🚀 **Implementation Steps**

1. **Phase 1: Basic Job Queue**

    - [ ] Create job queue API endpoints
    - [ ] Implement basic job status tracking
    - [ ] Add simple polling mechanism

2. **Phase 2: UI Integration**

    - [ ] Create JobStatusDisplay component
    - [ ] Integrate with NewsScraperExample
    - [ ] Add job management hooks

3. **Phase 3: Enhanced Features**

    - [ ] Add job cancellation
    - [ ] Implement job retry logic
    - [ ] Add job history/logs

4. **Phase 4: Production Ready**
    - [ ] Replace in-memory storage with Redis
    - [ ] Add job persistence to database
    - [ ] Implement WebSocket real-time updates
    - [ ] Add job queue worker scaling

---

## 🎯 **Benefits**

-   ✅ **Non-blocking UI**: Users can continue working while scraping runs
-   ✅ **Real-time Progress**: Live updates on scraping progress
-   ✅ **Multiple Jobs**: Can run multiple scraping operations simultaneously
-   ✅ **Error Handling**: Graceful handling of failed operations
-   ✅ **Scalable Architecture**: Easy to extend with Redis/WebSockets

---

## 📊 **Current vs. Proposed Flow**

### **Current (Blocking)**

```
User clicks "Scrape" → Wait 20-50 seconds → Results or Error
```

### **Proposed (Async)**

```
User clicks "Scrape" → Job started immediately →
Real-time progress updates → Auto-refresh when complete
```

---

## 🔧 **Technical Notes**

-   **Job Storage**: Currently uses in-memory Map, should be moved to Redis for production
-   **Polling Frequency**: 2 seconds (configurable)
-   **Job Cleanup**: Auto-remove completed jobs after 30 seconds
-   **Error Handling**: Graceful failure with detailed error messages
-   **Integration**: Seamlessly integrates with existing MCP client logic

---

**Priority**: High - This will significantly improve user experience by eliminating long wait times and providing better feedback.
