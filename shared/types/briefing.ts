export interface BriefingSection {
	topic: string;
	headline: string;
	summary: string;
	keyPoints: string[];
	sources: Array<{ title: string; link: string; source: string }>;
	importance: 'high' | 'medium' | 'low';
}

export interface NewsBriefing {
	id?: string;
	title: string;
	createdAt?: string;
	url?: string;
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
