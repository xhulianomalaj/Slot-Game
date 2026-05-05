// Tiny DI container. Services are registered once in composition.ts and
// looked up everywhere else. No reflection, no decorators, no magic.
//
// Two key forms are supported:
//   - Typed tokens (preferred): `container.get(Tokens.Network)` — the
//     type is inferred from the token, so typos and bad casts surface at
//     compile time. See `./tokens.ts`.
//   - String keys: `container.get<T>('myKey')` — legacy / ad-hoc.

import type { Token } from './tokens';

type Factory<T> = () => T;
type Key<T> = string | Token<T>;

export class Container {
  private factories = new Map<Key<unknown>, Factory<unknown>>();
  private instances = new Map<Key<unknown>, unknown>();

  register<T>(key: Token<T>, factory: Factory<T>): void;
  register<T>(key: string, factory: Factory<T>): void;
  register<T>(key: Key<T>, factory: Factory<T>): void {
    if (this.factories.has(key)) {
      throw new Error(`[Container] already registered: ${describe(key)}`);
    }
    this.factories.set(key, factory);
  }

  get<T>(key: Token<T>): T;
  get<T>(key: string): T;
  get<T>(key: Key<T>): T {
    if (this.instances.has(key)) return this.instances.get(key) as T;
    const factory = this.factories.get(key);
    if (!factory) {
      throw new Error(`[Container] not registered: ${describe(key)}. Did you wire it in composition.ts?`);
    }
    const instance = factory();
    this.instances.set(key, instance);
    return instance as T;
  }

  has<T>(key: Key<T>): boolean {
    return this.factories.has(key);
  }
}

function describe(key: Key<unknown>): string {
  return typeof key === 'symbol' ? key.toString() : String(key);
}
