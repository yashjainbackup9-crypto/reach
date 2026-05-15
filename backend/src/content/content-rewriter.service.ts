import { Injectable, Logger } from '@nestjs/common';
import { AIProviderService, AIProviderName } from '../ai-provider/ai-provider.service';

export interface RewriteAiConfig {
  provider?: string;
  model?: string;
  apiKey?: string;
  maxTokens?: number;
}

@Injectable()
export class ContentRewriterService {
  private readonly logger = new Logger(ContentRewriterService.name);

  constructor(private readonly aiProvider: AIProviderService) {}

  async rewrite(
    content: string,
    tonePrompt: string,
    aiConfig?: RewriteAiConfig,
  ): Promise<string> {
    const providerName = (aiConfig?.provider as AIProviderName) ?? 'gemini';
    this.logger.debug(`Rewriting content via provider: ${providerName}${aiConfig?.model ? ` model: ${aiConfig.model}` : ''}`);

    const result = await this.aiProvider.complete(providerName, {
      systemPrompt: tonePrompt,
      model: aiConfig?.model,
      maxTokens: aiConfig?.maxTokens,
      apiKey: aiConfig?.apiKey,
      messages: [
        {
          role: 'user',
          content: `Rewrite the following content according to the tone instructions. Return only the rewritten content with no extra commentary:\n\n${content}`,
        },
      ],
    });

    return result.text;
  }
}
