<script setup lang="ts">
import { watch } from 'vue';
import { route } from './router';
import { app, speech } from './state';
import HomeView from './views/HomeView.vue';
import LearnView from './views/LearnView.vue';
import QuizView from './views/QuizView.vue';
import ResultsView from './views/ResultsView.vue';
import ProgressView from './views/ProgressView.vue';

watch(
  () => app.soundOn,
  (on) => speech.setEnabled(on),
  { immediate: true },
);
</script>

<template>
  <HomeView v-if="route.name === 'home'" />
  <LearnView v-else-if="route.name === 'learn'" :lesson-id="route.lesson ?? 1" :key="`learn-${route.lesson}`" />
  <QuizView v-else-if="route.name === 'quiz'" mode="lesson" :lesson-id="route.lesson ?? 1" :key="`quiz-${route.lesson}`" />
  <QuizView v-else-if="route.name === 'review'" mode="review" :key="`review-${app.reviewSessionId}`" />
  <ResultsView v-else-if="route.name === 'results'" />
  <ProgressView v-else-if="route.name === 'progress'" />
  <HomeView v-else />
</template>
