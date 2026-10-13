<script setup lang="ts">
const emit = defineEmits<{ close: [] }>();

const isStandalone =
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true);
</script>

<template>
  <div class="dialog-backdrop" @click.self="emit('close')">
    <div class="dialog" role="dialog" aria-labelledby="install-title">
      <h2 id="install-title">Instalē Word Quest</h2>
      <p v-if="isStandalone" class="help-text">
        Lietotne jau ir instalēta — lieliski! Viss progress saglabājas šajā ierīcē.
      </p>
      <template v-else>
        <p class="help-text"><b>iPad / iPhone (Safari):</b></p>
        <p class="help-text">
          Spied <b>Kopīgot</b> (kvadrāts ar bultiņu uz augšu) →
          <b>Pievienot sākuma ekrānam</b>. Pēc tam atver no ikonas — spēle strādās
          arī bez interneta.
        </p>
        <p class="help-text"><b>Android (Chrome):</b></p>
        <p class="help-text">
          Spied izvēlni <b>⋮</b> → <b>Instalēt lietotni</b> jeb
          <b>Pievienot sākuma ekrānam</b>.
        </p>
        <p class="help-text">
          Ieteikums: progress saglabājas tajā pašā lietotnē/pārlūkā, kurā spēlē —
          vienmēr atver no vienas un tās pašas ikonas.
        </p>
      </template>
      <div class="btn-row">
        <button type="button" class="btn btn--primary" @click="emit('close')">Labi!</button>
      </div>
    </div>
  </div>
</template>
