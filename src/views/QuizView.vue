<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { LESSONS, getWord } from '../data/unit1';
import { app, bump, progress, speech } from '../state';
import { navigate } from '../router';
import {
  advance,
  buildLessonQuestions,
  buildReviewQuestions,
  createSession,
  currentQuestion,
  lessonPoolFor,
  markAnswered,
  spellingIsCorrect,
  type Question,
  type SessionPlan,
} from '../domain/quiz';
import WordArt from '../components/WordArt.vue';
import SpeakerButton from '../components/SpeakerButton.vue';
import LetterTiles from '../components/LetterTiles.vue';
import ProgressIndicator from '../components/ProgressIndicator.vue';

const props = defineProps<{ mode: 'lesson' | 'review'; lessonId?: number }>();

const session = ref<SessionPlan | null>(null);
const feedback = reactive<{ state: 'none' | 'ok' | 'bad'; detail: string }>({
  state: 'none',
  detail: '',
});
/** picture mode: which option index was picked */
const picked = ref<number | null>(null);
/** translate mode: which option index was picked */
const pickedOption = ref<number | null>(null);
const spellResult = ref<{ ok: boolean; attempt: string } | null>(null);

function start() {
  let questions: Question[] = [];
  if (props.mode === 'lesson') {
    const lesson = LESSONS.find((l) => l.id === props.lessonId) ?? LESSONS[0];
    questions = buildLessonQuestions(lesson.words, lessonPoolFor(lesson.id));
    session.value = createSession('lesson', questions);
  } else {
    const ids = app.reviewWordIds.length
      ? app.reviewWordIds
      : progress.dueWordIds(Date.now()); // cold #/review load
    if (!ids.length) {
      navigate({ name: 'home' });
      return;
    }
    const words = ids.map(getWord);
    questions = buildReviewQuestions(words, lessonPoolFor);
    session.value = createSession(app.reviewIsRetry ? 'retry' : 'review', questions);
  }
  resetPerQuestion();
}

const q = computed(() => (session.value ? currentQuestion(session.value) : null));
const qWord = computed(() => (q.value ? getWord(q.value.wordId) : null));

function resetPerQuestion() {
  feedback.state = 'none';
  feedback.detail = '';
  picked.value = null;
  pickedOption.value = null;
  spellResult.value = null;
}

watch(
  () => [props.mode, props.lessonId],
  start,
  { immediate: true },
);

function score(correct: boolean) {
  const s = session.value;
  const question = q.value;
  if (!s || !question || s.answeredCurrent) return false;
  const outcome = markAnswered(s, correct);
  if (!outcome) return false;
  const now = Date.now();
  if (correct) {
    progress.correct(outcome.wordId, now, {
      activeRecall: question.kind === 'spell',
    });
  } else {
    progress.wrong(outcome.wordId, now);
  }
  bump();
  return true;
}

function answerTranslate(optionIndex: number) {
  const question = q.value;
  if (!question || question.kind !== 'translate' || pickedOption.value !== null) return;
  pickedOption.value = optionIndex;
  const ok = optionIndex === question.correctOptionIndex;
  const word = getWord(question.wordId);
  score(ok);
  feedback.state = ok ? 'ok' : 'bad';
  feedback.detail = ok ? '' : `Pareizā atbilde: ${word.lv}`;
  if (ok && app.soundOn) speech.speak(word.en);
}

function answerPicture(optionIndex: number) {
  const question = q.value;
  if (!question || question.kind !== 'picture' || picked.value !== null) return;
  picked.value = optionIndex;
  const ok = optionIndex === question.correctOptionIndex;
  const word = getWord(question.wordId);
  score(ok);
  feedback.state = ok ? 'ok' : 'bad';
  feedback.detail = ok ? word.lv : `Pareizā atbilde: ${word.lv}`;
}

function submitSpelling(attempt: string) {
  const question = q.value;
  if (!question || question.kind !== 'spell' || spellResult.value) return;
  const word = getWord(question.wordId);
  const ok = spellingIsCorrect(attempt, word.en);
  spellResult.value = { ok, attempt };
  score(ok);
  feedback.state = ok ? 'ok' : 'bad';
  feedback.detail = ok ? '' : `Pareizi: ${word.en}`;
}

function next() {
  const s = session.value;
  if (!s) return;
  if (advance(s)) {
    resetPerQuestion();
  } else {
    app.lastSession = s;
    if (props.mode === 'review') {
      app.reviewWordIds = [];
      app.reviewIsRetry = false;
    }
    navigate({ name: 'results' });
  }
}

function quit() {
  navigate({ name: 'home' });
}

const modeLabel = computed(() => {
  const k = q.value?.kind;
  if (k === 'translate') return 'Izvēlies tulkojumu';
  if (k === 'picture') return 'Atrodi attēlu';
  if (k === 'spell') return 'Saliec vārdu';
  return '';
});

const position = computed(() => (session.value ? session.value.index + 1 : 0));
const total = computed(() => session.value?.queue.length ?? 0);
</script>

<template>
  <div v-if="session && q && qWord" class="shell">
    <header class="topbar">
      <button type="button" class="icon-btn" aria-label="Pārtraukt un atgriezties" @click="quit">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
        </svg>
      </button>
      <span class="quiz-mode">{{ modeLabel }}</span>
      <ProgressIndicator :current="position" :total="total" />
    </header>

    <main>
      <!-- MODE A: choose translation -->
      <template v-if="q.kind === 'translate'">
        <div class="prompt-row">
          <h2 class="prompt-en" lang="en">{{ qWord.en }}</h2>
          <SpeakerButton :text="qWord.en" />
        </div>
        <p class="prompt-hint">Kā tas ir latviski?</p>
        <div class="answer-grid">
          <button
            v-for="(opt, i) in q.options"
            :key="opt.wordId"
            type="button"
            class="answer-btn"
            :class="{
              'answer-btn--correct':
                pickedOption !== null && i === q.correctOptionIndex,
              'answer-btn--wrong':
                pickedOption === i && i !== q.correctOptionIndex,
              'answer-btn--dim':
                pickedOption !== null &&
                i !== q.correctOptionIndex &&
                i !== pickedOption,
            }"
            :disabled="pickedOption !== null"
            @click="answerTranslate(i)"
          >
            <span v-if="pickedOption !== null && i === q.correctOptionIndex" class="answer-mark" aria-hidden="true">✓</span>
            <span v-else-if="pickedOption === i" class="answer-mark" aria-hidden="true">✗</span>
            {{ opt.lv }}
          </button>
        </div>
      </template>

      <!-- MODE B: find the picture -->
      <template v-else-if="q.kind === 'picture'">
        <div class="prompt-row">
          <h2 class="prompt-en" lang="en">{{ qWord.en }}</h2>
          <SpeakerButton :text="qWord.en" />
        </div>
        <p class="prompt-hint">Atrodi pareizo attēlu!</p>
        <div class="pic-grid">
          <button
            v-for="(opt, i) in q.options"
            :key="opt.id"
            type="button"
            class="pic-btn"
            :class="{
              'pic-btn--correct': picked !== null && i === q.correctOptionIndex,
              'pic-btn--wrong': picked === i && i !== q.correctOptionIndex,
            }"
            :disabled="picked !== null"
            :aria-label="picked !== null ? opt.lv : `Attēls ${i + 1}`"
            @click="answerPicture(i)"
          >
            <span class="pic-btn__art">
              <WordArt :word="opt" />
            </span>
            <span v-if="picked !== null" class="pic-btn__label">
              <template v-if="i === q.correctOptionIndex">✓ {{ opt.lv }}</template>
              <template v-else-if="picked === i">✗ {{ opt.lv }}</template>
              <template v-else>{{ opt.lv }}</template>
            </span>
          </button>
        </div>
      </template>

      <!-- MODE C: build the word -->
      <template v-else>
        <div class="spell-art" aria-hidden="true">
          <WordArt :word="qWord" />
        </div>
        <div class="prompt-row">
          <h2 class="prompt-lv">{{ qWord.lv }}</h2>
        </div>
        <p class="prompt-hint">Saliec angļu vārdu no burtiem!</p>
        <LetterTiles
          :question="q"
          :target-length="qWord.en.length"
          :locked="spellResult !== null"
          @submit="submitSpelling"
        />
        <p v-if="spellResult && !spellResult.ok" class="center" style="margin-top: 10px">
          <span class="muted">Tava atbilde:</span>
          <strong lang="en">{{ spellResult.attempt }}</strong>
        </p>
      </template>

      <!-- feedback + next -->
      <div
        v-if="feedback.state !== 'none'"
        class="feedback"
        :class="feedback.state === 'ok' ? 'feedback--ok' : 'feedback--bad'"
        role="status"
        aria-live="polite"
      >
        <span aria-hidden="true">{{ feedback.state === 'ok' ? '✓' : '✗' }}</span>
        <span>
          {{ feedback.state === 'ok' ? 'Pareizi!' : 'Nē, pagānreiz.' }}
          <template v-if="feedback.detail"> {{ feedback.detail }}</template>
        </span>
      </div>

      <div class="btn-row">
        <button
          v-if="feedback.state !== 'none'"
          type="button"
          class="btn btn--primary"
          autofocus
          @click="next"
        >
          Tālāk →
        </button>
      </div>
    </main>
  </div>
</template>
