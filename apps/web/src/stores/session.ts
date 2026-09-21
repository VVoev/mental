import { defineStore } from 'pinia';
import type { ChatMessage, VoiceInfo } from '../types';
import { listVoices, streamMessage, speak } from '../api/session';

export const useSessionStore = defineStore('session', {
  state: () => ({
    messages: [] as ChatMessage[],
    streaming: false,
    error: null as string | null,
    voiceReplies: true,
    speaking: false,
    voices: [] as VoiceInfo[],
    selectedVoiceId: null as string | null,
    voicesLoading: false,
    voicesError: null as string | null,
  }),
  actions: {
    async loadVoices() {
      if (this.voices.length > 0 || this.voicesLoading) return;
      this.voicesLoading = true;
      this.voicesError = null;
      try {
        this.voices = await listVoices();
        if (!this.selectedVoiceId && this.voices.length > 0) {
          this.selectedVoiceId = this.voices[0].id;
        }
      } catch (e) {
        const code = e instanceof Error ? e.message : 'unknown';
        if (code === 'tts_not_configured') {
          this.voicesError =
            'ElevenLabs не е конфигуриран. Добави ELEVENLABS_API_KEY в apps/api/.env и рестартирай API-то.';
        } else if (code === 'voices_unavailable') {
          this.voicesError =
            'Неуспешно зареждане на гласове от ElevenLabs. Провери API ключа и рестартирай API-то.';
        } else {
          this.voicesError = `Гласовете не се заредиха (${code}).`;
        }
      } finally {
        this.voicesLoading = false;
      }
    },

    async send(age: number, presentingIssue: string, text: string) {
      this.error = null;
      this.messages.push({ role: 'user', content: text });
      this.messages.push({ role: 'assistant', content: '' });
      this.streaming = true;

      try {
        await streamMessage(
          { age, presentingIssue, messages: this.messages.slice(0, -1) },
          (delta) => {
            this.messages[this.messages.length - 1].content += delta;
          },
        );
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Unknown error';
      } finally {
        this.streaming = false;
      }

      if (this.voiceReplies && !this.error) {
        await this.speakLastReply();
      }
    },

    async speakLastReply() {
      const last = this.messages[this.messages.length - 1];
      if (!last || last.role !== 'assistant' || !last.content.trim()) return;
      await this.playText(last.content);
    },

    async playText(text: string) {
      if (!text.trim()) return;

      this.speaking = true;
      try {
        const blob = await speak(text, this.selectedVoiceId ?? undefined);
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.addEventListener('ended', () => URL.revokeObjectURL(url));
        await audio.play();
      } catch (e) {
        // Voice output failing should never block the text conversation —
        // surface it quietly rather than through session.error.
        // eslint-disable-next-line no-console
        console.error('voice reply failed:', e instanceof Error ? e.message : e);
      } finally {
        this.speaking = false;
      }
    },
  },
});
