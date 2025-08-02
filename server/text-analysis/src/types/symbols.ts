export const TYPES = {
	TextAnalysisServer: Symbol.for('TextAnalysisServer'),
	ArticleGrouper: Symbol.for('ArticleGrouper'),
	TextAnalysis: Symbol.for('TextAnalysis'),
	CurrentEventsDetector: Symbol.for('CurrentEventsDetector'),
	BatchArticleExtractor: Symbol.for('BatchArticleExtractor'),
	NewsBriefing: Symbol.for('NewsBriefing'),
	Config: Symbol.for('Config'),
	PrismaClient: Symbol.for('PrismaClient'),
} as const;
