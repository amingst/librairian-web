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
};
