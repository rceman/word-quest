<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { LESSONS } from '../data/unit1';
import { bump, progress } from '../state';
import { navigate } from '../router';
import WordArt from '../components/WordArt.vue';
import SpeakerButton from '../components/SpeakerButton.vue';
import ProgressIndicator from '../components/ProgressIndicator.vue';

const props = defineProps<{ lessonId: number }>();

const lesson = computed(
  () => LESSONS.find((l) => l.id === props.lessonId) ?? LESSONS[0],
);

const index = ref(0);
const seen = ref<Set<string>>(new Set());
const touchStartX = ref<number | null>(null);

const word = computed(() => lesson.value.words[index.value]);
const isLast = computed(() => index.value === lesson.value.words.length - 1);
const seenAll = computed(() => seen.value.size >= lesson.value.words.length);

watch(
  word,
  (w) => {
    if (w && !seen.value.has(w.id)) {
      progress.seen(w.id);
      bump();
      seen.value = new Set([...seen.value, w.id]);
    }
  },
  { immediate: true },
);

function next() {
  if (isLast.value) {
    navigate({ name: 'quiz', lesson: lesson.value.id });
    return;
  }
  index.value += 1;
}

function prev() {
  if (index.value > 0) index.value -= 1;
}

// Deliberate horizontal swipe also advances (tablet-friendly).
function onTouchStart(e: TouchEvent) {
  touchStartX.value = e.touches[0]?.clientX ?? null;
}
function onTouchEnd(e: TouchEvent) {
  if (touchStartX.value === null) return;
  const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.value;
  touchStartX.value = null;
  if (Math.abs(dx) < 48) return;
  if (dx < 0) next();
  else prev();
}
</script>

<template>
  <div class="shell" @touchstart.passive="onTouchStart" @touchend.passive="onTouchEnd">
    <header class="topbar">
      <button type="button" class="icon-btn" aria-label="Atpakaļ uz sākumu" @click="navigate({ name: 'home' })">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <span class="quiz-mode">Iepazīsti vārdus · Lesson {{ lesson.id }}</span>
      <ProgressIndicator :current="index + 1" :total="lesson.words.length" />
    </header>

    <main>
      <div class="card wordcard">
        <div class="wordcard__art">
          <WordArt :word="word" />
        </div>
        <h2 class="wordcard__en" lang="en">{{ word.en }}</h2>
        <p class="wordcard__lv">{{ word.lv }}</p>
        <SpeakerButton :text="word.en" />
      </div>

      <nav class="card-nav" aria-label="Kāršu navigācija">
        <button type="button" class="btn btn--ghost" :disabled="index === 0" @click="prev">
          ← Atpakaļ
        </button>
        <button type="button" class="btn btn--primary" @click="next">
          {{ isLast ? 'Uz viktorīnu ▶' : 'Tālāk →' }}
        </button>
      </nav>

      <div class="dots" aria-hidden="true">
        <span
          v-for="(w, i) in lesson.words"
          :key="w.id"
          class="dot"
          :class="{ 'dot--current': i === index, 'dot--seen': seen.has(w.id) && i !== index }"
        />
      </div>

      <p v-if="seenAll" class="center muted" style="font-weight: 700; margin-top: 10px">
        Visi vārdi apskatīti — laiks spēlēt!
      </p>
    </main>
  </div>
</template>
