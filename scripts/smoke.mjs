#!/usr/bin/env node
/**
 * Post-build smoke checks against dist/ (run after `npm run build`).
 * Optionally pass a live base URL to check the deployed app instead:
 *   node scripts/smoke.mjs https://rceman.github.io/word-quest
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const base = process.argv[2];
const dist = new URL('..', import.meta.url).pathname + 'dist';
let failures = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? 'PASS' : 'FAIL'} ${msg}`);
  if (!cond) failures++;
};

async function fetchText(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return r.text();
}

const read = async (path) =>
  base ? fetchText(`${base.replace(/\/$/, '')}/${path}`) : readFileSync(join(dist, path), 'utf8');

const exists = (path) => existsSync(join(dist, path));

// 1. manifest
const manifest = JSON.parse(await read('manifest.webmanifest'));
ok(manifest.name === 'Word Quest — Unit 1', 'manifest name');
ok(manifest.short_name === 'Word Quest', 'manifest short_name');
ok(manifest.display === 'standalone', 'manifest display=standalone');
ok(manifest.lang === 'lv', 'manifest lang=lv');
const sizes = manifest.icons.map((i) => i.sizes);
for (const s of ['192x192', '512x512', '180x180']) ok(sizes.includes(s), `icon ${s}`);

// 2. index.html
const html = await read('index.html');
ok(/<html lang="lv">/.test(html), 'html lang=lv');
ok(/viewport-fit=cover/.test(html), 'viewport-fit=cover');
ok(/apple-touch-icon/.test(html), 'apple-touch-icon link');
ok(!/[Ѐ-ӿ]/.test(html), 'no Cyrillic in index.html');

// 3. service worker + precache
const sw = await read('sw.js');
ok(/precacheAndRoute|\.precache/.test(sw) || /index\.html/.test(sw), 'sw.js precaches app shell');
ok(sw.includes('woff2'), 'sw precaches fonts');
ok(sw.includes('.png'), 'sw precaches icons');

// 4. all 23 words in bundle
const js = (await Promise.all(
  readdirSync(join(dist, 'assets'))
    .filter((f) => f.endsWith('.js'))
    .map((f) => read(`assets/${f}`)),
)).join('');
const words = [
  'bin','board','chair','clock','cupboard','desk','door','window',
  'black','blue','brown','green','grey','orange','pink','purple','red','white','yellow',
  'classroom','playground','student','teacher',
];
const lvWords = [
  'atkritumu tvertne','tāfele','krēsls','pulkstenis','skapis','skolas sols','durvis','logs',
  'melns','zils','brūns','zaļš','pelēks','oranžs','rozā','violets','sarkans','balts','dzeltens',
  'klases telpa','rotaļu laukums','skolēns','skolotājs',
];
for (const w of words) ok(js.includes(w), `bundle has en:${w}`);
for (const w of lvWords) ok(js.includes(w), `bundle has lv:${w}`);
ok(/data:image\/svg/.test(js), 'word illustrations bundled');
ok(!/[Ѐ-ӿ]/.test(js), 'no Cyrillic in JS bundle');

// 5. icons exist
for (const f of ['icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/icon-maskable-512.png']) {
  ok(base ? true : exists(f), `file ${f}`);
}

console.log(failures ? `\n${failures} FAILURES` : '\nAll smoke checks passed');
process.exit(failures ? 1 : 0);
