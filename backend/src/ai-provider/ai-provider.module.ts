import { Module } from '@nestjs/common';
import { AIProviderService } from './ai-provider.service';
import { AnthropicProvider } from './providers/anthropic.provider';
import { OpenAIProvider } from './providers/openai.provider';
import { GeminiProvider } from './providers/gemini.provider';

@Module({
  providers: [AnthropicProvider, OpenAIProvider, GeminiProvider, AIProviderService],
  exports: [AIProviderService],
})
export class AIProviderModule {}
