<script setup lang="ts">
import { useOnboardingStore } from './stores/onboarding';
import OnboardingView from './views/OnboardingView.vue';
import SessionView from './views/SessionView.vue';

const onboarding = useOnboardingStore();
</script>

<template>
  <SessionView v-if="onboarding.completed" />
  <OnboardingView v-else />
</template>
