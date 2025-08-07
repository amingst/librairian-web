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

export const articleSummarizerSchema = z.object({
	articles: z
		.array(
			z.object({
				title: z.string().min(1, 'Title is required'),
				content: z.string().min(1, 'Content is required'),
				source: z.string().optional(),
				date: z.string().optional(), // You could swap for z.date().optional() if you normalize dates earlier
			})
		)
		.min(1, 'At least one article is required'),

	audience: z.enum([
		// Keep in sync with your /prompts/summary/audience-contexts.json keys
		'general',
		'investor',
		'academic',
		'technical',
		'executive',
	]),

	detail: z.enum([
		// Keep in sync with your /prompts/summary/detail-levels.json keys
		'brief',
		'standard',
		'comprehensive',
	]),
});

@injectable()
export class ArticleSummarizerTool extends MCPTool {
	private openai: OpenAI;
	private prisma: PrismaClient;
	private audienceContexts: Record<string, string> = {};
	private detailLevels: Record<string, string> = {};
	private audienceTitles: Record<string, string> = {};

	constructor(@inject(TYPES.PrismaClient) prisma: PrismaClient) {
		super();
		this.openai = new OpenAI({ apiKey: config.openaiKey });
		this.prisma = PrismaClientFactory.getInstance('news-sources');

		this.loadConfigData().catch((err) => {
			console.error('❌ Failed to load prompt configs:', err);
		});
	}

	get name(): string {
		return 'summarize_articles_batch';
	}

	private async loadConfigData(): Promise<void> {
		const basePath = 'summary'; // all configs now live under prompts/summary

		// Defaults
		this.audienceContexts = {
			policymaker:
				'Focus on regulatory implications, policy precedents, and legislative considerations. Emphasize governance and public policy impacts.',
			business:
				'Highlight market impacts, competitive dynamics, and strategic implications for industry sectors.',
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

		try {
			this.audienceContexts = await promptLoader.loadConfig(
				`${basePath}/audience-contexts.json`
			);
			this.detailLevels = await promptLoader.loadConfig(
				`${basePath}/detail-levels.json`
			);
			this.audienceTitles = await promptLoader.loadConfig(
				`${basePath}/audience-titles.json`
			);
		} catch (error) {
			console.warn(
				'⚠️ Using default prompt configs due to load error:',
				error
			);
		}
	}

	get description(): string {
		return 'Summarizes batches of news articles into structured audience-targeted reports.';
	}

	get schema(): Record<string, any> {
		return articleSummarizerSchema;
	}

	async execute(
		params: z.infer<typeof articleSummarizerSchema>
	): Promise<any> {
		const { articles, audience, detail } = params;

		try {
			console.log(
				`[ArticleSummarizer] Start summarize_articles_batch: count=${articles.length}, audience=${audience}, detail=${detail}`
			);
			console.log(
				'[ArticleSummarizer] Sample titles:',
				articles.slice(0, 3).map((a) => a.title)
			);
			const t0 = Date.now();

			const audienceContext = this.audienceContexts[audience];
			const detailDescriptor = this.detailLevels[detail];
			const reportTitle = this.audienceTitles[audience];

			// Load system prompt from summary subfolder
			const systemPrompt = await promptLoader.getInterpolatedPrompt(
				'summary/article-summarizer.txt',
				{
					audienceName: audience.toUpperCase(),
					audienceContext,
					detailDescriptor,
					reportTitle,
				}
			);

			const combinedArticles = articles
				.map(
					(a, i) =>
						`[${i + 1}] ${a.title}\n${a.content}\nSource: ${
							a.source ?? 'N/A'
						}\nDate: ${a.date ?? 'Unknown'}`
				)
				.join('\n\n---\n\n');

			console.log(
				`[ArticleSummarizer] Prepared prompt with ${combinedArticles.length} chars (avg/article ~${Math.round(
					combinedArticles.length / Math.max(1, articles.length)
				)}).`
			);
			console.log('[ArticleSummarizer] Calling OpenAI gpt-4o-mini...');

			const response = await this.openai.chat.completions.create({
				model: 'gpt-4o-mini',
				messages: [
					{ role: 'system', content: systemPrompt },
					{
						role: 'user',
						content: `Here is the batch of articles to summarize:\n\n${combinedArticles}`,
					},
				],
				temperature: 0.3,
				max_tokens: 1500,
			});

			const elapsedMs = Date.now() - t0;
			const usage = (response as any)?.usage;
			if (usage) {
				console.log(
					`[ArticleSummarizer] OpenAI usage -> prompt_tokens=${usage.prompt_tokens}, completion_tokens=${usage.completion_tokens}, total_tokens=${usage.total_tokens}, time=${elapsedMs}ms`
				);
			} else {
				console.log(
					`[ArticleSummarizer] OpenAI call completed in ${elapsedMs}ms`
				);
			}

			const content = response.choices?.[0]?.message?.content || '';
			console.log(
				`[ArticleSummarizer] Summary generated: ${content.length} chars`
			);

			return {
				title: reportTitle,
				summary: content,
			};
		} catch (error) {
			console.error('[ArticleSummarizer] Error during summarization:', error);
			throw error;
		}
	}
}
