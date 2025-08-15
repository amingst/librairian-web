import { MCPResource } from '@shared/backend';
import { inject, injectable } from 'inversify';
import { PrismaClient } from '@prisma/client';
import { TYPES } from '../types/di.types.js';
import type {
	BriefingSection,
	NewsBriefing,
} from '@/../../shared/types/briefing.js';

// Temporary until we move this to a proper service
async function getBriefing(id: string): Promise<NewsBriefing | null> {
	try {
		const response = await fetch(
			`http://localhost:3000/api/pharos/briefing/${id}`
		);
		if (!response.ok) return null;
		const data = await response.json();
		return data.briefing;
	} catch (error) {
		console.error('Error fetching briefing:', error);
		return null;
	}
}

@injectable()
export class BriefingResource extends MCPResource {
	constructor(
		@inject(TYPES.PrismaClient) private readonly prisma: PrismaClient
	) {
		super();
	}

	get name(): string {
		return 'briefing';
	}

	get description(): string {
		return 'News briefing resource for RAG context';
	}

	get templateOrUri(): string {
		return 'briefing://';
	}

	get metadata(): Record<string, unknown> {
		return {
			contentType: 'news-briefing',
			version: '1.0',
		};
	}

	override register(server: any): void {
		server.registerResource(
			this.name,
			this.templateOrUri,
			this.metadata,
			async (uri: URL) => {
				// Extract briefing ID from URI
				const briefingId = uri.pathname.split('/').pop();
				if (!briefingId) {
					throw new Error('Invalid briefing URI');
				}

				// Get briefing from cookie storage
				const briefing = await getBriefing(briefingId);
				if (!briefing) {
					throw new Error(`Briefing not found: ${briefingId}`);
				}

				// Format briefing content for RAG
				const content = [
					`# ${briefing.title}\n`,
					`${briefing.summary}\n`,
					...briefing.sections.map(
						(section: BriefingSection) => `
## ${section.topic}: ${section.headline}
${section.summary}

Key Points:
${section.keyPoints.map((point: string) => `- ${point}`).join('\n')}
          `
					),
				].join('\n');

				return {
					contents: [
						{
							uri: uri.href,
							text: content,
							metadata: {
								title: briefing.title,
								createdAt: briefing.createdAt,
								sources: briefing.sources,
							},
						},
					],
				};
			}
		);
	}
}
