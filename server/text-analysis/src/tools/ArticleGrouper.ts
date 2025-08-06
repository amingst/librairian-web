import { z } from 'zod';
import { MCPTool } from '@shared/backend';
import type { NewsArticlePreview } from '@shared/types';
import { BatchArticleExtractorTool } from './BatchArticleExtractor.js';
import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';
import config from '../config.js';

// Input schema for the grouping tool
const GroupArticlesSchema = z.object({
	articles: z.array(z.any()), // Use any for now since we're accepting NewsArticlePreview from external source
	options: z
		.object({
			maxGroups: z.number().optional().default(10),
			minArticlesPerGroup: z.number().optional().default(2),
			useOpenAI: z.boolean().optional().default(true),
			extractFullContent: z.boolean().optional().default(true),
			minContentLength: z.number().optional().default(100),
			skipContentFiltering: z.boolean().optional().default(false),
		})
		.optional()
		.default({}),
});

export class ArticleGrouperTool extends MCPTool {
	private openai: OpenAI | null = null;
	private extractor: BatchArticleExtractorTool;

	constructor() {
		super();

		if (!config.openaiKey || config.openaiKey === '') {
			throw new Error('OPENAI_API_KEY is not set');
		}

		this.openai = new OpenAI({
			apiKey: config.openaiKey,
		});
		// Initialize the article extractor
		this.extractor = new BatchArticleExtractorTool();
		console.log('✅ Article extractor initialized');
	}

	get name(): string {
		return 'group_articles_by_current_events';
	}

	get description(): string {
		return 'Groups news articles by current events and topics using AI-powered text analysis';
	}

	get inputSchema(): z.ZodSchema {
		return GroupArticlesSchema;
	}

	get schema(): z.ZodSchema {
		return GroupArticlesSchema;
	}

	async execute(
		params: z.infer<typeof GroupArticlesSchema>
	): Promise<Record<string, NewsArticlePreview[]>> {
		const { articles, options } = params;

		console.log('🔍 ArticleGrouper.execute called with:', {
			articleCount: articles.length,
			options,
			useOpenAI: options?.useOpenAI,
			openaiAvailable: !!this.openai,
			sampleTitles: articles.slice(0, 3).map((a) => a.title),
		});

		if (articles.length === 0) {
			console.log('⚠️ No articles provided, returning empty result');
			return {};
		}

		try {
			if (this.openai && options.useOpenAI) {
				console.log('🤖 Using OpenAI grouping...');
				return await this.groupWithOpenAI(articles, options);
			} else {
				console.log('📝 Using simple keyword-based grouping...');
				return await this.groupWithSimpleAnalysis(articles, options);
			}
		} catch (error) {
			console.error('❌ Error grouping articles:', error);
			// Fallback to simple grouping
			console.log('🔄 Falling back to simple analysis...');
			return await this.groupWithSimpleAnalysis(articles, options);
		}
	}

	private async groupWithOpenAI(
		articles: NewsArticlePreview[],
		options: any
	): Promise<Record<string, NewsArticlePreview[]>> {
		if (!this.openai) {
			throw new Error('OpenAI not initialized');
		}

		try {
			// Extract full content for all articles first
			console.log(
				'🔍 Extracting full content for',
				articles.length,
				'articles...'
			);

			// Convert NewsArticlePreview to format expected by BatchArticleExtractor
			const articlesForExtraction = articles.map((article) => ({
				title: article.title,
				link: article.link,
				source: article.source,
			}));

			console.log(
				'📄 Sample article for extraction:',
				articlesForExtraction[0]
			);

			const extractedContent = await this.extractor.execute({
				articles: articlesForExtraction,
				options: {
					maxArticles: Math.min(articles.length, 15), // Limit for performance
					includeFullText: true,
					timeout: 8000,
				},
			});

			console.log(
				'✅ Extracted content for',
				extractedContent.length,
				'articles'
			);

			// Enhance articles with full content and assign UUIDs if missing
			const articlesWithContent = articles.map((article, index) => {
				const content = extractedContent.find(
					(extracted: any) => extracted.url === article.link
				);
				return {
					...article,
					id:
						article.id && article.id.length === 36
							? article.id
							: uuidv4(),
					fullContent: content?.fullText || article.excerpt || '',
					contentLength: content?.fullText?.length || 0,
				};
			});

			// Filter out articles without sufficient content for better analysis
			const validArticles = options.skipContentFiltering
				? articlesWithContent
				: articlesWithContent.filter((article) => {
						const contentToCheck =
							article.fullContent || article.excerpt || '';
						return (
							contentToCheck.length >
							(options.minContentLength || 100)
						);
				  });

			console.log(
				`📊 Analyzing ${
					validArticles.length
				} articles with full content (${
					articlesWithContent.length - validArticles.length
				} excluded due to extraction issues)`
			);

			// Prepare article data for AI analysis using full content
			const articleSummaries = validArticles.map((article, idx) => ({
				idx,
				title: article.title,
				excerpt: article.excerpt || '',
				source: article.source.site,
				content: article.fullContent.substring(0, 1500), // Use first 1500 chars of content
			}));

			console.log('🤖 Sending to OpenAI - sample data:', {
				totalArticles: articleSummaries.length,
				sampleArticle: articleSummaries[0]
					? {
							title: articleSummaries[0].title,
							source: articleSummaries[0].source,
							contentLength: articleSummaries[0].content.length,
					  }
					: 'none',
			});

			const prompt = `
You are a news analyst. Group the following ${
				validArticles.length
			} news articles by current events and topics using their full content.

Articles:
${articleSummaries
	.map(
		(a) =>
			`${a.idx}: "${a.title}" (${a.source})\nContent: ${a.content}...\n---`
	)
	.join('\n')}

Instructions:
1. Identify major current events and topics from these articles using their full content
2. Group articles that cover the same story or related events
3. Create meaningful group names that describe the current event/topic
4. Use the full article content to make more accurate grouping decisions

Respond with a JSON object where:
- Keys are descriptive group names (e.g., "U.S. Election Updates", "Tech Industry Layoffs")
- Values are arrays of article indices (numbers) that belong to that group

Example format:
{
  "Major Current Event Name": [0, 3, 7],
  "Another Topic": [1, 4],
  "Technology News": [2, 5, 6]
}

Any articles that do not fit into any group should be placed in a group called Other. 
`;

			const response = await this.openai.chat.completions.create({
				model: 'gpt-3.5-turbo',
				messages: [{ role: 'user', content: prompt }],
				temperature: 0.3,
				max_tokens: 1500,
			});

			console.log('📬 OpenAI response received:', {
				usage: response.usage,
				hasContent: !!response.choices[0]?.message?.content,
			});

			const content = response.choices[0]?.message?.content;
			if (!content) {
				throw new Error('No response from OpenAI');
			}

			console.log('📝 Raw OpenAI response:', content);

			// Parse the AI response
			const groupings = JSON.parse(content);
			console.log('🗂️ Parsed groupings:', groupings);

			// Convert article indices back to actual articles
			const result: Record<string, NewsArticlePreview[]> = {};
			for (const [groupName, articleIndices] of Object.entries(
				groupings
			)) {
				if (Array.isArray(articleIndices)) {
					result[groupName] = articleIndices
						.filter(
							(idx: any) =>
								typeof idx === 'number' &&
								idx >= 0 &&
								idx < validArticles.length
						)
						.map((idx: number) => validArticles[idx]);
				}
			}

			console.log(
				'✅ Final grouping result:',
				Object.keys(result).map((key) => ({
					group: key,
					articleCount: result[key].length,
				}))
			);

			return result;
		} catch (error) {
			console.error('Error in OpenAI grouping:', error);
			// Fallback to simple analysis if content extraction fails
			return await this.groupWithSimpleAnalysis(articles, options);
		}
	}

	private async groupWithSimpleAnalysis(
		articles: NewsArticlePreview[],
		options: any
	): Promise<Record<string, NewsArticlePreview[]>> {
		// Simple keyword-based grouping as fallback
		const groups: Record<string, NewsArticlePreview[]> = {};

		// Define common keywords for grouping
		const keywords = {
			'Politics & Elections': [
				'election',
				'vote',
				'democrat',
				'republican',
				'congress',
				'senate',
				'president',
				'campaign',
				'poll',
			],
			Technology: [
				'tech',
				'ai',
				'artificial intelligence',
				'software',
				'apple',
				'google',
				'microsoft',
				'meta',
				'tesla',
			],
			'Business & Economy': [
				'economy',
				'market',
				'stock',
				'inflation',
				'jobs',
				'unemployment',
				'trade',
				'business',
				'finance',
			],
			'International News': [
				'war',
				'ukraine',
				'russia',
				'china',
				'international',
				'global',
				'nato',
				'europe',
			],
			'Health & Science': [
				'health',
				'medical',
				'covid',
				'virus',
				'vaccine',
				'science',
				'research',
				'study',
			],
			'Climate & Environment': [
				'climate',
				'environment',
				'weather',
				'temperature',
				'emissions',
				'green',
				'renewable',
			],
			Sports: [
				'sports',
				'football',
				'basketball',
				'baseball',
				'soccer',
				'olympics',
				'game',
				'team',
				'player',
			],
			Entertainment: [
				'movie',
				'film',
				'music',
				'celebrity',
				'entertainment',
				'hollywood',
				'tv',
				'show',
			],
		};

		// Group articles by keyword matching, assign UUIDs if missing
		for (const articleRaw of articles) {
			const article = {
				...articleRaw,
				id:
					articleRaw.id && articleRaw.id.length === 36
						? articleRaw.id
						: uuidv4(),
			};
			const titleLower = article.title.toLowerCase();
			const excerptLower = (article.excerpt || '').toLowerCase();
			const text = titleLower + ' ' + excerptLower;

			let assigned = false;
			for (const [category, categoryKeywords] of Object.entries(
				keywords
			)) {
				if (
					categoryKeywords.some((keyword) => text.includes(keyword))
				) {
					if (!groups[category]) {
						groups[category] = [];
					}
					groups[category].push(article);
					assigned = true;
					break;
				}
			}

			// If no category matches, put in "Other News"
			if (!assigned) {
				if (!groups['Other News']) {
					groups['Other News'] = [];
				}
				groups['Other News'].push(article);
			}
		}

		// Filter out groups with too few articles if specified
		const filtered: Record<string, NewsArticlePreview[]> = {};
		for (const [groupName, groupArticles] of Object.entries(groups)) {
			if (groupArticles.length >= options.minArticlesPerGroup) {
				filtered[groupName] = groupArticles;
			} else if (groupArticles.length > 0) {
				// Add single articles to "Other News"
				if (!filtered['Other News']) {
					filtered['Other News'] = [];
				}
				filtered['Other News'].push(...groupArticles);
			}
		}

		return filtered;
	}
}
