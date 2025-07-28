// News-specific types for homepage scraping and site configuration

import { BaseArticlePreview } from './article.js';

export interface NewsMediaContent {
	type: 'image' | 'video' | 'audio' | 'none';
	url?: string;
	alt?: string;
	caption?: string;
	thumbnail?: string;
}

export interface ArticleMetrics {
	readTime?: number;
	wordCount?: number;
	publishedAt?: Date;
	updatedAt?: Date;
}

export interface SourceInformation {
	site: string;
	domain: string;
	section?: string;
	author?: string;
}

export interface NewsArticlePreview extends BaseArticlePreview {
	media?: NewsMediaContent;
	source: SourceInformation;
	metrics?: ArticleMetrics;
	excerpt?: string;
	tags?: string[];
	category?: string;
	priority?: 'low' | 'medium' | 'high' | 'breaking';
}

export interface SiteConfig {
	domain: string;
	name: string;
	selectors: SiteSelectors;
	rateLimit?: number; // requests per minute
	userAgent?: string;
	headers?: Record<string, string>;
}

export interface SiteSelectors {
	container: string | string[];
	title: string | string[];
	link: string | string[];
	image?: string | string[];
	section?: string | string[];
	video?: string | string[];
	author?: string | string[];
	publishDate?: string | string[];
	excerpt?: string | string[];
	category?: string | string[];
}

export interface NewsSource {
	id: string;
	name: string;
	icon?: string; // URL to icon image
	category: string;
	method: string;
}

export interface NewsSourceDetails extends NewsSource {
	url: string;
	selectors: {
		linkFilter: string;
		[key: string]: any;
	};
}
