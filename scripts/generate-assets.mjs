#!/usr/bin/env node
// Generate sprite symbols + rule icons via the Runware API, with backgrounds
// removed in the same pass. Two-step flow per asset:
//
//   1. imageInference           → generate PNG at a public URL
//   2. imageBackgroundRemoval   → strip the background, return transparent PNG
//
// See https://runware.ai/blog/introducing-layerdiffuse-generate-images-with-built-in-transparency-in-one-step
//
// Usage:
//   RUNWARE_KEY=sk_... pnpm run assets:generate
//
// Writes:
//   raw-assets/symbols/<id>.png   ← reel symbols (transparent)
//   raw-assets/icons/<id>.png     ← rule callout / feature icons (transparent)

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const KEY = process.env.RUNWARE_KEY;
if (!KEY) {
  console.error('Set RUNWARE_KEY before running. Get one at runware.ai.');
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const OUT_SYMBOLS = resolve(root, 'raw-assets/symbols');
const OUT_ICONS = resolve(root, 'raw-assets/icons');

const STYLE =
  'modern slot machine icon, bold vibrant colors, rich gradients, ' +
  'soft rim-lighting, high-contrast edge, centered subject, ' +
  'clean square silhouette, matching set, consistent thickness and shading, ' +
  'plain white background (will be removed), no shadow';

const SYMBOLS = [
  { id: 'cherry', prompt: `glossy red cherries with green stem and leaf, ${STYLE}` },
  { id: 'lemon', prompt: `ripe yellow lemon with leaf, ${STYLE}` },
  { id: 'orange', prompt: `round orange citrus fruit with leaf, ${STYLE}` },
  { id: 'plum', prompt: `deep purple plum fruit with leaf, ${STYLE}` },
  { id: 'bell', prompt: `golden brass bell with clapper, casino style, ${STYLE}` },
  { id: 'bar', prompt: `gold BAR badge, retro slot machine icon, chunky 3D lettering, ${STYLE}` },
  { id: 'seven', prompt: `lucky red number 7, bold serif numeral, chrome outline, slot machine style, ${STYLE}` },
  { id: 'wild', prompt: `rainbow WILD letter mark badge, dynamic gradient outline, sparkles, ${STYLE}` },
  { id: 'scatter', prompt: `radiant golden star burst SCATTER symbol, cosmic sparkles, ${STYLE}` },
];

const ICONS = [
  { id: 'wild', prompt: 'magical letter W emblem, cyan gradient, glow, flat game icon, plain white background' },
  { id: 'scatter', prompt: 'violet star burst emblem, sparks, flat game icon, plain white background' },
  { id: 'bonus', prompt: 'orange gem with star, flat game icon, plain white background' },
  { id: 'tip', prompt: 'gold lightbulb icon with glow, flat game icon, plain white background' },
  { id: 'info', prompt: 'cyan letter i circle icon, flat game icon, plain white background' },
  { id: 'warn', prompt: 'red triangle exclamation warning, flat game icon, plain white background' },
];

const MODEL = 'runware:100@1';
const W = 512;
const H = 512;
const ENDPOINT = 'https://api.runware.ai/v1';

async function runwareCall(body) {
  const r = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${KEY}`,
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Runware HTTP ${r.status}: ${await r.text()}`);
  const json = await r.json();
  if (json.errors?.length) throw new Error(`Runware errors: ${JSON.stringify(json.errors)}`);
  return json;
}

async function generate(prompt) {
  const json = await runwareCall([
    {
      taskType: 'imageInference',
      taskUUID: randomUUID(),
      positivePrompt: prompt,
      width: W,
      height: H,
      model: MODEL,
      numberResults: 1,
      outputType: 'URL',
      outputFormat: 'PNG',
    },
  ]);
  const url = json?.data?.[0]?.imageURL;
  if (!url) throw new Error(`no imageURL in response: ${JSON.stringify(json)}`);
  return url;
}

async function removeBackground(inputUrl) {
  const json = await runwareCall([
    {
      taskType: 'imageBackgroundRemoval',
      taskUUID: randomUUID(),
      inputImage: inputUrl,
      outputType: 'URL',
      outputFormat: 'PNG',
    },
  ]);
  const url = json?.data?.[0]?.imageURL;
  if (!url) throw new Error(`no imageURL in bg-removal response: ${JSON.stringify(json)}`);
  return url;
}

async function download(url, dest) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download failed ${r.status}`);
  const ab = await r.arrayBuffer();
  await writeFile(dest, Buffer.from(ab));
}

async function main() {
  await mkdir(OUT_SYMBOLS, { recursive: true });
  await mkdir(OUT_ICONS, { recursive: true });

  const run = async (set, outDir, label) => {
    for (const item of set) {
      const dest = resolve(outDir, `${item.id}.png`);
      process.stdout.write(`  ${label}/${item.id} … `);
      try {
        const raw = await generate(item.prompt);
        process.stdout.write('gen✓ ');
        const cutout = await removeBackground(raw);
        process.stdout.write('bg-rm✓ ');
        await download(cutout, dest);
        console.log('saved');
      } catch (err) {
        console.log(`FAIL: ${err instanceof Error ? err.message : err}`);
      }
    }
  };

  console.log('Generating symbols (with bg removal):');
  await run(SYMBOLS, OUT_SYMBOLS, 'sym');
  console.log('\nGenerating icons (with bg removal):');
  await run(ICONS, OUT_ICONS, 'icon');
  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
