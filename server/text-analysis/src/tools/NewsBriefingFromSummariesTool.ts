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

const BriefingFromSummariesSchema = z
	.object({
		articles: z
			.array(
				z.object({
					id: z.string().optional(),
					title: z.string(),
					link: z.string().url(),
					excerpt: z.string().optional(), // will be summary text
					source: z.object({
						site: z.string(),
						domain: z.string(),
						section: z.string().optional(),
					}),
					publishDate: z.string().optional(),
				})
			)
			.optional(),
		ids: z.array(z.string()).optional(),
		briefingType: z
			.enum(['executive', 'detailed', 'summary'])
			.default('summary'),
		targetAudience: z
			.enum(['general', 'business', 'technical', 'academic'])
			.default('general'),
		includeSourceAttribution: z.boolean().default(true),
		maxSections: z.number().min(3).max(20).default(10),
		prioritizeTopics: z.array(z.string()).optional(),
		includeAllSections: z.boolean().default(true),
	})
	.refine(
		(data) => (data.articles && data.articles.length) || (data.ids && data.ids.length),
		{ message: 'Either articles or ids must be provided' }
	);

interface BriefingSection {
	topic: string;
	headline: string;
	summary: string;
	keyPoints: string[];
	sources: Array<{ title: string; link: string; source: string }>;
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
		mode: 'summaries';
	};
}

@injectable()
export class NewsBriefingFromSummariesTool extends MCPTool {
	private openai: OpenAI;
	private audienceContexts: Record<string, string> = {};
	private detailLevels: Record<string, string> = {};
	private audienceTitles: Record<string, string> = {};
	private prisma: PrismaClient;

	constructor(@inject(TYPES.ArticleGrouper) private articleGrouper: ArticleGrouperTool) {
		super();

		if (!config.openaiKey || config.openaiKey === '') {
			throw new Error('OPENAI_API_KEY is not set');
		}

		this.openai = new OpenAI({ apiKey: config.openaiKey });
		this.prisma = PrismaClientFactory.getInstance('news-sources');
		this.loadConfigData();
		console.log('✅ News Briefing (Summaries) Tool initialized');
	}

	get name(): string {
		return 'create_news_briefing_from_summaries';
	}

	get description(): string {
		return 'Creates a news briefing using precomputed summaries (Post.summary) to reduce token usage.';
	}

	get schema(): z.ZodSchema {
		return BriefingFromSummariesSchema;
	}

	private async loadConfigData(): Promise<void> {
		try {
			this.audienceContexts = await promptLoader.loadConfig('shared/audience-contexts.json');
			this.detailLevels = await promptLoader.loadConfig('shared/detail-levels.json');
			this.audienceTitles = await promptLoader.loadConfig('shared/audience-titles.json');
		} catch (error) {
			console.warn('⚠️ Could not load prompt configs (summaries tool), using fallbacks:', error);
			this.audienceContexts = {
				policymaker: 'Focus on regulatory implications and governance.',
				business: 'Highlight market and strategic implications.',
				academic: 'Provide analytical depth and context.',
				general: 'Present information in accessible terms.',
			};
			this.detailLevels = { brief: 'concise', standard: 'balanced', detailed: 'comprehensive' } as any;
			this.audienceTitles = {
				policymaker: 'Policy Briefing',
				business: 'Business Intelligence Report',
				academic: 'Research Brief',
				general: 'News Summary',
			};
		}
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

	private generateBriefingTitle(audience: string): string {
		const now = new Date();
		const dateStr = now.toLocaleDateString('en-US', {
			weekday: 'long',
			year: 'numeric',
			month: 'long',
			day: 'numeric',
		});
		const title = this.audienceTitles[audience] || this.audienceTitles.general || 'News Summary';
		return `${title} - ${dateStr}`;
	}

	private async generateSectionContent(
		topic: string,
		articles: NewsArticlePreview[],
		params: z.infer<typeof BriefingFromSummariesSchema>
	): Promise<BriefingSection> {
		const articlesText = articles
			.map((article, idx) => {
				const content = article.excerpt || '';
				return `Article ${idx + 1}: "${article.title}" (${article.source.site})\n${content.substring(0, 800)}...\n---`;
			})
			.join('\n');

		const promptTemplate = await promptLoader.loadPromptTemplate('news-briefing/section-generation.txt');
		const prompt = promptLoader.interpolateTemplate(promptTemplate, {
			targetAudience: params.targetAudience,
			topic,
			articleCount: articles.length.toString(),
			articlesText,
			detailLevel: this.detailLevels[params.briefingType] || 'balanced',
			audienceContext: this.audienceContexts[params.targetAudience] || this.audienceContexts.general,
		});

		try {
			const response = await this.openai.chat.completions.create({
				model: 'gpt-3.5-turbo',
				messages: [{ role: 'user', content: prompt }],
				temperature: 0.3,
				max_tokens: 700,
			});
			const content = response.choices[0]?.message?.content;
			if (!content) throw new Error('No response from OpenAI');
			const sectionData = JSON.parse(content);
			return {
				topic,
				headline: sectionData.headline,
				summary: sectionData.summary,
				keyPoints: sectionData.keyPoints,
				sources: articles.map((a) => ({ title: a.title, link: a.link, source: a.source.site })),
				importance: sectionData.importance,
			};
		} catch (error) {
			console.error(`[BriefingSummaries] Error generating section for ${topic}:`, error);
			return {
				topic,
				headline: `${topic} Updates`,
				summary: `Latest developments in ${topic} based on ${articles.length} summarized articles.`,
				keyPoints: articles.slice(0, 3).map((a) => a.title),
				sources: articles.map((a) => ({ title: a.title, link: a.link, source: a.source.site })),
				importance: 'medium',
			};
		}
	}

	private async generateBriefingSummary(
		sections: BriefingSection[],
		params: z.infer<typeof BriefingFromSummariesSchema>
	): Promise<string> {
		const sectionsContent = sections.map((s) => `${s.topic}: ${s.summary}`).join('\n');
		const promptTemplate = await promptLoader.loadPromptTemplate('news-briefing/executive-summary.txt');
		const prompt = promptLoader.interpolateTemplate(promptTemplate, {
			targetAudience: params.targetAudience,
			sectionsContent,
			audienceContext: this.audienceContexts[params.targetAudience] || this.audienceContexts.general,
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
				'News briefing covering summarized developments across multiple topics.'
			);
		} catch (error) {
			console.error('[BriefingSummaries] Error generating briefing summary:', error);
			return `This ${params.briefingType} briefing covers ${sections.length} summarized topics.`;
		}
	}

	async execute(params: z.infer<typeof BriefingFromSummariesSchema>): Promise<NewsBriefing> {
		const startTime = Date.now();

		let workingArticles = params.articles;
		if (!workingArticles && params.ids) {
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
				const summary = p.summary || (p.articleText || '').slice(0, 800);
				return {
					id: p.id,
					title: p.title || 'Untitled',
					link: p.webUrl,
					excerpt: summary,
					source: { site: p.source?.name || domain, domain, section: undefined },
					publishDate: undefined,
				};
			});
		}

		if (!workingArticles || workingArticles.length === 0) {
			throw new Error('No articles resolved from provided input');
		}

		console.log(
			`📰 [BriefingSummaries] Creating ${params.briefingType} briefing from ${workingArticles.length} summarized articles`
		);

		const grouped = await this.articleGrouper.execute({
			articles: workingArticles,
			options: {
				maxGroups: params.includeAllSections ? 50 : params.maxSections,
				minArticlesPerGroup: 1,
				useOpenAI: true,
				extractFullContent: false,
				minContentLength: 10,
				skipContentFiltering: true,
			},
		});

		const sections: BriefingSection[] = [];
		for (const [topic, articles] of Object.entries(grouped)) {
			if (articles.length === 0) continue;
			const section = await this.generateSectionContent(topic, articles, params);
			sections.push(section);
		}

		const sorted = sections.sort(
			(a, b) => this.getImportanceScore(b.importance) - this.getImportanceScore(a.importance)
		);
		const finalSections = params.includeAllSections ? sorted : sorted.slice(0, params.maxSections);

		const briefing: NewsBriefing = {
			title: this.generateBriefingTitle(params.targetAudience),
			generatedAt: new Date().toISOString(),
			summary: await this.generateBriefingSummary(finalSections, params),
			sections: finalSections,
			totalArticles: workingArticles.length,
			sources: [...new Set(workingArticles.map((a) => a.source.site))],
			metadata: {
				briefingType: params.briefingType,
				targetAudience: params.targetAudience,
				processingTime: Date.now() - startTime,
				mode: 'summaries',
			},
		};

		console.log(`✅ [BriefingSummaries] Briefing created with ${briefing.sections.length} sections`);
		return briefing;
	}
}
