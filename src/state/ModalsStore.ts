import { action, makeObservable, observable } from 'mobx';
import type { JSX } from 'preact';

export type ModalIcon = 'info' | 'warning' | 'error' | 'success' | { src: string };
export type ModalButtonKind = 'primary' | 'secondary' | 'danger';

export interface ModalButton<T = unknown> {
  label: string;
  kind?: ModalButtonKind;
  /** Resolves the modal's promise with this value when clicked. */
  value?: T;
  /** If true, closes without resolving (treats click as a cancel/dismiss). */
  dismiss?: boolean;
}

export interface ModalSpec<T = unknown> {
  id: string;
  icon?: ModalIcon;
  title?: string;
  description?: string | JSX.Element;
  buttons?: ModalButton<T>[];
  /** Backdrop click + ESC dismiss. Default true. */
  dismissible?: boolean;
}

interface InternalEntry {
  spec: ModalSpec;
  resolve: (value: unknown) => void;
}

let nextId = 1;

/**
 * ModalsStore — imperative modal API backed by an observable stack.
 *
 * Usage:
 *   const v = await modals.show({ title, description, buttons: [...] });
 *   await modals.alert({ title, description });
 *   if (await modals.confirm({ title })) ...
 */
export class ModalsStore {
  stack: ModalSpec[] = [];
  private entries = new Map<string, InternalEntry>();

  constructor() {
    makeObservable(this, {
      stack: observable.shallow,
      _push: action,
      _remove: action,
    });
  }

  show<T = unknown>(spec: Omit<ModalSpec<T>, 'id'> & { id?: string }): Promise<T | undefined> {
    const id = spec.id ?? `modal-${nextId++}`;
    const full: ModalSpec = { dismissible: true, ...spec, id } as ModalSpec;
    return new Promise<T | undefined>((resolve) => {
      this.entries.set(id, { spec: full, resolve: resolve as (v: unknown) => void });
      this._push(full);
    });
  }

  alert(opts: { title?: string; description?: string | JSX.Element; icon?: ModalIcon; ok?: string }): Promise<void> {
    const spec: Omit<ModalSpec<void>, 'id'> = {
      icon: opts.icon ?? 'info',
      buttons: [{ label: opts.ok ?? 'OK', kind: 'primary' }],
    };
    if (opts.title !== undefined) spec.title = opts.title;
    if (opts.description !== undefined) spec.description = opts.description;
    return this.show<void>(spec) as Promise<void>;
  }

  confirm(opts: {
    title?: string;
    description?: string | JSX.Element;
    icon?: ModalIcon;
    confirm?: string;
    cancel?: string;
    danger?: boolean;
  }): Promise<boolean> {
    const spec: Omit<ModalSpec<boolean>, 'id'> = {
      icon: opts.icon ?? 'warning',
      buttons: [
        { label: opts.cancel ?? 'Cancel', kind: 'secondary', value: false },
        { label: opts.confirm ?? 'Confirm', kind: opts.danger ? 'danger' : 'primary', value: true },
      ],
    };
    if (opts.title !== undefined) spec.title = opts.title;
    if (opts.description !== undefined) spec.description = opts.description;
    return this.show<boolean>(spec).then((v) => v === true);
  }

  /** Called by the host when a button is clicked. */
  resolve(id: string, value: unknown): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    entry.resolve(value);
    this.entries.delete(id);
    this._remove(id);
  }

  /** Dismiss top of stack (ESC / backdrop), or a specific id. Resolves with undefined. */
  dismiss(id?: string): void {
    const target = id ?? this.stack[this.stack.length - 1]?.id;
    if (!target) return;
    this.resolve(target, undefined);
  }

  _push(spec: ModalSpec): void {
    this.stack = [...this.stack, spec];
  }

  _remove(id: string): void {
    this.stack = this.stack.filter((m) => m.id !== id);
  }
}
