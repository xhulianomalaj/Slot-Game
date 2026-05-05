import { useT } from '@/i18n/useT';
import { observer } from '@/ui/hooks/useObserver';
import { useStores } from '@/ui/hooks/useStores';
import { FormSection, LinkRow } from '../form/primitives';

const VERSION = import.meta.env.VITE_APP_VERSION ?? 'dev';

export const HelpTab = observer(() => {
  const { ui } = useStores();
  const t = useT();
  return (
    <div class="menu-pane" data-testid="menu-pane-help">
      <FormSection title={t('menu.help.title')}>
        <LinkRow
          label={t('menu.help.paytable')}
          testId="help-paytable"
          onClick={() => {
            ui.closeMenu();
            ui.openRules('paytable');
          }}
        />
        <LinkRow
          label={t('menu.help.contact')}
          testId="help-contact"
          onClick={() => window.open('mailto:support@example.com', '_blank')}
        />
        <LinkRow label={t('menu.help.faq')} testId="help-faq" onClick={() => alert('FAQ stub')} />
      </FormSection>

      <div class="help-meta">
        <div>
          <dt>{t('menu.help.version')}</dt>
          <dd>{VERSION}</dd>
        </div>
        <div>
          <dt>{t('menu.help.sessionId')}</dt>
          <dd>{ui.sessionId ?? '—'}</dd>
        </div>
      </div>
    </div>
  );
});
