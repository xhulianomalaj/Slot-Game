// Contract tests — runs against your real server when `RGS_API_URL` is set.
// Without it, the suite skips (CI-friendly).
//
// What's checked: the wire shape the client depends on. If your server
// adds a field, fine — these tests don't break. If it removes or renames
// one, every spin in production fails; better to find out here.
//
// Set in CI:
//   RGS_API_URL=https://staging.example.com/api  pnpm test:contract
//
// Or locally:
//   cp .env.example .env.local
//   echo "RGS_API_URL=..." >> .env.local
//   pnpm test:contract
//
// Skip an individual round-trip with:
//   skipIf(condition)('test name', ...)
//
// The contract intentionally stays narrow — only fields the client reads.

import { describe, expect, it } from 'vitest';
import type { SessionResponse, SpinRequest, SpinResponse } from '@/domain/types';

const BASE_URL = process.env.RGS_API_URL ?? '';
const TOKEN = process.env.RGS_TOKEN;

const skipNoUrl = BASE_URL ? describe : describe.skip;

skipNoUrl(`server contract @ ${BASE_URL || '<unset>'}`, () => {
  it('POST /session returns the SessionResponse shape', async () => {
    const res = await post<SessionResponse>('/session', {});
    expect(typeof res.sessionId).toBe('string');
    expect(typeof res.balance).toBe('number');
    expect(typeof res.currency).toBe('string');
    expect(Array.isArray(res.availableBets)).toBe(true);
    expect(typeof res.defaultBet).toBe('number');
    expect(typeof res.columns).toBe('number');
    expect(typeof res.rows).toBe('number');
  });

  it('POST /spin returns the SpinResponse shape (loss or win)', async () => {
    const session = await post<SessionResponse>('/session', {});
    const req: SpinRequest = { bet: session.defaultBet, sessionId: session.sessionId };
    const res = await post<SpinResponse>('/spin', req);

    expect(Array.isArray(res.grid)).toBe(true);
    expect(res.grid.length).toBe(session.columns);
    expect(res.grid[0]?.length).toBe(session.rows);
    expect(typeof res.totalWin).toBe('number');
    expect(Array.isArray(res.winlines)).toBe(true);
    expect(typeof res.balance).toBe('number');

    // If totalWin > 0, every winline matches the contract too.
    if (res.totalWin > 0) {
      for (const w of res.winlines) {
        expect(typeof w.lineId).toBe('number');
        expect(typeof w.symbolId).toBe('string');
        expect(typeof w.matchCount).toBe('number');
        expect(typeof w.amount).toBe('number');
        expect(Array.isArray(w.positions)).toBe(true);
        for (const p of w.positions) {
          expect(typeof p.reel).toBe('number');
          expect(typeof p.row).toBe('number');
        }
      }
    }
  });

  it('balance contract: post-win = post-debit + totalWin', async () => {
    // Pin the convention slotplate's WinShowPhase relies on.
    // SpinResponse.balance MUST be the post-win wallet figure.
    const session = await post<SessionResponse>('/session', {});
    const before = session.balance;
    const res = await post<SpinResponse>('/spin', { bet: session.defaultBet, sessionId: session.sessionId });
    const expected = before - session.defaultBet + res.totalWin;
    expect(res.balance).toBe(expected);
  });
});

async function post<T>(path: string, body: unknown): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (TOKEN) headers.authorization = `Bearer ${TOKEN}`;
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}
