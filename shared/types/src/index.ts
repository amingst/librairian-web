// Article types
export type {
	BaseArticlePreview,
	MediaContent,
	ArticleContent,
	ArticleMetadata,
	StructuredArticle,
} from './article.js';

// News types
export type {
	NewsMediaContent,
	ArticleMetrics,
	SourceInformation,
	NewsArticlePreview,
	SiteSelectors,
	SiteConfig,
	NewsSource,
	NewsSourceDetails,
} from './news.js';

// Scraping types
export type {
	LinkData,
	ImageData,
	HeadingData,
	ScrapedContent,
	PageMetadata,
} from './scraping.js';

// Search types
export type { SearchMatch, SearchResult } from './search.js';

// Response types
export type { ScrapingResponse, NewsHomepageResult } from './response.js';
