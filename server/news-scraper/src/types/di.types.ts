import { IMCPTool } from '@shared/backend';
import { TYPES } from './symbols.js';
import { PrismaClient } from '@prisma/client'; // Import PrismaClient
import { StartHomepageFirecrawlJob } from '../tools/StartHomepageFirecrawlJob.js';
import { StartFirecrawlExtractArticleJob } from '../tools/StartFirecrawlExtractArticleJob.js';
import { StartHomepageHtmlScraperJob } from '../tools/StartHomepageHtmlScraperJob.js';
import { StartArticleHtmlScraperJob } from '../tools/StartArticleHtmlScraperJob.js';

export { TYPES };

// Define types
export type ToolConstructor = new (...args: any[]) => IMCPTool;
export type ToolKeys = Exclude<
	keyof typeof TYPES,
	'NewsScraperServer' | 'Config' | 'PrismaClient'
>;
export type ToolMap = {
	[K in ToolKeys]: ToolConstructor;
};

// Define tool map
export const TOOL_MAP: ToolMap = {
	StartHomepageFirecrawlJob: StartHomepageFirecrawlJob, // Homepage scraping with Firecrawl
	StartFirecrawlExtractArticleJob: StartFirecrawlExtractArticleJob, // Article extraction with Firecrawl
	StartHomepageHtmlScraperJob: StartHomepageHtmlScraperJob, // Homepage scraping with local HTML parser
	StartArticleHtmlScraperJob: StartArticleHtmlScraperJob, // Article content extraction with local HTML parser
};
