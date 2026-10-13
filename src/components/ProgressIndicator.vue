<script setup lang="ts">
defineProps<{ current: number; total: number; label?: string }>();
</script>

<template>
  <div class="progress-indicator" role="status" :aria-label="`${label ?? 'Progress'}: ${current} no ${total}`">
    <div class="progress-track">
      <div
        class="progress-fill"
        :style="{ width: `${total ? Math.min(100, (current / total) * 100) : 0}%` }"
      />
    </div>
    <span class="progress-text">{{ current }}/{{ total }}</span>
  </div>
</template>

<style scoped>
.progress-indicator {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 140px;
}
.progress-text {
  font-weight: 800;
  color: var(--ink-soft);
  font-size: 1rem;
  white-space: nowrap;
}
.progress-track {
  flex: 1;
  margin-top: 0;
}
</style>
