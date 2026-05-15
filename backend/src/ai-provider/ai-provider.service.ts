import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { AnthropicProvider } from './providers/anthropic.provider';
import { OpenAIProvider } from './providers/openai.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { IAIProvider, AICompletionOptions, AICompletionResult } from './ai-provider.interface';

export type AIProviderName = 'anthropic' | 'openai' | 'gemini';

@Injectable()
export class AIProviderService implements OnModuleInit {
  private readonly logger = new Logger(AIProviderService.name);
  private readonly providers = new Map<string, IAIProvider>();

  constructor(
    private readonly anthropic: AnthropicProvider,
    private readonly openai: OpenAIProvider,
    private readonly gemini: GeminiProvider,
  ) {}

  onModuleInit() {
    this.providers.set(this.anthropic.name, this.anthropic);
    this.providers.set(this.openai.name, this.openai);
    this.providers.set(this.gemini.name, this.gemini);
    this.logger.log(`Registered AI providers: ${[...this.providers.keys()].join(', ')}`);
  }

  getProvider(name: AIProviderName): IAIProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new NotFoundException(`AI provider "${name}" not found`);
    }
    return provider;
  }

  getDefaultProvider(): IAIProvider {
    const name = (process.env.DEFAULT_AI_PROVIDER as AIProviderName) ?? 'anthropic';
    return this.getProvider(name);
  }

  async complete(
    providerName: AIProviderName,
    options: AICompletionOptions,
  ): Promise<AICompletionResult> {
    return this.getProvider(providerName).complete(options);
  }

  listProviders(): string[] {
    return [...this.providers.keys()];
  }
}
