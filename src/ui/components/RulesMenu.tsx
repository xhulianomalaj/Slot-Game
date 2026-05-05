import { useT } from '@/i18n/useT';
import { observer } from '@/ui/hooks/useObserver';
import { useStores } from '@/ui/hooks/useStores';
import { RenderBlock } from '@/ui/rules/blocks';
import { RULES } from '@/ui/rules/config';
import { IconClose } from './Icons';

export const RulesMenu = observer(() => {
  const { ui } = useStores();
  const t = useT();
  if (!ui.rulesOpen) return null;

  const active = RULES.find((s) => s.id === ui.rulesTab) ?? RULES[0];
  if (!active) return null;

  return (
    <div class="fullscreen rules" data-testid="rules-menu" role="dialog" aria-label={t('rules.title')}>
      <div class="fullscreen__header">
        <div class="fullscreen__title">{t('rules.title')}</div>
        <button
          type="button"
          class="icon-btn"
          aria-label={t('menu.close')}
          data-testid="rules-close"
          onClick={() => ui.closeRules()}
        >
          <IconClose />
        </button>
      </div>

      <div class="rules-tabs" role="tablist" aria-label={t('rules.title')}>
        {RULES.map((section) => (
          <button
            key={section.id}
            type="button"
            role="tab"
            aria-selected={ui.rulesTab === section.id}
            class={`rules-tab ${ui.rulesTab === section.id ? 'rules-tab--active' : ''}`.trim()}
            data-testid={`rules-tab-${section.id}`}
            onClick={() => ui.setRulesTab(section.id)}
          >
            {t(section.titleKey)}
          </button>
        ))}
      </div>

      <div class="rules-body" role="tabpanel" data-testid={`rules-panel-${active.id}`}>
        {active.blocks.map((block, i) => (
          <div class="rb" key={i}>
            <RenderBlock block={block} />
          </div>
        ))}
      </div>
    </div>
  );
});
