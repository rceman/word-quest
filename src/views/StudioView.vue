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
  /** Per-note overrides set in the cell editor. */
  cpick: Record<string, (string | undefined)[]>;
  clen: Record<string, (number | undefined)[]>;
  cvol: Record<string, (number | undefined)[]>;
  /** Per-note pitch offset in semitones (-12..+12). */
  csemis: Record<string, (number | undefined)[]>;
}

const bpm = ref(100);
const cells = reactive<Record<string, boolean[]>>({});
const pick = reactive<Record<string, string>>({});
const lens = reactive<Record<string, number>>({});
const vols = reactive<Record<string, number>>({});
const gvols = reactive<Record<string, number>>({});
const cpick = reactive<Record<string, (string | undefined)[]>>({});
const clen = reactive<Record<string, (number | undefined)[]>>({});
const cvol = reactive<Record<string, (number | undefined)[]>>({});
const csemis = reactive<Record<string, (number | undefined)[]>>({});
const playing = ref(false);
const currentStep = ref(-1);
const editing = ref<{ rowId: string; i: number } | null>(null);

const LEN_OPTIONS = [
  { v: 1, t: '𝅘𝅥' },
  { v: 0.5, t: '½' },
  { v: 0.25, t: '¼' },
];

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
    for (const k of Object.keys(s.cpick ?? {})) cpick[k] = s.cpick[k];
    for (const k of Object.keys(s.clen ?? {})) clen[k] = s.clen[k];
    for (const k of Object.keys(s.cvol ?? {})) cvol[k] = s.cvol[k];
    for (const k of Object.keys(s.csemis ?? {})) csemis[k] = s.csemis[k];
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
    cpick: { ...cpick },
    clen: { ...clen },
    cvol: { ...cvol },
    csemis: { ...csemis },
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
watch(cpick, save, { deep: true });
watch(clen, save, { deep: true });
watch(cvol, save, { deep: true });
watch(csemis, save, { deep: true });
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

function volFor(groupId: string, rowId: string, i?: number): number {
  const rowVol = (i === undefined ? undefined : cvol[rowId]?.[i]) ?? vols[rowId] ?? 1;
  return rowVol * (gvols[groupId] ?? 1);
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
      const frac = clen[r.id]?.[s] ?? lens[r.id] ?? 1;
      const vol = volFor(g.id, r.id, s);
      const semis = csemis[r.id]?.[s] ?? 0;
      if (vol <= 0) continue;
      if (r.kind === 'word' || r.kind === 'letter') {
        const text = cpick[r.id]?.[s] || pick[r.id] || (r.kind === 'word' ? randomWord() : randomLetter());
        speech.speak(text, vol, Math.pow(2, semis / 12));
        // Trim spoken audio for short notes: cut the tail of the word.
        const ms = 800 * frac;
        setTimeout(() => {
          if (frac < 1) speech.stop();
        }, ms);
      } else if (ctx) {
        playSound(ctx, r.id, when, stepDur.value * frac, vol, semis);
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

function cellArr<T>(m: Record<string, (T | undefined)[]>, rowId: string): (T | undefined)[] {
  if (!m[rowId]) m[rowId] = Array.from({ length: STEP_COUNT });
  return m[rowId];
}

function openEditor(rowId: string, i: number) {
  const found = findRow(rowId);
  if (!found) return;
  editing.value = { rowId, i };
  cellArr(clen, rowId);
  cellArr(cvol, rowId);
  cellArr(cpick, rowId);
  cellArr(csemis, rowId);
  if (clen[rowId][i] == null) clen[rowId][i] = lens[rowId] ?? 1;
  if (cvol[rowId][i] == null) cvol[rowId][i] = vols[rowId] ?? 1;
  if (csemis[rowId][i] == null) csemis[rowId][i] = 0;
  if (found.r.kind && cpick[rowId][i] == null) cpick[rowId][i] = pick[rowId] ?? '';
}

const editRow = computed(() => (editing.value ? findRow(editing.value.rowId) : null));

function auditionCell() {
  const e = editing.value;
  if (!e || !ctx) return;
  const found = findRow(e.rowId);
  if (!found) return;
  const vol = volFor(found.g.id, e.rowId, e.i);
  const semis = csemis[e.rowId]?.[e.i] ?? 0;
  if (found.r.kind === 'word' || found.r.kind === 'letter') {
    const text = cpick[e.rowId]?.[e.i] || pick[e.rowId];
    if (text) speech.speak(text, vol, Math.pow(2, semis / 12));
  } else {
    playSound(ctx, e.rowId, ctx.currentTime, stepDur.value * (clen[e.rowId]?.[e.i] ?? 1), vol, semis);
  }
}

function removeCell() {
  const e = editing.value;
  if (!e) return;
  ensureRow(e.rowId)[e.i] = false;
  if (cpick[e.rowId]) cpick[e.rowId][e.i] = undefined;
  if (clen[e.rowId]) clen[e.rowId][e.i] = undefined;
  if (cvol[e.rowId]) cvol[e.rowId][e.i] = undefined;
  if (csemis[e.rowId]) csemis[e.rowId][e.i] = undefined;
  editing.value = null;
}

function flagOf(rowId: string, i: number): string {
  const l = clen[rowId]?.[i] ?? lens[rowId] ?? 1;
  const p = cpick[rowId]?.[i];
  const semi = csemis[rowId]?.[i] ?? 0;
  let s = '';
  if (l !== 1) s = l === 0.5 ? '½' : '¼';
  if (p) s = s ? `${s} ${p}` : p;
  if (semi !== 0) s = s ? `${s} ${semi > 0 ? '+' : ''}${semi}` : `${semi > 0 ? '+' : ''}${semi}`;
  return s;
}

function tapCell(rowId: string, i: number) {
  const row = ensureRow(rowId);
  if (!row[i]) {
    row[i] = true;
    // Audition the sound immediately on tap-on so kids hear what they placed.
    if (ctx) {
      const found = findRow(rowId);
      if (found && !found.r.kind) {
        playSound(ctx, rowId, ctx.currentTime, stepDur.value * (lens[rowId] ?? 1), volFor(found.g.id, rowId));
      }
    }
  }
  openEditor(rowId, i);
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
          >
            <span v-if="cells[r.id]?.[i - 1] && flagOf(r.id, i - 1)" class="cell-flag">{{ flagOf(r.id, i - 1) }}</span>
          </button>
        </div>
      </section>

      <div v-if="editing && editRow" class="cell-editor" role="dialog" :aria-label="`Skaņas iestatījumi: ${editRow.r.label}`">
        <div class="cell-editor__head">
          <strong>{{ editRow.r.icon }} {{ editRow.r.label }} · solis {{ editing.i + 1 }}</strong>
          <button type="button" class="icon-btn" aria-label="Aizvērt" @click="editing = null">✕</button>
        </div>
        <select
          v-if="editRow.r.kind === 'word'"
          v-model="cpick[editing.rowId][editing.i]"
          class="track-pick cell-editor__pick"
          aria-label="Izvēlies vārdu šai nocei"
          @change="auditionCell"
        >
          <option value="">nejaušs</option>
          <option v-for="w in UNIT1_WORDS" :key="w.id" :value="w.en">{{ w.en }}</option>
        </select>
        <select
          v-else-if="editRow.r.kind === 'letter'"
          v-model="cpick[editing.rowId][editing.i]"
          class="track-pick cell-editor__pick"
          aria-label="Izvēlies burtu šai nocei"
          @change="auditionCell"
        >
          <option value="">nejaušs</option>
          <option v-for="c in 26" :key="c" :value="String.fromCharCode(64 + c)">
            {{ String.fromCharCode(64 + c) }}
          </option>
        </select>
        <div class="cell-editor__lens" role="group" aria-label="Nots garums">
          <button
            v-for="o in LEN_OPTIONS"
            :key="o.v"
            type="button"
            :class="{ on: clen[editing.rowId][editing.i] === o.v }"
            @click="clen[editing.rowId][editing.i] = o.v; auditionCell()"
          >
            {{ o.t }}
          </button>
        </div>
        <label class="cell-editor__vol">
          <span>Skaļums</span>
          <input
            v-model.number="cvol[editing.rowId][editing.i]"
            type="range"
            min="0"
            max="1"
            step="0.05"
            @change="auditionCell"
          />
        </label>
        <label class="cell-editor__vol">
          <span>Augstums {{ (csemis[editing.rowId][editing.i] ?? 0) > 0 ? '+' : '' }}{{ csemis[editing.rowId][editing.i] ?? 0 }}</span>
          <input
            v-model.number="csemis[editing.rowId][editing.i]"
            type="range"
            min="-12"
            max="12"
            step="1"
            @change="auditionCell"
          />
        </label>
        <button type="button" class="btn cell-editor__remove" @click="removeCell">🗑️ Noņemt skaņu</button>
      </div>
    </main>
  </div>
</template>
