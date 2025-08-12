import { Request, Response } from 'express';
import { controller, get, PrismaClientFactory } from '@shared/backend';
import { PrismaClient } from '@prisma/client';

@controller('/news-sources')
export class NewsSourcesController {
	private prisma: PrismaClient;

	constructor() {
		this.prisma = PrismaClientFactory.getInstance('news-sources');
	}

	@get('/')
	async getAllSources(req: Request, res: Response) {
		try {
			// Get active news sources from database
			const sources = await this.prisma.newsSource.findMany({
				where: {
					isActive: true,
					isDisabled: false,
				},
				select: {
					id: true,
					name: true,
					icon: true,
					createdAt: true,
					updatedAt: true,
				},
				orderBy: {
					name: 'asc',
				},
			});

			res.json({
				success: true,
				data: {
					sources,
					total: sources.length,
					timestamp: new Date().toISOString(),
				},
			});
		} catch (error) {
			console.error('Error loading news sources:', error);
			res.status(500).json({
				success: false,
				error: 'Failed to load news sources',
				message: error instanceof Error ? error.message : String(error),
			});
		}
	}

	@get('/:id')
	async getSourceById(req: Request, res: Response) {
		try {
			const sourceId = req.params.id;

			// Find the source by ID from database
			const source = await this.prisma.newsSource.findUnique({
				where: {
					id: sourceId,
				},
			});

			if (!source) {
				res.status(404).json({
					success: false,
					error: 'News source not found',
					sourceId,
				});
				return;
			}

			// Return full source configuration
			res.json({
				success: true,
				data: {
					...source,
					timestamp: new Date().toISOString(),
				},
			});
		} catch (error) {
			console.error('Error loading news source:', error);
			res.status(500).json({
				success: false,
				error: 'Failed to load news source',
				message: error instanceof Error ? error.message : String(error),
			});
		}
	}
}
