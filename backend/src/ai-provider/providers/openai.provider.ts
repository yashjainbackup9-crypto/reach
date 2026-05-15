import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { IAIProvider, AICompletionOptions, AICompletionResult } from '../ai-provider.interface';

@Injectable()
export class OpenAIProvider implements IAIProvider {
  private readonly logger = new Logger(OpenAIProvider.name);
  private _client: OpenAI | null = null;
  private get client(): OpenAI {
    if (!this._client) {
      this._client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    return this._client;
  }

  readonly name = 'openai';
  readonly defaultModel = 'gpt-4o';

  async complete(options: AICompletionOptions): Promise<AICompletionResult> {
    const model = options.model ?? this.defaultModel;
    this.logger.debug(`Completing with model ${model}`);
    const client = options.apiKey ? new OpenAI({ apiKey: options.apiKey }) : this.client;

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }

    for (const m of options.messages) {
      messages.push({ role: m.role, content: m.content });
    }

    const response = await client.chat.completions.create({
      model,
      max_tokens: options.maxTokens ?? 1024,
      messages,
    });

    const text = response.choices[0]?.message?.content;
    if (!text) {
      throw new Error('Empty response from OpenAI');
    }

    return { text, provider: this.name, model };
  }
}
