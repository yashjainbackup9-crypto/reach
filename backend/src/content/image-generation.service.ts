import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';

export interface ImageGenerationOptions {
  apiKey?: string;
  model?: string;
  size?: string;
  quality?: 'auto' | 'high' | 'medium' | 'low';
  style?: 'vivid' | 'natural';
}

export interface ImageGenerationResult {
  imageDataUrl: string;
  revisedPrompt?: string;
  model: string;
}

export interface PostImageContext {
  caption?: string;
  text?: string;
  author?: string;
  pageTitle?: string;
  webContext?: string;
  visualThemes?: string[];
  imageDescription?: string;
}

@Injectable()
export class ImageGenerationService {
  private readonly logger = new Logger(ImageGenerationService.name);
  private _client: OpenAI | null = null;

  private get defaultClient(): OpenAI {
    if (!this._client) {
      this._client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    return this._client;
  }

  private sanitizePrompt(raw: string): string {
    return raw
      .replace(/[–—]/g, ‘-’)
      .replace(/[‘’]/g, “’”)
      .replace(/[“”]/g, ‘”’)
      .replace(/…/g, ‘...’)
      .replace(/[^\x00-\xFF]/g, ‘ ‘);
  }

  async generateImage(prompt: string, options: ImageGenerationOptions = {}): Promise<ImageGenerationResult> {
    const model = options.model ?? ‘gpt-image-2-2026-04-21’;
    const client = options.apiKey ? new OpenAI({ apiKey: options.apiKey }) : this.defaultClient;

    this.logger.debug(`Generating image model=${model} size=${options.size ?? ‘1024x1024’}`);

    const params: Record<string, unknown> = {
      model,
      prompt: this.sanitizePrompt(prompt),
      n: 1,
      size: options.size ?? '1024x1024',
      quality: options.quality ?? 'auto',
    };

    // 'style' is only supported by dall-e-3, not gpt-image-2
    if (options.style && model === 'dall-e-3') params.style = options.style;

    const response = await (client.images as any).generate(params);

    const item = response.data?.[0];
    if (!item?.b64_json) {
      throw new Error('No image data returned from OpenAI image generation');
    }

    return {
      imageDataUrl: `data:image/png;base64,${item.b64_json}`,
      revisedPrompt: item.revised_prompt,
      model,
    };
  }

  buildPromptFromPost(context: PostImageContext, customPrompt?: string): string {
    const parts: string[] = [];

    const content = context.caption?.trim() || context.text?.trim();
    if (content) {
      parts.push(`Create a compelling social media visual for: "${content}"`);
    }

    if (context.author?.trim()) {
      parts.push(`posted by @${context.author.trim()}`);
    }

    if (context.webContext?.trim()) {
      parts.push(`Context: ${context.webContext.trim()}`);
    }

    if (context.visualThemes?.length) {
      parts.push(`Visual elements: ${context.visualThemes.join(', ')}`);
    }

    if (context.imageDescription?.trim()) {
      parts.push(`Reference style: ${context.imageDescription.trim()}`);
    }

    if (customPrompt?.trim()) {
      parts.push(customPrompt.trim());
    }

    if (parts.length === 0) {
      return 'Generate a visually striking, professional social media image suitable for Instagram';
    }

    parts.push('Style: high quality, modern, eye-catching, suitable for social media.');
    return parts.join('. ');
  }
}
