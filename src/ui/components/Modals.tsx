import type { JSX } from 'preact';
import { MenuFull } from './MenuFull';
import { RulesMenu } from './RulesMenu';

/** Composed full-screen overlays. Render once; each is null unless its store flag is on. */
export function Overlays(): JSX.Element {
  return (
    <>
      <MenuFull />
      <RulesMenu />
    </>
  );
}
