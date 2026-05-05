import type { JSX } from 'preact';

export function Toggle({ on, onChange, label }: { on: boolean; onChange: () => void; label?: string }): JSX.Element {
  return (
    <button
      type="button"
      class="sp-toggle"
      role="switch"
      aria-checked={on}
      aria-label={label}
      data-on={on ? '1' : undefined}
      onClick={onChange}
    />
  );
}

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (v: T) => void;
}): JSX.Element {
  return (
    <div class="sp-seg" role="radiogroup">
      {options.map((o) => (
        // biome-ignore lint/a11y/useSemanticElements: chip-styled segmented control via role=radio
        <button
          key={o.value}
          type="button"
          class="sp-seg__btn"
          role="radio"
          aria-checked={o.value === value}
          data-active={o.value === value ? '1' : undefined}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Slider({
  value,
  onChange,
  disabled,
  ariaLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  ariaLabel?: string;
}): JSX.Element {
  const pct = Math.round(value * 100);
  return (
    <>
      <input
        type="range"
        class="sp-slider"
        min={0}
        max={100}
        step={1}
        value={pct}
        disabled={disabled}
        aria-label={ariaLabel}
        onInput={(e) => onChange((e.currentTarget as HTMLInputElement).valueAsNumber / 100)}
      />
      <span class="sp-slider-value">{pct}</span>
    </>
  );
}
