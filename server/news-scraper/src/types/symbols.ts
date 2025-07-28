export const TYPES = {
	NewsScraperServer: Symbol.for('NewsScraperServer'),
	WebpageSearch: Symbol.for('WebpageSearch'),
	SingleSiteScraper: Symbol.for('SingleSiteScraper'),
	WebpageMetadata: Symbol.for('WebpageMetadata'),
	ArticleExtractor: Symbol.for('ArticleExtractor'),
	NewsHomepage: Symbol.for('NewsHomepage'),
	NewsPipeline: Symbol.for('NewsPipeline'),
	FirecrawlNewsHomepage: Symbol.for('FirecrawlNewsHomepage'),
	Config: Symbol.for('Config'),
	PrismaClient: Symbol.for('PrismaClient'),
} as const;
