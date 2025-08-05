import * as dotenv from 'dotenv';

dotenv.config();
export default {
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
};
