<script setup lang="ts">
import type { WordEntry } from '../data/unit1';

defineProps<{ word: WordEntry }>();
</script>

<template>
  <!-- Color splat with a readable Latvian label — color alone is never the
       only carrier of meaning. -->
  <svg
    class="swatch-svg"
    viewBox="0 0 200 160"
    role="img"
    :aria-label="`${word.lv} — ${word.en}`"
  >
    <path
      :fill="word.color"
      stroke="#2f3a4e"
      stroke-width="4"
      stroke-linejoin="round"
      d="M100 18
         q22 -10 30 10
         q34 -6 32 16
         q30 6 20 26
         q22 18 2 30
         q14 26 -8 30
         q2 26 -22 24
         q-8 20 -30 10
         q-24 12 -34 -6
         q-32 4 -30 -18
         q-26 -10 -16 -28
         q-18 -20 0 -32
         q-8 -24 14 -28
         q4 -26 32 -20
         q12 -14 30 -4 Z"
    />
    <text
      x="100"
      y="88"
      text-anchor="middle"
      font-size="26"
      font-weight="800"
      :fill="word.colorLabelFill"
      stroke="none"
    >
      {{ word.lv }}
    </text>
  </svg>
</template>
