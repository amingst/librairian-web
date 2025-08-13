import { Request, Response } from 'express';
import { controller, post } from '@shared/backend';
import { ArticleExtractorTool } from '../tools/ArticleExtractor.js';

@controller('/stream')
export class ArticleController {
	private articleExtractor: ArticleExtractorTool;

	constructor() {
		this.articleExtractor = new ArticleExtractorTool();
	}

	@post('/scrape-article')
	async streamScrapeArticle(req: Request, res: Response) {
		return this.articleExtractor.handleStreamRequest(req, res);
	}
}
