<script setup lang="ts">
import type { WordEntry } from '../data/unit1';
import ColorSwatch from './ColorSwatch.vue';
import binUrl from '../assets/words/bin.svg?url';
import boardUrl from '../assets/words/board.svg?url';
import chairUrl from '../assets/words/chair.svg?url';
import clockUrl from '../assets/words/clock.svg?url';
import cupboardUrl from '../assets/words/cupboard.svg?url';
import deskUrl from '../assets/words/desk.svg?url';
import doorUrl from '../assets/words/door.svg?url';
import windowUrl from '../assets/words/window.svg?url';
import classroomUrl from '../assets/words/classroom.svg?url';
import playgroundUrl from '../assets/words/playground.svg?url';
import studentUrl from '../assets/words/student.svg?url';
import teacherUrl from '../assets/words/teacher.svg?url';

const ART: Record<string, string> = {
  bin: binUrl,
  board: boardUrl,
  chair: chairUrl,
  clock: clockUrl,
  cupboard: cupboardUrl,
  desk: deskUrl,
  door: doorUrl,
  window: windowUrl,
  classroom: classroomUrl,
  playground: playgroundUrl,
  student: studentUrl,
  teacher: teacherUrl,
};

defineProps<{ word: WordEntry; decorative?: boolean }>();
</script>

<template>
  <ColorSwatch v-if="word.color" :word="word" />
  <img
    v-else-if="word.asset && ART[word.asset]"
    :src="ART[word.asset]"
    :alt="decorative ? '' : word.lv"
    :aria-hidden="decorative ? 'true' : undefined"
    draggable="false"
  />
  <!-- Fallback: labelled tile so a missing asset never renders blank. -->
  <div v-else class="art-fallback" role="img" :aria-label="word.lv">{{ word.lv }}</div>
</template>

<style scoped>
.art-fallback {
  width: 100%;
  height: 100%;
  min-height: 90px;
  display: grid;
  place-items: center;
  border-radius: 16px;
  background: var(--bg-soft);
  border: 3px solid var(--edge);
  font-weight: 800;
  color: var(--ink-soft);
  font-size: 1.1rem;
  text-align: center;
  padding: 8px;
}
</style>
