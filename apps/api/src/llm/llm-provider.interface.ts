export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmProvider {
  stream(messages: ChatMessage[], signal?: AbortSignal): AsyncIterable<string>;
}
