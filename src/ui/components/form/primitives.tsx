// Reusable form primitives for the settings menus. One file so new screens
// stay compact — each Hacksaw-style section is a handful of these.

import type { ComponentChildren, JSX } from 'preact';

// ─── Section heading ──────────────────────────────────────────────
export function FormSection({ title, children }: { title: string; children: ComponentChildren }): JSX.Element {
  return (
    <section class="form-section">
      <h3 class="form-section__title">{title}</h3>
      <div class="form-section__body">{children}</div>
    </section>
  );
}

// ─── Row with label left, control right ──────────────────────────
export function Row({
  label,
  hint,
  icon,
  children,
  testId,
}: {
  label: string;
  hint?: string;
  icon?: ComponentChildren;
  children: ComponentChildren;
  testId?: string;
}): JSX.Element {
  return (
    <div class="form-row" data-testid={testId}>
      {icon && <div class="form-row__icon">{icon}</div>}
      <div class="form-row__label">
        <span>{label}</span>
        {hint && <span class="form-row__hint">{hint}</span>}
      </div>
      <div class="form-row__control">{children}</div>
    </div>
  );
}

// ─── Toggle switch ───────────────────────────────────────────────
export function Toggle({
  on,
  onChange,
  labelOn,
  labelOff,
  testId,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  labelOn?: string;
  labelOff?: string;
  testId?: string;
}): JSX.Element {
  return (
    <button
      type="button"
      class={`toggle ${on ? 'toggle--on' : ''}`.trim()}
      aria-pressed={on}
      onClick={() => onChange(!on)}
      data-testid={testId}
    >
      <span class="toggle__track">
        <span class="toggle__thumb" />
      </span>
      {(labelOn || labelOff) && <span class="toggle__label">{on ? labelOn : labelOff}</span>}
    </button>
  );
}

// ─── Chip group (single-select) ──────────────────────────────────
export function RadioChips<T extends string | number>({
  options,
  value,
  onChange,
  testId,
}: {
  options: Array<{ id: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  testId?: string;
}): JSX.Element {
  return (
    <div class="radio-chips" role="radiogroup" data-testid={testId}>
      {options.map((o) => (
        // biome-ignore lint/a11y/useSemanticElements: chip-styled button + role=radio is the intended pattern
        <button
          key={String(o.id)}
          type="button"
          role="radio"
          aria-checked={o.id === value}
          class={`radio-chip ${o.id === value ? 'radio-chip--active' : ''}`.trim()}
          onClick={() => onChange(o.id)}
          data-testid={testId ? `${testId}-${o.id}` : undefined}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─── Numeric step (used for rounds, limits) ──────────────────────
export function StepRow({
  value,
  onChange,
  min = 0,
  max = 99999,
  step = 1,
  suffix,
  testId,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  testId?: string;
}): JSX.Element {
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  return (
    <div class="step-row" data-testid={testId}>
      <button
        type="button"
        class="step-row__btn"
        aria-label="Decrease"
        onClick={() => onChange(clamp(value - step))}
        disabled={value <= min}
      >
        −
      </button>
      <span class="step-row__value">
        {value.toLocaleString()}
        {suffix && <span class="step-row__suffix">{suffix}</span>}
      </span>
      <button
        type="button"
        class="step-row__btn"
        aria-label="Increase"
        onClick={() => onChange(clamp(value + step))}
        disabled={value >= max}
      >
        +
      </button>
    </div>
  );
}

// ─── Currency input (numeric with symbol) ────────────────────────
export function CurrencyInput({
  value,
  onChange,
  currency = 'USD',
  placeholder,
  testId,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  currency?: string;
  placeholder?: string;
  testId?: string;
}): JSX.Element {
  const sym = (() => {
    try {
      return (
        (0)
          .toLocaleString(undefined, { style: 'currency', currency, minimumFractionDigits: 0 })
          .replace(/\d|[\s,.]/g, '')
          .trim() || '$'
      );
    } catch {
      return '$';
    }
  })();
  return (
    <label class="currency-input" data-testid={testId}>
      <span class="currency-input__sym">{sym}</span>
      <input
        type="number"
        inputMode="decimal"
        step="0.01"
        min={0}
        value={value ?? ''}
        placeholder={placeholder}
        onInput={(e) => {
          const raw = (e.currentTarget as HTMLInputElement).value;
          onChange(raw === '' ? null : Number(raw));
        }}
      />
    </label>
  );
}

// ─── Select (native, styled) ─────────────────────────────────────
export function Select<T extends string | number>({
  value,
  options,
  onChange,
  testId,
}: {
  value: T;
  options: Array<{ id: T; label: string }>;
  onChange: (v: T) => void;
  testId?: string;
}): JSX.Element {
  return (
    <select
      class="form-select"
      value={String(value)}
      data-testid={testId}
      onChange={(e) => {
        const id = (e.target as HTMLSelectElement).value as unknown as T;
        const match = options.find((o) => String(o.id) === String(id));
        if (match) onChange(match.id);
      }}
    >
      {options.map((o) => (
        <option key={String(o.id)} value={String(o.id)}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ─── Link row (external action) ──────────────────────────────────
export function LinkRow({
  label,
  hint,
  onClick,
  testId,
}: {
  label: string;
  hint?: string;
  onClick: () => void;
  testId?: string;
}): JSX.Element {
  return (
    <button type="button" class="form-link-row" onClick={onClick} data-testid={testId}>
      <div class="form-row__label">
        <span>{label}</span>
        {hint && <span class="form-row__hint">{hint}</span>}
      </div>
      <span class="form-link-row__chevron">›</span>
    </button>
  );
}
