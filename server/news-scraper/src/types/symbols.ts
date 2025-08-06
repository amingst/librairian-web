import { StartHomepageFirecrawlJob } from '../tools/StartHomepageFirecrawlJob.js';
import { StartFirecrawlExtractArticleJob } from '../tools/StartFirecrawlExtractArticleJob.js';
import { StartHomepageHtmlScraperJob } from '../tools/StartHomepageHtmlScraperJob.js';
import { StartArticleHtmlScraperJob } from '../tools/StartArticleHtmlScraperJob.js';

export const TYPES = {
	Config: Symbol.for('Config'),
	PrismaClient: Symbol.for('PrismaClient'),
	StartHomepageFirecrawlJob: Symbol.for('StartHomepageFirecrawlJob'),
	StartFirecrawlExtractArticleJob: Symbol.for(
		'StartFirecrawlExtractArticleJob'
	),
	StartHomepageHtmlScraperJob: Symbol.for('StartHomepageHtmlScraperJob'),
	StartArticleHtmlScraperJob: Symbol.for('StartArticleHtmlScraperJob'),
} as const;
