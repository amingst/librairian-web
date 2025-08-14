'use server';

import { cookies } from 'next/headers';

// TODO: Implement Redis
export async function getBriefings(limit: number | null) {
	try {
		const cookieStore = await cookies();
		const briefingsJson = await cookieStore.get('local-briefings')?.value;

		if (!briefingsJson) {
			return [];
		}

		let briefings = JSON.parse(briefingsJson);

		if (limit) {
			briefings = briefings.slice(0, limit);
		}

		return briefings;
	} catch (error) {
		console.error('Error fetching briefings:', error);
		return [];
	}
}

export async function getBriefing(id: string) {
	try {
		const cookieStore = await cookies();
		const briefingsJson = await cookieStore.get('local-briefings')?.value;
		if (!briefingsJson) {
			return null;
		}

		const briefings = JSON.parse(briefingsJson);
		return briefings.find((b: any) => b.id === id) || null;
	} catch (error) {
		console.error('Error fetching briefing:', error);
		return null;
	}
}

export interface BriefingSection {
	topic: string;
	headline: string;
	summary: string;
	keyPoints: string[];
	sources: Array<{ title: string; link: string; source: string }>;
	importance: 'high' | 'medium' | 'low';
}

export interface NewsBriefing {
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

export async function createBriefing(params: NewsBriefing) {
	const cookieStore = await cookies();
	const currentBriefings = await getBriefings(null);

	const newBriefing = {
		...params,
		createdAt: params.createdAt || new Date().toISOString(),
	};

	cookieStore.set(
		'local-briefings',
		JSON.stringify([...currentBriefings, newBriefing])
	);

	return newBriefing;
}

export async function deleteBriefing(id: string) {
	try {
		const cookieStore = await cookies();
		const currentBriefings = await getBriefings(null);

		const updatedBriefings = currentBriefings.filter(
			(b: any) => b.id !== id
		);
		cookieStore.set('local-briefings', JSON.stringify(updatedBriefings));
	} catch (error) {
		console.error('Error deleting briefing:', error);
	}
}
