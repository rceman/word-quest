<script setup lang="ts">
import { computed } from 'vue';
import { getWord } from '../data/unit1';
import { app } from '../state';
import { navigate } from '../router';

const s = computed(() => app.lastSession);
const wrongWords = computed(() => (s.value?.wrongWordIds ?? []).map(getWord));
const correctCount = computed(() => s.value?.correctWordIds.length ?? 0);
const total = computed(() => correctCount.value + wrongWords.value.length);
const perfect = computed(() => wrongWords.value.length === 0 && total.value > 0);

function retryMistakes() {
  if (!s.value) return;
  app.reviewWordIds = [...s.value.wrongWordIds];
  app.reviewIsRetry = true;
  app.reviewSessionId += 1;
  navigate({ name: 'review' });
}
</script>

<template>
  <div v-if="s" class="shell">
    <main class="card results-hero">
      <div class="starburst" aria-hidden="true">{{ perfect ? '🏆' : '🌟' }}</div>
      <h1 class="section-title" style="margin-top: 4px">
        {{ perfect ? 'Lieliski!' : 'Labi padarīts!' }}
      </h1>
      <p class="results-score">{{ correctCount }}/{{ total }}</p>
      <p class="results-sub">
        {{ perfect ? 'Viss pareizi — tu esi zvaigzne!' : 'pareizas atbildes' }}
      </p>

      <template v-if="wrongWords.length">
        <h2 class="section-title" style="text-align: left">Jāatkārto:</h2>
        <ul class="mistake-list">
          <li v-for="w in wrongWords" :key="w.id">
            <span class="en" lang="en">{{ w.en }}</span>
            <span class="lv">{{ w.lv }}</span>
          </li>
        </ul>
      </template>

      <div class="btn-row" style="margin-top: 22px">
        <button
          v-if="wrongWords.length"
          type="button"
          class="btn btn--primary"
          @click="retryMistakes"
        >
          Atkārtot kļūdas
        </button>
        <button type="button" class="btn btn--ghost" @click="navigate({ name: 'home' })">
          Atpakaļ uz sākumu
        </button>
      </div>
    </main>
  </div>
  <div v-else class="shell">
    <!-- Direct #/results visit (e.g. after reload): go home, never blank. -->
    <main class="card results-hero">
      <h1 class="section-title">Sesija beigusies</h1>
      <button type="button" class="btn btn--primary" @click="navigate({ name: 'home' })">
        Uz sākumu
      </button>
    </main>
  </div>
</template>
