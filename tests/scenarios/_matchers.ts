// Custom Playwright matchers — `expect(slot).toBeAtPhase('idle')`.
//
// Why: Playwright's default `expect(x).toBe(y)` works fine on raw values,
// but reading `(await slot.state()).balance` in every assertion clutters
// specs and gives generic "expected X received Y" messages. These matchers:
//
//   - Auto-poll the bridge state, so a brief race doesn't fail a test.
//   - Print actionable errors that include the relevant snapshot context.
//   - Read like English: `await expect(slot).toShowBalance(99)`.
//
// Imported wherever you `import { expect, test } from './slot-fixture'`.
//
// Usage:
//   await expect(slot).toBeAtPhase('idle');
//   await expect(slot).toShowBalance(99);
//   await expect(slot).toShowLastWin(50);
//   await expect(slot).toBeSpinning(false);
//   await expect(slot).toHaveQueuedSpins(2);
//   await expect(slot).toHaveLabel('spin');
//   await expect(slot).toCompleteRoundFasterThan(50);

import { expect as baseExpect } from '@playwright/test';
import type { SlotDriver } from './slot-fixture';

const POLL_MS = 50;

async function poll<T>(
  fn: () => Promise<T>,
  predicate: (v: T) => boolean,
  timeoutMs: number,
): Promise<{ ok: boolean; last: T }> {
  const start = Date.now();
  let last = await fn();
  while (Date.now() - start < timeoutMs) {
    if (predicate(last)) return { ok: true, last };
    await new Promise((r) => globalThis.setTimeout(r, POLL_MS));
    last = await fn();
  }
  return { ok: predicate(last), last };
}

export const expect = baseExpect.extend({
  async toBeAtPhase(slot: SlotDriver, phase: string) {
    const r = await poll(
      () => slot.state(),
      (s) => s.phase === phase,
      2_000,
    );
    return {
      pass: r.ok,
      message: () => `expected phase "${phase}", got "${r.last.phase}"\n\n${summary(r.last)}`,
      name: 'toBeAtPhase',
    };
  },

  async toShowBalance(slot: SlotDriver, target: number) {
    const r = await poll(
      () => slot.state(),
      (s) => s.balance === target,
      2_000,
    );
    return {
      pass: r.ok,
      message: () => `expected balance ${target}, got ${r.last.balance}\n\n${summary(r.last)}`,
      name: 'toShowBalance',
    };
  },

  async toShowLastWin(slot: SlotDriver, target: number) {
    const r = await poll(
      () => slot.state(),
      (s) => s.lastWin === target,
      2_000,
    );
    return {
      pass: r.ok,
      message: () => `expected lastWin ${target}, got ${r.last.lastWin}\n\n${summary(r.last)}`,
      name: 'toShowLastWin',
    };
  },

  async toBeSpinning(slot: SlotDriver, spinning: boolean) {
    const r = await poll(
      () => slot.state(),
      (s) => s.spinning === spinning,
      2_000,
    );
    return {
      pass: r.ok,
      message: () => `expected spinning=${spinning}, got ${r.last.spinning}\n\n${summary(r.last)}`,
      name: 'toBeSpinning',
    };
  },

  async toHaveQueuedSpins(slot: SlotDriver, count: number) {
    const s = await slot.state();
    return {
      pass: s.queuedSpins === count,
      message: () => `expected queuedSpins=${count}, got ${s.queuedSpins}`,
      name: 'toHaveQueuedSpins',
    };
  },

  async toHaveLabel(slot: SlotDriver, label: string) {
    const labels = await slot.pixiLabels();
    return {
      pass: labels.includes(label),
      message: () => `expected Pixi label "${label}" — labels present: ${labels.join(', ')}`,
      name: 'toHaveLabel',
    };
  },

  async toCompleteRoundFasterThan(slot: SlotDriver, ms: number) {
    const s = await slot.state();
    if (s.lastRoundMs === null) {
      return {
        pass: false,
        message: () => `no completed round to time — make sure spin() resolved before this matcher`,
        name: 'toCompleteRoundFasterThan',
      };
    }
    return {
      pass: s.lastRoundMs < ms,
      message: () => `expected lastRoundMs < ${ms}, got ${s.lastRoundMs}\n\n${summary(s)}`,
      name: 'toCompleteRoundFasterThan',
    };
  },
});

function summary(s: Awaited<ReturnType<SlotDriver['state']>>): string {
  return [
    'state:',
    `  phase=${s.phase}  spinning=${s.spinning}`,
    `  balance=${s.balance}  bet=${s.bet}  lastWin=${s.lastWin}`,
    `  queued=${s.queuedSpins}  pending=${s.pendingNetworkRequests}`,
    `  bootStage=${s.bootStage}`,
  ].join('\n');
}
