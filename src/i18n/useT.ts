// Tiny Preact hook over i18next — re-renders on languageChanged.

import { useEffect, useReducer } from 'preact/hooks';
import { i18n } from './index';

type Forcer = (action: number) => void;

function useLangVersion(): void {
  const [, force] = useReducer((x: number) => x + 1, 0) as [number, Forcer];
  useEffect(() => {
    const onChange = () => force(0);
    i18n.on('languageChanged', onChange);
    return () => {
      i18n.off('languageChanged', onChange);
    };
  }, []);
}

export function useT(): (key: string, options?: Record<string, unknown>) => string {
  useLangVersion();
  return (key, options) => (options ? i18n.t(key, options) : i18n.t(key)) as string;
}

/** Reads an array-valued translation (for lists, steps, etc.). */
export function useTArray(): <T = string>(key: string) => T[] {
  useLangVersion();
  return <T = string>(key: string): T[] => {
    const v = i18n.t(key, { returnObjects: true });
    return Array.isArray(v) ? (v as T[]) : [];
  };
}
