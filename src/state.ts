import { reactive, readonly } from 'vue';
import { createProgressStore, type ProgressStore } from './services/progress';
import { createSpeechService, type SpeechService } from './services/speech';
import type { SessionPlan } from './domain/quiz';

/**
 * App-wide singletons. `tick` bumps after every progress mutation so
 * computed properties re-read the (non-reactive) store.
 */
export const progress: ProgressStore = createProgressStore();
export const speech: SpeechService = createSpeechService();

export const app = reactive({
  /** Bump to invalidate progress-dependent computeds. */
  tick: 0,
  /** Last finished session summary, consumed by ResultsView. */
  lastSession: null as SessionPlan | null,
  /** Word ids queued for the next review session (due list or retry list). */
  reviewWordIds: [] as string[],
  /** true when reviewWordIds came from "Atkārtot kļūdas". */
  reviewIsRetry: false,
  /** Bumped each time a review session is queued; used as the view key. */
  reviewSessionId: 0,
  soundOn: true,
});

export function bump(): void {
  app.tick += 1;
}

export const appReadonly = readonly(app);
