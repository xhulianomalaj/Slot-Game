import type { ComponentType, JSX } from 'preact';
import type { MenuTab } from '@/state/UIStore';
import { InfoIcon, PaytableIcon, SettingsIcon } from './icons';
import { GameInfoTab } from './tabs/GameInfoTab';
import { PaytableTab } from './tabs/PaytableTab';
import { SettingsTab } from './tabs/SettingsTab';

export interface TabEntry {
  id: MenuTab;
  label: string;
  Icon: ComponentType;
  Component: ComponentType;
}

// Add a tab: append a TabEntry. Remove: delete the line + the file.
export const TAB_REGISTRY: TabEntry[] = [
  { id: 'paytable', label: 'Paytable', Icon: PaytableIcon, Component: PaytableTab },
  { id: 'info', label: 'Game info', Icon: InfoIcon, Component: GameInfoTab },
  { id: 'settings', label: 'Settings', Icon: SettingsIcon, Component: SettingsTab },
];

export function findTab(id: MenuTab): TabEntry {
  const t = TAB_REGISTRY.find((x) => x.id === id);
  if (!t) throw new Error(`[menu] unknown tab "${id}"`);
  return t;
}

export function renderTabContent(id: MenuTab): JSX.Element {
  const { Component } = findTab(id);
  return <Component />;
}
