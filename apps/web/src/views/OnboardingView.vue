<script setup lang="ts">
import { ref } from 'vue';
import { useOnboardingStore } from '../stores/onboarding';

const onboarding = useOnboardingStore();
const age = ref<number | null>(null);
const presentingIssue = ref('');

function submit() {
  if (age.value === null) return;
  onboarding.submit(age.value, presentingIssue.value);
}
</script>

<template>
  <div class="onboarding">
    <h1>Рефлективен спътник</h1>
    <p class="disclaimer">
      Това не е терапия и не замества лицензиран специалист. AI-то ти
      задава въпроси, не дава съвети. Ако си в криза, потърси спешна помощ
      на 112.
    </p>

    <div v-if="onboarding.blocked" class="blocked">
      Апликацията в момента е предназначена за пълнолетни. За твоята
      възраст препоръчваме да говориш с училищен психолог или доверен
      възрастен.
    </div>

    <form v-else @submit.prevent="submit">
      <label>
        На колко години си?
        <input v-model.number="age" type="number" min="0" required />
      </label>

      <label>
        С какво бих могъл да ти помогна да разсъждаваш днес?
        <textarea v-model="presentingIssue" rows="4" required></textarea>
      </label>

      <button type="submit">Започни</button>
    </form>
  </div>
</template>
