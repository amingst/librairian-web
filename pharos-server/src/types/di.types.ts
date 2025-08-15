import { IMCPTool, IMCPPrompt, IMCPResource } from '@shared/backend';
import { TYPES } from './symbols.js';
import { StartHomepageFirecrawlJob } from '../tools/StartHomepageFirecrawlJob.js';
import { StartFirecrawlExtractArticleJob } from '../tools/StartFirecrawlExtractArticleJob.js';
import { StartHomepageHtmlScraperJob } from '../tools/StartHomepageHtmlScraperJob.js';
import { StartArticleHtmlScraperJob } from '../tools/StartArticleHtmlScraperJob.js';
import { ArticleGrouperTool } from '../tools/ArticleGrouper.js';
import { TextAnalysisTool } from '../tools/TextAnalysis.js';
import { CurrentEventsDetectorTool } from '../tools/CurrentEventsDetector.js';
import { BatchArticleExtractorTool } from '../tools/BatchArticleExtractor.js';
import { NewsBriefingTool } from '../tools/NewsBriefingTool.js';
import { ArticleSummarizerTool } from '../tools/ArticleSummarizer.js';
import { NewsBriefingFromSummariesTool } from '../tools/NewsBriefingFromSummariesTool.js';
import { BriefingRagTool } from '../tools/BriefingRagTool.js';

export { TYPES };

// Define types
export type ToolConstructor = new (...args: any[]) => IMCPTool;
export type PromptContsructor = new (...args: any[]) => IMCPPrompt;
export type ResourceConstructor = new (...args: any[]) => IMCPResource;
export type ToolKeys = Exclude<
	keyof typeof TYPES,
	'NewsScraperServer' | 'Config' | 'PrismaClient'
>;
export type PromptKeys = Exclude<keyof typeof TYPES, 'Config' | 'PrismaClient'>;
export type ResourceKeys = Exclude<
	keyof typeof TYPES,
	'Config' | 'PrismaClient'
>;
export type ToolMap = {
	[K in ToolKeys]: ToolConstructor;
};
export type PromptMap = {
	[K in PromptKeys]: PromptContsructor;
};
export type ResourceMap = {
	[K in ResourceKeys]: ResourceConstructor;
};

// Define tool map
export const TOOL_MAP: ToolMap = {
	StartHomepageFirecrawlJob: StartHomepageFirecrawlJob,
	StartFirecrawlExtractArticleJob: StartFirecrawlExtractArticleJob,
	StartHomepageHtmlScraperJob: StartHomepageHtmlScraperJob,
	StartArticleHtmlScraperJob: StartArticleHtmlScraperJob,
	ArticleGrouper: ArticleGrouperTool,
	TextAnalysis: TextAnalysisTool,
	CurrentEventsDetector: CurrentEventsDetectorTool,
	BatchArticleExtractor: BatchArticleExtractorTool,
	NewsBriefing: NewsBriefingTool,
	ArticleSummarizer: ArticleSummarizerTool,
	NewsBriefingFromSummaries: NewsBriefingFromSummariesTool,
	BriefingRag: BriefingRagTool,
};

// export const PROMPT_MAP: PromptMap = {};
