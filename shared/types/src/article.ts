export interface BaseArticlePreview {
	title: string;
	link: string;
	timestamp?: string;
	id?: string;
}

export interface MediaContent {
	type: 'image' | 'video' | 'audio' | 'none';
	url: string;
	caption?: string;
	altText?: string;
	credit?: string;
}

export interface ArticleContent {
	fullText: string;
	paragraphs: string[];
	wordCount: number;
	readingTime: number;
}

export interface ArticleMetadata {
	language: string;
	source: string;
	sourceUrl: string;
	canonical: string;
	ogData?: Record<string, string>;
	twitterData?: Record<string, string>;
}

export interface StructuredArticle {
	url: string;
	title: string;
	subtitle?: string;
	author?: string;
	publishDate?: string;
	lastModified?: string;
	category?: string;
	tags?: string[];
	summary?: string;
	content: ArticleContent;
	media?: MediaContent[];
	metadata: ArticleMetadata;
	timestamp: string;
}
