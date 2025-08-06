import * as dotenv from 'dotenv';

dotenv.config();

export default {
	openaiKey: process.env.OPENAI_API_KEY,
	port: parseInt(process.env.PORT || '3002'),
	host: process.env.HOST || 'localhost',
	nodeEnv: process.env.NODE_ENV || 'development',
	defaultUseOpenAI: process.env.DEFAULT_USE_OPENAI === 'true',
	defaultMaxGroups: parseInt(process.env.DEFAULT_MAX_GROUPS || '8'),
	defaultMinArticlesPerGroup: parseInt(
		process.env.DEFAULT_MIN_ARTICLES_PER_GROUP || '2'
	),
	databaseUrl:
		process.env.DATABASE_URL ||
		'postgresql://postgres:postgres@localhost:5432/news_scraper_dev',
};
