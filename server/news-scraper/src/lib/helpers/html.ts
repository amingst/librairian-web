import axios from 'axios';
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer';

// Base class for HTML scraping utilities
export class HTMLScraperBase {
	public static async fetchHTML(url: string): Promise<string> {
		const MAX_RETRIES = 2;
		const userAgent =
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';

		let lastError: any = null;

		for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
			try {
				const controller = new AbortController();
				const timeout = setTimeout(() => controller.abort(), 10000);
				const response = await axios.get(url, {
					headers: {
						'User-Agent': userAgent,
						Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
						'Accept-Language': 'en-US,en;q=0.9',
						// Intentionally omit explicit Accept-Encoding so Node handles decompression
						Connection: 'keep-alive',
					},
					maxRedirects: 5,
					validateStatus: (code) => code >= 200 && code < 400,
					signal: controller.signal,
					responseType: 'text',
				});
				clearTimeout(timeout);
				return response.data;
			} catch (error: any) {
				lastError = error;
				const msg = (error?.message || '').toLowerCase();
				// Break early for certain non-retryable statuses
				if (msg.includes('404') || msg.includes('403')) break;
				// Header overflow triggers fallback after loop
				if (attempt < MAX_RETRIES) continue;
			}
		}

		// If we got here, axios path failed. Try Puppeteer fallback for tough sites (e.g., header overflow, dynamic pages)
		try {
			const browser = await puppeteer.launch({
				headless: true,
				args: [
					'--no-sandbox',
					'--disable-setuid-sandbox',
					'--disable-dev-shm-usage',
					'--disable-gpu',
					'--no-first-run',
					'--no-zygote',
				],
			});
			try {
				const page = await browser.newPage();
				await page.setUserAgent(userAgent);
				await page.setRequestInterception(true);
				page.on('request', (req) => {
					if (
						['image', 'media', 'font', 'stylesheet'].includes(
							req.resourceType()
						)
					) {
						return req.abort();
					}
					req.continue();
				});
				await page.goto(url, {
					waitUntil: 'domcontentloaded',
					timeout: 15000,
				});
				await new Promise((r) => setTimeout(r, 500));
				const content = await page.content();
				await page.close();
				await browser.close();
				return content;
			} catch (inner) {
				await browser.close();
				throw inner;
			}
		} catch (fallbackError) {
			throw new Error(
				`Failed to fetch HTML from ${url}: ${
					lastError instanceof Error
						? lastError.message
						: String(lastError)
				} | Fallback error: ${
					fallbackError instanceof Error
						? fallbackError.message
						: String(fallbackError)
				}`
			);
		}
	}

	public static async fetchAndParseHTML(
		url: string
	): Promise<cheerio.CheerioAPI> {
		const html = await this.fetchHTML(url);
		return cheerio.load(html);
	}

	public static cleanText(text: string): string {
		return text.replace(/\s+/g, ' ').replace(/\n+/g, '\n').trim();
	}
}
