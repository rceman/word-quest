<script setup lang="ts">
import { computed, ref } from 'vue';
import { LESSONS, UNIT1_WORDS } from '../data/unit1';
import { app, bump, progress } from '../state';
import { navigate } from '../router';

const tick = computed(() => app.tick);
const showReset = ref(false);

const mastered = computed(() => {
  tick.value;
  return progress.masteredCount();
});
const learned = computed(() => {
  tick.value;
  return progress.learnedCount(UNIT1_WORDS.map((w) => w.id));
});
const due = computed(() => {
  tick.value;
  return progress.dueWordIds(Date.now()).length;
});

interface Row {
  en: string;
  lv: string;
  correct: number;
  wrong: number;
  mastered: boolean;
  seen: boolean;
}

const rows = computed<Row[]>(() => {
  tick.value;
  return UNIT1_WORDS.map((w) => {
    const p = progress.get(w.id);
    return {
      en: w.en,
      lv: w.lv,
      correct: p.correctCount,
      wrong: p.wrongCount,
      mastered: p.mastered,
      seen: p.seenCount > 0,
    };
  });
});

function lessonProgress(id: number): string {
  const lesson = LESSONS.find((l) => l.id === id)!;
  const c = progress.learnedCount(lesson.words.map((w) => w.id));
  return `${c}/${lesson.words.length}`;
}

function confirmReset() {
  progress.reset();
  bump();
  showReset.value = false;
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
      <h1 class="section-title" style="margin: 0">Mans progress</h1>
      <span style="width: 56px" />
    </header>

    <main>
      <div class="stat-grid">
        <div class="stat-tile">
          <div class="stat-tile__num">{{ learned }}/23</div>
          <div class="stat-tile__label">vārdi apgūti</div>
        </div>
        <div class="stat-tile">
          <div class="stat-tile__num">★ {{ mastered }}</div>
          <div class="stat-tile__label">pilnībā iemācīti</div>
        </div>
        <div class="stat-tile">
          <div class="stat-tile__num">{{ due }}</div>
          <div class="stat-tile__label">gaida atkārtošanas</div>
        </div>
      </div>

      <h2 class="section-title">Nodarbības</h2>
      <div class="card">
        <div v-for="l in LESSONS" :key="l.id" style="margin-bottom: 12px">
          <div style="display: flex; justify-content: space-between; font-weight: 800">
            <span>Lesson {{ l.id }} · {{ l.titleLv }}</span>
            <span>{{ lessonProgress(l.id) }}</span>
          </div>
          <div class="progress-track">
            <div
              class="progress-fill"
              :style="{
                width: `${(Number(lessonProgress(l.id).split('/')[0]) / l.words.length) * 100}%`,
              }"
            />
          </div>
        </div>
      </div>

      <h2 class="section-title">Visi vārdi</h2>
      <div class="card" style="overflow-x: auto">
        <table class="word-table">
          <thead>
            <tr>
              <th>Angļu</th>
              <th>Latviski</th>
              <th>✓</th>
              <th>✗</th>
              <th>Statuss</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in rows" :key="r.en">
              <td lang="en" style="font-weight: 800">{{ r.en }}</td>
              <td>{{ r.lv }}</td>
              <td>{{ r.correct }}</td>
              <td>{{ r.wrong }}</td>
              <td>
                <span v-if="r.mastered" title="Apgūts">★</span>
                <span v-else-if="r.correct > 0">mācās</span>
                <span v-else-if="r.seen">redzēts</span>
                <span v-else class="muted">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="btn-row">
        <button type="button" class="btn btn--ghost" @click="navigate({ name: 'home' })">
          Atpakaļ uz sākumu
        </button>
        <button
          type="button"
          class="btn btn--danger"
          @click="showReset = true"
        >
          Atiestatīt progresu
        </button>
      </div>
    </main>

    <div v-if="showReset" class="dialog-backdrop" @click.self="showReset = false">
      <div class="dialog" role="alertdialog" aria-labelledby="reset-title2">
        <h2 id="reset-title2">Atiestatīt progresu?</h2>
        <p class="help-text">
          Viss apgūtais progress tiks dzēsts no šīs ierīces. To nevarēs atsaukt.
        </p>
        <div class="btn-row">
          <button type="button" class="btn btn--ghost" @click="showReset = false">Atcelt</button>
          <button type="button" class="btn btn--danger" @click="confirmReset">
            Jā, dzēst progresu
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
