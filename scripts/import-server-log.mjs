#!/usr/bin/env node
// Imports a recorded server log (or any sequence of spin payloads) into a
// `SpinResponse[]` JSON file the bridge's `replay()` can play back.
//
// Why: production bug repro. A player files "round 17 didn't credit my
// win" — you grab the audit-log slice, run this, get a JSON file, write
// a one-line spec that calls `slot.replay(log)`, and you can debug locally.
//
// Usage:
//   pnpm run test:import-log <input>  [--out <path>] [--format <fmt>]
//
// Inputs supported:
//   - SpinResponse[]               (already in the right shape — copied through)
//   - { spins: SpinResponse[] }    (envelope object)
//   - { rounds: SpinResponse[] }   (alt envelope)
//   - JSONL                        (one SpinResponse per line)
//
// If `--format` isn't passed, we try to auto-detect.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, basename, join, resolve } from 'node:path';

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : fallback;
}

const positional = process.argv.slice(2).filter((a) => !a.startsWith('--') && !arg('--out', null) || a !== arg('--out', '__none__'));
const inputArg = positional.find((a) => !a.startsWith('--'));
if (!inputArg) {
  console.error('usage: import-server-log <input> [--out <path>] [--format json|jsonl|envelope]');
  process.exit(1);
}

const inputPath = resolve(inputArg);
const formatArg = arg('--format');
const outArg = arg('--out');

const raw = readFileSync(inputPath, 'utf8').trim();

let spins;
const detect = () => {
  if (formatArg) return formatArg;
  if (raw.startsWith('[')) return 'json';
  if (raw.startsWith('{')) return 'envelope';
  return 'jsonl';
};
const format = detect();

switch (format) {
  case 'json':
    spins = JSON.parse(raw);
    break;
  case 'envelope': {
    const obj = JSON.parse(raw);
    spins = obj.spins ?? obj.rounds ?? obj.data?.spins ?? null;
    if (!Array.isArray(spins)) {
      throw new Error(`could not find a spin array in envelope; tried .spins, .rounds, .data.spins. Keys present: ${Object.keys(obj).join(', ')}`);
    }
    break;
  }
  case 'jsonl':
    spins = raw.split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
    break;
  default:
    throw new Error(`unknown format "${format}"`);
}

if (!Array.isArray(spins)) {
  throw new Error('parsed result is not an array');
}

// Validate each entry has the SpinResponse shape — fail loud if not.
const REQUIRED = ['grid', 'totalWin', 'winlines', 'balance'];
const errors = [];
for (let i = 0; i < spins.length; i++) {
  const s = spins[i];
  for (const k of REQUIRED) {
    if (!(k in s)) errors.push(`spin[${i}] missing field: ${k}`);
  }
}
if (errors.length > 0) {
  console.error('invalid SpinResponse entries:');
  for (const e of errors.slice(0, 10)) console.error('  ' + e);
  if (errors.length > 10) console.error(`  …and ${errors.length - 10} more`);
  process.exit(2);
}

const outPath = resolve(
  outArg ?? join(dirname(inputPath), basename(inputPath).replace(/\.\w+$/, '') + '.spinlog.json'),
);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(spins, null, 2));

console.log(`✓ imported ${spins.length} spins from ${inputPath}`);
console.log(`✓ wrote ${outPath}`);
console.log('');
console.log('drop into a spec:');
console.log('');
console.log('    import log from \'./fixtures/' + basename(outPath) + '\';');
console.log('    test(\'replay\', async ({ slot }) => {');
console.log('      await slot.boot({ startingBalance: ' + (spins[0]?.balance ?? 100) + ' });');
console.log('      await slot.replay(log);');
console.log('    });');
