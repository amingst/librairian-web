import { Tool } from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer';
import { z } from 'zod';
import { MCPTool } from '@shared/backend';
import { injectable } from 'inversify';

const NewsAggregatorSchema = z.object({
	sources: z.array(
		z.object({
			name: z.string(),
			url: z.string(),
			method: z.enum(['static', 'puppeteer']),
			selectors: z.object({
				container: z.string().optional(),
				title: z.string().optional(),
				link: z.string().optional(),
				linkFilter: z.string().optional(),
			}),
		})
	),
	maxArticles: z.number().default(20),
});

interface Article {
	title: string;
	link: string;
	source: {
		site: string;
		domain: string;
		method: 'static' | 'puppeteer';
	};
	timestamp: string;
}

@injectable()
export class NewsAggregatorTool extends MCPTool {
	name = 'scrape_hybrid_sources';
	description =
		'Scrape multiple news sources using both static (fast) and Puppeteer (JS-capable) methods';

	schema = {
		type: 'object' as const,
		properties: {
			sources: {
				type: 'array' as const,
				items: {
					type: 'object' as const,
					properties: {
						name: { type: 'string' as const },
						url: { type: 'string' as const },
						method: {
							type: 'string' as const,
							enum: ['static', 'puppeteer'],
						},
						selectors: {
							type: 'object' as const,
							properties: {
								container: { type: 'string' as const },
								title: { type: 'string' as const },
								link: { type: 'string' as const },
								linkFilter: { type: 'string' as const },
							},
						},
					},
					required: ['name', 'url', 'method', 'selectors'],
				},
			},
			maxArticles: { type: 'number' as const, default: 20 },
		},
		required: ['sources'],
	};

	async execute(args: z.infer<typeof NewsAggregatorSchema>) {
		const startTime = Date.now();
		const results: Article[] = [];
		const errors: string[] = [];

		console.log(
			`🚀 Starting hybrid scraper for ${args.sources.length} sources...`
		);

		// Group sources by method for parallel processing
		const staticSources = args.sources.filter((s) => s.method === 'static');
		const puppeteerSources = args.sources.filter(
			(s) => s.method === 'puppeteer'
		);

		// Process static sources in parallel (fast)
		if (staticSources.length > 0) {
			console.log(
				`⚡ Processing ${staticSources.length} static sources...`
			);
			const staticPromises = staticSources.map((source) =>
				NewsAggregatorTool.scrapeStaticSource(source, args.maxArticles)
			);

			const staticResults = await Promise.allSettled(staticPromises);
			staticResults.forEach((result, index) => {
				if (result.status === 'fulfilled') {
					results.push(...result.value.articles);
				} else {
					errors.push(
						`${staticSources[index].name}: ${result.reason}`
					);
				}
			});
		}

		// Process Puppeteer sources sequentially to avoid overwhelming the browser
		if (puppeteerSources.length > 0) {
			console.log(
				`🤖 Processing ${puppeteerSources.length} Puppeteer sources...`
			);

			let browser;
			try {
				browser = await puppeteer.launch({
					headless: true,
					args: [
						'--no-sandbox',
						'--disable-setuid-sandbox',
						'--disable-dev-shm-usage',
						'--disable-accelerated-2d-canvas',
						'--disable-background-timer-throttling',
					],
				});

				// Process Puppeteer sources sequentially to avoid overwhelming the browser
				for (const source of puppeteerSources) {
					try {
						const result =
							await NewsAggregatorTool.scrapePuppeteerSource(
								browser,
								source,
								args.maxArticles
							);
						results.push(...result.articles);
						console.log(
							`✅ ${source.name}: ${result.articles.length} articles`
						);
					} catch (error) {
						const errorMessage =
							error instanceof Error
								? error.message
								: String(error);
						errors.push(`${source.name}: ${errorMessage}`);
						console.log(`❌ ${source.name}: ${errorMessage}`);
					}
				}
			} finally {
				if (browser) {
					await browser.close();
				}
			}
		}

		const totalTime = Date.now() - startTime;

		return {
			content: [
				{
					type: 'text' as const,
					text: JSON.stringify(
						{
							articles: results,
							metadata: {
								totalSources: args.sources.length,
								staticSources: staticSources.length,
								puppeteerSources: puppeteerSources.length,
								totalArticles: results.length,
								processingTime: totalTime,
								errors,
							},
						},
						null,
						2
					),
				},
			],
		};
	}

	private static async scrapeStaticSource(source: any, maxArticles: number) {
		const startTime = Date.now();

		const response = await axios.get(source.url, {
			timeout: 10000,
			headers: {
				'User-Agent':
					'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
			},
		});

		const $ = cheerio.load(response.data);
		const articles: Article[] = [];

		// Use link filter if provided, otherwise default selector
		const linkSelector = source.selectors.linkFilter || 'a[href]';

		$(linkSelector).each((i, element) => {
			if (articles.length >= maxArticles) return false;

			const $el = $(element);
			let title = '';
			let link = '';

			if (source.selectors.title) {
				title =
					$el.find(source.selectors.title).text().trim() ||
					$el.text().trim();
			} else {
				title = $el.text().trim();
			}

			if (source.selectors.link) {
				link =
					$el.find(source.selectors.link).attr('href') ||
					$el.attr('href') ||
					'';
			} else {
				link = $el.attr('href') || '';
			}

			if (title && link && title.length > 10) {
				if (!link.startsWith('http')) {
					const baseUrl = new URL(source.url);
					link = new URL(link, baseUrl.origin).href;
				}

				articles.push({
					title,
					link,
					source: {
						site: source.name,
						domain: new URL(source.url).hostname,
						method: 'static',
					},
					timestamp: new Date().toISOString(),
				});
			}
		});

		return {
			articles,
			processingTime: Date.now() - startTime,
		};
	}

	private static async scrapePuppeteerSource(
		browser: any,
		source: any,
		maxArticles: number
	) {
		const startTime = Date.now();
		const page = await browser.newPage();

		try {
			// Optimize for speed
			await page.setUserAgent(
				'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
			);

			// Block unnecessary resources
			await page.setRequestInterception(true);
			page.on('request', (req: any) => {
				if (
					req.resourceType() === 'image' ||
					req.resourceType() === 'stylesheet' ||
					req.resourceType() === 'font'
				) {
					req.abort();
				} else {
					req.continue();
				}
			});

			await page.goto(source.url, {
				waitUntil: 'domcontentloaded',
				timeout: 15000,
			});

			// Give JS time to render
			await new Promise((resolve) => setTimeout(resolve, 2000));

			const linkSelector = source.selectors.linkFilter || 'a[href]';

			const articles = await page.$$eval(
				linkSelector,
				(
					links: any[],
					maxArticles: number,
					sourceName: string,
					sourceUrl: string
				) => {
					return links
						.slice(0, maxArticles * 3) // Get more than needed for filtering
						.map((link: any) => {
							const text = link.textContent?.trim();
							const href = link.href;

							// Enhanced filtering for different news sites
							if (
								!text ||
								text.length < 10 ||
								text.length > 200
							) {
								return null;
							}

							// Filter out common navigation and non-article links
							if (
								text.includes('Subscribe') ||
								text.includes('Newsletter') ||
								text.includes('Sign up') ||
								text.includes("Today's news") ||
								text.includes('Entertainment') ||
								(text.includes('Best ') &&
									text.includes('cutting boards')) ||
								(text.includes('Best ') &&
									text.includes('vacuums')) ||
								href.includes('/about/') ||
								href.includes('/privacy/') ||
								href.includes('/shopping/') ||
								(href.includes('/finance/news/') &&
									!text.includes('Trump') &&
									!text.includes('UnitedHealth'))
							) {
								return null;
							}

							// Yahoo-specific filtering
							if (sourceName === 'Yahoo News') {
								// Keep news articles but filter shopping content
								if (
									href.includes('shopping.yahoo.com') ||
									(text.toLowerCase().includes('best ') &&
										(text.includes('cutting') ||
											text.includes('vacuum')))
								) {
									return null;
								}
							}

							return {
								title: text,
								link: href,
								source: {
									site: sourceName,
									domain: new URL(sourceUrl).hostname,
									method: 'puppeteer',
								},
								timestamp: new Date().toISOString(),
							};
						})
						.filter((article: any) => article !== null)
						.slice(0, maxArticles); // Final limit
				},
				maxArticles,
				source.name,
				source.url
			);

			return {
				articles,
				processingTime: Date.now() - startTime,
			};
		} finally {
			await page.close();
		}
	}
}
