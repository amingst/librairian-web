import { StartHomepageFirecrawlJob } from '../tools/StartHomepageFirecrawlJob.js';
import { StartFirecrawlExtractArticleJob } from '../tools/StartFirecrawlExtractArticleJob.js';

export const TYPES = {
	Config: Symbol.for('Config'),
	PrismaClient: Symbol.for('PrismaClient'),
	StartHomepageFirecrawlJob: Symbol.for('StartHomepageFirecrawlJob'),
	StartFirecrawlExtractArticleJob: Symbol.for(
		'StartFirecrawlExtractArticleJob'
	),
} as const;
