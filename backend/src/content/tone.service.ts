import { Injectable, Logger } from '@nestjs/common';
import { InstagramScraperService } from '../instagram/instagram-scraper.service';
import Sentiment from 'sentiment';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ToneInputType = 'instagram_link' | 'text';

export interface GeneratedTone {
    tonePrompt: string;
    label: string;
    source: ToneInputType;
    caption?: string;
}

export interface ContentRewrite {
    content: string;
    toneName: string;
    tonePrompt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TONE_SIGNALS: Record<string, string[]> = {
    Casual: ['lol', 'haha', 'omg', 'tbh', 'ngl', 'bruh', 'lmao', 'literally'],
    Inspirational: ['grind', 'hustle', 'dream', 'believe', 'growth', 'journey', 'mindset'],
    Educational: ['learn', 'tip', 'how', 'guide', 'explain', 'why', 'what', 'thread'],
    Promotional: ['sale', 'discount', 'offer', 'buy', 'shop', 'link', 'promo', 'deal'],
    Professional: ['proud', 'excited', 'announce', 'team', 'launch', 'partner', 'strategy'],
    Humorous: ['😂', '😅', '💀', 'lol', 'joke', 'funny', 'humor', 'roast'],
};

const TONE_TRAITS: Record<string, string> = {
    Casual: 'Use informal language, contractions, and conversational phrasing. Keep it light and relatable.',
    Inspirational: 'Use motivating, uplifting language. Include calls to action and empowering phrases.',
    Educational: 'Use clear, informative language. Break down concepts and explain the why behind statements.',
    Promotional: 'Use persuasive, action-driven language. Highlight benefits and create urgency.',
    Professional: 'Use formal, precise language. Maintain a confident and authoritative tone.',
    Humorous: 'Use wit, playful language, and lighthearted expressions. Include humor where appropriate.',
    Neutral: 'Use balanced, clear language without strong emotional coloring.',
    Custom: 'Maintain the described voice and style consistently throughout the content.',
};

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class ToneService {
    private readonly logger = new Logger(ToneService.name);
    private readonly sentiment = new Sentiment();

    constructor(private readonly instagramScraperService: InstagramScraperService) { }

    async generateTone(input: string, type: ToneInputType): Promise<GeneratedTone> {
        if (type === 'instagram_link') {
            return this.generateFromInstagram(input);
        }
        return this.generateFromText(input);
    }

    rewriteWithTone(content: string, toneName: string, tonePrompt: string): ContentRewrite {
        this.logger.log(`Rewriting content with tone: ${toneName}`);
        return { content, toneName, tonePrompt };
    }

    private async generateFromInstagram(url: string): Promise<GeneratedTone> {
        this.logger.log(`Generating tone from Instagram post: ${url}`);

        const postData = await this.instagramScraperService.scrapePost(url);

        if (!postData?.caption?.trim()) {
            throw new Error(
                `Could not extract a caption from ${url}. The post may be private, age-restricted, or Instagram may require a login to view it.`,
            );
        }

        const { label, sentiment, keywords } = this.analyzeCaption(postData.caption);

        const tonePrompt = this.buildTonePromptFromCaption({ label, sentiment, keywords, sampleText: postData.caption });

        return { tonePrompt, label, source: 'instagram_link', caption: postData.caption };
    }

    private generateFromText(prompt: string): GeneratedTone {
        const lower = prompt.toLowerCase();
        let label = 'Custom';

        for (const [l, words] of Object.entries(TONE_SIGNALS)) {
            if (words.some((w) => lower.includes(w))) {
                label = l;
                break;
            }
        }

        const tonePrompt = this.buildTonePromptFromText(prompt, label);
        return { tonePrompt, label, source: 'text' };
    }

    private analyzeCaption(caption: string): { label: string; sentiment: number; keywords: string[] } {
        const lower = caption.toLowerCase();
        const result = this.sentiment.analyze(caption);
        const normalizedSentiment = Math.max(-1, Math.min(1, result.score / 10));

        const scores: Record<string, number> = {};
        for (const [label, words] of Object.entries(TONE_SIGNALS)) {
            scores[label] = words.filter((w) => lower.includes(w)).length;
        }

        const topEntry = Object.entries(scores).sort(([, a], [, b]) => b - a)[0];
        const label = topEntry && topEntry[1] > 0 ? topEntry[0] : 'Neutral';
        const keywords: string[] = result.tokens.filter((t: string) => t.length > 4).slice(0, 8);

        return { label, sentiment: normalizedSentiment, keywords };
    }

    private buildTonePromptFromCaption(params: {
        label: string;
        sentiment: number;
        keywords: string[];
        sampleText: string;
    }): string {
        const sentimentDesc = params.sentiment > 0.2 ? 'positive' : params.sentiment < -0.2 ? 'critical' : 'neutral';
        const topKeywords = params.keywords.slice(0, 5).join(', ');
        const traits = TONE_TRAITS[params.label] ?? TONE_TRAITS['Custom'];
        const sample = params.sampleText.slice(0, 120);

        return [
            `Write in a ${params.label} tone.`,
            traits,
            `Overall sentiment: ${sentimentDesc}.`,
            topKeywords ? `Key vocabulary and themes: ${topKeywords}.` : null,
            `Sample voice: "${sample}${params.sampleText.length > 120 ? '...' : ''}"`,
        ].filter(Boolean).join(' ');
    }

    private buildTonePromptFromText(prompt: string, label: string): string {
        const traits = TONE_TRAITS[label] ?? TONE_TRAITS['Custom'];
        return [
            `Write in the following tone and style: ${prompt}.`,
            traits,
            `Maintain this voice consistently across all content.`,
        ].join(' ');
    }
}
