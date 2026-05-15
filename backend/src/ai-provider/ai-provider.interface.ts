export interface AICompletionOptions {
  messages: AIMessage[];
  systemPrompt?: string;
  model?: string;
  maxTokens?: number;
  apiKey?: string; // overrides the provider's env-var key for this request
}

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AICompletionResult {
  text: string;
  provider: string;
  model: string;
}

export interface IAIProvider {
  readonly name: string;
  readonly defaultModel: string;
  complete(options: AICompletionOptions): Promise<AICompletionResult>;
}
