// Content search and text analysis types

export interface SearchResult {
	url: string;
	query: string;
	matches_found: number;
	matches: SearchMatch[];
	timestamp: string;
}

export interface SearchMatch {
	index: number;
	context: string;
}