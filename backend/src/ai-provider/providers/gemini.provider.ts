import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { IAIProvider, AICompletionOptions, AICompletionResult } from '../ai-provider.interface';

@Injectable()
export class GeminiProvider implements IAIProvider {
  private readonly logger = new Logger(GeminiProvider.name);
  private readonly client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');

  readonly name = 'gemini';
  readonly defaultModel = 'gemini-3-flash-preview';

  async complete(options: AICompletionOptions): Promise<AICompletionResult> {
    const model = options.model ?? this.defaultModel;
    this.logger.debug(`Completing with model ${model}`);
    const client = options.apiKey ? new GoogleGenerativeAI(options.apiKey) : this.client;

    const genModel = client.getGenerativeModel({
      model,
      systemInstruction: options.systemPrompt,
    });

    const history = options.messages.slice(0, -1).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const lastMessage = options.messages[options.messages.length - 1];
    if (!lastMessage) {
      throw new Error('At least one message is required');
    }

    const chat = genModel.startChat({ history });
    const result = await chat.sendMessage(lastMessage.content);
    const text = result.response.text();

    return { text, provider: this.name, model };
  }
}
