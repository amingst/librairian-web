import { IMCPTool } from '@shared/backend';
import { WebpageSearchTool } from '../tools/WebpageSearch.js';
import { SingleSiteScraperTool } from '../tools/SingleSiteScraper.js';
import { WebpageMetadataTool } from '../tools/WebpageMetadata.js';
import { ArticleExtractorTool } from '../tools/ArticleExtractor.js';
import { NewsHomepageTool } from '../tools/NewsHomepage.js';
import { NewsPipelineTool } from '../tools/NewsPipelineTool.js';
import { FirecrawlNewsHomepageTool } from '../tools/FirecrawlNewsHomepage.js';
import { TYPES } from './symbols.js';
import { PrismaClient } from '@prisma/client'; // Import PrismaClient

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
	WebpageSearch: WebpageSearchTool,
	SingleSiteScraper: SingleSiteScraperTool,
	WebpageMetadata: WebpageMetadataTool,
	ArticleExtractor: ArticleExtractorTool,
	NewsHomepage: NewsHomepageTool,
	NewsPipeline: NewsPipelineTool,
	FirecrawlNewsHomepage: FirecrawlNewsHomepageTool,
};
