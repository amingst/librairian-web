'use client';

import React, { useEffect, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import RagChat from '@/components/RagChat';

// A simple side-by-side briefing view with space reserved for RAG chat
export default function BriefingViewPage() {
	const [briefing, setBriefing] = useState<any | null>(null);

	useEffect(() => {
		try {
			const stored = localStorage.getItem('lastNewsBriefing');
			if (stored) setBriefing(JSON.parse(stored));
		} catch (e) {
			console.error('Failed to load last briefing from storage', e);
		}
	}, []);

	if (!briefing) {
		return (
			<div className='p-6'>
				<Card>
					<CardContent className='py-12 text-center text-muted-foreground'>
						No briefing available. Generate one from the News Dock.
					</CardContent>
				</Card>
			</div>
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
							<CardTitle>{briefing.title || 'News Briefing'}</CardTitle>
						</CardHeader>
						<CardContent>
							<div className='text-sm text-muted-foreground mb-4'>
								{briefing.summary}
							</div>

							<div className='text-xs text-muted-foreground mb-4'>
								Generated: {new Date(briefing.generatedAt || Date.now()).toLocaleString()} • Articles: {briefing.totalArticles} • Sources: {Array.isArray(briefing.sources) ? briefing.sources.join(', ') : ''}
							</div>

							<ScrollArea className='h-[70vh]'>
								<div className='space-y-4'>
									{(briefing.sections || []).map((section: any, idx: number) => (
										<div key={idx} className='border rounded p-4'>
											<div className='flex items-center gap-2 mb-2'>
												<span className={`px-2 py-0.5 text-xs rounded ${
													section.importance === 'high'
														? 'bg-red-100 text-red-800'
													: section.importance === 'medium'
													? 'bg-yellow-100 text-yellow-800'
													: 'bg-gray-100 text-gray-800'
												}`}>{(section.importance || 'medium').toUpperCase()}</span>
											<h3 className='font-semibold'>{section.headline || section.topic}</h3>
											</div>
											<p className='text-sm text-muted-foreground mb-2'>{section.summary}</p>
											<ul className='list-disc pl-6 text-sm space-y-1'>
												{(section.keyPoints || []).map((p: string, i: number) => (
													<li key={i}>{p}</li>
												))}
											</ul>

											<div className='mt-3'>
												<div className='text-xs font-medium mb-1'>Sources</div>
												<div className='space-y-1'>
													{(section.sources || []).map((s: any, j: number) => (
														<div key={j} className='text-xs'>
															<a href={s.link} target='_blank' rel='noopener noreferrer' className='text-blue-600 hover:underline'>{s.title}</a>
															<div className='text-muted-foreground'>{s.source}</div>
														</div>
													))}
												</div>
											</div>
										</div>
									))}
								</div>
							</ScrollArea>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
