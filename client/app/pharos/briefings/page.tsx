'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
	Calendar,
	Clock,
	FileText,
	Users,
	ExternalLink,
	ChevronDown,
	ChevronRight,
	Trash2,
	Search,
	Filter,
	Download,
	Mic,
	Volume2,
	Play,
	Pause,
	Square,
} from 'lucide-react';

interface BriefingSection {
	topic: string;
	headline: string;
	summary: string;
	keyPoints: string[];
	sources: Array<{
		title: string;
		link: string;
		source: string;
	}>;
	importance: 'high' | 'medium' | 'low';
}

interface SavedBriefing {
	id: string;
	title: string;
	generatedAt: string;
	savedAt: string;
	summary: string;
	sections: BriefingSection[];
	totalArticles: number;
	sources: string[];
	metadata: {
		briefingType: string;
		targetAudience: string;
		processingTime: number;
	};
}

export default function BriefingsPage() {
	const [briefings, setBriefings] = useState<SavedBriefing[]>([]);
	const [selectedBriefing, setSelectedBriefing] =
		useState<SavedBriefing | null>(null);
	const [expandedSections, setExpandedSections] = useState<Set<number>>(
		new Set()
	);
	const [searchTerm, setSearchTerm] = useState('');
	const [filterAudience, setFilterAudience] = useState<string>('all');
	const [sortBy, setSortBy] = useState<'date' | 'articles' | 'sections'>(
		'date'
	);

	// Podcast-related state
	// Podcast generation states (UI only)
	const [generatingPodcast, setGeneratingPodcast] = useState<string | null>(
		null
	);

	// Load briefings from localStorage
	useEffect(() => {
		try {
			const savedBriefings = JSON.parse(
				localStorage.getItem('savedNewsBriefings') || '[]'
			);
			setBriefings(
				savedBriefings.sort(
					(a: SavedBriefing, b: SavedBriefing) =>
						new Date(b.savedAt).getTime() -
						new Date(a.savedAt).getTime()
				)
			);
		} catch (error) {
			console.error('Error loading briefings:', error);
		}
	}, []);

	// Filter and sort briefings
	const filteredBriefings = briefings
		.filter((briefing) => {
			const matchesSearch =
				briefing.title
					.toLowerCase()
					.includes(searchTerm.toLowerCase()) ||
				briefing.summary
					.toLowerCase()
					.includes(searchTerm.toLowerCase()) ||
				briefing.sections.some(
					(section) =>
						section.topic
							.toLowerCase()
							.includes(searchTerm.toLowerCase()) ||
						section.headline
							.toLowerCase()
							.includes(searchTerm.toLowerCase())
				);

			const matchesAudience =
				filterAudience === 'all' ||
				briefing.metadata.targetAudience === filterAudience;

			return matchesSearch && matchesAudience;
		})
		.sort((a, b) => {
			switch (sortBy) {
				case 'articles':
					return b.totalArticles - a.totalArticles;
				case 'sections':
					return b.sections.length - a.sections.length;
				case 'date':
				default:
					return (
						new Date(b.savedAt).getTime() -
						new Date(a.savedAt).getTime()
					);
			}
		});

	const deleteBriefing = (id: string) => {
		const updatedBriefings = briefings.filter((b) => b.id !== id);
		setBriefings(updatedBriefings);
		localStorage.setItem(
			'savedNewsBriefings',
			JSON.stringify(updatedBriefings)
		);

		if (selectedBriefing?.id === id) {
			setSelectedBriefing(null);
		}
	};

	const toggleSection = (index: number) => {
		const newExpanded = new Set(expandedSections);
		if (newExpanded.has(index)) {
			newExpanded.delete(index);
		} else {
			newExpanded.add(index);
		}
		setExpandedSections(newExpanded);
	};

	const getImportanceColor = (importance: 'high' | 'medium' | 'low') => {
		switch (importance) {
			case 'high':
				return 'bg-red-100 text-red-800';
			case 'medium':
				return 'bg-yellow-100 text-yellow-800';
			case 'low':
				return 'bg-green-100 text-green-800';
		}
	};

	const exportBriefing = (briefing: SavedBriefing) => {
		const exportData = {
			...briefing,
			exportedAt: new Date().toISOString(),
		};

		const blob = new Blob([JSON.stringify(exportData, null, 2)], {
			type: 'application/json',
		});

		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `briefing-${briefing.id}.json`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	};

	// Simple placeholder for podcast generation
	const generatePodcast = (briefing: SavedBriefing) => {
		setGeneratingPodcast(briefing.id);
		// Simulate generation time
		setTimeout(() => {
			setGeneratingPodcast(null);
			alert('Podcast generation feature coming soon!');
		}, 2000);
	};

	// Placeholder audio control functions
	const playAudio = (briefingId: string) => {
		alert('Audio playback feature coming soon!');
	};

	const pauseAudio = (briefingId: string) => {
		alert('Audio controls feature coming soon!');
	};

	const stopAudio = (briefingId: string) => {
		alert('Audio controls feature coming soon!');
	};

	return (
		<div className='min-h-screen bg-background'>
			<div className='container mx-auto p-6'>
				<div className='mb-8'>
					<h1 className='text-3xl font-bold mb-4'>
						Local News Briefings
					</h1>
					<p className='text-muted-foreground'>
						Your generated news briefings are stored locally and
						organized by date.
					</p>
				</div>

				{/* Search and Filter Controls */}
				<div className='mb-6 space-y-4'>
					<div className='flex flex-col sm:flex-row gap-4'>
						<div className='relative flex-1'>
							<Search className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground' />
							<input
								type='text'
								placeholder='Search briefings...'
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
								className='w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent'
							/>
						</div>

						<div className='flex gap-2'>
							<select
								value={filterAudience}
								onChange={(e) =>
									setFilterAudience(e.target.value)
								}
								className='px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500'
							>
								<option value='all'>All Audiences</option>
								<option value='general'>General</option>
								<option value='business'>Business</option>
								<option value='technical'>Technical</option>
								<option value='academic'>Academic</option>
							</select>

							<select
								value={sortBy}
								onChange={(e) =>
									setSortBy(
										e.target.value as
											| 'date'
											| 'articles'
											| 'sections'
									)
								}
								className='px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500'
							>
								<option value='date'>Sort by Date</option>
								<option value='articles'>
									Sort by Articles
								</option>
								<option value='sections'>
									Sort by Sections
								</option>
							</select>
						</div>
					</div>
				</div>

				{briefings.length === 0 ? (
					<Card>
						<CardContent className='text-center py-12'>
							<FileText className='mx-auto h-12 w-12 text-muted-foreground mb-4' />
							<h3 className='text-lg font-semibold mb-2'>
								No Briefings Yet
							</h3>
							<p className='text-muted-foreground'>
								Generate news briefings from the News Dock to
								see them here.
							</p>
						</CardContent>
					</Card>
				) : (
					<div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
						{/* Briefings List */}
						<div className='space-y-4'>
							<h2 className='text-xl font-semibold'>
								{filteredBriefings.length} Briefing
								{filteredBriefings.length !== 1 ? 's' : ''}
							</h2>

							<ScrollArea className='h-[800px]'>
								<div className='space-y-4'>
									{filteredBriefings.map((briefing) => (
										<Card
											key={briefing.id}
											className={`cursor-pointer transition-all hover:shadow-md ${
												selectedBriefing?.id ===
												briefing.id
													? 'ring-2 ring-blue-500'
													: ''
											}`}
											onClick={() =>
												setSelectedBriefing(briefing)
											}
										>
											<CardHeader className='pb-3'>
												<div className='flex items-start justify-between'>
													<div className='flex-1'>
														<CardTitle className='text-lg mb-2'>
															{briefing.title}
														</CardTitle>
														<div className='flex flex-wrap gap-2 mb-2'>
															<Badge
																variant='secondary'
																className='text-xs'
															>
																{
																	briefing
																		.metadata
																		.targetAudience
																}
															</Badge>
															<Badge
																variant='outline'
																className='text-xs'
															>
																{
																	briefing
																		.metadata
																		.briefingType
																}
															</Badge>
														</div>
													</div>
													<div className='flex gap-1'>
														<Button
															variant='ghost'
															size='sm'
															onClick={(e) => {
																e.stopPropagation();
																generatePodcast(
																	briefing
																);
															}}
															disabled={
																generatingPodcast ===
																briefing.id
															}
															className='text-blue-500 hover:text-blue-700'
															title='Generate Podcast'
														>
															{generatingPodcast ===
															briefing.id ? (
																<Volume2 className='h-4 w-4 animate-pulse' />
															) : (
																<Mic className='h-4 w-4' />
															)}
														</Button>
														<Button
															variant='ghost'
															size='sm'
															onClick={(e) => {
																e.stopPropagation();
																deleteBriefing(
																	briefing.id
																);
															}}
															className='text-red-500 hover:text-red-700'
														>
															<Trash2 className='h-4 w-4' />
														</Button>
													</div>
												</div>
											</CardHeader>

											<CardContent className='pt-0'>
												<p className='text-sm text-muted-foreground mb-3 line-clamp-2'>
													{briefing.summary}
												</p>

												<div className='flex items-center gap-4 text-xs text-muted-foreground'>
													<div className='flex items-center gap-1'>
														<Calendar className='h-3 w-3' />
														{new Date(
															briefing.savedAt
														).toLocaleDateString()}
													</div>
													<div className='flex items-center gap-1'>
														<FileText className='h-3 w-3' />
														{briefing.totalArticles}{' '}
														articles
													</div>
													<div className='flex items-center gap-1'>
														<Users className='h-3 w-3' />
														{
															briefing.sections
																.length
														}{' '}
														sections
													</div>
												</div>
											</CardContent>
										</Card>
									))}
								</div>
							</ScrollArea>
						</div>

						{/* Briefing Details */}
						<div className='lg:sticky lg:top-6'>
							{selectedBriefing ? (
								<Card>
									<CardHeader>
										<div className='flex items-start justify-between'>
											<div>
												<CardTitle className='text-xl mb-2'>
													{selectedBriefing.title}
												</CardTitle>
												<div className='flex flex-wrap gap-2 mb-3'>
													<Badge variant='secondary'>
														{
															selectedBriefing
																.metadata
																.targetAudience
														}
													</Badge>
													<Badge variant='outline'>
														{
															selectedBriefing
																.metadata
																.briefingType
														}
													</Badge>
												</div>
											</div>
											<div className='flex gap-2'>
												{/* Podcast Generation Button */}
												<Button
													variant='outline'
													size='sm'
													onClick={() =>
														generatePodcast(
															selectedBriefing
														)
													}
													disabled={
														generatingPodcast ===
														selectedBriefing.id
													}
												>
													{generatingPodcast ===
													selectedBriefing.id ? (
														<>
															<Volume2 className='h-4 w-4 mr-2 animate-pulse' />
															Generating...
														</>
													) : (
														<>
															<Mic className='h-4 w-4 mr-2' />
															Generate Podcast
														</>
													)}
												</Button>

												{/* Audio Controls (placeholder buttons) */}
												<div className='flex gap-1'>
													<Button
														variant='outline'
														size='sm'
														onClick={() =>
															playAudio(
																selectedBriefing.id
															)
														}
													>
														<Play className='h-4 w-4' />
													</Button>
													<Button
														variant='outline'
														size='sm'
														onClick={() =>
															stopAudio(
																selectedBriefing.id
															)
														}
													>
														<Square className='h-4 w-4' />
													</Button>
												</div>

												{/* Export Button */}
												<Button
													variant='outline'
													size='sm'
													onClick={() =>
														exportBriefing(
															selectedBriefing
														)
													}
												>
													<Download className='h-4 w-4 mr-2' />
													Export
												</Button>
											</div>
										</div>

										<div className='flex items-center gap-4 text-sm text-muted-foreground'>
											<div className='flex items-center gap-1'>
												<Calendar className='h-4 w-4' />
												Generated:{' '}
												{new Date(
													selectedBriefing.generatedAt
												).toLocaleString()}
											</div>
											<div className='flex items-center gap-1'>
												<Clock className='h-4 w-4' />
												{(
													selectedBriefing.metadata
														.processingTime / 1000
												).toFixed(1)}
												s
											</div>
										</div>
									</CardHeader>

									<CardContent>
										<div className='mb-6'>
											<h3 className='font-semibold mb-2'>
												Executive Summary
											</h3>
											<p className='text-sm text-muted-foreground leading-relaxed'>
												{selectedBriefing.summary}
											</p>
										</div>

										<div className='mb-4'>
											<h3 className='font-semibold mb-2'>
												Overview
											</h3>
											<div className='grid grid-cols-3 gap-4 text-sm'>
												<div>
													<div className='font-medium'>
														{
															selectedBriefing.totalArticles
														}
													</div>
													<div className='text-muted-foreground'>
														Articles
													</div>
												</div>
												<div>
													<div className='font-medium'>
														{
															selectedBriefing
																.sections.length
														}
													</div>
													<div className='text-muted-foreground'>
														Sections
													</div>
												</div>
												<div>
													<div className='font-medium'>
														{
															selectedBriefing
																.sources.length
														}
													</div>
													<div className='text-muted-foreground'>
														Sources
													</div>
												</div>
											</div>
										</div>

										<ScrollArea className='h-[500px]'>
											<div className='space-y-4'>
												<h3 className='font-semibold mb-3'>
													Briefing Sections
												</h3>

												{selectedBriefing.sections.map(
													(section, index) => (
														<Card
															key={index}
															className='border-l-4 border-l-blue-500'
														>
															<CardHeader className='pb-2'>
																<div
																	className='flex items-center justify-between cursor-pointer'
																	onClick={() =>
																		toggleSection(
																			index
																		)
																	}
																>
																	<div className='flex items-center gap-2 flex-1'>
																		<Badge
																			className={`text-xs ${getImportanceColor(
																				section.importance
																			)}`}
																		>
																			{
																				section.importance
																			}
																		</Badge>
																		<h4 className='font-semibold text-sm'>
																			{
																				section.topic
																			}
																		</h4>
																	</div>
																	{expandedSections.has(
																		index
																	) ? (
																		<ChevronDown className='h-4 w-4' />
																	) : (
																		<ChevronRight className='h-4 w-4' />
																	)}
																</div>
																<h5 className='text-sm font-medium text-muted-foreground'>
																	{
																		section.headline
																	}
																</h5>
															</CardHeader>

															{expandedSections.has(
																index
															) && (
																<CardContent className='pt-0'>
																	<p className='text-sm mb-3 leading-relaxed'>
																		{
																			section.summary
																		}
																	</p>

																	<div className='mb-3'>
																		<h6 className='font-medium text-xs mb-2'>
																			Key
																			Points:
																		</h6>
																		<ul className='text-xs space-y-1'>
																			{section.keyPoints.map(
																				(
																					point,
																					pointIndex
																				) => (
																					<li
																						key={
																							pointIndex
																						}
																						className='flex items-start gap-2'
																					>
																						<span className='text-blue-500 mt-1'>
																							•
																						</span>
																						<span>
																							{
																								point
																							}
																						</span>
																					</li>
																				)
																			)}
																		</ul>
																	</div>

																	<div>
																		<h6 className='font-medium text-xs mb-2'>
																			Sources:
																		</h6>
																		<div className='space-y-1'>
																			{section.sources.map(
																				(
																					source,
																					sourceIndex
																				) => (
																					<div
																						key={
																							sourceIndex
																						}
																						className='text-xs'
																					>
																						<a
																							href={
																								source.link
																							}
																							target='_blank'
																							rel='noopener noreferrer'
																							className='text-blue-600 hover:text-blue-800 flex items-center gap-1'
																						>
																							<span className='truncate'>
																								{
																									source.title
																								}
																							</span>
																							<ExternalLink className='h-3 w-3 flex-shrink-0' />
																						</a>
																						<div className='text-muted-foreground'>
																							{
																								source.source
																							}
																						</div>
																					</div>
																				)
																			)}
																		</div>
																	</div>
																</CardContent>
															)}
														</Card>
													)
												)}
											</div>
										</ScrollArea>
									</CardContent>
								</Card>
							) : (
								<Card>
									<CardContent className='text-center py-12'>
										<FileText className='mx-auto h-12 w-12 text-muted-foreground mb-4' />
										<h3 className='text-lg font-semibold mb-2'>
											Select a Briefing
										</h3>
										<p className='text-muted-foreground'>
											Choose a briefing from the list to
											view its details.
										</p>
									</CardContent>
								</Card>
							)}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
