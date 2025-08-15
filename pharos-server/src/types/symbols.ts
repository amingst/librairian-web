export const TYPES = {
	Config: Symbol.for('Config'),
	PrismaClient: Symbol.for('PrismaClient'),
	StartHomepageFirecrawlJob: Symbol.for('StartHomepageFirecrawlJob'),
	StartFirecrawlExtractArticleJob: Symbol.for(
		'StartFirecrawlExtractArticleJob'
	),
	StartHomepageHtmlScraperJob: Symbol.for('StartHomepageHtmlScraperJob'),
	StartArticleHtmlScraperJob: Symbol.for('StartArticleHtmlScraperJob'),
	ArticleGrouper: Symbol.for('ArticleGrouper'),
	TextAnalysis: Symbol.for('TextAnalysis'),
	CurrentEventsDetector: Symbol.for('CurrentEventsDetector'),
	BatchArticleExtractor: Symbol.for('BatchArticleExtractor'),
	NewsBriefing: Symbol.for('NewsBriefing'),
	ArticleSummarizer: Symbol.for('ArticleSummarizer'),
	NewsBriefingFromSummaries: Symbol.for('NewsBriefingFromSummaries'),
	BriefingRag: Symbol.for('BriefingRag'),
} as const;
