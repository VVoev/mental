import { defineStore } from 'pinia';

export const useOnboardingStore = defineStore('onboarding', {
  state: () => ({
    age: null as number | null,
    presentingIssue: '',
    completed: false,
    blocked: false,
  }),
  actions: {
    submit(age: number, presentingIssue: string) {
      if (age < 18) {
        this.blocked = true;
        this.completed = false;
        return;
      }
      this.age = age;
      this.presentingIssue = presentingIssue;
      this.completed = true;
      this.blocked = false;
    },
  },
});
