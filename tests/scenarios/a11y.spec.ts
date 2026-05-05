// Accessibility scenarios — the canvas isn't free.
//
// Pixi paints to a single <canvas> element, which by default exposes
// nothing to screen readers or QA tooling. The TestBridge's `a11yTree()`
// returns every labeled `Container` with bounds + visibility — that's
// the contract we lean on for both manual a11y triage and these tests.
//
// If you add a new interactive Pixi node (button, toggle, modal close),
// give it a `.label = '<id>'` and add an entry here.

import { expect, test } from './slot-fixture';

// Structural containers we expect to find but don't assert dimensions on.
// `reels-frame` and `hud` are layout wrappers; their content (the StubReelsEngine,
// the labeled controls) is what carries non-zero bounds in test mode.
const STRUCTURAL = ['background', 'reels-frame', 'hud'] as const;

// Interactive controls — must be visible and have a non-zero hit-box.
const INTERACTIVE = ['spin', 'autoplay', 'bet', 'bet:plus', 'bet:minus', 'balance', 'win'] as const;

test.describe('a11y', () => {
  test('every required Pixi label exists', async ({ slot }) => {
    await slot.boot();
    const labels = new Set(await slot.pixiLabels());
    for (const label of [...STRUCTURAL, ...INTERACTIVE]) {
      expect(labels.has(label), `label "${label}" missing — set .label on the Container`).toBe(true);
    }
  });

  test('every interactive Pixi node has a non-empty bounding box', async ({ slot }) => {
    await slot.boot();
    const tree = await slot.a11yTree();
    const byLabel = new Map(tree.map((n) => [n.label, n] as const));
    for (const label of INTERACTIVE) {
      const node = byLabel.get(label);
      expect(node, `interactive node "${label}" missing`).toBeDefined();
      expect(node?.visible, `${label} must be visible`).toBe(true);
      expect(node?.width, `${label} width`).toBeGreaterThan(0);
      expect(node?.height, `${label} height`).toBeGreaterThan(0);
    }
  });

  test('HUD controls fit inside the canvas (no off-screen clipping)', async ({ slot, page }) => {
    await slot.boot();
    const viewport = page.viewportSize();
    if (!viewport) test.skip();
    const { width: vw, height: vh } = viewport!;

    const tree = await slot.a11yTree();
    const hudControls = tree.filter((n) => ['spin', 'autoplay', 'bet', 'balance', 'win'].includes(n.label));
    expect(hudControls.length).toBeGreaterThan(0);

    for (const c of hudControls) {
      expect(c.x, `${c.label} x`).toBeGreaterThanOrEqual(0);
      expect(c.y, `${c.label} y`).toBeGreaterThanOrEqual(0);
      expect(c.x + c.width, `${c.label} right edge`).toBeLessThanOrEqual(vw);
      expect(c.y + c.height, `${c.label} bottom edge`).toBeLessThanOrEqual(vh);
    }
  });
});
