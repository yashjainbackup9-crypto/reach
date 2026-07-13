import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { IAIProvider, AICompletionOptions, AICompletionResult } from '../ai-provider.interface';

@Injectable()
export class GeminiProvider implements IAIProvider {
  private readonly logger = new Logger(GeminiProvider.name);
  private readonly apiKeys = (process.env.GEMINI_API_KEY ?? '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);

  readonly name = 'gemini';
  readonly defaultModel = 'gemini-3-flash-preview';

  async complete(options: AICompletionOptions): Promise<AICompletionResult> {
    const model = options.model ?? this.defaultModel;
    this.logger.debug(`Completing with model ${model}`);

    const lastMessage = options.messages[options.messages.length - 1];
    if (!lastMessage) {
      throw new Error('At least one message is required');
    }

    const history = options.messages.slice(0, -1).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const keys = options.apiKey ? [options.apiKey] : this.apiKeys;
    if (keys.length === 0) {
      throw new Error('No Gemini API key configured');
    }

    let lastError: unknown;
    for (const key of keys) {
      try {
        const client = new GoogleGenerativeAI(key);
        const genModel = client.getGenerativeModel({
          model,
          systemInstruction: options.systemPrompt,
        });

        const chat = genModel.startChat({ history });
        const result = await chat.sendMessage(lastMessage.content);
        const text = result.response.text();

        return { text, provider: this.name, model };
      } catch (error) {
        lastError = error;
        this.logger.warn(`Gemini key ...${key.slice(-4)} failed, trying next: ${(error as Error).message}`);
      }
    }

    throw lastError;
  }
}
