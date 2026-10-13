<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import type { SpellQuestion, Tile } from '../domain/quiz';
import {
  placeTile,
  removeLastTile,
  removeTile,
  resetTiles,
  tilesToWord,
  type TileInput,
} from '../domain/quiz';

const props = defineProps<{
  question: SpellQuestion;
  targetLength: number;
  locked: boolean;
}>();

const emit = defineEmits<{ submit: [attempt: string] }>();

const input = reactive<TileInput>({ placed: [] });
watch(
  () => props.question,
  () => Object.assign(input, resetTiles()),
  { immediate: true },
);

const placedTiles = computed<Tile[]>(() => {
  const byKey = new Map(props.question.tiles.map((t) => [t.key, t]));
  return input.placed.map((k) => byKey.get(k)!).filter(Boolean);
});

const attempt = computed(() => tilesToWord(input, props.question.tiles));
const full = computed(() => input.placed.length === props.targetLength);

function tapTile(t: Tile) {
  if (props.locked || input.placed.length >= props.targetLength) return;
  Object.assign(input, placeTile(input, t));
}

function tapPlaced(t: Tile) {
  if (props.locked) return;
  Object.assign(input, removeTile(input, t));
}

function undo() {
  if (props.locked) return;
  Object.assign(input, removeLastTile(input));
}

function reset() {
  if (props.locked) return;
  Object.assign(input, resetTiles());
}
</script>

<template>
  <div>
    <div
      class="spell-answer"
      role="group"
      :aria-label="`Tava atbilde: ${attempt || 'tukša'}`"
    >
      <button
        v-for="t in placedTiles"
        :key="t.key"
        type="button"
        class="tile tile--placed"
        :disabled="locked"
        :aria-label="`Burts ${t.letter}, noņemt`"
        @click="tapPlaced(t)"
      >
        {{ t.letter }}
      </button>
      <span v-if="!placedTiles.length" class="muted" style="align-self: center; font-weight: 700">
        Pieskaries burtiem
      </span>
    </div>

    <div class="tile-tray" role="group" aria-label="Burtu izvēle">
      <button
        v-for="t in question.tiles"
        :key="t.key"
        type="button"
        class="tile"
        :disabled="locked || input.placed.includes(t.key) || input.placed.length >= targetLength"
        :aria-label="`Burts ${t.letter}`"
        @click="tapTile(t)"
      >
        {{ t.letter }}
      </button>
    </div>

    <div class="spell-tools">
      <button
        type="button"
        class="btn btn--ghost btn--small"
        :disabled="locked || !input.placed.length"
        @click="undo"
      >
        ⌫ Dzēst
      </button>
      <button
        type="button"
        class="btn btn--ghost btn--small"
        :disabled="locked || !input.placed.length"
        @click="reset"
      >
        No jauna
      </button>
      <button
        type="button"
        class="btn btn--primary btn--small"
        :disabled="locked || !full"
        @click="emit('submit', attempt)"
      >
        Pārbaudīt
      </button>
    </div>
  </div>
</template>
