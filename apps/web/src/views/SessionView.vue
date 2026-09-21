<script setup lang="ts">
import { ref, nextTick, watch, onBeforeUnmount, onMounted } from 'vue';
import { useOnboardingStore } from '../stores/onboarding';
import { useSessionStore } from '../stores/session';
import { transcribeAudio } from '../api/session';

const onboarding = useOnboardingStore();
const session = useSessionStore();
const draft = ref('');
const listEl = ref<HTMLElement | null>(null);

const previewText = ref(
  'Здравей. Какво те притеснява в момента? Разкажи ми със свои думи.',
);
const previewError = ref<string | null>(null);
const previewPlaying = ref(false);

onMounted(() => {
  void session.loadVoices();
});

async function send() {
  if (!draft.value.trim() || session.streaming) return;
  const text = draft.value;
  draft.value = '';
  await session.send(onboarding.age as number, onboarding.presentingIssue, text);
}

async function previewVoice() {
  if (previewPlaying.value || !previewText.value.trim()) return;
  previewError.value = null;
  previewPlaying.value = true;
  try {
    await session.playText(previewText.value);
  } catch {
    previewError.value = 'Прослушването се провали.';
  } finally {
    previewPlaying.value = false;
  }
}

// --- voice input -----------------------------------------------------
const recording = ref(false);
const transcribing = ref(false);
const micError = ref<string | null>(null);
let mediaRecorder: MediaRecorder | null = null;
let chunks: Blob[] = [];
let stream: MediaStream | null = null;

async function startRecording() {
  micError.value = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    micError.value = 'Нямам достъп до микрофона.';
    return;
  }
  chunks = [];
  mediaRecorder = new MediaRecorder(stream);
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  mediaRecorder.onstop = onRecordingStopped;
  mediaRecorder.start();
  recording.value = true;
}

function stopRecording() {
  mediaRecorder?.stop();
  stream?.getTracks().forEach((t) => t.stop());
  recording.value = false;
}

async function onRecordingStopped() {
  if (chunks.length === 0) return;
  const blob = new Blob(chunks, { type: mediaRecorder?.mimeType || 'audio/webm' });
  transcribing.value = true;
  try {
    const text = await transcribeAudio(blob);
    if (text.trim()) {
      await session.send(onboarding.age as number, onboarding.presentingIssue, text);
    }
  } catch {
    micError.value = 'Транскрипцията се провали, опитай пак.';
  } finally {
    transcribing.value = false;
  }
}

async function toggleRecording() {
  if (session.streaming || transcribing.value) return;
  if (recording.value) {
    stopRecording();
  } else {
    await startRecording();
  }
}

onBeforeUnmount(() => {
  stream?.getTracks().forEach((t) => t.stop());
});
// -----------------------------------------------------------------------

watch(
  () => session.messages.map((m) => m.content).join('|'),
  async () => {
    await nextTick();
    listEl.value?.scrollTo({ top: listEl.value.scrollHeight });
  },
);
</script>

<template>
  <div class="session">
    <p class="disclaimer">
      Не е терапия. При криза: 112, Психологична денонощна линия за кризи:
      0700 40 150.
    </p>

    <div class="voice-controls">
      <label class="voice-toggle">
        <input type="checkbox" v-model="session.voiceReplies" />
        Отговорите да се четат на глас
      </label>

      <label class="voice-picker">
        <span>Глас</span>
        <select
          v-model="session.selectedVoiceId"
          :disabled="session.voicesLoading || session.voices.length === 0"
        >
          <option v-if="session.voicesLoading" disabled value="">Зареждам...</option>
          <option v-for="v in session.voices" :key="v.id" :value="v.id">
            {{ v.name }}
          </option>
        </select>
      </label>
    </div>

    <p v-if="session.voicesError" class="error">{{ session.voicesError }}</p>

    <details class="voice-preview">
      <summary>Прослушай глас</summary>
      <textarea v-model="previewText" rows="3" placeholder="Текст за проба..." />
      <button
        type="button"
        :disabled="previewPlaying || session.speaking || !previewText.trim()"
        @click="previewVoice"
      >
        {{ previewPlaying || session.speaking ? '...' : 'Прослушай' }}
      </button>
      <p v-if="previewError" class="error">{{ previewError }}</p>
    </details>

    <div class="messages" ref="listEl">
      <div
        v-for="(m, i) in session.messages"
        :key="i"
        class="message"
        :class="m.role"
      >
        <strong>{{ m.role === 'user' ? 'Ти' : 'AI' }}</strong>
        <span>{{ m.content }}</span>
      </div>
      <div v-if="session.error" class="error">Грешка: {{ session.error }}</div>
      <div v-if="micError" class="error">{{ micError }}</div>
      <div v-if="session.speaking" class="status">говори...</div>
      <div v-if="transcribing" class="status">транскрибирам...</div>
    </div>

    <form class="composer" @submit.prevent="send">
      <button
        type="button"
        class="mic"
        :class="{ recording }"
        :disabled="session.streaming || transcribing"
        @click="toggleRecording"
      >
        {{ recording ? '⏹' : '🎙' }}
      </button>
      <textarea
        v-model="draft"
        rows="2"
        placeholder="Напиши нещо..."
        @keydown.enter.exact.prevent="send"
      ></textarea>
      <button type="submit" :disabled="session.streaming">
        {{ session.streaming ? '...' : 'Изпрати' }}
      </button>
    </form>
  </div>
</template>
