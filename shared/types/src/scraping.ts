// General web scraping and content extraction types

export interface LinkData {
	text: string;
	url: string;
	title?: string;
}

export interface ImageData {
	src: string;
	alt: string;
	title?: string;
}



export interface HeadingData {
	level: number;
	text: string;
}

/**
 * Basic scraped content structure
 */
export interface ScrapedContent {
  url: string;
  title: string;
  content: string;
  text?: string;
  html?: string;
  links?: LinkData[];
  images?: ImageData[];
  headings?: HeadingData[];
  timestamp?: string;
}

export interface PageMetadata {
	url: string;
	title: string;
	description: string;
	keywords: string;
	author: string;
	canonical: string;
	language: string;
	timestamp: string;
	headings: HeadingData[];
	openGraph?: Record<string, string>;
	twitter?: Record<string, string>;
}
