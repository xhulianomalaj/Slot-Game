// Block renderers — one per kind in config.ts. Content comes from i18next.
// Add a new block kind by:
//   1) extending the RuleBlock union in config.ts
//   2) adding a <Component> and mapping it in RenderBlock below

import type { JSX } from 'preact';
import { GAME } from '@/config/gameConfig';
import { useT, useTArray } from '@/i18n/useT';
import { SymbolTile } from '@/ui/components/SymbolTile';
import type { RuleBlock } from './config';

interface PaytableRow {
  symbol: string;
  name: string;
  payouts: string[];
}
interface PaylineDef {
  label: string;
  pattern: number[];
}
interface FeatureDef {
  icon?: 'wild' | 'scatter' | 'bonus';
  title: string;
  body: string;
}
interface StepDef {
  title: string;
  body?: string;
}
interface KvRow {
  key: string;
  value: string;
}

function Heading({ titleKey, subKey }: { titleKey: string; subKey?: string | undefined }): JSX.Element {
  const t = useT();
  return (
    <div class="rb-heading">
      <h3>{t(titleKey)}</h3>
      {subKey && <p>{t(subKey)}</p>}
    </div>
  );
}

function TextBlock({ k }: { k: string }): JSX.Element {
  const t = useT();
  return <p class="rb-text">{t(k)}</p>;
}

function StepsBlock({ k }: { k: string }): JSX.Element {
  const arr = useTArray()<StepDef>(k);
  return (
    <ol class="rb-steps">
      {arr.map((s, i) => (
        <li key={i}>
          <span class="rb-steps__num">{i + 1}</span>
          <div class="rb-steps__body">
            <div class="rb-steps__title">{s.title}</div>
            {s.body && <div class="rb-steps__desc">{s.body}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}

function CalloutBlock({ k, icon }: { k: string; icon?: 'tip' | 'info' | 'warn' | undefined }): JSX.Element {
  const t = useT();
  const title = t(`${k}.title`);
  const body = t(`${k}.body`);
  const iconName = icon ?? 'info';
  return (
    <aside class={`rb-callout rb-callout--${iconName}`}>
      <div class="rb-callout__icon" aria-hidden="true">
        <img
          src={`/assets/icons/${iconName}.png`}
          alt=""
          class="rb-icon-img"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      </div>
      <div class="rb-callout__body">
        <div class="rb-callout__title">{title}</div>
        <div>{body}</div>
      </div>
    </aside>
  );
}

function SymbolLegend(): JSX.Element {
  return (
    <ul class="rb-legend" aria-label="Available symbols">
      {GAME.symbolIds.map((id) => (
        <li class="rb-legend__item" key={id}>
          <SymbolTile symbolId={id} size={64} />
          <span>{id}</span>
        </li>
      ))}
    </ul>
  );
}

function PaytableBlock({ k }: { k: string }): JSX.Element {
  const t = useT();
  const rows = useTArray()<PaytableRow>(`${k}.rows`);
  const cols = ['x2', 'x3', 'x4', 'x5'] as const;
  return (
    <div class="rb-table-wrap">
      <table class="rb-paytable">
        <thead>
          <tr>
            <th>{t(`${k}.columns.symbol`)}</th>
            {cols.map((c) => (
              <th key={c}>{t(`${k}.columns.${c}`)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.symbol}>
              <td class="rb-paytable__name">
                <SymbolTile symbolId={r.symbol} size={36} />
                <span>{r.name}</span>
              </td>
              {cols.map((_, i) => (
                <td key={i}>{r.payouts[i]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PaylinesBlock({ k }: { k: string }): JSX.Element {
  const lines = useTArray()<PaylineDef>(k);
  return (
    <div class="rb-paylines">
      {lines.map((line, idx) => (
        <PaylineViz key={idx} line={line} index={idx} />
      ))}
    </div>
  );
}

function PaylineViz({ line, index }: { line: PaylineDef; index: number }): JSX.Element {
  const rows = GAME.rows;
  const cols = GAME.columns;
  const W = 150;
  const H = 70;
  const cw = W / cols;
  const ch = H / rows;
  const colors = [
    '#ff7a22',
    '#ffb838',
    '#22d3ee',
    '#a78bfa',
    '#22c55e',
    '#ec4899',
    '#60a5fa',
    '#f97316',
    '#10b981',
    '#eab308',
  ];
  const color = colors[index % colors.length];
  const points = line.pattern.map((row, c) => ({
    x: c * cw + cw / 2,
    y: row * ch + ch / 2,
  }));
  const d = points.map((p, i) => (i === 0 ? `M${p.x} ${p.y}` : `L${p.x} ${p.y}`)).join(' ');
  return (
    <div class="rb-payline">
      <svg viewBox={`0 0 ${W} ${H}`} class="rb-payline__svg" aria-hidden="true">
        <rect x="0" y="0" width={W} height={H} rx="6" fill="#171b22" />
        {Array.from({ length: rows * cols }).map((_, i) => {
          const c = i % cols;
          const r = Math.floor(i / cols);
          return (
            <rect
              key={i}
              x={c * cw + 2}
              y={r * ch + 2}
              width={cw - 4}
              height={ch - 4}
              rx="3"
              fill="#222834"
              stroke="#2a2f3a"
              stroke-width="0.6"
            />
          );
        })}
        <path d={d} stroke={color} stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="4" fill={color} />
        ))}
      </svg>
      <div class="rb-payline__label">
        <span class="rb-payline__num">#{index + 1}</span>
        {line.label}
      </div>
    </div>
  );
}

function FeatureBlocks({ k }: { k: string }): JSX.Element {
  const items = useTArray()<FeatureDef>(k);
  return (
    <div class="rb-features">
      {items.map((f, i) => {
        const iconName = f.icon ?? 'bonus';
        return (
          <div class="rb-feature" key={i}>
            <div class={`rb-feature__icon rb-feature__icon--${iconName}`} aria-hidden="true">
              <img
                src={`/assets/icons/${iconName}.png`}
                alt=""
                class="rb-icon-img"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
            <div>
              <div class="rb-feature__title">{f.title}</div>
              <div class="rb-feature__body">{f.body}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function KeyValueBlock({ k }: { k: string }): JSX.Element {
  const rows = useTArray()<KvRow>(k);
  return (
    <dl class="rb-kv">
      {rows.map((r, i) => (
        <div class="rb-kv__row" key={i}>
          <dt>{r.key}</dt>
          <dd>{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function NotesBlock({ k }: { k: string }): JSX.Element {
  const items = useTArray()<string>(k);
  return (
    <ul class="rb-notes">
      {items.map((n, i) => (
        <li key={i}>{n}</li>
      ))}
    </ul>
  );
}

export function RenderBlock({ block }: { block: RuleBlock }): JSX.Element {
  switch (block.kind) {
    case 'heading':
      return <Heading titleKey={block.titleKey} subKey={block.subKey} />;
    case 'text':
      return <TextBlock k={block.key} />;
    case 'steps':
      return <StepsBlock k={block.key} />;
    case 'callout':
      return <CalloutBlock k={block.key} icon={block.icon} />;
    case 'symbolLegend':
      return <SymbolLegend />;
    case 'paytable':
      return <PaytableBlock k={block.key} />;
    case 'paylines':
      return <PaylinesBlock k={block.key} />;
    case 'featureBlocks':
      return <FeatureBlocks k={block.key} />;
    case 'keyValue':
      return <KeyValueBlock k={block.key} />;
    case 'notes':
      return <NotesBlock k={block.key} />;
    default: {
      const _exhaustive: never = block;
      return _exhaustive;
    }
  }
}
