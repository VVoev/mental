import { defineStore } from 'pinia';
import { markRaw } from 'vue';
import { LIMITS, type ChatMessage, type AppConfig } from '@mental-help/shared';
import { loadConfig, streamMessage } from '../api/session';
import { useOnboardingStore } from './onboarding';

export const useSessionStore = defineStore('session', {
  state: () => ({
    messages: [] as (ChatMessage & { incomplete?: boolean })[], streaming: false, error: '',
    config: null as AppConfig | null, configError: false, loading: false,
    controller: null as AbortController | null, generation: 0, retryText: '',
    summaryOpen: false, facts: '', interpretations: '', unknowns: '', nextStep: '', copied: false, copyError: false,
  }),
  actions: {
    async initialize() {
      this.loading = true; this.configError = false;
      try { this.config = await loadConfig(); } catch { this.configError = true; } finally { this.loading = false; }
    },
    async send(text: string, retry = false) {
      if (this.streaming || !text.trim() || !this.config) return;
      const onboarding = useOnboardingStore();
      const clean = text.trim();
      let history = this.messages.filter(m => !m.incomplete).map(({ role, content }) => ({ role, content }));
      if (retry && history.at(-1)?.role === 'user') history = history.slice(0, -1);
      const candidate = [...history, { role: 'user' as const, content: clean }];
      const total = candidate.reduce((n, m) => n + m.content.length, 0) + onboarding.presentingIssue.length + onboarding.goal.length;
      if (clean.length > LIMITS.message || candidate.length > LIMITS.turns || total > LIMITS.history) {
        this.error = 'Достигнат е лимитът за този разговор. Можеш да запишеш равносметката и да започнеш нов.'; return;
      }
      const id = ++this.generation;
      const controller = markRaw(new AbortController());
      this.controller = controller;
      this.error = ''; this.retryText = ''; this.streaming = true;
      this.messages = [...candidate, { role: 'assistant', content: '', incomplete: true }];
      const index = this.messages.length - 1;
      const timer = window.setTimeout(() => controller.abort('timeout'), LIMITS.timeoutMs + 2000);
      try {
        await streamMessage({ age: onboarding.age!, presentingIssue: onboarding.presentingIssue, goal: onboarding.goal, messages: candidate }, delta => {
          if (id === this.generation) this.messages[index].content += delta;
        }, controller.signal);
        if (id === this.generation) this.messages[index].incomplete = false;
      } catch {
        if (id === this.generation) {
          this.error = controller.signal.aborted && controller.signal.reason !== 'timeout'
            ? 'Отговорът е спрян. Можеш да опиташ отново.'
            : 'Отговорът не завърши. Опитай отново след малко.';
          this.retryText = clean;
        }
      } finally {
        window.clearTimeout(timer);
        if (id === this.generation) { this.streaming = false; this.controller = null; }
      }
    },
    stop() { this.controller?.abort(); },
    retry() { if (this.retryText) void this.send(this.retryText, true); },
    openSummary() {
      this.summaryOpen = true; this.copied = false; this.copyError = false;
      if (!this.facts) this.facts = useOnboardingStore().presentingIssue;
    },
    async copySummary() {
      const text = `Моята равносметка\n\nКакво съм описал:\n${this.facts}\n\nМои предположения:\n${this.interpretations}\n\nКакво още не знам:\n${this.unknowns}\n\nМоя следваща стъпка:\n${this.nextStep}`;
      const id = this.generation;
      try { await navigator.clipboard.writeText(text); if (id === this.generation) this.copied = true; }
      catch { if (id === this.generation) this.copyError = true; }
    },
    end() {
      this.controller?.abort();
      const generation = this.generation + 1;
      const config = this.config;
      this.$reset(); this.generation = generation; this.config = config;
      useOnboardingStore().$reset();
    },
  },
});
