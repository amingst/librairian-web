import * as dotenv from 'dotenv';

dotenv.config();
export default {
	openaiKey: process.env.OPENAI_API_KEY,
	xaiKey: process.env.XAI_API_KEY,
	anthropicKey: process.env.ANTHROPIC_API_KEY,
	firecrawlKey: process.env.FIRECRAWL_API_KEY,
	port: parseInt(process.env.PORT || '3001'),
	host: process.env.HOST || 'localhost',
	nodeEnv: process.env.NODE_ENV || 'development',
	databaseUrl:
		process.env.DATABASE_URL ||
		'postgresql://postgres:postgres@localhost:5432/news_scraper_dev',
	webhookBaseUrl:
		process.env.WEBHOOK_BASE_URL || 'https://409c6bffabf6.ngrok-free.app',
	webhooks: {
		homepage: process.env.HOMEPAGE_WEBHOOK_URL || undefined,
		article: process.env.ARTICLE_WEBHOOK_URL || undefined,
	},
	defaultUseOpenAI: process.env.DEFAULT_USE_OPENAI === 'true',
	defaultMaxGroups: parseInt(process.env.DEFAULT_MAX_GROUPS || '8'),
	defaultMinArticlesPerGroup: parseInt(
		process.env.DEFAULT_MIN_ARTICLES_PER_GROUP || '2'
	),
};
