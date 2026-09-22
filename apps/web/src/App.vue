<script setup lang="ts">
import { onMounted } from 'vue';
import { useOnboardingStore } from './stores/onboarding';
import { useSessionStore } from './stores/session';
import OnboardingView from './views/OnboardingView.vue';
import SessionView from './views/SessionView.vue';
const onboarding = useOnboardingStore();
const session = useSessionStore();
onMounted(() => session.initialize());
</script>
<template>
  <main>
    <div v-if="session.config?.mode === 'demo'" class="demo-banner">Локално демо · Подготвени отговори, не истински AI. Без платени заявки и без изпращане към външни услуги. Разговорът се изчиства при презареждане или приключване.</div>
    <div v-else-if="session.config" class="demo-banner">AI режим · Текстът се обработва от Groq. Не въвеждай чувствителна информация в тази непубликувана тестова версия.</div>
    <p v-if="session.loading" role="status">Подготвям приложението…</p>
    <div v-else-if="session.configError" role="alert"><p>Няма връзка с локалното приложение.</p><button @click="session.initialize">Опитай отново</button></div>
    <template v-else-if="session.config"><SessionView v-if="onboarding.completed" /><OnboardingView v-else /></template>
  </main>
</template>
