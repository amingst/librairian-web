import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

interface PromptCache {
	[key: string]: string | object;
}

export class PromptLoader {
	private cache: PromptCache = {};
	private promptsDir: string;

	constructor(promptsDir?: string) {
		// Get the directory name for ES modules
		const __filename = fileURLToPath(import.meta.url);
		const __dirname = path.dirname(__filename);
		// Go up to project root: src/utils -> src -> project-root -> prompts
		this.promptsDir =
			promptsDir || path.join(__dirname, '..', '..', 'prompts');
	}

	/**
	 * Load a text prompt template
	 */
	async loadPromptTemplate(filePath: string): Promise<string> {
		const fullPath = path.join(this.promptsDir, filePath);

		if (this.cache[fullPath]) {
			return this.cache[fullPath] as string;
		}

		try {
			const content = await fs.readFile(fullPath, 'utf-8');
			this.cache[fullPath] = content;
			return content;
		} catch (error) {
			throw new Error(
				`Failed to load prompt template from ${fullPath}: ${error}`
			);
		}
	}

	/**
	 * Load a JSON configuration file
	 */
	async loadConfig<T = any>(filePath: string): Promise<T> {
		const fullPath = path.join(this.promptsDir, filePath);

		if (this.cache[fullPath]) {
			return this.cache[fullPath] as T;
		}

		try {
			const content = await fs.readFile(fullPath, 'utf-8');
			const parsed = JSON.parse(content);
			this.cache[fullPath] = parsed;
			return parsed;
		} catch (error) {
			throw new Error(`Failed to load config from ${fullPath}: ${error}`);
		}
	}

	/**
	 * Interpolate variables in a template string
	 */
	interpolateTemplate(
		template: string,
		variables: Record<string, string>
	): string {
		return template.replace(/\{(\w+)\}/g, (match, key) => {
			return variables[key] || match;
		});
	}

	/**
	 * Load and interpolate a prompt template in one step
	 */
	async getInterpolatedPrompt(
		filePath: string,
		variables: Record<string, string>
	): Promise<string> {
		const template = await this.loadPromptTemplate(filePath);
		return this.interpolateTemplate(template, variables);
	}

	/**
	 * Clear the cache (useful for development)
	 */
	clearCache(): void {
		this.cache = {};
	}
}

// Singleton instance
export const promptLoader = new PromptLoader();
