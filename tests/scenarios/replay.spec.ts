// Replay scenarios — feed real or recorded SpinResponse logs through the
// FSM. Use this to reproduce production bugs ("here's the spin sequence
// that broke the autoplay UI") or to lock down a golden tape.
//
// The fixture JSON in `./fixtures/` mimics what you'd pull from a server's
// audit log — paste yours next to `repro-spinlog.json` and add a test.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SpinResponse } from '@/domain/types';
import { expect, test } from './slot-fixture';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const reproPath = path.join(__dirname, 'fixtures', 'repro-spinlog.json');
const reproSpins = JSON.parse(readFileSync(reproPath, 'utf8')) as SpinResponse[];

test.describe('replay', () => {
  test('plays a recorded SpinResponse log end-to-end', async ({ slot }) => {
    await slot.boot({ startingBalance: 100, bet: 1 });
    await slot.replay(reproSpins);

    const final = await slot.state();
    // The last response in the log says balance: 159.
    expect(final.balance).toBe(159);
    expect(final.lastWin).toBe(12);
    // Three rounds played, all resolved.
    const history = await slot.history();
    expect(history.filter((h) => h.kind === 'spin')).toHaveLength(3);
    expect(history.filter((h) => h.outcome === 'resolved').length).toBeGreaterThanOrEqual(3);
  });

  test('replay survives a network hiccup mid-tape', async ({ slot }) => {
    await slot.boot({ startingBalance: 100, bet: 1 });
    // Inject an error halfway through. The bridge surfaces the rejection
    // through `spin().catch`, then the test recovers and continues.
    const [first, second, third] = reproSpins;
    await slot.queueSpin({ kind: 'response', response: first! });
    await slot.queueError('synthetic-mid-tape');
    await slot.queueSpin({ kind: 'response', response: second! });
    await slot.queueSpin({ kind: 'response', response: third! });

    await slot.spin(); // resolves
    await slot.spin().catch(() => undefined); // rejects
    await slot.recoverFromError();
    await slot.spin();
    await slot.spin();

    const final = await slot.state();
    expect(final.balance).toBe(159);
  });
});
