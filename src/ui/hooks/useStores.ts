import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import type { FSM } from '@/flow/fsm';
import type { RootStore } from '@/state/RootStore';

// StoresContext — the root providers wrap the app, components read via useStores/useFSM.
export interface UIContext {
  stores: RootStore;
  fsm: FSM;
}

export const UIContextProvider = createContext<UIContext | null>(null);

export function useUI(): UIContext {
  const ctx = useContext(UIContextProvider);
  if (!ctx) throw new Error('[useUI] no provider — wrap <App/> in <UIProvider value={...}>');
  return ctx;
}

export function useStores(): RootStore {
  return useUI().stores;
}

export function useFSM(): FSM {
  return useUI().fsm;
}
