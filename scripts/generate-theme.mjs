#!/usr/bin/env node
// Generate themed background + side decorations + accent art for the Hacksaw-
// style slot layout. Separate from generate-assets.mjs so you can re-run one
// without the other.
//
//   RUNWARE_KEY=sk_... pnpm run assets:theme
//
// Writes:
//   raw-assets/theme/bg-portrait.png    — tall atmospheric background
//   raw-assets/theme/bg-landscape.png   — wide atmospheric background
//   raw-assets/theme/char-left.png      — side decoration left (landscape)
//   raw-assets/theme/char-right.png     — side decoration right (landscape)
//   raw-assets/theme/logo-banner.png    — top banner / game title art

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const KEY = process.env.RUNWARE_KEY;
if (!KEY) {
  console.error('Set RUNWARE_KEY before running.');
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const OUT = resolve(root, 'raw-assets/theme');

const ENDPOINT = 'https://api.runware.ai/v1';
const MODEL = 'runware:100@1';

const ITEMS = [
  {
    id: 'bg-portrait',
    w: 768,
    h: 1280,
    removeBg: false,
    prompt:
      'dramatic ancient stone temple, misty jungle, mayan carvings on stone pillars, ' +
      'dark atmospheric lighting with warm amber and teal rim light, cinematic, ' +
      'vertical composition with empty center space for UI, dark vignette edges, ' +
      'no characters, no text, no logos, concept art, illustration',
  },
  {
    id: 'bg-landscape',
    w: 1280,
    h: 768,
    removeBg: false,
    prompt:
      'dramatic ancient stone temple interior, mayan carvings on stone walls, ' +
      'lush jungle vines in distance, dark atmospheric lighting with warm amber and teal rim light, ' +
      'cinematic horizontal composition with empty center for UI, dark vignette edges, ' +
      'no characters, no text, concept art, illustration',
  },
  {
    id: 'char-left',
    w: 512,
    h: 1024,
    removeBg: true,
    prompt:
      'tall ornate ancient mayan stone guardian statue, warrior with feathered headdress, ' +
      'full body, facing right, stone texture, eroded carvings, dark, dramatic rim lighting, ' +
      'isolated on plain white background, game asset, illustration',
  },
  {
    id: 'char-right',
    w: 512,
    h: 1024,
    removeBg: true,
    prompt:
      'tall ornate ancient mayan stone guardian statue, warrior with feathered headdress, ' +
      'full body, facing left, stone texture, eroded carvings, dark, dramatic rim lighting, ' +
      'isolated on plain white background, game asset, illustration',
  },
  {
    id: 'logo-banner',
    w: 1024,
    h: 512,
    removeBg: true,
    prompt:
      'fantasy slot game logo title SLOTPLATE, bold 3D chiseled stone gold letters, ' +
      'ornate mayan ribbon banner, radiant sunburst behind letters, ' +
      'isolated on plain white background, game logo, illustration',
  },
  {
    id: 'buy-bonus-badge',
    w: 512,
    h: 512,
    removeBg: true,
    prompt:
      'round gold coin emblem labeled BUY BONUS, ornate celtic/mayan rim, ' +
      'sparkling treasure, isolated on plain white background, game icon, vector style',
  },
];

async function runwareCall(body) {
  const r = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Runware HTTP ${r.status}: ${await r.text()}`);
  const json = await r.json();
  if (json.errors?.length) throw new Error(`Runware errors: ${JSON.stringify(json.errors)}`);
  return json;
}

async function generate(prompt, w, h) {
  const json = await runwareCall([
    {
      taskType: 'imageInference',
      taskUUID: randomUUID(),
      positivePrompt: prompt,
      width: w,
      height: h,
      model: MODEL,
      numberResults: 1,
      outputType: 'URL',
      outputFormat: 'PNG',
    },
  ]);
  const url = json?.data?.[0]?.imageURL;
  if (!url) throw new Error(`no imageURL: ${JSON.stringify(json)}`);
  return url;
}

async function removeBg(inputUrl) {
  const json = await runwareCall([
    {
      taskType: 'imageBackgroundRemoval',
      taskUUID: randomUUID(),
      inputImage: inputUrl,
      outputType: 'URL',
      outputFormat: 'PNG',
    },
  ]);
  return json?.data?.[0]?.imageURL;
}

async function download(url, dest) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download failed ${r.status}`);
  await writeFile(dest, Buffer.from(await r.arrayBuffer()));
}

async function main() {
  await mkdir(OUT, { recursive: true });
  for (const item of ITEMS) {
    const dest = resolve(OUT, `${item.id}.png`);
    process.stdout.write(`  ${item.id} (${item.w}x${item.h}) … `);
    try {
      let url = await generate(item.prompt, item.w, item.h);
      process.stdout.write('gen✓ ');
      if (item.removeBg) {
        url = await removeBg(url);
        if (!url) throw new Error('bg-rm returned no url');
        process.stdout.write('bg-rm✓ ');
      }
      await download(url, dest);
      console.log('saved');
    } catch (err) {
      console.log(`FAIL: ${err instanceof Error ? err.message : err}`);
    }
  }
  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
