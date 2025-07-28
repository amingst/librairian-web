import { z } from 'zod';
import { MCPTool } from '@shared/backend';

const TextAnalysisSchema = z.object({
    text: z.string(),
    options: z.object({
        sentiment: z.boolean().optional().default(true),
        keywords: z.boolean().optional().default(true),
        summary: z.boolean().optional().default(false)
    }).optional().default({})
});

export class TextAnalysisTool extends MCPTool {
    get name(): string {
        return 'analyze_text';
    }

    get description(): string {
        return 'Performs text analysis including sentiment analysis and keyword extraction';
    }

    get inputSchema(): z.ZodSchema {
        return TextAnalysisSchema;
    }

    get schema(): z.ZodSchema {
        return TextAnalysisSchema;
    }

    async execute(params: z.infer<typeof TextAnalysisSchema>): Promise<any> {
        const { text, options } = params;
        
        const result: any = {
            text: text.substring(0, 100) + '...'
        };

        if (options.sentiment) {
            // Simple sentiment analysis placeholder
            const positiveWords = ['good', 'great', 'excellent', 'positive', 'success', 'win'];
            const negativeWords = ['bad', 'terrible', 'negative', 'fail', 'loss', 'crisis'];
            
            const lowerText = text.toLowerCase();
            const positive = positiveWords.filter(word => lowerText.includes(word)).length;
            const negative = negativeWords.filter(word => lowerText.includes(word)).length;
            
            result.sentiment = {
                score: positive - negative,
                label: positive > negative ? 'positive' : negative > positive ? 'negative' : 'neutral'
            };
        }

        if (options.keywords) {
            // Simple keyword extraction placeholder
            const words = text.toLowerCase().split(/\W+/)
                .filter(word => word.length > 3)
                .filter(word => !['the', 'and', 'that', 'have', 'for', 'not', 'with', 'you', 'this', 'but', 'his', 'from', 'they'].includes(word));
            
            const wordCount: Record<string, number> = {};
            words.forEach(word => {
                wordCount[word] = (wordCount[word] || 0) + 1;
            });
            
            result.keywords = Object.entries(wordCount)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 10)
                .map(([word, count]) => ({ word, count }));
        }

        return result;
    }
}
