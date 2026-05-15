import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';

export interface WebResearchResult {
  summary: string;
  hashtags: string[];
  visualThemes: string[];
  imageDescription?: string;
  enrichedContext: string;
}

@Injectable()
export class WebResearchService {
  private readonly logger = new Logger(WebResearchService.name);
  private readonly client = new Anthropic();

  async researchContent(content: string, referenceImageUrls?: string[]): Promise<WebResearchResult> {
    try {
      const imageUrls = (referenceImageUrls ?? [])
        .filter(u => /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(u))
        .slice(0, 2);

      const userContent: Anthropic.MessageParam['content'] = [
        {
          type: 'text',
          text: [
            'You are preparing a social media post. Search the web for context about this topic and analyze any reference images.',
            '',
            `Post content:\n"${content}"`,
            '',
            'Tasks:',
            '1. Search the web for relevant facts, trends, and context about this topic.',
            imageUrls.length
              ? '2. Analyze the provided reference images and describe their visual style.'
              : '2. Suggest strong visual themes for the image.',
            '3. Return ONLY valid JSON with these exact fields:',
            '{',
            '  "summary": "2-3 sentence summary of key web findings",',
            '  "hashtags": ["tag1", "tag2", ...],',
            '  "visualThemes": ["theme1", "theme2", ...],',
            '  "imageDescription": "visual style description from reference images or null",',
            '  "enrichedContext": "1-2 sentence context that combines the post with web findings"',
            '}',
          ].join('\n'),
        },
      ];

      for (const url of imageUrls) {
        (userContent as any[]).push({ type: 'image', source: { type: 'url', url } });
      }

      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        tools: [{ type: 'web_search_20250305', name: 'web_search' } as any],
        messages: [{ role: 'user', content: userContent }],
      });

      const textBlock = response.content.find((b) => b.type === 'text');
      if (!textBlock || textBlock.type !== 'text') return this.fallback(content);

      const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return this.fallback(content);

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        summary: parsed.summary ?? '',
        hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
        visualThemes: Array.isArray(parsed.visualThemes) ? parsed.visualThemes : [],
        imageDescription: parsed.imageDescription ?? undefined,
        enrichedContext: parsed.enrichedContext ?? content,
      };
    } catch (err: any) {
      this.logger.warn(`Web research failed (${err.message}) — using original content`);
      return this.fallback(content);
    }
  }

  private fallback(content: string): WebResearchResult {
    return { summary: '', hashtags: [], visualThemes: [], enrichedContext: content };
  }
}
