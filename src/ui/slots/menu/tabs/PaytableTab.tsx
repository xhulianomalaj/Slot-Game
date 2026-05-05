import type { JSX } from 'preact';
import { GAME } from '@/config/gameConfig';
import { PAYTABLE } from '@/config/paytable';
import { observer } from '@/ui/hooks/useObserver';
import { useStores } from '@/ui/hooks/useStores';

function fmtCurrency(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
  } catch {
    return `${currency} ${n.toLocaleString()}`;
  }
}

export const PaytableTab = observer((): JSX.Element => {
  const { ui } = useStores();
  return (
    <div>
      <div class="sp-pt-stats">
        <Stat label="Lines" value={PAYTABLE.lines} />
        <Stat label="Theoretical max win" value={`${PAYTABLE.theoreticalMaxWin.toLocaleString()}× bet`} />
        <Stat label="Platform max win" value={fmtCurrency(PAYTABLE.platformMaxWin, ui.currency)} />
        <Stat label="Reels" value={`${GAME.columns} × ${GAME.rows}`} />
      </div>
      <table class="sp-pt-table" aria-label="Paytable">
        <thead>
          <tr class="sp-pt-row" data-head="1">
            <th scope="col">Symbol</th>
            <th class="sp-pt-cell" scope="col">
              3×
            </th>
            <th class="sp-pt-cell" scope="col">
              4×
            </th>
            <th class="sp-pt-cell" scope="col">
              5×
            </th>
          </tr>
        </thead>
        <tbody>
          {PAYTABLE.symbols.map((s) => (
            <tr class="sp-pt-row" key={s.id}>
              <td class="sp-pt-symbol">
                <img
                  class="sp-pt-symbol__img"
                  src={`/assets/symbols/${s.id}.png`}
                  alt=""
                  width="28"
                  height="28"
                  onError={(e) => ((e.currentTarget as HTMLImageElement).style.visibility = 'hidden')}
                />
                <span class="sp-pt-symbol__name">{s.label ?? s.id}</span>
              </td>
              {([3, 4, 5] as const).map((n) => {
                const v = s.payouts[n];
                return (
                  <td key={n} class="sp-pt-cell" data-empty={v == null ? '1' : undefined}>
                    {v != null ? `×${v.toLocaleString()}` : '—'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

function Stat({ label, value }: { label: string; value: string | number }): JSX.Element {
  return (
    <div class="sp-pt-stat">
      <div class="sp-pt-stat__label">{label}</div>
      <div class="sp-pt-stat__value">{value}</div>
    </div>
  );
}
