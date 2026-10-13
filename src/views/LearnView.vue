<script setup lang="ts">
import { computed, watch } from 'vue';
import { LESSONS } from '../data/unit1';
import { bump, progress } from '../state';
import { navigate } from '../router';
import WordArt from '../components/WordArt.vue';
import SpeakerButton from '../components/SpeakerButton.vue';

const props = defineProps<{ lessonId: number }>();

const lesson = computed(
  () => LESSONS.find((l) => l.id === props.lessonId) ?? LESSONS[0],
);

// The whole list is on screen at once — every word counts as "seen" on view.
watch(
  lesson,
  (l) => {
    for (const w of l.words) progress.seen(w.id);
    bump();
  },
  { immediate: true },
);

function start() {
  navigate({ name: 'quiz', lesson: lesson.value.id });
}
</script>

<template>
  <div class="shell">
    <header class="topbar">
      <button type="button" class="icon-btn" aria-label="Atpakaļ uz sākumu" @click="navigate({ name: 'home' })">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <span class="quiz-mode">Iepazīsti vārdus · Lesson {{ lesson.id }}</span>
      <span class="topbar-count">{{ lesson.words.length }} vārdi</span>
    </header>

    <main>
      <ul class="wordlist" role="list">
        <li v-for="w in lesson.words" :key="w.id" class="wordlist__row">
          <span class="wordlist__art" aria-hidden="true"><WordArt :word="w" /></span>
          <span class="wordlist__text">
            <span class="wordlist__en" lang="en">{{ w.en }}</span>
            <span class="wordlist__lv">{{ w.lv }}</span>
          </span>
          <SpeakerButton :text="w.en" />
        </li>
      </ul>
    </main>

    <footer class="bottom-cta">
      <button type="button" class="btn btn--primary btn--wide" @click="start">
        Uz viktorīnu ▶
      </button>
    </footer>
  </div>
</template>
