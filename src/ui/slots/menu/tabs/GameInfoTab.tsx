import type { JSX } from 'preact';
import { GAME_INFO } from '@/config/gameInfo';

export function GameInfoTab(): JSX.Element {
  return (
    <div class="sp-info-blocks">
      {GAME_INFO.map((b, i) => (
        <section class="sp-info-block" key={i}>
          <h3 class="sp-info-block__title">{b.title}</h3>
          <p class="sp-info-block__body">{b.body}</p>
        </section>
      ))}
    </div>
  );
}
