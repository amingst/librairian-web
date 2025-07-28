// API response types and generic wrappers

import { NewsArticlePreview } from "./news";

export interface ScrapingResponse<T> {
	data: T;
	metadata: {
		site: string;
		scrapedAt: Date;
		totalFound: number;
		totalReturned: number;
		processingTime: number;
	};
	errors?: string[];
	warnings?: string[];
}

export interface MultiSiteScrapingResponse<T> {
	data: T;
	metadata: {
		sites: string[];
		scrapedAt: Date;
		totalSites: number;
		totalFound: number;
		totalReturned: number;
		processingTime: number;
	};
	errors?: string[];
	warnings?: string[];
}

export interface NewsHomepageResult
	extends ScrapingResponse<NewsArticlePreview[]> {
	data: NewsArticlePreview[];
}

export interface MultiSiteNewsHomepageResult
	extends MultiSiteScrapingResponse<Record<string, NewsArticlePreview[]>> {
	data: Record<string, NewsArticlePreview[]>;
}
