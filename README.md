# Word Quest — Unit 1

Angļu valodas (EN→LV) vārdu mācību PWA bērniem (~8 gadi), planšetēm pirmkārt.
23 Unit 1 vārdi trīs nodarbībās: **Lesson 1 · Klases priekšmeti** (8),
**Lesson 3 · Krāsas** (11), **Lesson 5 · Skola** (4).

Live: **https://rceman.github.io/word-quest/**

## Stack

Vue 3 + TypeScript + Vite + vite-plugin-pwa (Workbox generateSW) + Vitest.
Nav backendu, kontu, reklāmu, analītikas — viss progress ir lokāls
(`localStorage`, versijuota shēma `wordquest-progress-v1`).

## Komandas

```bash
npm install
npm run dev       # dev serveris
npm test          # Vitest (domēna + komponentu testi)
npm run build     # vue-tsc + vite build → dist/
npm run preview   # dist/ lokāls preview (base: /word-quest/)
npm run smoke     # pēcbūves smoke checks (manifest, SW, precache)
```

## Struktūra

- `src/data/unit1.ts` — kanoniskās 23 vārdīnes (id, lesson, en, lv, asset/color)
- `src/domain/quiz.ts` — 3 režīmu jautājumu ģeneratori, sesijas plūsma,
  retry plānošana (max 2×), burtu flīžu reduktors
- `src/domain/repetition.ts` — spaced repetition 1→3→7 d., mastery noteikumi
  (≥3 pareizas, ≥2 dienas, ≥1 aktīvā atcerēšanās)
- `src/services/progress.ts` — versijuota localStorage shēma, drošs fallback
- `src/services/speech.ts` — speechSynthesis (en-GB), graceful bez KTT
- `src/views/` — Home / Learn / Quiz / Results / Progress
- `src/assets/words/*.svg` — 12 oriģinālas ilustrācijas (data-URI bundlā)
- `public/icons/` — PWA ikonas (192/512/maskable/apple-touch)

## Offline / iPad

Pēc pirmā ielādes viss strādā bez interneta (app shell + assets precache).
iPad: Safari → **Kopīgot → Pievienot sākuma ekrānam**. TTS izmanto ierīces
balsis — bezsaistē ir best-effort atkarībā no OS.
Piezīme: instalētās PWA un Safari localStorage ir atsevišķi — ieteicams
vienmēr spēlēt no vienas ikonas.

## Deploy

GitHub Pages no `gh-pages` zara (`dist/` saturs saknē, `base=/word-quest/`).
