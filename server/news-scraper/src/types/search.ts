// Content search related types

export interface SearchContentParams {
	url: string;
	query: string;
	case_sensitive?: boolean;
	context_chars?: number;
	max_results?: number;
}
