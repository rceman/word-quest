<script setup lang="ts">
import { speech } from '../state';

const props = withDefaults(
  defineProps<{ text: string; label?: string }>(),
  { label: 'Klausīties' },
);

function speak() {
  // Called from a tap — a real user gesture, which iOS requires.
  speech.speak(props.text);
}
</script>

<template>
  <button
    v-if="speech.available"
    type="button"
    class="icon-btn"
    :aria-label="`${label}: ${text}`"
    :title="label"
    @click="speak"
  >
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 9v6h4l5 4V5L8 9H4Z"
        fill="currentColor"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linejoin="round"
      />
      <path
        d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      />
    </svg>
  </button>
</template>
