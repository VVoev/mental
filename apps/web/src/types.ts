export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface VoiceInfo {
  id: string;
  name: string;
}
