<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { navigate } from '../router';
import { speech } from '../state';
import { UNIT1_WORDS } from '../data/unit1';
import { STEP_COUNT, TRACK_GROUPS, playSound } from '../audio/synth';

const STORAGE_KEY = 'wordquest-studio-v1';

interface SavedState {
  bpm: number;
  cells: Record<string, boolean[]>;
}

const bpm = ref(100);
const cells = reactive<Record<string, boolean[]>>({});
const playing = ref(false);
const currentStep = ref(-1);

function ensureRow(id: string): boolean[] {
  if (!cells[id]) cells[id] = Array.from({ length: STEP_COUNT }, () => false);
  return cells[id];
}

// ---------- persistence ----------
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const s = JSON.parse(raw) as SavedState;
    if (typeof s.bpm === 'number') bpm.value = Math.min(160, Math.max(60, s.bpm));
    for (const g of TRACK_GROUPS)
      for (const r of g.rows) {
        const saved = s.cells?.[r.id];
        cells[r.id] = Array.from({ length: STEP_COUNT }, (_, i) => Boolean(saved?.[i]));
      }
  } catch {
    /* corrupted save — start clean */
  }
}

function save() {
  const snapshot: SavedState = { bpm: bpm.value, cells: {} };
  for (const g of TRACK_GROUPS)
    for (const r of g.rows) snapshot.cells[r.id] = [...(cells[r.id] ?? [])];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    /* storage full/denied — keep playing */
  }
}

load();
watch(cells, save, { deep: true });
watch(bpm, save);

// ---------- audio engine ----------
let ctx: AudioContext | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let nextTime = 0;
let step = 0;

const stepDur = computed(() => 60 / bpm.value / 2); // 8 steps per bar = eighth notes

function randomWord(): string {
  const w = UNIT1_WORDS[Math.floor(Math.random() * UNIT1_WORDS.length)];
  return w.en;
}

function randomLetter(): string {
  return String.fromCharCode(65 + Math.floor(Math.random() * 26));
}

function triggerStep(s: number, when: number) {
  for (const g of TRACK_GROUPS) {
    for (const r of g.rows) {
      if (!cells[r.id]?.[s]) continue;
      if (r.kind === 'word') speech.speak(randomWord());
      else if (r.kind === 'letter') speech.speak(randomLetter());
      else if (ctx) playSound(ctx, r.id, when, stepDur.value);
    }
  }
}

function scheduler() {
  if (!ctx) return;
  const ahead = 0.12;
  while (nextTime < ctx.currentTime + ahead) {
    triggerStep(step, nextTime);
    const uiStep = step;
    // Slightly later UI highlight so it lands with the sound.
    setTimeout(() => {
      currentStep.value = uiStep;
    }, Math.max(0, (nextTime - ctx.currentTime) * 1000));
    nextTime += stepDur.value;
    step = (step + 1) % STEP_COUNT;
  }
}

function togglePlay() {
  if (playing.value) {
    stop();
    return;
  }
  if (!ctx) ctx = new AudioContext();
  void ctx.resume();
  step = 0;
  nextTime = ctx.currentTime + 0.06;
  playing.value = true;
  timer = setInterval(scheduler, 25);
}

function stop() {
  playing.value = false;
  currentStep.value = -1;
  if (timer) clearInterval(timer);
  timer = null;
}

function clearAll() {
  for (const g of TRACK_GROUPS) for (const r of g.rows) cells[r.id] = Array.from({ length: STEP_COUNT }, () => false);
}

function tapCell(rowId: string, i: number) {
  const row = ensureRow(rowId);
  row[i] = !row[i];
  // Audition the sound immediately on tap-on so kids hear what they placed.
  if (row[i] && ctx) {
    const def = TRACK_GROUPS.flatMap((g) => g.rows).find((r) => r.id === rowId);
    if (!def?.kind) playSound(ctx, rowId, ctx.currentTime, stepDur.value);
  }
}

onBeforeUnmount(stop);
</script>

<template>
  <div class="shell">
    <header class="topbar">
      <button type="button" class="icon-btn" aria-label="Atpakaļ uz sākumu" @click="navigate({ name: 'home' })">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <span class="quiz-mode">🎛️ Muzikālais darbnīca</span>
      <button
        type="button"
        class="icon-btn"
        aria-label="Notīrīt visu"
        title="Notīrīt visu"
        @click="clearAll"
      >
        🗑️
      </button>
    </header>

    <main class="studio">
      <div class="studio-controls">
        <button
          type="button"
          class="btn btn--primary studio-play"
          @click="togglePlay"
        >{{ playing ? '⏹ Stop' : '▶ Play' }}</button>
        <label class="studio-tempo">
          <span>Temps: <strong>{{ bpm }}</strong></span>
          <input v-model.number="bpm" type="range" min="60" max="160" step="5" />
        </label>
      </div>

      <div class="step-head" aria-hidden="true">
        <span class="track-label" />
        <span v-for="i in STEP_COUNT" :key="i" class="step-num">{{ i }}</span>
      </div>

      <section v-for="g in TRACK_GROUPS" :key="g.id" class="track-group">
        <h3 class="track-group__title">{{ g.title }}</h3>
        <div v-for="r in g.rows" :key="r.id" class="track-row">
          <span class="track-label" :title="r.label">{{ r.icon }} {{ r.label }}</span>
          <button
            v-for="i in STEP_COUNT"
            :key="i"
            type="button"
            class="cell"
            :class="[
              `cell--${g.id}`,
              {
                'cell--on': cells[r.id]?.[i - 1],
                'cell--playhead': currentStep === i - 1 && playing,
              },
            ]"
            :aria-pressed="cells[r.id]?.[i - 1]"
            :aria-label="`${r.label}, solis ${i}`"
            @click="tapCell(r.id, i - 1)"
          />
        </div>
      </section>
    </main>
  </div>
</template>
