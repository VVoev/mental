import { defineStore } from 'pinia';
import { LIMITS } from '@mental-help/shared';
export const useOnboardingStore = defineStore('onboarding', {
  state: () => ({ age: null as number | null, presentingIssue: '', goal: '', completed: false, blocked: false }),
  actions: {
    submit(age: number, presentingIssue: string, goal: string) {
      if (!Number.isInteger(age) || age < 0 || age > 130) return;
      if (age < 18) { this.blocked = true; return; }
      if (!presentingIssue.trim() || presentingIssue.length > LIMITS.message || goal.length > LIMITS.goal) return;
      this.age = age; this.presentingIssue = presentingIssue.trim(); this.goal = goal.trim(); this.completed = true; this.blocked = false;
    },
  },
});
