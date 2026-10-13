<script setup lang="ts">
import { computed, ref } from 'vue';
import { LESSONS } from '../data/unit1';
import { app, bump, progress } from '../state';
import { navigate } from '../router';
import deskUrl from '../assets/words/desk.svg?url';
import classroomUrl from '../assets/words/classroom.svg?url';
import InstallHelp from '../components/InstallHelp.vue';

const lessonIcons: Record<number, string> = { 1: deskUrl, 5: classroomUrl };

const tick = computed(() => app.tick);
const dueCount = computed(() => {
  tick.value;
  return progress.dueWordIds(Date.now()).length;
});

function learned(lessonId: number): number {
  tick.value;
  const lesson = LESSONS.find((l) => l.id === lessonId)!;
  return progress.learnedCount(lesson.words.map((w) => w.id));
}

function masteredIn(lessonId: number): number {
  tick.value;
  const lesson = LESSONS.find((l) => l.id === lessonId)!;
  return lesson.words.filter((w) => progress.get(w.id).mastered).length;
}

const showInstall = ref(false);
const showReset = ref(false);

function startReview() {
  app.reviewWordIds = progress.dueWordIds(Date.now());
  app.reviewIsRetry = false;
  app.reviewSessionId += 1;
  navigate({ name: 'review' });
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
      <div class="brand">
        <div class="brand-badge" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path
              d="M12 3l1.6 3.4 3.7.5-2.7 2.6.7 3.7L12 11.5 8.7 13.2l.7-3.7-2.7-2.6 3.7-.5Z"
              fill="#f5a623"
            />
            <path
              d="M4 14.5Q8 12.5 12 14.5v5.5Q8 18 4 19.8ZM20 14.5Q16 12.5 12 14.5v5.5Q16 18 20 19.8Z"
              fill="#ffffff"
            />
          </svg>
        </div>
        <div>
          <h1>Word Quest</h1>
          <p class="subtitle">Unit 1</p>
        </div>
      </div>
      <button
        type="button"
        class="icon-btn"
        :aria-pressed="app.soundOn"
        :aria-label="app.soundOn ? 'Skaņa ieslēgta' : 'Skaņa izslēgta'"
        :title="app.soundOn ? 'Skaņa ieslēgta' : 'Skaņa izslēgta'"
        @click="app.soundOn = !app.soundOn"
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
            v-if="app.soundOn"
            d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
          <path
            v-else
            d="M16 9l6 6M22 9l-6 6"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
      </button>
    </header>

    <div v-if="!progress.persistent" class="banner" role="alert">
      ⚠️ Šī pārlūka bloķē datu saglabāšanu — spēle darbosies, bet progress var
      pazust pēc aizvēršanas.
    </div>

    <main>
      <h2 class="section-title">Izvēlies nodarbību</h2>

      <button
        v-for="lesson in LESSONS"
        :key="lesson.id"
        type="button"
        class="lesson-card"
        :class="`lesson-card--l${lesson.id}`"
        :aria-label="`Lesson ${lesson.id} · ${lesson.titleLv}, ${lesson.words.length} vārdi, apgūti ${learned(lesson.id)}`"
        @click="navigate({ name: 'learn', lesson: lesson.id })"
      >
        <span class="lesson-card__icon" aria-hidden="true">
          <svg v-if="lesson.id === 3" viewBox="0 0 64 64" width="40" height="40">
            <circle cx="24" cy="26" r="14" fill="#e5484d" stroke="#2f3a4e" stroke-width="3" />
            <circle cx="42" cy="26" r="14" fill="#2563eb" stroke="#2f3a4e" stroke-width="3" opacity="0.92" />
            <circle cx="33" cy="40" r="14" fill="#f7d038" stroke="#2f3a4e" stroke-width="3" />
          </svg>
          <img v-else :src="lessonIcons[lesson.id]" alt="" width="44" height="36" />
        </span>
        <span class="lesson-card__body">
          <p class="lesson-card__title">Lesson {{ lesson.id }} · {{ lesson.titleLv }}</p>
          <span class="lesson-card__meta">{{ lesson.words.length }} vārdi</span>
          <div class="progress-track" aria-hidden="true">
            <div
              class="progress-fill"
              :class="{ 'progress-fill--mastered': masteredIn(lesson.id) === lesson.words.length }"
              :style="{ width: `${(learned(lesson.id) / lesson.words.length) * 100}%` }"
            />
          </div>
          <span class="lesson-card__meta">
            {{ learned(lesson.id) }}/{{ lesson.words.length }} apgūti
            <template v-if="masteredIn(lesson.id)"> · ★ {{ masteredIn(lesson.id) }}</template>
          </span>
        </span>
        <span class="lesson-card__go" aria-hidden="true">▶</span>
      </button>

      <button
        type="button"
        class="btn btn--primary"
        style="width: 100%; margin-top: 6px"
        :disabled="dueCount === 0"
        @click="startReview"
      >
        Atkārtot
        <span v-if="dueCount" class="review-count">{{ dueCount }}</span>
      </button>
      <p class="center muted" style="margin-top: 6px; font-weight: 700">
        {{ dueCount ? `${dueCount} vārdi gaida atkārtošanas` : 'Nav vārdu, ko atkārtot — visi apgūti!' }}
      </p>

      <div class="btn-row">
        <button type="button" class="btn btn--ghost" @click="navigate({ name: 'progress' })">
          Mans progress
        </button>
        <button type="button" class="btn btn--ghost" @click="showInstall = true">
          Kā instalēt?
        </button>
      </div>
      <div class="btn-row">
        <button
          type="button"
          class="btn btn--ghost btn--small"
          style="border-color: var(--bad-edge); color: var(--bad-ink)"
          @click="showReset = true"
        >
          Atiestatīt progresu
        </button>
      </div>
    </main>

    <InstallHelp v-if="showInstall" @close="showInstall = false" />

    <div v-if="showReset" class="dialog-backdrop" @click.self="showReset = false">
      <div class="dialog" role="alertdialog" aria-labelledby="reset-title">
        <h2 id="reset-title">Atiestatīt progresu?</h2>
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

<style scoped>
.review-count {
  background: #fff;
  color: var(--amber-deep);
  border-radius: 999px;
  min-width: 34px;
  height: 34px;
  display: inline-grid;
  place-items: center;
  font-weight: 900;
  padding: 0 8px;
}
</style>
