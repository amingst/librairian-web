import { ArticleGrouperTool } from '../tools/ArticleGrouper.js';
import { TextAnalysisTool } from '../tools/TextAnalysis.js';
import { CurrentEventsDetectorTool } from '../tools/CurrentEventsDetector.js';
import { BatchArticleExtractorTool } from '../tools/BatchArticleExtractor.js';
import { TYPES } from './symbols.js';
import type { IMCPTool } from '@shared/backend';

export { TYPES };

// Define types
export type ToolConstructor = new (...args: any[]) => IMCPTool;

export type ToolKeys = Exclude<
	keyof typeof TYPES,
	'TextAnalysisServer' | 'Config' | 'PrismaClient'
>;

export type ToolMap = {
	[K in ToolKeys]: ToolConstructor;
};

// Define tool map with type assertion to bypass the type checking
// This is safe because we know these classes implement IMCPTool at runtime
export const TOOL_MAP: ToolMap = {
	ArticleGrouper: ArticleGrouperTool as unknown as ToolConstructor,
	TextAnalysis: TextAnalysisTool as unknown as ToolConstructor,
	CurrentEventsDetector:
		CurrentEventsDetectorTool as unknown as ToolConstructor,
	BatchArticleExtractor:
		BatchArticleExtractorTool as unknown as ToolConstructor,
};
