<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { LIMITS } from '@mental-help/shared';
import { useOnboardingStore } from '../stores/onboarding';
import { useSessionStore } from '../stores/session';
const onboarding = useOnboardingStore();
const session = useSessionStore();
const draft = ref('');
onMounted(() => { if (!session.messages.length) void session.send(onboarding.presentingIssue); });
onBeforeUnmount(() => session.stop());
function send() { if (!draft.value.trim() || session.streaming) return; const text = draft.value; draft.value = ''; void session.send(text); }
function pieces(text: string) { return text.split(/(0700 40 150|\b112\b)/g); }
</script>
<template>
  <section class="session">
    <header class="session-header"><h1>Изясняване на решение</h1><button class="secondary" @click="session.end">Приключи и изчисти</button></header>
    <p class="disclaimer">Не е терапия. При криза: <a href="tel:112">112</a>, Психологична денонощна линия за кризи: <a href="tel:070040150">0700 40 150</a>.</p>
    <label class="goal">Моята цел (незадължително)<input v-model="onboarding.goal" :maxlength="LIMITS.goal" placeholder="Какво искаш да изясниш?" :disabled="session.streaming" /></label>
    <p class="hint">Промяната на целта важи за следващото съобщение. Можеш и да я изтриеш.</p>
    <div class="messages" role="log" aria-label="Разговор" :aria-busy="session.streaming">
      <article v-for="(m, i) in session.messages" :key="i" class="message" :class="m.role" :aria-label="m.role === 'user' ? 'Съобщение от теб' : session.config?.mode === 'demo' ? 'Демо отговор' : 'AI отговор'">
        <strong>{{ m.role === 'user' ? 'Ти' : session.config?.mode === 'demo' ? 'Демо' : 'AI' }}</strong>
        <span v-for="(piece, n) in pieces(m.content)" :key="n"><a v-if="piece === '112' || piece === '0700 40 150'" :href="`tel:${piece.replaceAll(' ', '')}`">{{ piece }}</a><template v-else>{{ piece }}</template></span>
        <small v-if="m.incomplete">{{ session.streaming ? 'Отговорът се показва…' : 'Незавършен отговор' }}</small>
      </article>
    </div>
    <div v-if="session.error" role="alert" class="error"><p>{{ session.error }}</p><button v-if="session.retryText" class="secondary" :disabled="session.streaming" @click="session.retry">Опитай отново</button></div>
    <form class="composer" @submit.prevent="send">
      <label>Твоето съобщение<textarea v-model="draft" rows="3" :maxlength="LIMITS.message" placeholder="Какво знаеш със сигурност?" :disabled="session.streaming" /></label>
      <div class="actions"><button type="submit" :disabled="session.streaming || !draft.trim()">Изпрати</button><button v-if="session.streaming" type="button" class="secondary" @click="session.stop">Спри отговора</button><button type="button" class="secondary" :disabled="session.streaming" @click="session.openSummary">Моята равносметка</button></div>
    </form>
    <section v-if="session.summaryOpen" class="summary" aria-label="Моята равносметка">
      <h2>Моята равносметка</h2><p>Лична бележка, не AI анализ. Началното описание е копирано дословно; редактирай го свободно. Останалото попълваш ти. Бележката не се изпраща към AI.</p>
      <label>Какво съм описал<textarea v-model="session.facts" :maxlength="LIMITS.message" rows="3" /></label>
      <label>Мои предположения<textarea v-model="session.interpretations" :maxlength="LIMITS.message" rows="2" /></label>
      <label>Какво още не знам<textarea v-model="session.unknowns" :maxlength="LIMITS.message" rows="2" /></label>
      <label>Моя следваща стъпка (незадължително)<textarea v-model="session.nextStep" :maxlength="LIMITS.message" rows="2" /></label>
      <div class="actions"><button @click="session.copySummary">Копирай равносметката</button><button class="secondary" @click="session.summaryOpen = false">Затвори</button></div>
      <p class="hint">Копирането поставя текста в клипборда на устройството. Приключването изчиства приложението, но не клипборда.</p>
      <p v-if="session.copied" role="status">Копирано.</p><p v-if="session.copyError" role="alert">Копирането не успя. Можеш да маркираш текста ръчно.</p>
    </section>
  </section>
</template>
