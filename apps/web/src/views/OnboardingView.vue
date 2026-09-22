<script setup lang="ts">
import { ref } from 'vue';
import { LIMITS } from '@mental-help/shared';
import { useOnboardingStore } from '../stores/onboarding';
const onboarding = useOnboardingStore();
const age = ref<number | null>(null);
const presentingIssue = ref('');
const goal = ref('');
function submit() { if (age.value !== null) onboarding.submit(age.value, presentingIssue.value, goal.value); }
</script>
<template>
  <section class="onboarding">
    <p class="eyebrow">ЕДИН РАЗГОВОР · ЕДНО РЕШЕНИЕ</p>
    <h1>Малко повече яснота.</h1>
    <p class="intro">Подреди какво знаеш, какво предполагаш и какво още ти липсва. Решението остава твое.</p>
    <p class="disclaimer">Това не е терапия и не замества лицензиран специалист. Приложението е за пълнолетни. При криза потърси спешна помощ на <a href="tel:112">112</a>.</p>
    <div v-if="onboarding.blocked" role="alert" class="blocked">
      Апликацията в момента е предназначена за пълнолетни. Говори с училищен психолог или доверен възрастен.
      <button type="button" class="secondary" @click="onboarding.$reset(); age = null">Назад</button>
    </div>
    <form v-else @submit.prevent="submit">
      <label>На колко години си?<input v-model.number="age" type="number" min="0" max="130" required /></label>
      <label>Кое решение обмисляш?<textarea v-model="presentingIssue" :maxlength="LIMITS.message" rows="4" required placeholder="Например: обмислям нова работа, но не знам какво е най-важно за мен." /></label>
      <label>Какво искаш да изясниш? (незадължително)<input v-model="goal" :maxlength="LIMITS.goal" placeholder="Можеш да оставиш празно или да промениш по-късно." /></label>
      <button type="submit" :disabled="!presentingIssue.trim() || age === null">Започни</button>
    </form>
  </section>
</template>
