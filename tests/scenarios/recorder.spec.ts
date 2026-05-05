// Recorder scenario — proves QA can capture an interactive session and
// export a runnable Playwright spec without writing code.

import { Grids } from './_fixtures';
import { expect } from './_matchers';
import { test } from './slot-fixture';

test.describe('recorder', () => {
  test('captures every action and formats as a spec file', async ({ slot }) => {
    await slot.boot({ startingBalance: 100, bet: 1 });

    await slot.startRecording();

    // Simulate a QA poking at the inspector: queue → spin → click → setBet.
    await slot.queueLoss(Grids.neutralLoss);
    await slot.spin();
    await slot.clickPixi('autoplay');
    await slot.setBet(2);
    await slot.clickPixi('autoplay'); // toggle off

    await slot.stopRecording();

    const buffer = await slot.getRecording();
    const methods = buffer.map((a) => a.method);
    expect(methods).toContain('queueLoss');
    expect(methods).toContain('spin');
    expect(methods).toContain('clickPixi');
    expect(methods).toContain('setBet');

    const spec = await slot.formatAsSpec('hello-recorded');
    // The exported spec must compile-shape: an `import`, a `test(...)` block,
    // and at least one bridge call.
    expect(spec).toContain("import { expect, test } from './slot-fixture'");
    expect(spec).toContain("test('hello-recorded'");
    expect(spec).toContain('await slot.boot');
    expect(spec).toContain('slot.spin()');
  });

  test('expect(slot) custom matchers narrate state', async ({ slot }) => {
    await slot.boot({ startingBalance: 100, bet: 1 });
    await slot.queueLoss(Grids.neutralLoss);
    await slot.spin();

    await expect(slot).toBeAtPhase('idle');
    await expect(slot).toShowBalance(99);
    await expect(slot).toShowLastWin(0);
    await expect(slot).toBeSpinning(false);
    await expect(slot).toHaveLabel('spin');
    await expect(slot).toCompleteRoundFasterThan(100);
  });

  test('audio cues land in the audio log', async ({ slot }) => {
    await slot.boot();
    await slot.recordAudio('click', { volume: 0.7 });
    await slot.recordAudio('win-show', { volume: 0.85 });
    const log = await slot.audioLog();
    expect(log.map((e) => e.name)).toEqual(['click', 'win-show']);
    expect(log[1]?.meta?.volume).toBe(0.85);
  });

  test('snapshotCanvas returns a PNG data URL', async ({ slot }) => {
    await slot.boot();
    const dataUrl = await slot.snapshotCanvas();
    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
    expect(dataUrl?.length).toBeGreaterThan(100);
  });
});
