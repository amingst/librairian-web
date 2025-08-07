import z from 'zod';
import { MCPTool } from '@shared/backend';
import { NewsArticlePreview } from '@shared/types';
import { injectable, inject } from 'inversify';
import { TYPES } from '../types/symbols.js';
import { ArticleGrouperTool } from './ArticleGrouper.js';
import OpenAI from 'openai';
import config from '../config.js';
import { promptLoader } from '../utils/PromptLoader.js';
import { PrismaClient } from '@prisma/client';
import { PrismaClientFactory } from '@shared/backend';

const NewsBriefingSchema = z
	.object({
		articles: z
			.array(
				z.object({
					id: z.string().optional(),
					title: z.string(),
					link: z.string().url(),
					excerpt: z.string().optional(),
					source: z.object({
						site: z.string(),
						domain: z.string(),
						section: z.string().optional(),
					}),
					publishDate: z.string().optional(),
				})
			)
			.optional()
			.describe(
				'Array of news articles to create briefing from (optional if ids provided)'
			),
		ids: z
			.array(z.string())
			.optional()
			.describe('Array of article/post IDs to load from the database'),
		briefingType: z
			.enum(['executive', 'detailed', 'summary'])
			.default('summary')
			.describe('Type of briefing to generate'),
		targetAudience: z
			.enum(['general', 'business', 'technical', 'academic'])
			.default('general')
			.describe('Target audience for the briefing'),
		includeSourceAttribution: z
			.boolean()
			.default(true)
			.describe('Whether to include source links and citations'),
		maxSections: z
			.number()
			.min(3)
			.max(20)
			.default(10)
			.describe(
				'Maximum number of sections in the briefing (ignored if includeAllSections=true)'
			),
		prioritizeTopics: z
			.array(z.string())
			.optional()
			.describe('Topics to prioritize in the briefing'),
		includeAllSections: z
			.boolean()
			.default(true)
			.describe(
				'If true (default) include all generated sections and ignore maxSections slice'
			),
	})
	.refine(
		(data) =>
			(data.articles && data.articles.length) ||
			(data.ids && data.ids.length),
		{
			message: 'Either articles or ids must be provided',
		}
	);

interface BriefingSection {
	topic: string;
	headline: string;
	summary: string;
	keyPoints: string[];
	sources: Array<{
		title: string;
		link: string;
		source: string;
	}>;
	importance: 'high' | 'medium' | 'low';
}

interface NewsBriefing {
	title: string;
	generatedAt: string;
	summary: string;
	sections: BriefingSection[];
	totalArticles: number;
	sources: string[];
	metadata: {
		briefingType: string;
		targetAudience: string;
		processingTime: number;
	};
}

@injectable()
export class NewsBriefingTool extends MCPTool {
	private openai: OpenAI;
	private audienceContexts: Record<string, string> = {};
	private detailLevels: Record<string, string> = {};
	private audienceTitles: Record<string, string> = {};
	private prisma: PrismaClient;

	constructor(
		@inject(TYPES.ArticleGrouper) private articleGrouper: ArticleGrouperTool
	) {
		super();

		if (!config.openaiKey || config.openaiKey === '') {
			throw new Error('OPENAI_API_KEY is not set');
		}

		this.openai = new OpenAI({
			apiKey: config.openaiKey,
		});

		// Load configuration data
		this.loadConfigData();

		this.prisma = PrismaClientFactory.getInstance('news-sources');

		console.log('✅ News Briefing Tool initialized');
	}

	private async loadConfigData(): Promise<void> {
		try {
			this.audienceContexts = await promptLoader.loadConfig(
				'shared/audience-contexts.json'
			);
			this.detailLevels = await promptLoader.loadConfig(
				'shared/detail-levels.json'
			);
			this.audienceTitles = await promptLoader.loadConfig(
				'shared/audience-titles.json'
			);
		} catch (error) {
			console.warn(
				'⚠️ Could not load prompt configs, using fallbacks:',
				error
			);
			// Fallback values in case files aren't available
			this.audienceContexts = {
				policymaker:
					'Focus on regulatory implications, policy precedents, and legislative considerations.',
				business:
					'Highlight market impacts, competitive dynamics, and strategic business implications.',
				academic:
					'Provide analytical depth, historical context, and research implications.',
				general:
					'Present information in accessible terms with broad context.',
			};
			this.detailLevels = {
				brief: 'concise',
				standard: 'balanced',
				detailed: 'comprehensive',
			};
			this.audienceTitles = {
				policymaker: 'Policy Briefing',
				business: 'Business Intelligence Report',
				academic: 'Research Brief',
				general: 'News Summary',
			};
		}
	}
	get name(): string {
		return 'create_news_briefing';
	}

	get description(): string {
		return 'Creates a comprehensive news briefing from a collection of articles, organizing them by topics and generating executive summaries';
	}

	get inputSchema(): z.ZodSchema {
		return NewsBriefingSchema;
	}

	get schema(): z.ZodSchema {
		return NewsBriefingSchema;
	}

	async execute(
		params: z.infer<typeof NewsBriefingSchema>
	): Promise<NewsBriefing> {
		const startTime = Date.now();

		let workingArticles = params.articles;
		if (!workingArticles && params.ids) {
			// Load posts from DB by IDs
			const posts = await this.prisma.post.findMany({
				where: { id: { in: params.ids } },
				include: { source: true },
			});

			workingArticles = posts.map((p) => {
				let domain: string;
				try {
					domain = new URL(p.webUrl).hostname;
				} catch {
					domain = 'unknown';
				}
				return {
					id: p.id,
					title: p.title || 'Untitled',
					link: p.webUrl,
					excerpt: (p.articleText || '').slice(0, 1000),
					source: {
						site: p.source?.name || domain,
						domain,
						section: undefined,
					},
					publishDate: undefined,
				};
			});
		}

		if (!workingArticles || workingArticles.length === 0) {
			throw new Error('No articles resolved from provided input');
		}

		try {
			console.log(
				`📰 Creating ${params.briefingType} briefing for ${
					workingArticles.length
				} articles (input mode: ${params.ids ? 'ids' : 'articles'})`
			);

			// Step 1: Group articles by topics
			const groupedArticles = await this.articleGrouper.execute({
				articles: workingArticles,
				options: {
					maxGroups: params.includeAllSections
						? 50
						: params.maxSections,
					minArticlesPerGroup: 1,
					useOpenAI: true,
					extractFullContent: true,
					minContentLength: 50,
					skipContentFiltering: false,
				},
			});
			console.log(
				`🗂️ Grouped articles into ${
					Object.keys(groupedArticles).length
				} topics`
			);

			// Step 2: Generate briefing sections for each group
			const sections = await this.generateBriefingSections(
				groupedArticles,
				{ ...params, articles: workingArticles }
			);

			// Step 3: Create overall briefing summary
			const briefingSummary = await this.generateBriefingSummary(
				sections,
				params
			);

			// Step 4: Compile final briefing
			const allSections = sections.sort(
				(a, b) =>
					this.getImportanceScore(b.importance) -
					this.getImportanceScore(a.importance)
			);

			const finalSections = params.includeAllSections
				? allSections
				: allSections.slice(0, params.maxSections);

			// Step 4: Compile final briefing
			const briefing: NewsBriefing = {
				title: this.generateBriefingTitle(params.targetAudience),
				generatedAt: new Date().toISOString(),
				summary: briefingSummary,
				sections: finalSections,
				totalArticles: workingArticles.length,
				sources: [
					...new Set(workingArticles.map((a) => a.source.site)),
				],
				metadata: {
					briefingType: params.briefingType,
					targetAudience: params.targetAudience,
					processingTime: Date.now() - startTime,
				},
			};

			console.log(
				`✅ News briefing created with ${
					briefing.sections.length
				} sections (input mode: ${params.ids ? 'ids' : 'articles'})`
			);

			return briefing;
		} catch (error) {
			console.error('❌ Error creating news briefing:', error);
			throw error;
		}
	}

	private async generateBriefingSections(
		groupedArticles: Record<string, NewsArticlePreview[]>,
		params: z.infer<typeof NewsBriefingSchema>
	): Promise<BriefingSection[]> {
		const sections: BriefingSection[] = [];

		for (const [topic, articles] of Object.entries(groupedArticles)) {
			if (articles.length === 0) continue;

			console.log(
				`📝 Generating section for: ${topic} (${articles.length} articles)`
			);

			const section = await this.generateSectionContent(
				topic,
				articles,
				params
			);
			sections.push(section);
		}

		return sections;
	}

	private async generateSectionContent(
		topic: string,
		articles: NewsArticlePreview[],
		params: z.infer<typeof NewsBriefingSchema>
	): Promise<BriefingSection> {
		const articlesText = articles
			.map((article, idx) => {
				const content = article.excerpt || '';
				return `Article ${idx + 1}: "${article.title}" (${
					article.source.site
				})\n${content.substring(0, 1000)}...\n---`;
			})
			.join('\n');

		// Get the prompt template and interpolate values
		const promptTemplate = await promptLoader.loadPromptTemplate(
			'news-briefing/section-generation.txt'
		);
		const prompt = promptLoader.interpolateTemplate(promptTemplate, {
			targetAudience: params.targetAudience,
			topic: topic,
			articleCount: articles.length.toString(),
			articlesText: articlesText,
			detailLevel: this.detailLevels[params.briefingType] || 'balanced',
			audienceContext:
				this.audienceContexts[params.targetAudience] ||
				this.audienceContexts.general,
		});

		try {
			const response = await this.openai.chat.completions.create({
				model: 'gpt-3.5-turbo',
				messages: [{ role: 'user', content: prompt }],
				temperature: 0.3,
				max_tokens: 800,
			});

			const content = response.choices[0]?.message?.content;
			if (!content) {
				throw new Error('No response from OpenAI');
			}

			const sectionData = JSON.parse(content);

			return {
				topic,
				headline: sectionData.headline,
				summary: sectionData.summary,
				keyPoints: sectionData.keyPoints,
				sources: articles.map((article) => ({
					title: article.title,
					link: article.link,
					source: article.source.site,
				})),
				importance: sectionData.importance,
			};
		} catch (error) {
			console.error(`Error generating section for ${topic}:`, error);
			// Fallback section
			return {
				topic,
				headline: `${topic} Updates`,
				summary: `Latest developments in ${topic} based on ${articles.length} recent articles.`,
				keyPoints: articles.slice(0, 3).map((a) => a.title),
				sources: articles.map((article) => ({
					title: article.title,
					link: article.link,
					source: article.source.site,
				})),
				importance: 'medium' as const,
			};
		}
	}

	private async generateBriefingSummary(
		sections: BriefingSection[],
		params: z.infer<typeof NewsBriefingSchema>
	): Promise<string> {
		const sectionsContent = sections
			.map((s) => `${s.topic}: ${s.summary}`)
			.join('\n');

		// Get the prompt template and interpolate values
		const promptTemplate = await promptLoader.loadPromptTemplate(
			'news-briefing/executive-summary.txt'
		);
		const prompt = promptLoader.interpolateTemplate(promptTemplate, {
			targetAudience: params.targetAudience,
			sectionsContent: sectionsContent,
			audienceContext:
				this.audienceContexts[params.targetAudience] ||
				this.audienceContexts.general,
		});

		try {
			const response = await this.openai.chat.completions.create({
				model: 'gpt-3.5-turbo',
				messages: [{ role: 'user', content: prompt }],
				temperature: 0.3,
				max_tokens: 200,
			});

			return (
				response.choices[0]?.message?.content ||
				'News briefing covering current developments across multiple topics.'
			);
		} catch (error) {
			console.error('Error generating briefing summary:', error);
			return `This ${params.briefingType} briefing covers ${sections.length} key topics from recent news developments.`;
		}
	}

	private generateBriefingTitle(audience: string): string {
		const now = new Date();
		const dateStr = now.toLocaleDateString('en-US', {
			weekday: 'long',
			year: 'numeric',
			month: 'long',
			day: 'numeric',
		});

		const title =
			this.audienceTitles[audience] ||
			this.audienceTitles.general ||
			'News Summary';
		return `${title} - ${dateStr}`;
	}

	private getImportanceScore(importance: 'high' | 'medium' | 'low'): number {
		switch (importance) {
			case 'high':
				return 3;
			case 'medium':
				return 2;
			case 'low':
				return 1;
		}
	}
}
