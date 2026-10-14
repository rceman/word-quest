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
  /** Per-row sound pick for 'word'/'letter' tracks; '' = random. */
  pick: Record<string, string>;
  /** Per-row note length as a fraction of a step: 1, 0.5 or 0.25. */
  lens: Record<string, number>;
  /** Per-row volume 0..1. */
  vols: Record<string, number>;
  /** Per-group volume 0..1, multiplied with the row volume. */
  gvols: Record<string, number>;
}

const bpm = ref(100);
const cells = reactive<Record<string, boolean[]>>({});
const pick = reactive<Record<string, string>>({});
const lens = reactive<Record<string, number>>({});
const vols = reactive<Record<string, number>>({});
const gvols = reactive<Record<string, number>>({});
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
    for (const k of Object.keys(s.pick ?? {})) pick[k] = s.pick[k];
    for (const k of Object.keys(s.lens ?? {})) lens[k] = s.lens[k];
    for (const k of Object.keys(s.vols ?? {})) vols[k] = s.vols[k];
    for (const k of Object.keys(s.gvols ?? {})) gvols[k] = s.gvols[k];
  } catch {
    /* corrupted save — start clean */
  }
}

function save() {
  const snapshot: SavedState = {
    bpm: bpm.value,
    cells: {},
    pick: { ...pick },
    lens: { ...lens },
    vols: { ...vols },
    gvols: { ...gvols },
  };
  for (const g of TRACK_GROUPS)
    for (const r of g.rows) snapshot.cells[r.id] = [...(cells[r.id] ?? [])];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    /* storage full/denied — keep playing */
  }
}

load();
for (const g of TRACK_GROUPS) {
  if (gvols[g.id] == null) gvols[g.id] = 1;
  for (const r of g.rows) {
    if (lens[r.id] == null) lens[r.id] = 1;
    if (vols[r.id] == null) vols[r.id] = 1;
  }
}
watch(cells, save, { deep: true });
watch(pick, save, { deep: true });
watch(lens, save, { deep: true });
watch(vols, save, { deep: true });
watch(gvols, save, { deep: true });
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

function volFor(groupId: string, rowId: string): number {
  return (vols[rowId] ?? 1) * (gvols[groupId] ?? 1);
}

function findRow(rowId: string): { g: (typeof TRACK_GROUPS)[number]; r: (typeof TRACK_GROUPS)[number]['rows'][number] } | null {
  for (const g of TRACK_GROUPS) {
    const r = g.rows.find((x) => x.id === rowId);
    if (r) return { g, r };
  }
  return null;
}

function triggerStep(s: number, when: number) {
  for (const g of TRACK_GROUPS) {
    for (const r of g.rows) {
      if (!cells[r.id]?.[s]) continue;
      const frac = lens[r.id] ?? 1;
      const vol = volFor(g.id, r.id);
      if (vol <= 0) continue;
      if (r.kind === 'word' || r.kind === 'letter') {
        const text = pick[r.id] || (r.kind === 'word' ? randomWord() : randomLetter());
        speech.speak(text, vol);
        // Trim spoken audio for short notes: cut the tail of the word.
        const ms = 800 * frac;
        setTimeout(() => {
          if (frac < 1) speech.stop();
        }, ms);
      } else if (ctx) {
        playSound(ctx, r.id, when, stepDur.value * frac, vol);
      }
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
    const found = findRow(rowId);
    if (found && !found.r.kind) {
      playSound(ctx, rowId, ctx.currentTime, stepDur.value * (lens[rowId] ?? 1), volFor(found.g.id, rowId));
    }
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
        <h3 class="track-group__title">
          <span>{{ g.title }}</span>
          <input
            v-model.number="gvols[g.id]"
            type="range"
            min="0"
            max="1"
            step="0.05"
            class="group-vol"
            :aria-label="`Skaļums grupai ${g.title}`"
          />
        </h3>
        <div v-for="r in g.rows" :key="r.id" class="track-row">
          <span class="track-label" :title="r.label">
            {{ r.icon }}
            <select
              v-if="r.kind === 'word'"
              v-model="pick[r.id]"
              class="track-pick"
              :aria-label="`Izvēlies vārdu rindai ${r.label}`"
              @click.stop
            >
              <option value="">nejaušs</option>
              <option v-for="w in UNIT1_WORDS" :key="w.id" :value="w.en">{{ w.en }}</option>
            </select>
            <select
              v-else-if="r.kind === 'letter'"
              v-model="pick[r.id]"
              class="track-pick"
              :aria-label="`Izvēlies burtu rindai ${r.label}`"
              @click.stop
            >
              <option value="">nejaušs</option>
              <option v-for="c in 26" :key="c" :value="String.fromCharCode(64 + c)">
                {{ String.fromCharCode(64 + c) }}
              </option>
            </select>
            <template v-else>{{ r.label }}</template>
            <select
              v-model.number="lens[r.id]"
              class="track-pick track-pick--len"
              :aria-label="`Nots garums rindai ${r.label}`"
              @click.stop
            >
              <option :value="1">𝅘𝅥</option>
              <option :value="0.5">½</option>
              <option :value="0.25">¼</option>
            </select>
            <input
              v-model.number="vols[r.id]"
              type="range"
              min="0"
              max="1"
              step="0.05"
              class="track-vol"
              :aria-label="`Skaļums rindai ${r.label}`"
              @click.stop
            />
          </span>
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
