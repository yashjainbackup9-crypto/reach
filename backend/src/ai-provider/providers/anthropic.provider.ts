import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { IAIProvider, AICompletionOptions, AICompletionResult } from '../ai-provider.interface';

@Injectable()
export class AnthropicProvider implements IAIProvider {
  private readonly logger = new Logger(AnthropicProvider.name);
  private readonly client = new Anthropic();

  readonly name = 'anthropic';
  readonly defaultModel = 'claude-sonnet-4-6';

  async complete(options: AICompletionOptions): Promise<AICompletionResult> {
    const model = options.model ?? this.defaultModel;
    this.logger.debug(`Completing with model ${model}`);
    const client = options.apiKey ? new Anthropic({ apiKey: options.apiKey }) : this.client;

    const response = await client.messages.create({
      model,
      max_tokens: options.maxTokens ?? 1024,
      system: options.systemPrompt,
      messages: options.messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const block = response.content[0];
    if (block.type !== 'text') {
      throw new Error('Unexpected non-text response from Anthropic');
    }

    return { text: block.text, provider: this.name, model };
  }
}
