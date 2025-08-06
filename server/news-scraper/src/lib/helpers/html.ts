import axios from 'axios';
import * as cheerio from 'cheerio';

// Base class for HTML scraping utilities
export class HTMLScraperBase {
	public static async fetchHTML(url: string): Promise<string> {
		try {
			const response = await axios.get(url, {
				headers: {
					'User-Agent':
						'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
					Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
					'Accept-Language': 'en-US,en;q=0.5',
					'Accept-Encoding': 'gzip, deflate',
					Connection: 'keep-alive',
				},
				timeout: 10000, // 10 second timeout
			});
			return response.data;
		} catch (error) {
			throw new Error(
				`Failed to fetch HTML from ${url}: ${
					error instanceof Error ? error.message : String(error)
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
