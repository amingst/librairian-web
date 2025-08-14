'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getBriefing } from '@/app/actions/pharos/briefings';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import RagChat from '@/components/RagChat';

interface BriefingSection {
	topic: string;
	headline: string;
	summary: string;
	keyPoints: string[];
	sources: Array<{ title: string; link: string; source: string }>;
	importance: 'high' | 'medium' | 'low';
}

interface Briefing {
	id: string;
	title: string;
	createdAt: string;
	url: string;
	summary: string;
	generatedAt: string;
	totalArticles: number;
	sources: string[];
	sections: BriefingSection[];
	metadata?: {
		briefingType: string;
		targetAudience: string;
		processingTime: number;
		mode: string;
	};
}

function BriefingSkeleton() {
	return (
		<Card>
			<CardHeader>
				<Skeleton className='h-6 w-3/4' />
			</CardHeader>
			<CardContent className='space-y-4'>
				<Skeleton className='h-4 w-full' />
				<Skeleton className='h-4 w-full' />
				<Skeleton className='h-4 w-3/4' />
			</CardContent>
		</Card>
	);
}

export default function BriefingPage() {
	const params = useParams();
	const briefingId = params.briefingId as string;
	const [briefing, setBriefing] = useState<Briefing | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		async function fetchBriefing() {
			try {
				const found = await getBriefing(briefingId);

				if (!found) {
					setError('Briefing not found');
				} else {
					setBriefing(found);
				}
			} catch (err) {
				setError('Failed to load briefing');
				console.error('Error loading briefing:', err);
			} finally {
				setLoading(false);
			}
		}

		fetchBriefing();
	}, [briefingId]);

	if (loading) {
		return <BriefingSkeleton />;
	}

	if (error) {
		return (
			<Card className='border-red-200 bg-red-50'>
				<CardHeader>
					<CardTitle className='text-red-700'>Error</CardTitle>
				</CardHeader>
				<CardContent>
					<p className='text-red-600'>{error}</p>
				</CardContent>
			</Card>
		);
	}

	if (!briefing) {
		return (
			<Card className='border-yellow-200 bg-yellow-50'>
				<CardHeader>
					<CardTitle className='text-yellow-700'>Not Found</CardTitle>
				</CardHeader>
				<CardContent>
					<p className='text-yellow-600'>
						The requested briefing was not found.
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className='p-4'>
			<div className='grid grid-cols-1 lg:grid-cols-3 gap-4'>
				{/* Left column: RAG chat */}
				<div className='hidden lg:block lg:col-span-1'>
					<RagChat />
				</div>

				{/* Right column: briefing content */}
				<div className='lg:col-span-2'>
					<Card>
						<CardHeader>
							<CardTitle>{briefing.title}</CardTitle>
						</CardHeader>
						<CardContent>
							<div className='text-sm text-muted-foreground mb-4'>
								{briefing.summary}
							</div>

							<div className='text-xs text-muted-foreground mb-4'>
								Generated:{' '}
								{new Date(
									briefing.generatedAt || briefing.createdAt
								).toLocaleString()}{' '}
								• Articles: {briefing.totalArticles} • Sources:{' '}
								{Array.isArray(briefing.sources)
									? briefing.sources.join(', ')
									: ''}
							</div>

							<ScrollArea className='h-[70vh]'>
								<div className='space-y-4'>
									{(briefing.sections || []).map(
										(section, idx) => (
											<div
												key={idx}
												className='border rounded p-4'
											>
												<div className='flex items-center gap-2 mb-2'>
													<span
														className={`px-2 py-0.5 text-xs rounded ${
															section.importance ===
															'high'
																? 'bg-red-100 text-red-800'
																: section.importance ===
																  'medium'
																? 'bg-yellow-100 text-yellow-800'
																: 'bg-gray-100 text-gray-800'
														}`}
													>
														{(
															section.importance ||
															'medium'
														).toUpperCase()}
													</span>
													<h3 className='font-semibold'>
														{section.headline ||
															section.topic}
													</h3>
												</div>
												<p className='text-sm text-muted-foreground mb-2'>
													{section.summary}
												</p>
												<ul className='list-disc pl-6 text-sm space-y-1'>
													{(
														section.keyPoints || []
													).map((p, i) => (
														<li key={i}>{p}</li>
													))}
												</ul>

												<div className='mt-3'>
													<div className='text-xs font-medium mb-1'>
														Sources
													</div>
													<div className='space-y-1'>
														{(
															section.sources ||
															[]
														).map((s, j) => (
															<div
																key={j}
																className='text-xs'
															>
																<a
																	href={
																		s.link
																	}
																	target='_blank'
																	rel='noopener noreferrer'
																	className='text-blue-600 hover:underline'
																>
																	{s.title}
																</a>
																<div className='text-muted-foreground'>
																	{s.source}
																</div>
															</div>
														))}
													</div>
												</div>
											</div>
										)
									)}
								</div>
							</ScrollArea>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
