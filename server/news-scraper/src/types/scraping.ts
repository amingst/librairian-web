// Web scraping related types

export interface ScrapeWebpageParams {
	url: string;
	selector?: string;
	extract_text?: boolean;
	extract_links?: boolean;
	extract_images?: boolean;
	max_content_length?: number;
}

export interface ExtractMetadataParams {
	url: string;
}
